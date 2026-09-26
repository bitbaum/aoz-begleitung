/**
 * Staff-facing messaging labels.
 *
 * German only, like every other staff surface: caseworkers work in German, and
 * the translated dictionaries exist for residents, who may not read it. The
 * resident side of this same feature goes through `lib/i18n` instead.
 */
export const MESSAGES_LABELS = {
  inboxTitle: 'Nachrichten',
  waitingSuffix: 'warten auf eine Antwort',
  allAnswered: 'Alles beantwortet.',
  empty: 'Noch keine Gespräche.',
  threadTitle: 'Gespräch',
  backToInbox: 'Zurück zu den Nachrichten',
  replyPlaceholder: 'Antwort schreiben …',
  send: 'Senden',
  sending: 'Wird gesendet …',
  sendFailed: 'Die Nachricht wurde nicht gesendet. Bitte nochmals versuchen.',
  fromResident: 'Klient*in',
  fromStaff: 'Betreuung',
  /** Said where staff write, because a resident reads this in their language. */
  languageHint:
    'Die Bewohnenden lesen das Portal in ihrer eigenen Sprache — Ihre Nachricht wird nicht übersetzt.',
} as const
