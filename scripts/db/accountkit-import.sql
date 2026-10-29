-- Run only inside a transaction, with legacy auth writes stopped for a cutover.
-- The default CLI rehearsal rolls back. This is deliberately not a deploy migration:
-- old auth still owns credentials until the runtime cutover is ready.
LOCK TABLE "Account", "User", "Resident", users, accounts, sessions,
  passkeys, two_factors, verifications, "AccountIdentity" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE aoz_accountkit_source ON COMMIT DROP AS
SELECT id, lower(trim(email)) AS email, "passwordHash" AS password,
  "emailVerifiedAt" IS NOT NULL AS verified,
  id AS legacy_id, "userId" AS staff_id, "residentId" AS resident_id
FROM "Account"
UNION ALL
SELECT 'aoz-staff:' || s.id, 'aoz-staff-' || lower(s.id) || '@identity.invalid', NULL,
  false, NULL, s.id, NULL
FROM "User" s WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = s.id)
UNION ALL
SELECT 'aoz-resident:' || r.id, 'aoz-resident-' || lower(r.id) || '@identity.invalid', NULL,
  false, NULL, NULL, r.id
FROM "Resident" r WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."residentId" = r.id);

DO $$ BEGIN
  IF EXISTS (SELECT id FROM aoz_accountkit_source GROUP BY id HAVING count(*) > 1)
    OR EXISTS (SELECT email FROM aoz_accountkit_source GROUP BY email HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM aoz_accountkit_source WHERE email = '' OR email NOT LIKE '%@%')
  THEN RAISE EXCEPTION 'Account import requires identity/address reconciliation'; END IF;

  IF EXISTS (
    SELECT 1 FROM users u LEFT JOIN aoz_accountkit_source s ON s.id = u.id
    WHERE s.id IS NULL OR u.email IS DISTINCT FROM s.email
  ) THEN RAISE EXCEPTION 'Account import snapshot differs; no changes committed'; END IF;

  -- This importer is for a stopped legacy deployment, never a second writer
  -- beside an active shared runtime. No reset, factor or provider can be erased.
  IF EXISTS (SELECT 1 FROM sessions) OR EXISTS (SELECT 1 FROM passkeys)
    OR EXISTS (SELECT 1 FROM two_factors) OR EXISTS (SELECT 1 FROM verifications)
    OR EXISTS (SELECT 1 FROM accounts WHERE provider_id <> 'credential')
  THEN RAISE EXCEPTION 'Account import refuses an active shared runtime'; END IF;
END $$;

INSERT INTO users (id, name, email, email_verified)
SELECT id, '', email, verified FROM aoz_accountkit_source
ON CONFLICT DO NOTHING;

INSERT INTO "AccountIdentity" ("sharedUserId", "legacyAccountId", "staffId", "residentId")
SELECT id, legacy_id, staff_id, resident_id FROM aoz_accountkit_source
ON CONFLICT DO NOTHING;

INSERT INTO accounts (id, account_id, provider_id, user_id, password)
SELECT 'aoz-credential:' || id, id, 'credential', id, password
FROM aoz_accountkit_source WHERE password IS NOT NULL
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  -- A repeat is a no-op only for the same snapshot. Drift fails atomically;
  -- it never overwrites a reset password, merges by email or moves an actor.
  IF EXISTS (
    SELECT 1 FROM aoz_accountkit_source s
    LEFT JOIN users u ON u.id = s.id
    LEFT JOIN "AccountIdentity" i ON i."sharedUserId" = s.id
    LEFT JOIN accounts c ON c.user_id = s.id AND c.provider_id = 'credential'
    WHERE u.id IS NULL OR i."sharedUserId" IS NULL
      OR u.email IS DISTINCT FROM s.email
      OR u.email_verified IS DISTINCT FROM s.verified
      OR u.role <> 'customer' OR u.two_factor_enabled
      OR i."legacyAccountId" IS DISTINCT FROM s.legacy_id
      OR i."staffId" IS DISTINCT FROM s.staff_id
      OR i."residentId" IS DISTINCT FROM s.resident_id
      OR c.password IS DISTINCT FROM s.password
      OR (s.password IS NULL AND c.id IS NOT NULL)
      OR (s.password IS NOT NULL AND c.account_id IS DISTINCT FROM s.id)
  ) OR EXISTS (
    SELECT 1 FROM users u WHERE NOT EXISTS (SELECT 1 FROM aoz_accountkit_source s WHERE s.id = u.id)
  ) THEN RAISE EXCEPTION 'Account import snapshot differs; no changes committed'; END IF;
END $$;
