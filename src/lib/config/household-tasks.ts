/**
 * Household Task Configuration - SSOT
 *
 * All task types, categories, priorities, statuses, templates, and labels.
 * UI and validation derive from this config.
 */

// =============================================================================
// TASK TYPE
// =============================================================================

export const TASK_TYPE_LABELS: Record<string, string> = {
  ONE_TIME: 'Einmalig',
  RECURRING_SCHEDULED: 'Regelmässig',
  RECURRING_AS_NEEDED: 'Nach Bedarf',
}

export const TASK_TYPE_DESCRIPTIONS: Record<string, string> = {
  ONE_TIME: 'Einmal erledigen, dann fertig',
  RECURRING_SCHEDULED: 'Regelmässiger Zeitplan (z.B. wöchentlich)',
  RECURRING_AS_NEEDED: 'Erledigen wenn nötig (z.B. Abfall rausbringen)',
}

// =============================================================================
// TASK CATEGORY
// =============================================================================

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  CLEANING: 'Reinigung',
  SHOPPING: 'Einkauf',
  MAINTENANCE: 'Unterhalt',
  COOKING: 'Kochen',
  TRASH: 'Abfall',
  OTHER: 'Sonstiges',
}

export const TASK_CATEGORY_ICONS: Record<string, string> = {
  CLEANING: '🧹',
  SHOPPING: '🛒',
  MAINTENANCE: '🔧',
  COOKING: '🍳',
  TRASH: '♻️',
  OTHER: '📋',
}

// =============================================================================
// TASK PRIORITY
// =============================================================================

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  HIGH: 'Hoch',
  URGENT: 'Dringend',
}

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-ui-subtle text-ui-muted',
  NORMAL: 'bg-status-info/15 text-status-info-text',
  HIGH: 'bg-status-warning/15 text-status-warning-text',
  URGENT: 'bg-status-error/15 text-status-error-text',
}

// =============================================================================
// TASK STATUS
// =============================================================================

export const TASK_STATUS_LABELS: Record<string, string> = {
  IDLE: 'Bereit',
  NEEDS_ATTENTION: 'Achtung',
  REQUESTED: 'Angefragt',
  IN_PROGRESS: 'In Arbeit',
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  IDLE: 'bg-ui-subtle text-ui-muted',
  NEEDS_ATTENTION: 'bg-status-warning/15 text-status-warning-text',
  REQUESTED: 'bg-brand-primary/10 text-brand-primary',
  IN_PROGRESS: 'bg-status-info/15 text-status-info-text',
}

// =============================================================================
// REQUEST STATUS
// =============================================================================

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Offen',
  ACCEPTED: 'Angenommen',
  DECLINED: 'Abgelehnt',
  COMPLETED: 'Erledigt',
}

// =============================================================================
// TASK TEMPLATES (Pre-defined common chores)
// =============================================================================

/**
 * `instructions` and `checklist` answer two different questions and must not
 * duplicate each other:
 *
 *   instructions → HOW / WHERE ("der Container steht hinter dem Haus")
 *   checklist    → WHAT COUNTS AS DONE, as binary observable actions
 *
 * The checklist never describes an outcome. "Bad ist sauber" is a gradient two
 * people can honestly disagree about; "Boden gewischt" is not. That is the
 * whole trick: housemates with different standards never have to agree on what
 * "sauber" means, only on whether the floor got wiped.
 */
export interface TaskTemplate {
  title: string
  category: string
  taskType: string
  instructions?: string
  checklist?: string[]
  estimatedMinutes?: number
  scheduleHuman?: string
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    title: 'Badezimmer putzen',
    category: 'CLEANING',
    taskType: 'RECURRING_SCHEDULED',
    checklist: [
      'WC innen und aussen gereinigt',
      'Lavabo und Spiegel gewischt',
      'Dusche ausgespült',
      'Boden gewischt',
      'Abfalleimer geleert',
    ],
    estimatedMinutes: 30,
    scheduleHuman: 'Wöchentlich',
  },
  {
    title: 'Küche aufräumen',
    category: 'CLEANING',
    taskType: 'RECURRING_AS_NEEDED',
    checklist: [
      'Spüle leer, nichts steht mehr drin',
      'Herd abgewischt',
      'Arbeitsflächen abgewischt',
      'Tisch frei geräumt',
    ],
    estimatedMinutes: 20,
  },
  {
    title: 'Toilettenpapier kaufen',
    category: 'SHOPPING',
    taskType: 'RECURRING_AS_NEEDED',
    checklist: ['Gekauft', 'Im Bad verstaut'],
    estimatedMinutes: 15,
  },
  {
    title: 'Abfall rausbringen',
    category: 'TRASH',
    taskType: 'RECURRING_AS_NEEDED',
    instructions: 'Der Container steht hinter dem Haus.',
    checklist: ['Sack zum Container gebracht', 'Neuer Sack eingesetzt'],
    estimatedMinutes: 10,
  },
  {
    title: 'Boden wischen',
    category: 'CLEANING',
    taskType: 'RECURRING_SCHEDULED',
    checklist: ['Küche gewischt', 'Flur gewischt', 'Bad gewischt'],
    estimatedMinutes: 25,
    scheduleHuman: 'Wöchentlich',
  },
  {
    title: 'Recycling sortieren',
    category: 'TRASH',
    taskType: 'RECURRING_AS_NEEDED',
    checklist: [
      'PET getrennt',
      'Glas getrennt',
      'Papier und Karton getrennt',
      'Zum Sammelplatz gebracht',
    ],
    estimatedMinutes: 15,
  },
]

