# AccountKit migration staging

The application still authenticates through its existing handlers and cookies.
`AUTH_RUNTIME` is unset in every deployment, so nothing below the "Shared
runtime" heading answers yet. The additive migrations
`drizzle/0012_accountkit_identity_staging.sql` and
`drizzle/0013_accountkit_session_scope.sql` create AccountKit's published
tables, AOZ's `AccountIdentity` mapping and the per-session
`AccountSessionScope`. They copy no credentials and switch no screen. The wider acceptance queue remains in
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

## Shared runtime (built, off)

With `AUTH_RUNTIME=accountkit` and `BETTER_AUTH_SECRET` set, the shared runtime
in `src/lib/auth/shared/` serves every sign-in:

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

## Before switching

1. Stop legacy auth writes for the final snapshot; reconcile and import once
   under transaction locks, then set `AUTH_RUNTIME=accountkit` and
   `BETTER_AUTH_SECRET` together, so every credential writer switches at once.
   Record counts and constraint checks without publishing account data. If the
   import fails, roll back and keep the legacy deployment authoritative. A
   rollback after shared password changes requires credential reconciliation;
   it must not restore an older password hash.
2. Everyone signed in under legacy auth is signed out by the switch: legacy
   JWTs and resident cookies are no longer read. Say so to staff beforehand.
3. Prove registration, invitations, linking, password/reset/verify, logout and
   revocation, role/site changes, dual identities, code scope, impersonation and
   local fallback against the deployed artifact with an approved test identity.
   AccountKit's own account screens (passkeys, second factor, session list) and
   configured providers are not yet offered to AOZ users. Then record exact
   merge/deploy and journey evidence through the Fleet sweep.
