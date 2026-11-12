import { BRAND } from '@/lib/config/brand'
import { AI_DISCLOSURE_HREF, AI_PROVIDERS_TODAY } from '@/lib/config/ai-disclosure'

/**
 * Who runs this site and what it does with personal data — the one place the
 * Impressum and the Datenschutzerklärung read from.
 *
 * Every sentence here is a fact about THIS deployment that someone opened and
 * checked: the operator and contact, the hosting country, the mail transport,
 * the cookies the code sets. Nothing is boilerplate from a generator, because
 * a privacy statement that promises what the code does not do is worse than
 * none. There is deliberately no company name and no postal address: none
 * exists to print, and inventing one is the failure this file is here to avoid.
 *
 * AI is NOT restated here. `/ki-datenschutz` owns that, rendered from
 * `ai-disclosure.ts`; this page names the providers from the same list and
 * links there, so the two cannot disagree.
 */

export const IMPRESSUM_HREF = '/impressum'
export const PRIVACY_HREF = '/datenschutz'

/** The operator, as publicly named. */
export const OPERATOR = {
  name: 'Cato',
  site: 'orangecat.ch',
  email: 'cato@orangecat.ch',
} as const

export const SOURCE_REPO_URL = 'https://github.com/bitbaum/aoz-begleitung'

/** Who else handles data for this site. AI providers come from ai-disclosure. */
export const PROCESSORS = [
  {
    name: 'Hetzner',
    country: 'Deutschland',
    role: 'Server und Datenbank: Hier liegen alle Daten des Produkts.',
  },
  {
    name: 'Resend',
    country: 'USA',
    role: 'Versand von E-Mails wie Einladungen, Passwort-Rücksetzung und Benachrichtigungen. Übermittelt werden Empfängeradresse und Inhalt der jeweiligen E-Mail.',
  },
  ...AI_PROVIDERS_TODAY.map((provider) => ({
    name: provider.name,
    country: provider.country,
    role: 'KI-Hilfen für Fachpersonen im Testbetrieb. Was übermittelt wird, steht auf der Seite «KI und Datenschutz».',
  })),
] as const

export interface LegalSection {
  id: string
  title: string
  paragraphs: readonly string[]
}

export const LEGAL_LAST_UPDATED = '12. November 2026'

export const IMPRESSUM_COPY = {
  eyebrow: 'Rechtliches',
  title: 'Impressum',
  lead: 'Wer diese Website betreibt und wie Sie diese Person erreichen.',
  sections: [
    {
      id: 'betreiber',
      title: 'Betreiber und Kontakt',
      paragraphs: [
        `Diese Website und die Software «${BRAND.productName}» werden von ${OPERATOR.name} (${OPERATOR.site}) entwickelt und betrieben.`,
        `Kontakt für alle Anliegen, auch zum Datenschutz: ${OPERATOR.email}`,
      ],
    },
    {
      id: 'aoz',
      title: `Verhältnis zur ${BRAND.orgName}`,
      paragraphs: [
        `Die Software ist für die Begleitarbeit der ${BRAND.orgName} gebaut und trägt deshalb deren Namen. Betrieben wird diese Website vom oben genannten Betreiber, nicht von der ${BRAND.orgName}; sie ist kein offizieller Auftritt der ${BRAND.orgName}.`,
      ],
    },
    {
      id: 'quellcode',
      title: 'Quellcode',
      paragraphs: [
        `Der Quellcode ist öffentlich und steht unter der MIT-Lizenz: ${SOURCE_REPO_URL}`,
      ],
    },
  ],
} as const satisfies LegalCopy

export const PRIVACY_COPY = {
  eyebrow: 'Rechtliches',
  title: 'Datenschutzerklärung',
  lead: 'Welche Personendaten diese Website bearbeitet, wozu, wo sie liegen und an wen Sie sich wenden können.',
  sections: [
    {
      id: 'verantwortlich',
      title: 'Verantwortlich',
      paragraphs: [
        `Verantwortlich für die Datenbearbeitung auf dieser Website ist der Betreiber: ${OPERATOR.name} (${OPERATOR.site}), ${OPERATOR.email}. Es gilt das Schweizer Datenschutzgesetz (DSG).`,
      ],
    },
    {
      id: 'oeffentlich',
      title: 'Öffentliche Seiten',
      paragraphs: [
        'Die öffentlichen Seiten (Startseite, Blog, Roadmap, Changelog und die rechtlichen Seiten) sind ohne Konto lesbar. Sie setzen keine Cookies und binden keine Analyse- oder Werbedienste ein. Schriften werden vom eigenen Server geladen, nicht von einem Drittanbieter.',
        'Beim Aufruf einer Seite erhält der Server technisch bedingt Ihre IP-Adresse, den Zeitpunkt und die aufgerufene Adresse, um die Seite auszuliefern.',
        'Ihre Wahl zwischen heller und dunkler Darstellung wird nur in Ihrem Browser gespeichert.',
      ],
    },
    {
      id: 'rueckmeldung',
      title: 'Rückmeldungen',
      paragraphs: [
        'Auf den öffentlichen Seiten wird ein Rückmelde-Fenster von loki.orangecat.ch geladen, einem Dienst desselben Betreibers. Dabei erhält auch dieser Dienst Ihre IP-Adresse. Was Sie dort eingeben und absenden, geht an den Betreiber und dient dazu, Fehler zu beheben. Im angemeldeten Bereich wird dieses Fenster nicht geladen.',
      ],
    },
    {
      id: 'konto',
      title: 'Angemeldeter Bereich',
      paragraphs: [
        'Ein Konto entsteht nur über eine Einladung oder einen persönlichen Code. Bearbeitet werden die Angaben zum Konto (E-Mail-Adresse oder Code; das Passwort nur als nicht umkehrbarer Hashwert) und die Angaben, die Fachpersonen und Klient*innen für die Begleitung erfassen: zum Wohnen, zum Alltag im Haus, zu Lernen und Arbeit sowie Nachrichten und Meldungen.',
        'Nicht erfasst werden medizinische Diagnosen, Religion, politische Überzeugung und Einzelheiten des Asylverfahrens.',
        'Im angemeldeten Bereich werden ausschliesslich technisch notwendige Cookies gesetzt: für die Anmeldung und, im Portal, für die gewählte Sprache.',
      ],
    },
    {
      id: 'empfaenger',
      title: 'Wo die Daten liegen und wer sie erhält',
      paragraphs: [
        'Die Daten werden nicht verkauft und nicht zu Werbezwecken weitergegeben. Folgende Dienstleister bearbeiten Daten im Auftrag; damit gelangen Daten nach Deutschland und, bei E-Mail-Versand und KI-Hilfen, in die USA:',
      ],
    },
    {
      id: 'rechte',
      title: 'Ihre Rechte',
      paragraphs: [
        `Sie können Auskunft über die zu Ihnen bearbeiteten Daten verlangen, sie berichtigen oder löschen lassen. Schreiben Sie dazu an ${OPERATOR.email}.`,
        'Aufsichtsbehörde ist der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB).',
      ],
    },
  ],
} as const satisfies LegalCopy

/** The section of the privacy statement the processor table renders under. */
export const PROCESSORS_SECTION_ID = 'empfaenger'

export const LEGAL_LABELS = {
  updated: 'Stand',
  aiLink: 'KI und Datenschutz',
  aiHref: AI_DISCLOSURE_HREF,
  impressum: 'Impressum',
  privacy: 'Datenschutz',
} as const

interface LegalCopy {
  eyebrow: string
  title: string
  lead: string
  sections: readonly LegalSection[]
}
