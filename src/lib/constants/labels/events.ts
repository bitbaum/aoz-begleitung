/**
 * Events admin labels (German).
 *
 * The category words are NOT written here: they already exist in the German
 * dictionary, because the resident portal renders the same four. Two copies is
 * two places to add the fifth and one place to forget — and a category missing
 * from an inferred object literal renders `undefined` rather than failing to
 * compile. Derived from the config, which declares the map exhaustively.
 *
 * The staff side is German-only by design (@see CLAUDE.md), so reading the
 * German dictionary directly is honest here rather than an untranslated string.
 */

import { de } from '@/lib/i18n/dictionaries/de'
import { HOUSE_EVENT_CATEGORIES, HOUSE_EVENT_CATEGORY_LABEL_KEYS } from '@/lib/config/events'
import type { HouseEventCategory } from '@/lib/db'

const categoryLabels = Object.fromEntries(
  HOUSE_EVENT_CATEGORIES.map((category) => [
    category,
    de[HOUSE_EVENT_CATEGORY_LABEL_KEYS[category]],
  ]),
) as Record<HouseEventCategory, string>

export const EVENTS_ADMIN_LABELS = {
  pageTitle: 'Veranstaltungen',
  pageDescription: 'Hausversammlungen und gemeinsame Anlässe — für alle Einheiten.',
  emptyTitle: 'Noch keine Veranstaltungen geplant.',
  newAction: 'Veranstaltung',
  formTitle: 'Titel',
  formDescription: 'Beschreibung',
  formLocation: 'Ort',
  formStartsAt: 'Beginn',
  formUnit: 'Einheit',
  formCategory: 'Kategorie',
  submit: 'Erstellen',
  cancel: 'Absagen',
  cancelled: 'Abgesagt',
  cancelConfirmTitle: 'Veranstaltung absagen?',
  cancelConfirm: (going: number) =>
    going > 0
      ? `${going === 1 ? 'Eine Person hat' : `${going} Personen haben`} zugesagt und ${going === 1 ? 'bekommt' : 'bekommen'} eine Nachricht im Portal. Die Veranstaltung bleibt für sie als «Abgesagt» sichtbar.`
      : 'Noch niemand hat zugesagt. Die Veranstaltung verschwindet aus dem Portal.',
  keep: 'Nicht absagen',
  delete: 'Löschen',
  deleteConfirmTitle: 'Veranstaltung löschen?',
  deleteConfirm:
    'Die abgesagte Veranstaltung und alle Antworten darauf werden gelöscht. Das lässt sich nicht rückgängig machen.',
  failed: 'Das hat nicht geklappt. Bitte laden Sie die Seite neu.',
  // Sent into each «Ich komme» resident's message thread, in German like every
  // other staff message there — no email.
  cancellationMessage: (title: string, when: string) =>
    `Die Veranstaltung «${title}» am ${when} ist abgesagt. Sie hatten zugesagt — deshalb diese Nachricht. Bei Fragen können Sie hier antworten.`,
  unitGroupOccupied: 'Bewohnte Einheiten',
  unitGroupEmpty: 'Zurzeit ohne Platzierung',
  unitChoose: 'Einheit wählen',
  unit: 'Einheit',
  rsvps: 'Zusagen',
  category: categoryLabels,
  status: {
    DRAFT: 'Entwurf',
    PUBLISHED: 'Veröffentlicht',
    CANCELLED: 'Abgesagt',
  },
} as const
