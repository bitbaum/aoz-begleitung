# AOZ Begleitung — Auth Boundary Model (Resident vs Staff)

created_date: 2026-04-01
last_modified_date: 2026-09-07
last_modified_summary: Drei orthogonale Achsen statt einer Rollenliste; LIEGENSCHAFTEN ergänzt.

## User Types

1. **Resident user**
   - Entry: `/portal`
   - Auth: `resident_code` cookie
   - Scope: resident self-service only (`/portal/*`, `/api/portal/*`)

2. **Staff user**
   - Entry: `/login` (code-first on AOZ; email still available)
   - Auth: `staff_session` JWT cookie
   - Scope: admin/staff operations (`/`, `/residents`, `/housing`, ...)
   - Roles: `BETREUUNG`, `SOZIALARBEIT`, `JOBCOACH`, `FREIWILLIGENARBEIT`,
     `LIEGENSCHAFTEN`. Permissions live in `src/lib/auth/role-policy.ts`. The
     enum value `ADMIN` is kept so live JWTs and User rows keep working, and is
     never issued to anyone new.
   - **A role answers ONE question**: which care domain am I staffed for.
     `scope` answers whose files I may open (`OWN_DOMAIN` / `ALL_DOMAINS`) and
     `isSystemAdmin` answers whether I may reconfigure the product. Those two
     axes are what `ADMIN` used to bundle. A team lead is
     `BETREUUNG + ALL_DOMAINS` without the settings page.
   - `LIEGENSCHAFTEN` maps to NO care domain — it runs the housing stock and
     holds no caseload, which is why `STAFF_ROLE_CARE_DOMAIN` is a
     `Partial<Record<…>>` rather than total.
   - **One staff identity, four care domains.** Wohnen, Sozialarbeit, Jobcoach
     and Freiwilligenarbeit are seats on a resident (`CareAssignment`), not
     extra logins.
     Leitung may write every domain; each specialist writes only their own
     (`src/lib/config/care.ts`). Appointments and catalog attributes live on
     the same resident file. An operator who also lives in the house links
     the resident code to the same Account (existing register-with-same-email
     flow). Do not create three User rows for one human.

---

## Boundary Rules

- Resident auth does **not** grant staff access.
- Staff auth does **not** grant resident API access unless resident cookie exists.
- Public routes remain public (`/portal`, `/login`, `/portal/help`, health/auth endpoints).
- Unauthorized resident API access returns **401 JSON** (not redirect HTML).

---

## Expected Behaviors

### Resident side
- Missing resident cookie on `/portal/*` page -> redirect to `/portal`.
- Missing resident cookie on `/api/portal/*` -> `401 { success:false, error:'Nicht angemeldet' }`.

### Staff side
- Missing/invalid staff JWT on protected staff routes -> redirect to `/login?from=...` and clear invalid cookie.

---

## Security Notes

- Middleware does fast boundary checks; route handlers still perform full validation.
- Resident cookie presence is only an entry check; DB existence checks happen in route/auth helpers.
- Rate limiting exists on resident login (`/api/portal/login`).

---

## Next hardening steps

1. Add explicit automated auth-boundary tests for:
   - resident -> staff route denied
   - unauth -> portal API gets 401 JSON
   - repeated invalid resident login -> rate_limited
2. ~~Add minimal staff role gate smoke checks for sensitive staff actions.~~ Done:
   invite (`users:manage`), export (`export:read`), import (`import:write`),
   algorithm and pilot baseline (`system:configure`).
3. Add session-expiry/logout edge-case tests for both user types.
