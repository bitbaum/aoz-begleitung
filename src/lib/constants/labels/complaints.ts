import type { ComplaintStatus, ComplaintSubject } from '@/lib/db'

/**
 * Complaints about the organisation — resident-facing and staff-facing German.
 *
 * The tone is doing work here. Someone objecting to the organisation that
 * houses them is taking a risk, and copy that sounds like a form will read as
 * a discouragement. So the words say plainly that complaining is allowed, that
 * it changes nothing about their housing, and what happens next.
 */

/** SSOT for the enum's values, so the zod schema and the form share one list. */
export const COMPLAINT_SUBJECT_IDS = ['STAFF', 'ACCOMMODATION', 'DECISION', 'OTHER'] as const

export const COMPLAINT_SUBJECT_LABELS: Record<ComplaintSubject, string> = {
  STAFF: 'Wie ich behandelt wurde',
  ACCOMMODATION: 'Die Unterkunft oder ihre Regeln',
  DECISION: 'Eine Entscheidung über mich',
  OTHER: 'Etwas anderes',
}

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: 'Eingegangen',
  IN_REVIEW: 'In Prüfung',
  ANSWERED: 'Beantwortet',
}

export const COMPLAINT_STATUS_BADGES: Record<ComplaintStatus, string> = {
  OPEN: 'badge-pending',
  IN_REVIEW: 'badge-active',
  ANSWERED: 'badge-ended',
}

export const COMPLAINT_LABELS = {
  // --- Resident side ---
  navLabel: 'Beschwerde',
  title: 'Beschwerde über die Betreuung',
  intro:
    'Wenn Sie mit der Betreuung, der Unterkunft oder einer Entscheidung nicht einverstanden sind, können Sie das hier sagen. Eine Beschwerde hat keine Folgen für Ihren Platz.',
  /**
   * Says who does NOT read it. That is the fact that makes the channel usable:
   * a complaint read by the person it is about is not a complaint.
   */
  whoReads:
    'Ihre Beschwerde geht an die zuständige Stelle — nicht an die Betreuungspersonen in Ihrer Unterkunft.',
  subjectLabel: 'Worum geht es?',
  bodyLabel: 'Was ist passiert?',
  bodyPlaceholder: 'Beschreiben Sie, was vorgefallen ist. Wann, wo, und wer beteiligt war.',
  anonymousLabel: 'Anonym einreichen',
  /** The trade-off, stated where the choice is made rather than buried. */
  anonymousHint:
    'Anonym heisst: Ihr Name steht nicht dabei. Wir können Ihnen dann aber nicht antworten, und die Beschwerde erscheint nicht unter "Ihre Meldungen".',
  submit: 'Beschwerde einreichen',
  tooShort: 'Bitte beschreiben Sie kurz, worum es geht (mindestens 10 Zeichen).',
  sent: 'Ihre Beschwerde ist eingegangen. Sie sehen die Antwort unter "Ihre Meldungen".',
  sentAnonymous: 'Ihre anonyme Beschwerde ist eingegangen.',
  /** How it reads in the resident's merged report list. */
  reportTitle: 'Beschwerde',

  // --- Staff side ---
  staffTitle: 'Beschwerden',
  staffSubtitle:
    'Beschwerden über die Organisation. Nicht sichtbar für die Betreuung — auch nicht mit Einsicht in alle Bereiche.',
  staffEmpty: 'Keine Beschwerden eingegangen.',
  anonymousMarker: 'Anonym',
  respondLabel: 'Antwort',
  respondPlaceholder: 'Was wurde geprüft, und was folgt daraus?',
  respondSubmit: 'Antwort senden',
  respondedBy: 'Beantwortet von',
  filedOn: 'Eingegangen',
} as const