// =============================================================================
// COMPLAINT → INCIDENT CATEGORY MAPPING
// =============================================================================

import type { HouseholdTaskCategory, IncidentType } from '@/lib/db'

export const CHORE_COMPLAINT_INCIDENT_MAP: Record<HouseholdTaskCategory, IncidentType> = {
  CLEANING: 'CLEANLINESS_DISPUTE',
  SHOPPING: 'PERSONAL_CONFLICT',
  MAINTENANCE: 'GENERAL_MAINTENANCE',
  COOKING: 'SPACE_DISPUTE',
  TRASH: 'CLEANLINESS_DISPUTE',
  OTHER: 'PERSONAL_CONFLICT',
}

// =============================================================================
// PORTAL LABELS (all German text for chore feature)
// =============================================================================

export const CHORE_LABELS = {
  nav: 'Aufgaben',
  pages: {
    list: 'Haushaltsaufgaben',
    listSubtitle: 'Gemeinsame Aufgaben für Ihre Wohnung',
    create: 'Neue Aufgabe',
    createSubtitle: 'Erstellen Sie eine Aufgabe für die Wohnung',
    detail: 'Aufgabe',
  },
  filter: {
    all: 'Alle',
  },
  card: {
    lastCompleted: 'Zuletzt erledigt',
    never: 'Noch nie',
    by: 'von',
    completed: 'Erledigt',
  },
  actions: {
    complete: 'Erledigt!',
    completing: 'Wird gespeichert...',
    request: 'Anfragen',
    attention: 'Aufmerksamkeit',
    complaint: 'Problem melden',
    create: 'Neue Aufgabe',
    useTemplate: 'Vorlage verwenden',
  },
  form: {
    title: 'Titel',
    titlePlaceholder: 'z.B. Küche aufräumen',
    description: 'Beschreibung (optional)',
    descriptionPlaceholder: 'Zusätzliche Details...',
    instructions: 'Anleitung (optional)',
    instructionsPlaceholder: 'Wo steht was, worauf achten...',
    checklist: 'Das gehört dazu',
    checklistHint:
      'Eine Zeile pro Handgriff — etwas, das man sehen kann. Also «Boden gewischt», nicht «Bad ist sauber».',
    checklistPlaceholder: 'Boden gewischt\nAbfalleimer geleert\nSpiegel gewischt',
    category: 'Kategorie',
    taskType: 'Art',
    priority: 'Priorität',
    schedule: 'Zeitplan (optional)',
    schedulePlaceholder: 'z.B. Jeden Montag',
    createError: 'Die Aufgabe konnte nicht erstellt werden.',
    estimatedMinutes: 'Geschätzte Dauer (Min.)',
    submit: 'Aufgabe erstellen',
    submitting: 'Wird erstellt...',
  },
  complete: {
    title: 'Aufgabe erledigt',
    checklistTitle: 'Was haben Sie gemacht?',
    checklistHint: 'Hake ab, was erledigt ist. Nicht alles muss angekreuzt sein.',
    notes: 'Notizen (optional)',
    notesPlaceholder: 'Was haben Sie gemacht?',
    duration: 'Dauer in Minuten (optional)',
    durationHint: 'Zählt für den Aufgaben-Saldo. Ohne Angabe gilt die geschätzte Dauer.',
  },
  request: {
    title: 'Hilfe anfragen',
    selectRoommate: 'Mitbewohner auswählen',
    broadcast: 'Alle fragen',
    broadcastDesc: 'Anfrage an alle Mitbewohner senden',
    message: 'Nachricht (optional)',
    messagePlaceholder: 'z.B. Könnten Sie das heute machen?',
    submit: 'Anfrage senden',
    submitting: 'Wird gesendet...',
  },
  attention: {
    title: 'Aufmerksamkeit nötig',
    message: 'Nachricht (optional)',
    messagePlaceholder: 'z.B. Das Bad ist schon wieder schmutzig...',
    submit: 'Markieren',
    submitting: 'Wird markiert...',
  },
  complaint: {
    title: 'Problem mit Aufgabe melden',
    description: 'Beschreiben Sie das Problem',
    descriptionPlaceholder: 'z.B. Mitbewohner macht nie sauber...',
    submit: 'Problem melden',
    submitting: 'Wird gemeldet...',
    note: 'Ihre Meldung wird an die Hausverwaltung weitergeleitet.',
  },
  balance: {
    title: 'Aufgaben-Saldo',
    subtitle: 'Diesen Monat, in Minuten',
    // The framing matters more than the numbers. Asked separately, housemates'
    // estimates of their own share reliably add up to well over 100% — everyone
    // remembers their own work better than anyone else's. So this is stated as
    // a correction that applies to all of us, never as an accusation.
    explainer:
      'Fast alle überschätzen den eigenen Anteil — nicht aus Unehrlichkeit, sondern weil man die eigene Arbeit besser erinnert als die der anderen. Darum zeigt diese Übersicht die tatsächlichen Minuten und keine Rangliste.',
    done: 'Geleistet',
    share: 'Anteil',
    net: 'Saldo',
    netHint:
      'Saldo = geleistet minus Anteil. Plus heisst: hat diesen Monat mehr übernommen als den eigenen Anteil.',
    settleHint:
      'Ein Saldo wird nicht zurückgezahlt, sondern mit der nächsten Aufgabe ausgeglichen.',
    minutes: 'Min.',
    empty: 'Diesen Monat wurde noch nichts erledigt.',
  },
  detail: {
    description: 'Beschreibung',
    instructions: 'Anleitung',
    checklist: 'Das gehört dazu',
    checklistHint: 'Vereinbart im Haus. Ändern geht über einen Vorschlag.',
    noChecklist: 'Für diese Aufgabe ist noch nicht vereinbart, was dazugehört.',
    turn: 'Diesmal dran',
    turnYou: 'Sie sind dran',
    turnHint: 'Wer dran ist, ist eine Voreinstellung — erledigen darf sie jede und jeder.',
    turnSwap: 'Tauschen',
    schedule: 'Zeitplan',
    estimatedMinutes: 'Geschätzte Dauer',
    minutes: 'Min.',
    history: 'Letzte Erledigungen',
    activeRequests: 'Offene Anfragen',
    attentionFlags: 'Aufmerksamkeits-Meldungen',
    noHistory: 'Noch keine Erledigungen',
    noRequests: 'Keine offenen Anfragen',
    noFlags: 'Keine Meldungen',
  },
  success: {
    created: 'Aufgabe erstellt!',
    completed: 'Aufgabe als erledigt markiert!',
    flagged: 'Aufmerksamkeit markiert!',
    requested: 'Anfrage gesendet!',
    complained: 'Problem wurde gemeldet.',
  },
  errors: {
    generic: 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
    notFound: 'Aufgabe nicht gefunden.',
    noPlacement: 'Sie haben noch keine Unterkunft zugewiesen bekommen.',
  },
  empty: {
    title: 'Noch keine Aufgaben',
    message: 'Erstellen Sie die erste Aufgabe für Ihre Wohnung.',
  },
  sections: {
    urgentNow: 'Jetzt wichtig',
    urgentDesc: 'Diese Aufgaben brauchen zuerst eine Entscheidung.',
    after: 'Danach',
  },
  // Card-level action hints (previously in lib/constants/labels/ui.ts)
  openTaskHint: 'Empfohlen: Aufgabe öffnen und zuerst Entscheidung treffen.',
  openTaskAction: 'Aufgabe öffnen und Entscheidung treffen',
  markDoneDirectly: 'Direkt als erledigt markieren',
  done: 'Erledigt',
  // Admin chores page stats
  statTotal: 'Total Aufgaben',
  statActive: 'Aktive Aufgaben',
  statNeedsAttention: 'Braucht Aufmerksamkeit',
  statCompletions: 'Erledigungen',
  admin: {
    pageTitle: 'Haushaltsaufgaben',
    perUnitTitle: 'Aufgaben pro Unterkunft',
    noUnits: 'Keine Unterkünfte mit Aufgaben gefunden',
    attention: 'Achtung',
    colUnit: 'Unterkunft',
    colAddress: 'Adresse',
    colResidents: 'Klient*innen',
    colTasks: 'Aufgaben',
    colActive: 'Aktiv',
    chooseUnit: 'Unterkunft wählen …',
    createHint: 'Die Bewohnenden sehen, dass die Aufgabe von der Betreuung stammt.',
  },
} as const
