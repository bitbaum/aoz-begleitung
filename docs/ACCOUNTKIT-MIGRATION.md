# AccountKit migration

AOZ answers every sign-in from AccountKit since the switch on 2026-11-02
(loki `accountkit-switch.yml`, `aoz-begleitung switch`): a fresh backup was
restored and rehearsed, 24 identities were imported under a stopped app,
`AUTH_RUNTIME=accountkit` was set, an imported bcrypt account signed in on the
public site, and the digest of every staff member's role, scope, admin flag,
site reach and active flag was the same before and after. Everyone signed in
under the legacy cookies signs in again once. The additive migrations
`drizzle/0012_accountkit_identity_staging.sql` and
`drizzle/0013_accountkit_session_scope.sql` create AccountKit's published
tables, AOZ's `AccountIdentity` mapping and the per-session
`AccountSessionScope`. The wider acceptance queue remains in
[Fleet's checkpoint](https://github.com/bitbaum/fleet/blob/main/docs/remediation-resume-2026-10-29.md).

## Rehearse the import

After applying the ordinary schema migrations to an isolated database containing
an authorized legacy snapshot, run:

```sh
node scripts/db/rehearse-accountkit-import.mjs
```

The command uses `DATABASE_URL`, takes bounded transaction locks, runs the
import assertions and always rolls back. Its output contains only aggregate
counts. There is no apply option. The SQL in
`scripts/db/accountkit-import.sql` is not part of automatic deployment.
Do not copy that SQL into a production migration while legacy authentication
can still write credentials. A rehearsal acquires locks even though it rolls
back; use an isolated snapshot rather than the served database.

The import keeps each existing `Account.id` as the shared user id, copies its
password hash byte for byte and records its staff and resident actor ids in a
single mapping. It retains passwordless invited accounts without fabricating
a password or verification. An actor without an Account receives a namespaced
shared id and a reserved `.invalid` address; that address grants no ownership
or mailbox verification. Product staff permissions remain in `User`, not in
AccountKit's generic role. Deactivated actors are retained for reconciliation,
not granted access.

Repeated imports accept only the same snapshot. Address normalization
collisions, conflicting shared ownership, changed credentials or mappings,
and an already-used shared runtime fail the transaction. Nothing is merged
because two records share an address. The legacy account, actor, claim-invite
and recovery-token records are never modified by this import.

The database tests apply the complete committed migration chain, import
synthetic dual/password/invited/code-only accounts, exercise the real shared
password runtime and recovery, and verify rollback and conflict rejection.
They do not establish production migration or browser evidence.

## Shared runtime

With `AUTH_RUNTIME=accountkit` and `BETTER_AUTH_SECRET` set (the box, since the
switch), the shared runtime in `src/lib/auth/shared/` serves every sign-in:

- `runtime.ts` builds AccountKit with AOZ's mail (fleet mail-kit), the imported
  bcrypt hashes (`legacyBcrypt`), exact code login as a domain credential and
  AccountKit's provisioning for claim links and codes. `/api/auth/[...all]`
  mounts it; with the flag off that path answers 404.
- A code session is bound to its own side in `AccountSessionScope` before its
  cookie is set: a resident code never opens the staff side of a dual account.
  A password sign-in carries both sides.
- Sessions of anyone holding a staff identity keep AOZ's 8-hour idle limit
  (`SESSION_DURATION`, through AccountKit's `sessionLifetime`), borrowed views
  included; resident-only accounts keep AccountKit's 14-day default.
- `identity.ts` answers who a session may act as on every request: active
  status, role, scope, site and unit reach come from the rows, never from the
  session. Identities created after the import are mapped on first use with the
  same namespaced id and `.invalid` address the import gives them.
- A claim (register screen with a code, or a claim link) gives an identity its
  first password through AccountKit. A second identity joins an existing account
  only on that account's own password; an invited account without one recovers
  through its mailbox first. Admin invitations and hand-overs attach the
  address, unverified, to the colleague's shared account.
- "Ansicht wechseln" opens a real shared session for the colleague, scoped to
  their staff side and read-only by its scope row, which the proxy enforces on
  every write. Closing it returns to the administrator's own session only if
  that session still lives.
- The existing screens keep their API: `bridge.ts` answers `/api/auth/login`,
  `/signup`, `/claim`, `/forgot-password` and `/reset-password` from AccountKit.
  With mail configured an unconfirmed address is refused at sign-in with a
  "send the link again" action, and a used reset link confirms the address it
  was sent to (AccountKit 0.11). The self-serve household route refuses while
  the shared runtime is on; it is off for AOZ.

`src/lib/auth/__tests__/accountkit-runtime.test.ts` and
`accountkit-journeys.test.ts` run all of this on the committed migration chain
and the real import SQL. Neither is deployed or browser evidence.

## AccountKit's own screens (with the runtime on)

With `AUTH_RUNTIME=accountkit` the pages render AccountKit's components; with
it off they are the legacy screens, so a rollback of the runtime is a rollback
of the screens too.

- `/login`: the email door is AccountKit's `SignInForm` with every method this
  deployment offers (`src/lib/auth/methods.ts`): password, passkey, an email
  sign-in link and recovery with mail, OrangeCat with `ORANGECAT_OAUTH_*`, the
  shared bitbaum sign-in with `SIGNIN_*` once Morulia publishes a provider. The
  code door stays AOZ's (a domain credential through the bridge), as does the
  `/login?code=…` link. A sign-in lands on `from`, or on `/`, which sends staff
  to their dashboard and residents to the portal.
- `/forgot-password` is AccountKit's recovery form; its link, and old
  `/reset-password?token=…` links, land on `/login`, which sets the password.
- `/konto` (staff, in the user menu) and `/portal/konto` (residents, under
  "Mein Konto") are AccountKit's `AccountPanel`: password, passkeys, a second
  factor, linked sign-ins, sign-out. Names stay on `User` and `Resident`
  (`ownProfile`). Nobody deletes their own login (`accountDeletion: false`):
  identities are provisioned and retired by AOZ, and the panel says whom to ask.
- `/register` (claiming a code) stays AOZ's screen over AccountKit's
  provisioning: AccountKit has no claim or code screen yet
  ([accountkit#67](https://github.com/bitbaum/accountkit/issues/67)).
- With mail, an unconfirmed address is still refused at sign-in
  (`emailConfirmation: 'before-sign-in'`). A code sign-in is refused for anyone
  with a second factor enrolled, and a code session cannot change account
  security (AccountKit's domain-credential rules).

## The switch

It runs on the box through loki's `accountkit-switch.yml`
(`scripts/hetzner/accountkit-cutover.sh`), never by hand: `rehearse` restores
last night's dump into a temporary database, runs the import there with a
throwaway account, prints counts and drops it (the restore proof of the
backup); `switch` takes a fresh dump, rehearses it, stops the app for the
import, sets `AUTH_RUNTIME=accountkit` and proves on the public site that an
imported bcrypt account signs in and that the staff role digest is unchanged;
`rollback` empties `AUTH_RUNTIME` and restarts, and never empties a table.
Everyone signed in under the legacy cookies signs in again once.

A rollback after people changed passwords, added passkeys or set a second
factor through AccountKit needs credential reconciliation: those exist only in
the shared tables. It must not restore an older password hash.
