import { ALL_CODE_PREFIXES, BRANDS, DEFAULT_BRAND_ID, type BrandId } from '../brand'

/**
 * The point of the brand layer is that re-badging is a config change, not a
 * code change. These tests hold that promise: every brand must be complete,
 * and the AOZ preset must stay byte-identical to what AOZ was originally
 * shown — "we can put it back" has to remain true.
 */
describe('brand presets', () => {
  const ids = Object.keys(BRANDS) as BrandId[]

  it('offers AOZ and the WG register, and no placeholder badge', () => {
    // `aozh` was a neutral name nobody recognised; retired 2026-09-26. Another
    // organisation gets a preset with its own name.
    expect(ids.sort()).toEqual(['aoz', 'wg'])
  })

  it.each(['aoz', 'wg'] as const)('%s fills in every field', (id) => {
    const brand = BRANDS[id]
    for (const [key, value] of Object.entries(brand)) {
      expect(`${key}=${value}`).not.toMatch(/=(undefined|null|)$/)
    }
  })

  it('keys each preset by its own id, so lookups cannot silently cross over', () => {
    for (const id of ids) expect(BRANDS[id].id).toBe(id)
  })

  it('preserves the original AOZ wording exactly', () => {
    // If this fails, handing the product to AOZ no longer restores what they saw.
    expect(BRANDS.aoz).toEqual({
      id: 'aoz',
      shortName: 'AOZ',
      codePrefix: 'AOZ-',
      // AOZ staff say Klient*in. The prefix is vocabulary, so it is per brand.
      residentCodePrefix: 'KL-',
      clientTerm: 'Klient*in',
      clientTermPlural: 'Klient*innen',
      productName: 'AOZ Begleitung',
      // Neutral register: an AOZ Unterkunft is not asserted to be someone's
      // home by the software they are required to use.
      portalName: 'Mein Bereich',
      portalTitleKey: 'portal.title',
      tagline: 'Integrationsplattform',
      // Corrected 2026-09-07: this shipped as "Housing-Stabilitaet" — a
      // stripped umlaut, live in the meta description every search engine and
      // link preview read, against this repo's own mandatory Swiss-German
      // rule. The pin is here so the AOZ preset cannot DRIFT; a spelling fix
      // is not drift, so the pin moves with it rather than preserving a
      // misspelling forever. @see constants/__tests__/marketing-copy.test.ts
      metaDescription:
        'Wohnstabilität sichern, Integrationsfortschritte sichtbar machen und Fachpersonen in einem gemeinsamen Verlauf koordinieren',
      orgName: 'AOZ',
      features: {
        householdMoney: false,
        householdVotes: false,
        householdPrimaryNav: false,
        codeFirstLogin: false,
        matchingFastDefault: true,
        // Safeguarding, not preference: AOZ provisions every identity through
        // intake. @see auth/__tests__/household-aoz-gate.test.ts
        selfServeHousehold: false,
        // There is a pilot, and it is judged on these numbers.
        pilotMeasurement: true,
      },
    })
  })

  it('keeps the pilot evaluation instrument off the real-flat brand', () => {
    // A WG has no baseline month and no Auftraggeber. Charting a household of
    // four against "Ziel: -30% Konflikte" measures the residents, not a
    // programme. @see BrandFeatures.pilotMeasurement
    expect(BRANDS.wg.features.pilotMeasurement).toBe(false)
    expect(BRANDS.aoz.features.pilotMeasurement).toBe(true)
  })

  it('gives every brand an explicit answer for every feature flag', () => {
    // A flag added to the interface but forgotten in one preset is `undefined`,
    // which is falsy — the feature would silently vanish for that brand with
    // tsc, ESLint and the render all green.
    const flags = Object.keys(BRANDS.aoz.features) as (keyof typeof BRANDS.aoz.features)[]
    for (const id of ids) {
      for (const flag of flags) {
        expect(typeof BRANDS[id].features[flag]).toBe('boolean')
      }
    }
  })

  it('keeps AOZ as the rule-issuing organization on the WG product brand', () => {
    // The product is WG; the rules are AOZ's. Governance copy reads orgName,
    // so "AOZ-Regel" must survive the WG re-badge.
    expect(BRANDS.wg.orgName).toBe('AOZ')
    expect(BRANDS.wg.shortName).toBe('WG')
  })

  it('keeps the WG register free of placement-system language', () => {
    // A flatmate is not "placed" by a "system" — the real-flat brand must not
    // present the org register.
    const wg = BRANDS.wg
    expect(`${wg.productName} ${wg.tagline} ${wg.metaDescription}`).not.toMatch(/[Pp]latzierung/)
  })

  it('gives each brand a distinct short name and code prefix', () => {
    const shortNames = ids.map((id) => BRANDS[id].shortName)
    const prefixes = ids.map((id) => BRANDS[id].codePrefix)
    expect(new Set(shortNames).size).toBe(ids.length)
    expect(new Set(prefixes).size).toBe(ids.length)
  })

  it('ends every code prefix with a separator so codes stay readable', () => {
    for (const id of ids) expect(BRANDS[id].codePrefix).toMatch(/-$/)
  })

  it('defaults to a brand that exists', () => {
    expect(BRANDS[DEFAULT_BRAND_ID]).toBeDefined()
  })
})

describe('ALL_CODE_PREFIXES', () => {
  /**
   * Codes outlive the brand that issued them. Anything matching on the ACTIVE
   * brand's prefix alone — log redaction was doing exactly this — silently
   * stops working for previously-issued codes the day the product is
   * re-badged. This list is what consumers must read instead.
   */
  it('covers every brand, not just the active one', () => {
    const ids = Object.keys(BRANDS) as BrandId[]
    for (const id of ids) {
      expect(ALL_CODE_PREFIXES).toContain(BRANDS[id].codePrefix)
    }
  })

  it('still recognises codes minted by the retired AOZH badge', () => {
    // One live staff code starts with AOZH- (measured 2026-09-26).
    expect(ALL_CODE_PREFIXES).toEqual(expect.arrayContaining(['AOZ-', 'WG-', 'AOZH-']))
  })
})

describe('brand resolution', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_BRAND

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRAND = ORIGINAL
    vi.resetModules()
  })

  async function loadBrand(value?: string) {
    vi.resetModules()
    if (value === undefined) delete process.env.NEXT_PUBLIC_BRAND
    else process.env.NEXT_PUBLIC_BRAND = value
    return (await import('../brand')).BRAND
  }

  it('re-badges to AOZ from the environment alone', async () => {
    expect((await loadBrand('aoz')).shortName).toBe('AOZ')
  })

  it('uses the neutral brand by default', async () => {
    expect((await loadBrand(undefined)).id).toBe(DEFAULT_BRAND_ID)
  })

  it('falls back rather than crashing on an unknown brand', async () => {
    // A typo in an env var must not take the whole app down — and neither must
    // a retired brand id left behind in a deployed .env.
    expect((await loadBrand('not-a-brand')).id).toBe(DEFAULT_BRAND_ID)
    expect((await loadBrand('aoch')).id).toBe(DEFAULT_BRAND_ID)
  })
})
