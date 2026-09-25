-- No religion or origin proxies in anything that decides who lives with whom.
--
-- 1. Food keeps the practical need and loses the belief: a shared kitchen
--    needs to know someone keeps their own pans, never why. HALAL/KOSHER (any
--    case) become SEPARATE_COOKWARE, de-duplicated. The field is no longer
--    scored at all.
UPDATE "Resident"
SET "dietaryNeeds" = ARRAY(
  SELECT DISTINCT CASE WHEN upper(v) IN ('HALAL', 'KOSHER') THEN 'SEPARATE_COOKWARE' ELSE v END
  FROM unnest("dietaryNeeds") AS v
)
WHERE EXISTS (SELECT 1 FROM unnest("dietaryNeeds") AS v WHERE upper(v) IN ('HALAL', 'KOSHER'));--> statement-breakpoint
-- 2. The portal asked residents for flatmates from the "same" or a "different
--    region" and stored the answer as "Kultur: <choice>" inside the free-text
--    roommate preferences. The question is gone; so is every stored answer.
UPDATE "Resident"
SET "roommatePreferences" = NULLIF(
  btrim(regexp_replace("roommatePreferences", '(^|\.\s*)Kultur:\s*[A-Z_]+', '', 'g'), ' .'),
  ''
)
WHERE "roommatePreferences" ~ 'Kultur:\s*[A-Z_]+';--> statement-breakpoint
-- 3. "Kulturelle Region" was captured and never scored — an origin proxy kept
--    for nothing. The column goes.
ALTER TABLE "Resident" DROP COLUMN "culturalRegion";
