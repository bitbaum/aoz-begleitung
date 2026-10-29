# AccountKit migration staging

The application still authenticates through its existing handlers and cookies.
The additive migration `drizzle/0012_accountkit_identity_staging.sql` only creates
AccountKit's published tables and AOZ's `AccountIdentity` mapping. It does not
copy credentials, activate a second writer, revoke sessions or switch the login
screens. The wider acceptance queue remains in
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

## Before activating the runtime

1. Extend and release AccountKit's shared provisioning contract for an invited
   or code-only user to receive their first password, and for proof of an
   existing account before linking a second AOZ actor. Do not recreate credential
   storage, verification or recovery handlers in AOZ.
2. Resolve verification parity: AOZ's old password login accepts an unverified
   address. AccountKit 0.10.0 requires verification when mail is configured.
   Preserve the imported verification flag and prove a usable verification or
   recovery journey; never set it to true merely to pass sign-in.
3. Wire the shared runtime, mail adapter and account screens. Preserve exact
   code login through AccountKit's domain credential adapter, storing staff-only
   or resident-only restrictions against the shared session before exposing its
   cookie. A code for one actor must not open the other side of a dual account.
4. Read revocable shared sessions on every staff and portal request, reload
   active status, role, site and tenant restrictions, and preserve the read-only
   impersonation boundary. Remove raw resident-cookie and local-JWT authority.
5. Stop legacy auth writes for the final snapshot; reconcile and import once
   under transaction locks, then switch all credential writers together. Record
   counts and constraint checks without publishing account data. If rehearsal
   fails, roll back and keep the legacy deployment authoritative. A rollback
   after shared password changes requires credential reconciliation; it must
   not restore an older password hash.
6. Prove registration, single-use invitations, linking, password/reset/verify,
   logout and revocation, role/site changes, dual identities, code scope,
   impersonation, configured providers and local fallback against the isolated
   database and deployed artifact. Production journeys require an approved
   test identity. Then record exact merge/deploy and journey evidence through
   the Fleet sweep.
