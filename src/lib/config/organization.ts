/**
 * Organization Contact & Enforcement — SSOT
 *
 * Who residents actually reach when something breaks, someone is in danger, or
 * a conflict needs a human — and what happens when rules are broken.
 *
 * Source of truth: the official AOZ "Hausordnung" (signed paper document,
 * Stand Januar 2026), page 2 ("Konflikte, Mängel und Schäden", "Sanktionen und
 * Konsequenzen"). Numbers and office hours here are the REAL ones from that
 * document — inventing a plausible-looking phone number is worse than showing
 * none, because a resident in trouble will dial it.
 *
 * This names the rule-issuing ORGANIZATION (BRAND.orgName), not the product:
 * the WG-branded product still runs under AOZ's house rules and AOZ's
 * emergency line. Multi-org support moves this per-org; until then there is
 * exactly one organization and exactly one contact sheet.
 */
import { BRAND } from './brand'

export interface ContactChannel {
  icon: string
  /** What this channel is FOR — residents pick by situation, not by org chart. */
  label: string
  value: string
  sublabel?: string
}

/** Ordered by urgency of the situation, not by organizational hierarchy. */
export const ORG_CONTACT = {
  /** Life-and-limb emergencies — always first, never behind office hours. */
  emergency: {
    police: 'Polizei / Rettung',
    policeNumber: '117 / 144',
    orgLabel: `${BRAND.orgName} Notfall-Nummer`,
    orgNumber: '044 415 63 30',
    orgHours: 'Ausserhalb der Bürozeiten',
  },

  /** Named primitives — consumers that need ONE number reference these. */
  maintenancePhone: '044 415 67 31',
  maintenanceEmail: 'bewirtschaftung@aoz.ch',
  maintenanceHours: 'Bürozeiten: 09:00–11:00 und 14:00–16:00 Uhr',
} as const

/** The display list for the help page — derived, never restated. */
export const ORG_CONTACT_CHANNELS: readonly ContactChannel[] = [
  {
    icon: '💬',
    label: 'Konfliktsituationen (Unstimmigkeiten, Ruhestörung)',
    value: 'Fachbereich Wohnen',
    sublabel: 'Telefonisch über die Betreuung — oder direkt hier im Portal melden',
  },
  {
    icon: '🔧',
    label: 'Schadenfall und Reparaturbedarf',
    value: ORG_CONTACT.maintenancePhone,
    sublabel: ORG_CONTACT.maintenanceHours,
  },
  {
    icon: '📧',
    label: 'Bewirtschaftung per E-Mail',
    value: ORG_CONTACT.maintenanceEmail,
    sublabel: 'Schäden und Reparaturen während der Bürozeiten',
  },
  {
    icon: '📍',
    label: 'Aushang in der Wohnliegenschaft',
    value: 'Alle Kontaktdaten',
    sublabel: 'Jederzeit am Aushang in Ihrem Haus zu finden',
  },
]

/**
 * What happens when rules are broken — shown WITH the rule book, because a
 * consequence nobody was told about is not a consequence, it is a surprise.
 * Wording follows the signed Hausordnung.
 */
export const ORG_ENFORCEMENT = {
  title: 'Sanktionen und Konsequenzen',
  paragraphs: [
    'Verstösse gegen die schweizerische Rechtsordnung (Drohung, Gewalt, Drogenbesitz usw.) werden der Polizei gemeldet.',
    `Verstösse gegen die Hausordnung führen zu einer Verwarnung. Im Wiederholungsfall sowie in schwerwiegenden Fällen kann die ${BRAND.orgName} eine fristlose Kündigung der Unterkunft mit Hausverbot aussprechen.`,
    'Verrechnet werden: Ersatzschlüssel und Türschlösser bei Schlüsselverlust, mutwillige oder durch unsachgemässen Gebrauch verursachte Beschädigungen sowie Folgeschäden aus nicht gemeldeten Mängeln.',
  ],
} as const
