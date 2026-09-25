import { SCORED_FACTOR_COUNT } from '@/lib/config/resident-factors'
import { RESEARCH_SOURCES } from '@/lib/config/algorithm-docs'

/**
 * The SHAPE of the landing copy, separated from any one language's words.
 *
 * It lives in its own file for a boring but load-bearing reason: `marketing.ts`
 * has to import every language file in order to offer them, and every language
 * file has to import this interface in order to satisfy it. With the interface
 * declared in `marketing.ts` that is a cycle, and a cycle here resolves to
 * `undefined` at module-init time rather than failing — the landing page would
 * render blank sections instead of refusing to build.
 */

// Counted from the same config the algorithm runs on — a marketing page that
// hand-writes "27 Faktoren" starts lying the day a factor is added. Exported
// because every language has to state the same number, and a translator
// re-typing "27" into French is exactly the drift this avoids.
/** @see SCORED_FACTOR_COUNT — one definition, re-exported here for existing imports. */
export const FACTOR_COUNT = SCORED_FACTOR_COUNT
export const SOURCE_COUNT = RESEARCH_SOURCES.length

export interface MarketingSection {
  title: string
  body: string
}

export interface MarketingFeature {
  title: string
  body: string
  /** Key into NAV_ICONS — features reuse the navigation's icon set. */
  icon: string
}

export interface MarketingCopy {
  /** Small line above the headline. */
  eyebrow: string
  headline: string
  subline: string
  ctaPrimary: string
  ctaSecondary: string
  ctaNote: string

  problemEyebrow: string
  problemTitle: string
  problems: MarketingSection[]

  howEyebrow: string
  howTitle: string
  steps: MarketingSection[]

  featuresEyebrow: string
  featuresTitle: string
  features: MarketingFeature[]

  scienceEyebrow: string
  scienceTitle: string
  scienceBody: string
  /** The load-bearing design decisions of the matching science, stated plainly. */
  science: MarketingSection[]

  ethicsEyebrow: string
  ethicsTitle: string
  ethicsBody: string
  /** Things the system refuses to record. Stated as a promise, kept as code. */
  neverTracked: string[]

  blogEyebrow: string
  blogTitle: string
  blogLink: string

  /**
   * The section that lists what the product actually contains.
   *
   * Only the FRAME lives here — the eyebrow, the heading, the line under it.
   * The contents come from `lib/config/product-surface.ts`, which reads the
   * navigation, so this section grows when the product does instead of when
   * somebody remembers to edit a paragraph.
   */
  surfaceEyebrow: string
  surfaceTitle: string
  surfaceBody: string
  /**
   * Why the staff column stays German on a French or English page.
   *
   * Not a translation gap being papered over — a fact about the product. The
   * staff interface IS German (`i18n/locales.ts`: caseworkers read German), so
   * a French landing page that translated those menu names would be describing
   * a product that does not exist. The resident column beside it is genuinely
   * translated, because the resident portal genuinely is.
   *
   * Empty string on the German page, where there is nothing to explain.
   */
  surfaceStaffNote: string

  /** The three public product documents, as cards. */
  docsEyebrow: string
  docsTitle: string
  docs: MarketingSection[]

  closingTitle: string
  closingBody: string
}

/**
 * Both registers of one language.
 *
 * The product ships in two registers and they are not interchangeable.
 * `aoz`/`aozh` are shown to an organisation deciding whether to place people
 * with software; `wg` runs in a real shared flat where nobody is "placed" by a
 * "system" and the reader is a person who lives there. The same landing page
 * for both would be wrong for at least one of them — so a language is not
 * finished until it has said both.
 */
export interface MarketingRegisters {
  /** The pitch register: an organisation deciding whether to use this. */
  placement: MarketingCopy
  /** The household register: the people who actually live in the flat. */
  household: MarketingCopy
}
