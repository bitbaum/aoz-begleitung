/**
 * What this product does with AI — the single list every disclosure reads.
 *
 * Until 2026-09-25 the AI was disclosed nowhere but one changelog line: staff
 * typed intake notes into a form assistant, asked a chat assistant about the
 * register, and Einsatzplatz listings were machine-translated, all through
 * free test access at US providers, and no screen said so.
 *
 * The public page (/ki-datenschutz) and the "KI · Testzugang" badge both
 * render from THIS list, so a new AI feature cannot ship undisclosed without
 * someone deciding what to write here — `ai-disclosure.test.ts` checks every
 * call site of the provider is named below.
 */

export const AI_DISCLOSURE_HREF = '/ki-datenschutz'

/** Where AI runs today, and on what terms. Placeholders, not a contract. */
export const AI_PROVIDERS_TODAY = [
  { id: 'groq', name: 'Groq', country: 'USA', role: 'erste Wahl' },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    country: 'USA',
    role: 'Ersatz, wenn Groq nicht antwortet',
  },
] as const

/**
 * The provider ids the product may call — exactly the ones disclosed above.
 * `lib/ai/provider.ts` drops every other vendor from the shared chain, so a
 * key set on the box for a vendor nobody disclosed is ignored rather than
 * used. The shared chain also offers Google; it stays off until it is named
 * here and on the public pages.
 */
export const DISCLOSED_AI_PROVIDER_IDS: ReadonlySet<string> = new Set(
  AI_PROVIDERS_TODAY.map((provider) => provider.id),
)

export interface AiSurface {
  /** Source file of the call site — pinned by the disclosure test. */
  source: string
  name: string
  usedBy: string
  sent: string
  neverSent: string
}

export const AI_SURFACES: readonly AiSurface[] = [
  {
    source: 'src/app/api/ai/form-assist/route.ts',
    name: 'Formular-Assistent',
    usedBy: 'Fachpersonen beim Erfassen einer Person oder eines Einsatzplatzes',
    sent: 'Der eingetippte oder eingefügte Text und die aktuellen Formularwerte.',
    neverSent:
      'Der Klient*innen-Code, die gespeicherten Angaben zu Gesundheit und Unterstützungsbedarf (z. B. medizinische Geräte, Schlafgeräte, Einzelzimmer-Bedarf, Mobilität) und der Bewilligungsweg eines Platzes. Was Fachpersonen selbst in das Eingabefeld tippen, wird übermittelt; Gesundheitsangaben gehören nicht dort hinein.',
  },
  {
    source: 'src/app/api/ai/chat/route.ts',
    name: 'KI-Assistent (Fragen an die Daten)',
    usedBy: 'Fachpersonen',
    sent: 'Die gestellte Frage sowie Codes, Status, Sprachen, Unterkunft und Vorfall-Kategorien.',
    neverSent: 'Namen und Beschreibungen von Vorfällen.',
  },
  {
    source: 'src/lib/opportunities/translate.ts',
    name: 'Übersetzung von Einsatzplätzen',
    usedBy: 'automatisch, für das Portal der Klient*innen',
    sent: 'Titel, Beschreibung, Hinweis und Zeitangaben eines veröffentlichten Einsatzplatzes.',
    neverSent: 'Angaben zu Personen. Die Angabe zur Bewilligung wird nie maschinell übersetzt.',
  },
]

export const AI_DISCLOSURE_COPY = {
  badge: 'KI · Testzugang',
  badgeTitle: 'KI-Hilfe über kostenlose Testzugänge — was übermittelt wird und an wen',
  pageTitle: 'KI und Datenschutz',
  pageLead:
    'Wo in diesem Produkt KI vorkommt, was ihr übermittelt wird, an wen — und was sich vor dem Regelbetrieb ändert.',
  todayTitle: 'Heute: kostenlose Zugänge, echte Daten',
  today:
    'Die KI-Funktionen laufen heute über kostenlose Testzugänge externer Anbieter in den USA, ohne Auftragsbearbeitungsvertrag und ohne Zusage zu Speicherung oder Training. Die Daten in diesem Produkt sind echt: Was unten als übermittelt steht, sind Angaben über echte Personen.',
  providersTitle: 'Anbieter heute',
  surfacesTitle: 'Wo KI vorkommt',
  sentLabel: 'Übermittelt',
  neverSentLabel: 'Nie übermittelt',
  usedByLabel: 'Genutzt von',
  notTitle: 'Wo keine KI vorkommt',
  not: [
    'Die Zuteilung von Zimmern und Wohnungen: Der Passungswert ist eine offengelegte Formel, keine KI.',
    'Das Portal der Klient*innen selbst: Klient*innen sprechen nie mit einer KI.',
    'Entscheidungen: Die KI schlägt vor, ein Mensch prüft und entscheidet. Jede von der KI ausgefüllte Angabe ist markiert und lässt sich rückgängig machen.',
  ],
  contractTitle: 'Vor dem Regelbetrieb',
  contract:
    'Bevor eine Organisation das Produkt im Regelbetrieb einsetzt, wird die KI entweder abgeschaltet oder durch ein Modell mit Hosting in der Schweiz bzw. einen Anbieter mit Auftragsbearbeitungsvertrag ersetzt (keine Speicherung, kein Training) — nach Freigabe durch deren Datenschutzstelle.',
  englishTitle: 'In English',
  english:
    'AI appears in three places: a form assistant and a question assistant for staff, and machine translation of job and volunteering listings. Today it runs on free test access at Groq (USA), with OpenRouter (USA) as a fallback: no contract, no data-processing agreement and no commitment on storage or training. The data in this product is real, so what is sent is about real people. Placement is a published formula, not AI; residents never talk to an AI inside the product; a person reviews every suggestion. Before an organisation uses the product in regular operation, AI is either switched off or replaced by a Swiss-hosted model or a provider under a data-processing agreement. The feedback window on the public pages is a separate service and is described in the privacy statement.',
} as const
