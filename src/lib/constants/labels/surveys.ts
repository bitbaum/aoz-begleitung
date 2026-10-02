/**
 * Staff copy for anonymous client surveys. Portal copy lives in the i18n
 * dictionaries (`survey.*`), because residents read it in their language.
 */

export const SURVEY_STATUS_LABELS = {
  DRAFT: 'Entwurf',
  OPEN: 'Offen',
  CLOSED: 'Abgeschlossen',
} as const

export const SURVEY_STATUS_BADGE = {
  DRAFT: 'badge-pending',
  OPEN: 'badge-active',
  CLOSED: 'badge-ended',
} as const

export const SURVEY_LABELS = {
  navLabel: 'Umfragen',
  navDesc: 'Anonyme Umfragen an Klient*innen',
  listTitle: 'Umfragen',
  listDescription:
    'Anonyme Umfragen an Klient*innen. Sie sehen nur zusammengefasste Ergebnisse — nie, wer was geantwortet hat.',
  newSurvey: 'Neue Umfrage',
  emptyTitle: 'Noch keine Umfragen',
  emptyDescription:
    'Erstellen Sie eine Umfrage aus einer Vorlage und senden Sie sie an eine gespeicherte Gruppe oder an einzelne Klient*innen.',
  invited: 'Eingeladen',
  answered: 'Geantwortet',
  status: 'Status',
  created: 'Erstellt',
  opened: 'Geöffnet',
  closed: 'Abgeschlossen',
  back: 'Alle Umfragen',

  // New
  newTitle: 'Neue Umfrage',
  newDescription:
    'Die Fragen kommen aus der Vorlage und sind in alle Portalsprachen übersetzt. Titel und Einleitung können Sie anpassen — angepasster Text erscheint im Portal auf Deutsch.',
  template: 'Vorlage',
  templateQuestions: (n: number) => `${n} Fragen`,
  title: 'Titel',
  intro: 'Einleitung (optional)',
  minResponses: 'Mindestanzahl Antworten (k)',
  minResponsesHint: (min: number, max: number) =>
    `Ergebnisse erscheinen erst ab so vielen Antworten (mindestens ${min}, höchstens ${max}). Darunter könnte man einzelne Personen erkennen.`,
  create: 'Als Entwurf speichern',
  cancel: 'Abbrechen',

  // Detail — audience
  audienceTitle: 'Empfänger*innen',
  audienceDescription:
    'Wählen Sie eine gespeicherte Gruppe oder einzelne Klient*innen. Die Gruppe wird jetzt, mit Ihren Rechten, aufgelöst. Platzhalter-Profile und ausgetretene Klient*innen werden nie eingeladen.',
  audienceGroup: 'Gespeicherte Gruppe',
  audienceIndividuals: 'Einzelne Klient*innen',
  chooseGroup: 'Gruppe wählen',
  noGroups: 'Noch keine gespeicherten Gruppen — legen Sie eine unter «Alle Klient*innen» an.',
  groupCount: (n: number | null) =>
    n === null ? 'ungültig' : n === 1 ? '1 Person' : `${n} Personen`,
  chooseIndividuals: 'Klient*innen wählen',
  selectedCount: (n: number) => (n === 1 ? '1 ausgewählt' : `${n} ausgewählt`),
  open: 'Öffnen und einladen',
  inviteMore: 'Weitere einladen',
  openConfirm:
    'Umfrage jetzt öffnen? Die gewählten Klient*innen sehen sie sofort in ihrem Portal. Die Fragen können danach nicht mehr geändert werden.',
  invitedNow: (n: number) =>
    n === 1 ? '1 Person neu eingeladen.' : `${n} Personen neu eingeladen.`,
  close: 'Umfrage schliessen',
  closeConfirm: 'Umfrage schliessen? Danach kann niemand mehr antworten.',

  // Detail — results
  resultsTitle: 'Ergebnisse',
  resultsAnonymity:
    'Antworten werden ohne Namen, ohne Code und ohne Uhrzeit gespeichert. Es gibt keine Einzelansicht und keinen Export einzelner Antworten.',
  /** Results wait for the close: open results could be diffed answer by answer. */
  stillOpen: (responses: number) =>
    `${responses === 1 ? '1 Antwort' : `${responses} Antworten`} bisher. Die Ergebnisse erscheinen, wenn Sie die Umfrage schliessen — so lässt sich keine einzelne Antwort ablesen.`,
  tooFew: (responses: number, k: number) =>
    `Noch zu wenige Antworten, um Ergebnisse anonym zu zeigen (${responses} von ${k}).`,
  responsesCount: (n: number) => (n === 1 ? '1 Antwort' : `${n} Antworten`),
  answeredOf: (answered: number, total: number) => `${answered} von ${total} beantwortet`,
  otherAnswers: 'Sonstiges (Freitext)',
  freeTextHint: 'Alphabetisch sortiert — die Reihenfolge sagt nichts über Zeitpunkt oder Person.',
  noText: 'Keine Antworten.',
  questionsTitle: 'Fragen',

  errors: {
    templateUnknown: 'Diese Vorlage gibt es nicht.',
    titleRequired: 'Bitte geben Sie einen Titel ein.',
    titleTooLong: 'Der Titel darf höchstens 120 Zeichen lang sein.',
    introTooLong: 'Die Einleitung darf höchstens 1000 Zeichen lang sein.',
    minResponses: (min: number, max: number) =>
      `Die Mindestanzahl muss zwischen ${min} und ${max} liegen.`,
    notFound: 'Diese Umfrage gibt es nicht mehr.',
    notSendable: 'Eine abgeschlossene Umfrage kann niemanden mehr einladen.',
    notOpen: 'Nur eine offene Umfrage kann geschlossen werden.',
    noAudience: 'Bitte wählen Sie eine Gruppe oder mindestens eine Person.',
    groupNotFound: 'Diese Gruppe gibt es nicht mehr.',
    groupInvalid:
      'Diese Gruppe enthält Filter, die es nicht mehr gibt. Bitte speichern Sie sie neu.',
    emptyAudience:
      'Niemand in dieser Auswahl kann eingeladen werden (Platzhalter, ausgetreten oder ausserhalb Ihres Bereichs).',
    saveFailed: 'Das hat nicht geklappt. Bitte versuchen Sie es erneut.',
  },
} as const
