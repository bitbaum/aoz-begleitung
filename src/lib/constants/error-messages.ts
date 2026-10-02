/**
 * Centralized German error messages for server actions and API routes.
 *
 * Single source of truth: change a message here and every action/route
 * that imports it picks up the change automatically.
 *
 * Naming convention:
 *   ENTITY_ACTION_OUTCOME  e.g. RESIDENT_CREATE_ERROR, SPOT_NOT_FOUND
 */
import { BRAND } from '@/lib/config/brand'

export const ERROR_MESSAGES = {
  // ─── Auth / Session ────────────────────────────────────────────
  NOT_AUTHENTICATED: 'Nicht angemeldet',
  AUTH_REQUIRED: 'Authentifizierung erforderlich',
  INSUFFICIENT_PERMISSIONS: 'Unzureichende Berechtigungen',
  INVALID_CREDENTIALS: 'Ungültige E-Mail oder Passwort',
  ACCOUNT_NOT_SETUP: 'Konto nicht vollständig eingerichtet',
  SESSION_ERROR: 'Ein Fehler ist aufgetreten',

  // ─── Account (register, email login, password reset) ───────────
  AUTH_CODE_REQUIRED: 'Code erforderlich',
  AUTH_HOUSEHOLD_NAME_REQUIRED: 'Bitte gib deiner Wohnung einen Namen',
  AUTH_HOUSEHOLD_NAME_TOO_LONG: 'Der Name ist zu lang (max. 80 Zeichen)',
  AUTH_EMAIL_INVALID: 'Gültige E-Mail-Adresse erforderlich',
  AUTH_PASSWORD_TOO_SHORT: 'Passwort muss mindestens 8 Zeichen haben',
  AUTH_PASSWORD_TOO_LONG: 'Passwort darf höchstens 72 Zeichen haben',
  AUTH_CODE_UNKNOWN: 'Ungültiger Code. Verwenden Sie den Code, den Sie erhalten haben.',
  AUTH_ALREADY_REGISTERED:
    'Für diesen Code existiert bereits ein Konto. Verwenden Sie «Passwort vergessen», falls Sie das Passwort nicht mehr wissen.',
  AUTH_EMAIL_TAKEN: 'Diese E-Mail-Adresse wird bereits verwendet',
  AUTH_ROLE_ALREADY_LINKED:
    'Mit dieser E-Mail-Adresse ist bereits ein Zugang dieser Art verknüpft.',
  AUTH_LINK_PASSWORD_MISMATCH:
    'Für diese E-Mail-Adresse existiert bereits ein Konto. Geben Sie das Passwort dieses Kontos ein, um den Code damit zu verknüpfen.',
  AUTH_RESET_TOKEN_INVALID: 'Dieser Link ist ungültig oder abgelaufen. Fordern Sie einen neuen an.',
  AUTH_EMAIL_NOT_CONFIGURED:
    'E-Mail-Versand ist auf dieser Installation nicht eingerichtet. Bitte wenden Sie sich an die Verwaltung.',

  // ─── Generic validation ────────────────────────────────────────
  INVALID_INPUT: 'Ungültige Eingabe',
  INVALID_INPUT_DATA: 'Ungültige Eingabedaten',
  INVALID_REQUEST: 'Ungültige Anfrage.',
  INVALID_RATING: 'Ungültige Bewertung',
  INVALID_SATISFACTION_VALUE: 'Ungültiger Zufriedenheitswert',
  INVALID_AOZ_CODE: `Ungültiger ${BRAND.shortName}-Code`,

  // ─── Generic operation errors ──────────────────────────────────
  ARCHIVE_ERROR: 'Fehler beim Archivieren',
  RESTORE_ERROR: 'Fehler beim Wiederherstellen',
  SAVE_ERROR: 'Fehler beim Speichern',
  SAVE_FAILED: 'Speichern fehlgeschlagen',
  PLACEMENT_ERROR: 'Fehler bei der Platzierung',
  TRANSFER_ERROR: 'Fehler bei der Verlegung',

  // ─── Resident ──────────────────────────────────────────────────
  RESIDENT_NOT_FOUND: 'Klient*in nicht gefunden',
  /** With trailing period — used inside matching transaction */
  RESIDENT_NOT_FOUND_P: 'Klient*in nicht gefunden.',
  RESIDENT_CREATE_ERROR: 'Fehler beim Erstellen der Klient*in',
  RESIDENT_UPDATE_ERROR: 'Fehler beim Aktualisieren der Klient*in',
  RESIDENT_HAS_ACTIVE_PLACEMENT: 'Klient*in hat bereits eine aktive Platzierung',
  RESIDENT_HAS_ACTIVE_PLACEMENTS: 'Klient*in hat noch aktive Platzierungen. Bitte zuerst beenden.',
  RESIDENT_ALREADY_PLACED: 'Klient*in ist bereits platziert.',
  RESIDENT_ARCHIVE_BLOCKED: 'Archivieren nicht möglich: aktive Platzierung vorhanden',
  RESIDENT_CODE_EXISTS: 'Code ist bereits vergeben',

  // ─── Housing unit ──────────────────────────────────────────────
  UNIT_NOT_FOUND: 'Unterkunft nicht gefunden',
  UNIT_CREATE_ERROR: 'Fehler beim Erstellen der Unterkunft',
  UNIT_UPDATE_ERROR: 'Fehler beim Aktualisieren der Unterkunft',
  UNIT_ARCHIVE_BLOCKED: 'Archivieren nicht möglich: aktive Belegung vorhanden',
  UNIT_CODE_EXISTS: 'Code ist bereits vergeben',
  SPOT_CODE_EXISTS: 'Platz-Code ist in dieser Unterkunft bereits vergeben',

  // ─── Placement ─────────────────────────────────────────────────
  PLACEMENT_NOT_FOUND: 'Platzierung nicht gefunden',
  PLACEMENT_NOT_ACTIVE: 'Platzierung ist nicht aktiv',
  PLACEMENT_END_ERROR: 'Fehler beim Beenden der Platzierung',
  NO_ACTIVE_PLACEMENT: 'Keine aktive Platzierung',

  // ─── Spot / Platz ─────────────────────────────────────────────
  SPOT_NOT_FOUND: 'Platz nicht gefunden',
  /** With trailing period — used inside matching transaction */
  SPOT_NOT_FOUND_P: 'Platz nicht gefunden.',
  SPOT_NOT_AVAILABLE: 'Platz ist nicht verfügbar',
  SPOT_NOT_AVAILABLE_ANYMORE: 'Platz ist nicht mehr verfügbar.',
  SPOT_ALREADY_OCCUPIED: 'Platz ist bereits belegt.',
  SPOT_CREATE_ERROR: 'Fehler beim Erstellen des Platzes',
  SPOT_UPDATE_ERROR: 'Fehler beim Aktualisieren des Platzes',
  SPOT_DELETE_ERROR: 'Fehler beim Löschen des Platzes',
  SPOT_DELETE_BLOCKED: 'Platz kann nicht gelöscht werden, da aktive Platzierungen existieren',
  SPOTS_BATCH_CREATE_ERROR: 'Fehler beim Erstellen der Zimmer/Betten',

  // ─── Satisfaction / Check-in ───────────────────────────────────
  CHECKIN_SAVE_ERROR: 'Fehler beim Speichern des Check-ins',

  // ─── Incident ──────────────────────────────────────────────────
  INCIDENT_CREATE_ERROR: 'Fehler beim Erstellen des Vorfalls',
  INCIDENT_RESOLVE_ERROR: 'Fehler beim Auflösen des Vorfalls',
  INCIDENT_UPDATE_MEDIATION_ERROR: 'Fehler beim Speichern der Mediationszeit',
  FOLLOWUP_CREATE_ERROR: 'Fehler beim Erstellen der Nachverfolgung',
  REMINDER_DELETE_ERROR: 'Fehler beim Löschen der Erinnerung',

  // ─── Maintenance ───────────────────────────────────────────────
  MAINTENANCE_CREATE_ERROR: 'Fehler beim Erstellen der Wartungsanfrage',
  MAINTENANCE_STATUS_UPDATE_ERROR: 'Fehler beim Aktualisieren des Status',
  MAINTENANCE_ASSIGN_ERROR: 'Fehler bei der Zuweisung',

  // ─── Household tasks (chores) ──────────────────────────────────
  TASK_NOT_FOUND: 'Aufgabe nicht gefunden',
  TASK_ALREADY_COMPLETED: 'Aufgabe ist bereits abgeschlossen',
  TASK_LOAD_ERROR: 'Aufgabe konnte nicht geladen werden',
  TASKS_LOAD_ERROR: 'Aufgaben konnten nicht geladen werden',
  TASK_CREATE_ERROR: 'Aufgabe konnte nicht erstellt werden',
  TASK_COMPLETE_ERROR: 'Aufgabe konnte nicht als erledigt markiert werden',
  TASK_FLAG_ERROR: 'Markierung konnte nicht gespeichert werden',
  TASK_COMPLAINT_ERROR: 'Problem konnte nicht gemeldet werden',
  TASK_REQUEST_ERROR: 'Anfrage konnte nicht gesendet werden',

  // ─── Transfer requests ─────────────────────────────────────────
  TRANSFER_REQUEST_NOT_FOUND: 'Verlegungsanfrage nicht gefunden',
  TRANSFER_REQUEST_ALREADY_PENDING: 'Sie haben bereits eine offene Verlegungsanfrage',
  TRANSFER_REQUEST_NO_PLACEMENT: 'Keine aktive Platzierung vorhanden',
  TRANSFER_REQUEST_CREATE_ERROR: 'Fehler beim Erstellen der Verlegungsanfrage',
  TRANSFER_REQUEST_REVIEW_ERROR: 'Fehler beim Bearbeiten der Verlegungsanfrage',

  // ─── Portal / Registration ─────────────────────────────────────
  PREFERENCES_SAVE_ERROR: 'Einstellungen konnten nicht gespeichert werden',
  REPORT_SAVE_ERROR: 'Meldung konnte nicht gespeichert werden',
  EMAIL_ALREADY_REGISTERED: `Diese E-Mail ist bereits als ${BRAND.shortName}-Profil registriert`,
  CODE_GENERATION_ERROR: 'Code-Generierung fehlgeschlagen. Bitte erneut versuchen.',
  RATE_LIMITED: 'Zu viele Versuche. Bitte warte eine Minute.',
  REGISTRATION_FIELDS_REQUIRED: 'Bitte alle Pflichtfelder ausfüllen.',
  REGISTRATION_FIELDS_REQUIRED_CORRECT: 'Bitte alle Pflichtfelder korrekt ausfüllen.',

  // ─── House rules ───────────────────────────────────────────────
  RULE_NOT_FOUND: 'Regel nicht gefunden',
  RULE_SAVE_ERROR: 'Regel konnte nicht gespeichert werden',
  RULE_ACKNOWLEDGE_ERROR: 'Bestätigung konnte nicht gespeichert werden',
  RULE_SYNC_ERROR: `${BRAND.orgName}-Regeln konnten nicht abgeglichen werden`,
  ORG_RULE_IMMUTABLE: `Diese ${BRAND.orgName}-Regel ist nicht verhandelbar und kann nicht durch einen Hausbeschluss geändert werden`,

  // ─── Proposals / voting ────────────────────────────────────────
  PROPOSAL_NOT_FOUND: 'Vorschlag nicht gefunden',
  PROPOSAL_CREATE_ERROR: 'Vorschlag konnte nicht erstellt werden',
  PROPOSAL_NOT_OPEN: 'Über diesen Vorschlag kann nicht mehr abgestimmt werden',
  PROPOSAL_NOT_VOTING: 'Die Abstimmung hat noch nicht begonnen',
  PROPOSAL_ALREADY_DECIDED: 'Dieser Vorschlag wurde bereits entschieden',
  PROPOSAL_STAFF_ONLY:
    'Über dieses Thema wird nicht abgestimmt — es schützt Einzelne. Die Betreuung nimmt Ihr Anliegen entgegen.',
  VOTE_SAVE_ERROR: 'Stimme konnte nicht gespeichert werden',
  VOTE_REASON_REQUIRED: 'Bitte begründen Sie Ihr Veto, damit darüber gesprochen werden kann',
  VOTE_NOT_ELIGIBLE: 'Nur Bewohnende dieses Hauses können abstimmen',
  UNIT_TOO_SMALL_FOR_VOTE:
    'In diesem Haus wohnen zu wenige Personen für eine Abstimmung. Die Betreuung legt die Hausregeln gemeinsam mit Ihnen fest.',

  // ─── Conflict resolution ───────────────────────────────────────
  AGREEMENT_NOT_FOUND: 'Abmachung nicht gefunden',
  AGREEMENT_SAVE_ERROR: 'Abmachung konnte nicht gespeichert werden',
  AGREEMENT_PARTIES_REQUIRED: 'Eine Abmachung braucht mindestens zwei Beteiligte',
  RESOLUTION_STAGE_ERROR: 'Der Bearbeitungsschritt konnte nicht geändert werden',

  // ─── Shared expenses ───────────────────────────────────────────
  EXPENSE_NOT_FOUND: 'Ausgabe nicht gefunden',
  EXPENSE_CREATE_ERROR: 'Ausgabe konnte nicht gespeichert werden',
  EXPENSE_DELETE_ERROR: 'Ausgabe konnte nicht gelöscht werden',
  EXPENSE_DELETE_FORBIDDEN: 'Nur wer die Ausgabe bezahlt oder erfasst hat, kann sie löschen',
  EXPENSE_MEMBER_INVALID: 'Alle Beteiligten müssen aktuell in dieser Wohnung wohnen',
  SETTLEMENT_CREATE_ERROR: 'Zahlung konnte nicht gespeichert werden',
  SETTLEMENT_SELF: 'Sie können keine Zahlung an sich selbst erfassen',

  // ─── Resident profile / apartment profile ──────────────────────
  PROFILE_UPDATE_ERROR: 'Profil konnte nicht gespeichert werden',
  PHOTO_TOO_LARGE: 'Das Foto ist zu gross (max. 500 KB)',
  PHOTO_TYPE_INVALID: 'Nur JPG, PNG oder WebP werden unterstützt',
  PHOTO_UPLOAD_ERROR: 'Foto konnte nicht gespeichert werden',
  PHOTO_DELETE_ERROR: 'Foto konnte nicht entfernt werden',
  APARTMENT_UPDATE_ERROR: 'Wohnungsname konnte nicht gespeichert werden',
} as const

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES
