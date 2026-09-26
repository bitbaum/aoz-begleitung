/**
 * Brand Configuration — SSOT
 *
 * The product is one thing; the organisation whose name is on it is another.
 * Everything user-visible that names an organisation comes from here, so
 * re-badging is a one-line change (`NEXT_PUBLIC_BRAND`) rather than a sweep
 * through 150 files.
 *
 * Why this exists: the software is shown to AOZ under a neutral brand, and can
 * be handed over badged as AOZ if they want it. Both must be first-class —
 * neither is a "fork" or a patch of the other.
 *
 * What is deliberately NOT in here:
 *  - infrastructure identifiers (repo, deploy app `aoz-wohnen`, domain, the
 *    `aoz_wohnen` database, systemd units). Those are addresses, not branding;
 *    renaming them means DNS, Caddy and service churn for zero user benefit.
 *  - existing resident codes. `codePrefix` applies to NEWLY generated codes
 *    only; login resolves a code by exact string, so codes issued under a
 *    previous brand keep working forever. Nobody is locked out by a rebrand.
 *  - `JWT_ISSUER` ('aoz-housing') and the theme storage key ('aoz-theme').
 *    Rebranding those would invalidate every live session and silently reset
 *    everyone's light/dark preference — a cosmetic change must not log people
 *    out. They are opaque identifiers that users never read.
 *
 * Colours are NOT a field here. They live in `globals.css` as the
 * `--color-brand-*` tokens, because a colour belongs in the stylesheet that
 * also has to express it in light mode, dark mode and at 15% opacity. A brand
 * that wants a different palette adds a `:root[data-brand='<id>']` block; a
 * brand that wants the default palette adds nothing at all.
 */

export type BrandId = 'aoz' | 'wg'

/**
 * Surfaces that differ between an AOZ Standort and a private WG.
 * Each flag hides or shows a real control — never a dormant switch.
 */
export interface BrandFeatures {
  /** Shared-expense split and settle-up. WG yes; AOZ pays the rent. */
  householdMoney: boolean
  /** House votes on UNIT_DECIDES topics. AOZ residents acknowledge, they don't legislate. */
  householdVotes: boolean
  /** Pin chores / expenses / apartment on the portal tab bar. */
  householdPrimaryNav: boolean
  /** Code-first login (printed/SMS code). Email stays available as the other door. */
  codeFirstLogin: boolean
  /** Open matching in compact Top-3 mode. */
  matchingFastDefault: boolean
  /**
   * Sign up with no code at all and create your own household.
   *
   * OFF for AOZ, and that is a safeguarding decision rather than a preference.
   * On an AOZ deployment every identity arrives through intake or a staff
   * invite, and the database holds real asylum seekers' records; a public door
   * that mints identities into it is precisely the thing that must not exist.
   *
   * ON for WG, where the deployment IS a flat and the person signing up is the
   * one who lives there. Note what the flow may create even then: a RESIDENT in
   * the household it just made, never a staff user. Staff permissions are
   * global — `requirePermission` checks a role, not a household — so a
   * self-serve staff account would be able to read every resident in the
   * database. The portal is unit-scoped (`getPortalAuth`), which is why the
   * self-serve door opens onto it and nowhere else.
   */
  selfServeHousehold: boolean
  /**
   * The pilot evaluation instrument: the Mission-KPI block on /analytics and
   * the Pilot-Baseline fieldset on /settings that feeds it.
   *
   * ON for AOZ, because there IS a pilot and it is judged on these numbers —
   * incidents/month, conflict relocations, mediation hours, placement time,
   * each against a manually measured baseline with a reduction target.
   *
   * OFF for WG, and not merely because it is noise. A real shared flat has no
   * baseline month, no Auftraggeber to report to, and nobody was "placed"
   * there — so the block asks a household of four to enter how many conflicts
   * per month they used to have, then charts their own life against a target
   * of minus 30 percent. Measuring a pilot is a thing you do to a programme,
   * not to the people living in it. The whole surface is unavailable rather
   * than empty: an empty chart reads as a feature that is broken, and the
   * settings form would still write pilot fields nothing renders.
   */
  pilotMeasurement: boolean
}

const AOZ_FEATURES: BrandFeatures = {
  householdMoney: false,
  householdVotes: false,
  householdPrimaryNav: false,
  // Email and password open first. A code is still a valid door — every issued
  // code keeps working and the toggle is one tap away — but leading with a
  // form that demands a string nobody can guess makes the product look shut to
  // anyone arriving without a piece of paper.
  codeFirstLogin: false,
  matchingFastDefault: true,
  // See the field docs: a public identity-minting door into a database of
  // asylum seekers' records is not a feature this brand may have.
  selfServeHousehold: false,
  // The AOZ pilot is judged on these numbers. @see CLAUDE.md "Measuring Success"
  pilotMeasurement: true,
}

const WG_FEATURES: BrandFeatures = {
  householdMoney: true,
  householdVotes: true,
  householdPrimaryNav: true,
  codeFirstLogin: false,
  matchingFastDefault: false,
  // A WG deployment IS one flat, and the person signing up lives in it. This
  // is what makes the product usable without an administrator to issue codes.
  selfServeHousehold: true,
  // There is no pilot in a real WG, and no baseline month to compare against.
  pilotMeasurement: false,
}

export interface Brand {
  id: BrandId
  features: BrandFeatures
  /**
   * The acronym driving all compound German copy ("AOZ-Regel",
   * "AOZ-Verwaltung"). One token, many strings. Deliberately not accompanied
   * by per-string fields: config nobody reads is config that drifts, and a
   * field you can set with no visible effect is a trap.
   */
  shortName: string
  /**
   * Prefix for NEWLY generated staff login codes. Never applied retroactively —
   * login resolves a code by exact string, so codes issued under a previous
   * brand keep working. A rebrand must not lock anyone out.
   */
  codePrefix: string
  /**
   * Prefix for NEWLY generated CLIENT/resident login codes.
   *
   * This was a lone `RES-` constant outside the brand config, justified as
   * "residents are not the organisation". But the code is the person's whole
   * identity in this product — it is what staff read on a list and what the
   * person types to log in — and `RES-` is neither German nor the word either
   * register actually uses. AOZ staff say Klient*in (`KL-`); a shared flat says
   * Mitbewohner*in (`MB-`). The prefix is vocabulary, and vocabulary is
   * per-brand, so it belongs here with every other word the product says.
   *
   * Retroactive rules are identical to `codePrefix`: new codes only, and every
   * prefix ever issued stays valid — see `ALL_RESIDENT_CODE_PREFIXES`.
   */
  residentCodePrefix: string
  /**
   * What this register calls the person the product serves, singular.
   *
   * The companion to `residentCodePrefix`: same decision, other half. Without
   * it the login page offered "Als Bewohner:in ausprobieren" — a third
   * gendering convention (colon) beside the product's gender star, naming a
   * role ("Bewohner") that the staff side had already stopped using.
   *
   * Swiss German gender star throughout; never the colon or the interpunct.
   */
  clientTerm: string
  /**
   * The same word, plural. German plurals of gender-star forms are not
   * derivable from the singular by rule (Klient*in → Klient*innen, but
   * Mitbewohner*in → Mitbewohner*innen), and inferring one with a conditional
   * on the singular's value is the hardcoding this config exists to remove.
   */
  clientTermPlural: string
  /** Product name in the chrome, login page and page titles. */
  productName: string
  /**
   * What the CLIENT-facing portal calls itself.
   *
   * Hardcoded as "Mein Zuhause" everywhere until now, which is the household
   * register applied to both products. In a shared flat that is simply true.
   * In an AOZ Unterkunft it is a claim the software has no standing to make:
   * a person in temporary accommodation, whose placement staff can change, is
   * not being asked whether it feels like home — they are being told it is.
   * The neutral register says "Mein Bereich": this part of the tool is yours,
   * which is the only promise the product can actually keep.
   *
   * The page metadata already said "Mein Bereich" while the nav said "Mein
   * Zuhause" — two answers to one question, which is what this field ends.
   *
   * @see portalTitleKey for the translated portal, which must resolve per
   * locale rather than per deployment.
   */
  portalName: string
  /**
   * The i18n key naming the portal, chosen per register.
   *
   * The portal is translated into every origin language, so its title cannot
   * come from a German string in the brand config. The brand selects the KEY;
   * the dictionaries hold the words. One decision, expressed once.
   */
  portalTitleKey: 'portal.title' | 'portal.titleHousehold'
  /** The register line under the product name (login page, titles). */
  tagline: string
  /** Meta description — the org brands sell placement, the WG brand doesn't. */
  metaDescription: string
  /**
   * The RULE-ISSUING ORGANIZATION — distinct from the product. The org-rule
   * catalog, the rule hierarchy copy ("AOZ-Regel", "AOZ-Thema") and the org
   * contact info all name this organization, not the product: the WG-branded
   * product still runs under AOZ's rules. Governance copy must use `orgName`,
   * never `shortName`.
   */
  orgName: string
}

