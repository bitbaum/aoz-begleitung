/**
 * AI form assistance labels
 */

export const AI_FORM_LABELS = {
  fillTitle: 'Aus Gesprächsnotizen ausfüllen',
  fillHint:
    'Beschreibe das Aufnahmegespräch in eigenen Worten. Das Formular wird ausgefüllt — überprüfe jede Angabe, bevor du speicherst.',
  fillPlaceholder:
    'z.B. Frau, 34, alleinstehend, spricht Arabisch und etwas Deutsch. Steht früh auf, hätte gerne ein Einzelzimmer. Raucht draussen, kocht lieber mit eigenem Geschirr. Reagiert empfindlich auf Lärm.',
  fillSubmit: 'Ausfüllen',

  refineTitle: 'Änderung beschreiben',
  refineHint:
    'Sag, was anders sein soll — z.B. «spricht auch Französisch» oder «doch Nichtraucherin».',
  refinePlaceholder: 'z.B. Lärmtoleranz eher 2, und sie kann ein Zimmer teilen',
  refineSubmit: 'Übernehmen',

  working: 'Einen Moment…',
  undo: 'Rückgängig',
  aiMarker: 'KI',
  aiMarkerTitle: 'Von der KI ausgefüllt — bitte prüfen',
  changedOne: '1 Feld aktualisiert',
  changedMany: (count: number) => `${count} Felder aktualisiert`,

  suggest: 'Verbesserungen vorschlagen',
  suggesting: 'Suche Vorschläge…',
  suggestionsTitle: 'Vorschläge — antippen zum Übernehmen:',
} as const

export const AI_FORM_ERRORS = {
  notConfigured: 'KI-Assistent nicht konfiguriert (kein API-Schlüssel hinterlegt).',
  unauthenticated: 'Nicht authentifiziert',
  forbidden: 'Für diese Funktion fehlt die Berechtigung.',
  rateLimited: (seconds: number) => `Zu viele Anfragen. Bitte warten Sie ${seconds} Sekunden.`,
} as const

/**
 * Everything the ai-forms package says to a user, in German. Its defaults are
 * English, and an English sentence inside a German form reads as a crash
 * rather than as guidance.
 */
export const AI_FORM_MESSAGES = {
  tooShort: (intent: 'fill' | 'refine', min: number) =>
    intent === 'refine'
      ? `Beschreibe die Änderung etwas genauer (mindestens ${min} Zeichen).`
      : `Beschreibe es etwas ausführlicher (mindestens ${min} Zeichen).`,
  noFields: 'Dieses Formular hat keine Felder, die die KI ausfüllen darf.',
  unavailable: 'Der KI-Assistent ist gerade nicht erreichbar.',
  unreadable: 'Die Antwort der KI war nicht lesbar. Bitte anders formulieren.',
  nothingChanged: (intent: 'fill' | 'refine') =>
    intent === 'refine'
      ? 'Nichts geändert — nenne das Feld, das anders sein soll, oder füge mehr Angaben ein.'
      : 'Daraus liess sich nichts ausfüllen. Beschreibe es anders oder ausführlicher.',
  updated: (labels: readonly string[]) =>
    labels.length === 1
      ? `${labels[0]} aktualisiert.`
      : `${labels.slice(0, -1).join(', ')} und ${labels[labels.length - 1]} aktualisiert.`,
  badBody: 'Ungültige Anfrage.',
  unknownForm: (key: string) => `Unbekanntes Formular «${key}».`,
  nothingToReview: 'Fülle zuerst etwas aus — noch gibt es nichts zu verbessern.',
  noSuggestions: 'Keine Vorschläge — das sieht gut aus.',
}