export const BRANDS: Record<BrandId, Brand> = {
  // The original. Preserved exactly — the `:root` palette in globals.css is the
  // AOZ palette byte-for-byte, so handing the product to AOZ is lossless rather
  // than a reconstruction.
  aoz: {
    id: 'aoz',
    shortName: 'AOZ',
    codePrefix: 'AOZ-',
    residentCodePrefix: 'KL-',
    clientTerm: 'Klient*in',
    clientTermPlural: 'Klient*innen',
    productName: 'AOZ Begleitung',
    portalName: 'Mein Bereich',
    portalTitleKey: 'portal.title',
    tagline: 'Integrationsplattform',
    metaDescription:
      'Wohnstabilität sichern, Integrationsfortschritte sichtbar machen und Fachpersonen in einem gemeinsamen Verlauf koordinieren',
    orgName: 'AOZ',
    features: AOZ_FEATURES,
  },

  // Real shared-flat deployments (first: the pilot flat). Same product,
  // different register: nobody in a WG is "placed" by a "system".
  wg: {
    id: 'wg',
    shortName: 'WG',
    codePrefix: 'WG-',
    residentCodePrefix: 'MB-',
    clientTerm: 'Mitbewohner*in',
    clientTermPlural: 'Mitbewohner*innen',
    productName: 'WG Zuhause',
    portalName: 'Mein Zuhause',
    portalTitleKey: 'portal.titleHousehold',
    tagline: 'Gemeinsam wohnen',
    metaDescription:
      'Gemeinsam wohnen, fair geteilt: Ausgaben, Aufgaben und Absprachen für die ganze Wohnung',
    // The WG-branded product runs under AOZ's rule catalog: the product is
    // WG, the organization behind the rules is AOZ.
    orgName: 'AOZ',
    features: WG_FEATURES,
  },
}

/**
 * AOZ is the default: the product IS the AOZ tool, and anything that has not
 * been told otherwise should say so. Another organisation that adopts it gets
 * its own preset here — a name of its own, never a placeholder. The neutral
 * `aozh` badge was retired on 2026-09-26 for exactly that reason: a third name
 * nobody recognised, on a product built for AOZ.
 */
export const DEFAULT_BRAND_ID: BrandId = 'aoz'

/**
 * Every code prefix any brand has ever issued.
 *
 * Consumers that must recognise codes across a rebrand — log redaction, code
 * parsing — read this rather than the active brand. Codes outlive the brand
 * that issued them, so anything matching on `BRAND.codePrefix` alone silently
 * stops working the day the name changes. That is exactly how the log
 * redactor's hardcoded /AOZ-…/ pattern would have started leaking staff codes.
 */
/**
 * Staff prefixes issued by a brand that no longer exists. `AOZH-` was minted
 * while that badge existed, and one live staff code still carries it (measured
 * 2026-09-26); login matches the exact string, so it keeps working — this list
 * keeps it redacted in logs and recognised by parsers.
 */
export const LEGACY_CODE_PREFIXES: readonly string[] = ['AOZH-']

export const ALL_CODE_PREFIXES: readonly string[] = [
  ...Object.values(BRANDS).map((brand) => brand.codePrefix),
  ...LEGACY_CODE_PREFIXES,
]

/**
 * Client/resident code prefixes issued before `residentCodePrefix` existed.
 *
 * Every code in every live database starts with `RES-`. It is retired as a
 * prefix for NEW codes and must never disappear as a prefix that RESOLVES:
 * the people holding those codes have them printed on paper, and login matches
 * the exact string. Dropping it here would lock out every existing resident on
 * the day of a rebrand — the precise failure `ALL_CODE_PREFIXES` was created
 * to prevent on the staff side.
 */
export const LEGACY_RESIDENT_CODE_PREFIXES: readonly string[] = ['RES-']

/**
 * Every client/resident prefix that must be RECOGNISED — current brands plus
 * retired ones. Anything that parses, redacts or cleans up codes reads this;
 * only code GENERATION reads `BRAND.residentCodePrefix`.
 */
export const ALL_RESIDENT_CODE_PREFIXES: readonly string[] = [
  ...Object.values(BRANDS).map((brand) => brand.residentCodePrefix),
  ...LEGACY_RESIDENT_CODE_PREFIXES,
].filter((prefix, index, all) => all.indexOf(prefix) === index)

function resolveBrandId(): BrandId {
  const configured = process.env.NEXT_PUBLIC_BRAND
  if (configured && configured in BRANDS) return configured as BrandId
  return DEFAULT_BRAND_ID
}

/** The brand this deployment runs under. Set `NEXT_PUBLIC_BRAND=aoz` to re-badge. */
export const BRAND: Brand = BRANDS[resolveBrandId()]

/** The AOZ staff/resident surface, as opposed to a private WG. */
export function isAozSurface(brand: Brand = BRAND): boolean {
  return brand.id === 'aoz'
}
