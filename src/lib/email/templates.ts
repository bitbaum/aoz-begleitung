/**
 * Email templates — all content in German (Swiss spelling).
 * Each function returns { subject, html } for use with sendEmail/notifyStaff.
 */

import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_CATEGORY_LABELS,
  SUPPORT_LEVEL_LABELS,
  INCIDENT_TYPE_LABELS,
  MAINTENANCE_CATEGORY_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
} from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'
import { getAppUrl } from '@/lib/config/app-url'
import { EMAIL_COLORS } from './tokens'
import { formatDateNumeric } from '@/lib/utils/formatting'

// -- Template data interfaces --

interface OverdueIncident {
  id: string
  description: string
  severity: string
  housingUnitCode?: string
  nextFollowUpDate: Date
}

interface OverdueResident {
  code: string
  supportLevel: string
  lastCheckInDate: Date | null
  daysSinceLastCheckIn: number
}

interface LowSatisfactionData {
  residentCode: string
  housingUnitCode: string
  overallSatisfaction: number
  concerns?: string | null
}

interface TransferRequestData {
  residentCode: string
  currentUnitCode: string
  reason: string
  targetUnitCode?: string
}

interface NewIncidentData {
  residentCode: string
  housingUnitCode: string
  category: string
  type: string
  severity: string
  description: string
  subjectCode?: string
  requestedMediation: boolean
}

// -- HTML escaping for user-controlled data --

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// -- Shared styles --

const FONT = 'font-family: Arial, sans-serif;'

const STYLES = {
  table: `border-collapse: collapse; width: 100%; ${FONT} font-size: 14px;`,
  th: `background-color: ${EMAIL_COLORS.surfaceHeader}; padding: 8px 12px; text-align: left; border: 1px solid ${EMAIL_COLORS.borderStrong}; font-weight: 600;`,
  td: `padding: 8px 12px; border: 1px solid ${EMAIL_COLORS.borderStrong};`,
  header: `${FONT} color: ${EMAIL_COLORS.text}; margin-bottom: 16px;`,
  paragraph: `${FONT} color: ${EMAIL_COLORS.textBody}; font-size: 14px; line-height: 1.5;`,
  warning: `background-color: ${EMAIL_COLORS.dangerBg}; border: 1px solid ${EMAIL_COLORS.dangerBorder}; border-radius: 6px; padding: 16px; margin-bottom: 16px;`,
  footer: `${FONT} color: ${EMAIL_COLORS.textMuted}; font-size: 12px; margin-top: 24px; border-top: 1px solid ${EMAIL_COLORS.border}; padding-top: 12px;`,
  panel: `background-color: ${EMAIL_COLORS.surfaceSubtle}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 6px; padding: 16px; margin-bottom: 16px;`,
  alertHeading: `${FONT} color: ${EMAIL_COLORS.dangerStrong}; margin: 0 0 12px 0;`,
  codePanel: `background-color: ${EMAIL_COLORS.infoBg}; border: 1px solid ${EMAIL_COLORS.infoBorder}; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;`,
} as const

function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return EMAIL_COLORS.danger
    case 'HIGH':
      return EMAIL_COLORS.danger
    case 'MEDIUM':
      return EMAIL_COLORS.warning
    case 'LOW':
      return EMAIL_COLORS.muted
    default:
      return EMAIL_COLORS.textBody
  }
}

const severityLabel = (severity: string) => INCIDENT_SEVERITY_LABELS[severity] ?? severity

function maintenancePriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT':
      return EMAIL_COLORS.danger
    case 'HIGH':
      return EMAIL_COLORS.warning
    case 'LOW':
      return EMAIL_COLORS.muted
    default:
      return EMAIL_COLORS.textBody
  }
}
const supportLevelLabel = (level: string) => SUPPORT_LEVEL_LABELS[level] ?? level

function supportLevelColor(level: string): string {
  switch (level) {
    case 'INTENSIVE':
      return EMAIL_COLORS.danger
    case 'ELEVATED':
      return EMAIL_COLORS.warning
    default:
      return EMAIL_COLORS.textBody
  }
}

function stars(rating: number): string {
  return '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating)
}

function emailFooter(): string {
  return `<p style="${STYLES.footer}">Diese E-Mail wurde automatisch vom ${BRAND.productName} System generiert.</p>`
}

// -- Template functions --

export function incidentFollowUpReminder(incidents: OverdueIncident[]): {
  subject: string
  html: string
} {
  const subject = `[${BRAND.productName}] ${incidents.length} überfällige Nachverfolgungen`

  const rows = incidents
    .map(
      (i) => `
    <tr>
      <td style="${STYLES.td}">${i.id.slice(-8)}</td>
      <td style="${STYLES.td}">${escapeHtml(i.description)}</td>
      <td style="${STYLES.td}"><span style="color: ${severityColor(i.severity)}; font-weight: 600;">${severityLabel(i.severity)}</span></td>
      <td style="${STYLES.td}">${i.housingUnitCode ? escapeHtml(i.housingUnitCode) : '-'}</td>
      <td style="${STYLES.td}">${formatDateNumeric(i.nextFollowUpDate)}</td>
    </tr>
  `,
    )
    .join('')

  const html = `
    <h2 style="${STYLES.header}">Überfällige Nachverfolgungen</h2>
    <p style="${STYLES.paragraph}">${incidents.length} Vorfall/Vorfälle benötigen dringend eine Nachverfolgung:</p>
    <table style="${STYLES.table}">
      <thead>
        <tr>
          <th style="${STYLES.th}">ID</th>
          <th style="${STYLES.th}">Beschreibung</th>
          <th style="${STYLES.th}">Schweregrad</th>
          <th style="${STYLES.th}">Wohneinheit</th>
          <th style="${STYLES.th}">Fällig seit</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    ${emailFooter()}
  `

  return { subject, html }
}

export function checkInReminder(overdueResidents: OverdueResident[]): {
  subject: string
  html: string
} {
  const subject = `[${BRAND.productName}] ${overdueResidents.length} Check-ins überfällig`

  const rows = overdueResidents
    .map(
      (r) => `
    <tr>
      <td style="${STYLES.td}">${escapeHtml(r.code)}</td>
      <td style="${STYLES.td}"><span style="color: ${supportLevelColor(r.supportLevel)}; font-weight: 600;">${supportLevelLabel(r.supportLevel)}</span></td>
      <td style="${STYLES.td}">${r.lastCheckInDate ? formatDateNumeric(r.lastCheckInDate) : 'Nie'}</td>
      <td style="${STYLES.td}">${r.daysSinceLastCheckIn} Tage</td>
    </tr>
  `,
    )
    .join('')

  const html = `
    <h2 style="${STYLES.header}">Überfällige Check-ins</h2>
    <p style="${STYLES.paragraph}">${overdueResidents.length} Klient*innen benötigen einen Check-in:</p>
    <table style="${STYLES.table}">
      <thead>
        <tr>
          <th style="${STYLES.th}">Klient*in</th>
          <th style="${STYLES.th}">Betreuungsstufe</th>
          <th style="${STYLES.th}">Letzter Check-in</th>
          <th style="${STYLES.th}">Überfällig</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    ${emailFooter()}
  `

  return { subject, html }
}

export function lowSatisfactionAlert(data: LowSatisfactionData): { subject: string; html: string } {
  const subject = `[${BRAND.productName}] Niedrige Zufriedenheit: ${data.residentCode}`

  const html = `
    <div style="${STYLES.warning}">
      <h2 style="${STYLES.alertHeading}">Niedrige Zufriedenheit gemeldet</h2>
      <p style="${STYLES.paragraph}">
        <strong>Klient*in:</strong> ${escapeHtml(data.residentCode)}<br>
        <strong>Wohneinheit:</strong> ${escapeHtml(data.housingUnitCode)}<br>
        <strong>Bewertung:</strong> <span style="font-size: 18px; color: ${EMAIL_COLORS.danger};">${stars(data.overallSatisfaction)}</span> (${data.overallSatisfaction}/5)
      </p>
      ${data.concerns ? `<p style="${STYLES.paragraph}"><strong>Anliegen:</strong> ${escapeHtml(data.concerns)}</p>` : ''}
    </div>
    <p style="${STYLES.paragraph}">Bitte prüfen Sie die Situation und kontaktieren Sie die*den Klient*in zeitnah.</p>
    ${emailFooter()}
  `

  return { subject, html }
}

const categoryLabel = (category: string) => INCIDENT_CATEGORY_LABELS[category] ?? category

const typeLabel = (type: string) => INCIDENT_TYPE_LABELS[type] ?? type

export function newIncidentNotification(data: NewIncidentData): { subject: string; html: string } {
  const subject = `[${BRAND.productName}] Neuer Vorfall: ${typeLabel(data.type)} (${severityLabel(data.severity)})`

  const html = `
    <div style="${STYLES.warning}">
      <h2 style="${STYLES.alertHeading}">Neuer Vorfall gemeldet</h2>
      <p style="${STYLES.paragraph}">
        <strong>Gemeldet von:</strong> ${escapeHtml(data.residentCode)}<br>
        <strong>Wohneinheit:</strong> ${escapeHtml(data.housingUnitCode)}<br>
        <strong>Kategorie:</strong> ${categoryLabel(data.category)}<br>
        <strong>Typ:</strong> ${typeLabel(data.type)}<br>
        <strong>Schweregrad:</strong> <span style="color: ${severityColor(data.severity)}; font-weight: 600;">${severityLabel(data.severity)}</span>
        ${data.subjectCode ? `<br><strong>Betroffene Person:</strong> ${escapeHtml(data.subjectCode)}` : ''}
        ${data.requestedMediation ? `<br><strong>Vermittlung gewünscht:</strong> Ja` : ''}
      </p>
    </div>
    <div style="${STYLES.panel}">
      <h3 style="${FONT} color: ${EMAIL_COLORS.textBody}; margin: 0 0 8px 0; font-size: 14px;">Beschreibung</h3>
      <p style="${STYLES.paragraph}">${escapeHtml(data.description)}</p>
    </div>
    <p style="${STYLES.paragraph}">Bitte prüfen Sie den Vorfall im ${BRAND.productName} System.</p>
    ${emailFooter()}
  `

  return { subject, html }
}

interface NewMaintenanceRequestData {
  residentCode: string
  housingUnitCode: string
  category: string
  priority: string
  title: string
  description: string
  location: string | null
}

/**
 * A resident reported something broken. This goes to the maintenance board, not
 * onto the conflict ladder — so it needs its own notification rather than being
 * announced as a "Vorfall", which would read to staff as a conflict.
 */
export function newMaintenanceRequestNotification(data: NewMaintenanceRequestData): {
  subject: string
  html: string
} {
  const priority = MAINTENANCE_PRIORITY_LABELS[data.priority] ?? data.priority
  const category = MAINTENANCE_CATEGORY_LABELS[data.category] ?? data.category
  const subject = `[${BRAND.productName}] Neue Wartungsanfrage: ${escapeHtml(data.title)} (${priority})`

  const html = `
    <div style="${STYLES.panel}">
      <h2 style="${STYLES.header}">Neue Wartungsanfrage</h2>
      <p style="${STYLES.paragraph}">
        <strong>Gemeldet von:</strong> ${escapeHtml(data.residentCode)}<br>
        <strong>Wohneinheit:</strong> ${escapeHtml(data.housingUnitCode)}<br>
        <strong>Bereich:</strong> ${escapeHtml(category)}<br>
        <strong>Dringlichkeit:</strong> <span style="color: ${maintenancePriorityColor(data.priority)}; font-weight: 600;">${escapeHtml(priority)}</span>
        ${data.location ? `<br><strong>Ort:</strong> ${escapeHtml(data.location)}` : ''}
      </p>
    </div>
    <div style="${STYLES.panel}">
      <h3 style="${FONT} color: ${EMAIL_COLORS.textBody}; margin: 0 0 8px 0; font-size: 14px;">Beschreibung</h3>
      <p style="${STYLES.paragraph}">${escapeHtml(data.description)}</p>
    </div>
    <p style="${STYLES.paragraph}">Die Anfrage liegt unter Wartung im ${BRAND.productName} System.</p>
    ${emailFooter()}
  `

  return { subject, html }
}

// -- Staff invite template --

interface StaffInviteData {
  recipientEmail: string
  staffCode: string
  invitedByName: string
  appUrl: string
}

export function staffInviteEmail(data: StaffInviteData): { subject: string; html: string } {
  const subject = `Einladung zu ${BRAND.productName}`
  const loginUrl = `${data.appUrl}/login?code=${data.staffCode}`

  const html = `
    <h2 style="${STYLES.header}">Willkommen bei ${BRAND.productName}</h2>
    <p style="${STYLES.paragraph}">
      ${escapeHtml(data.invitedByName)} hat Sie zum ${BRAND.productName} System eingeladen.
    </p>
    <div style="${STYLES.codePanel}">
      <p style="${FONT} color: ${EMAIL_COLORS.info}; font-size: 13px; margin: 0 0 8px 0;">Ihr persönlicher Zugangscode</p>
      <p style="font-family: monospace; font-size: 28px; font-weight: 700; color: ${EMAIL_COLORS.infoStrong}; letter-spacing: 3px; margin: 0 0 16px 0;">${escapeHtml(data.staffCode)}</p>
      <a href="${loginUrl}" style="display: inline-block; background-color: ${EMAIL_COLORS.info}; color: ${EMAIL_COLORS.onAccent}; text-decoration: none; padding: 12px 28px; border-radius: 6px; ${FONT} font-size: 14px; font-weight: 600;">
        Jetzt anmelden
      </a>
    </div>
    <p style="${STYLES.paragraph}">
      Oder öffnen Sie <a href="${data.appUrl}/login" style="color: ${EMAIL_COLORS.info};">${data.appUrl}/login</a> und geben Sie Ihren Code manuell ein.
    </p>
    <p style="${STYLES.paragraph}">
      Bewahren Sie Ihren Code sicher auf — er ist Ihr persönlicher Zugang zum System.
    </p>
    ${emailFooter()}
  `

  return { subject, html }
}

// -- Account flow templates (email verification, password reset) --

/** The raw token travels ONLY inside `link`; never log or echo it elsewhere. */
export function verifyEmailEmail(data: { link: string }): { subject: string; html: string } {
  const subject = `E-Mail-Adresse bestätigen — ${BRAND.productName}`

  const html = `
    <h2 style="${STYLES.header}">E-Mail-Adresse bestätigen</h2>
    <p style="${STYLES.paragraph}">
      Ihr Konto bei ${BRAND.productName} wurde mit dieser E-Mail-Adresse erstellt.
      Bestätigen Sie die Adresse, damit die Passwort-Wiederherstellung sicher funktioniert.
    </p>
    <p style="${STYLES.paragraph}">
      <a href="${data.link}" style="display: inline-block; background-color: ${EMAIL_COLORS.info}; color: ${EMAIL_COLORS.onAccent}; text-decoration: none; padding: 12px 28px; border-radius: 6px; ${FONT} font-size: 14px; font-weight: 600;">
        E-Mail bestätigen
      </a>
    </p>
    <p style="${STYLES.paragraph}">
      Falls Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.
    </p>
    ${emailFooter()}
  `

  return { subject, html }
}

/** The raw token travels ONLY inside `link`; never log or echo it elsewhere. */
export function passwordResetEmail(data: { link: string }): { subject: string; html: string } {
  const subject = `Passwort zurücksetzen — ${BRAND.productName}`

  const html = `
    <h2 style="${STYLES.header}">Passwort zurücksetzen</h2>
    <p style="${STYLES.paragraph}">
      Sie haben ein neues Passwort für ${BRAND.productName} angefordert.
      Der Link ist eine Stunde lang gültig.
    </p>
    <p style="${STYLES.paragraph}">
      <a href="${data.link}" style="display: inline-block; background-color: ${EMAIL_COLORS.info}; color: ${EMAIL_COLORS.onAccent}; text-decoration: none; padding: 12px 28px; border-radius: 6px; ${FONT} font-size: 14px; font-weight: 600;">
        Neues Passwort setzen
      </a>
    </p>
    <p style="${STYLES.paragraph}">
      Falls Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren —
      Ihr Passwort bleibt unverändert.
    </p>
    ${emailFooter()}
  `

  return { subject, html }
}

export function newTransferRequestNotification(data: TransferRequestData): {
  subject: string
  html: string
} {
  const subject = `[${BRAND.productName}] Neue Verlegungsanfrage: ${data.residentCode}`

  const html = `
    <h2 style="${STYLES.header}">Neue Verlegungsanfrage</h2>
    <p style="${STYLES.paragraph}">
      <strong>Klient*in:</strong> ${escapeHtml(data.residentCode)}<br>
      <strong>Aktuelle Wohneinheit:</strong> ${escapeHtml(data.currentUnitCode)}<br>
      ${data.targetUnitCode ? `<strong>Gewünschte Wohneinheit:</strong> ${escapeHtml(data.targetUnitCode)}<br>` : ''}
      <strong>Grund:</strong> ${escapeHtml(data.reason)}
    </p>
    <p style="${STYLES.paragraph}">Bitte prüfen Sie die Anfrage im ${BRAND.productName} System.</p>
    ${emailFooter()}
  `

  return { subject, html }
}

/**
 * Insurances and permits running out — a POINTER, never the facts themselves.
 *
 * Who may read a client fact is decided per person by `mayReadFact`: an
 * insurance is for Betreuung and Sozialarbeit, a permit additionally for the
 * Jobcoach, and Liegenschaften sees neither. Email cannot honour that.
 * `notifyStaff` sends to one shared address out of `STAFF_EMAIL_RECIPIENTS`,
 * so anything written into this body reaches every reader of that inbox
 * regardless of role — and it is exactly the sensitive half: who, which
 * insurer, which permit letter.
 *
 * So the email carries a COUNT and a link. The page behind the link applies
 * the reader policy to whoever actually signs in. The mail's job is to make
 * someone look before a document lapses, and it does that job without becoming
 * the leak. Same rule the rest of this codebase follows: the payload is the
 * leak, not the markup.
 *
 * Restating the count in the subject is deliberate — a notification preview is
 * often all that gets read on a phone, and "3" is not a disclosure.
 */
export function renewalReminder(
  count: number,
  soonestDaysLeft: number,
): {
  subject: string
  html: string
} {
  const noun = count === 1 ? 'Dokument läuft' : 'Dokumente laufen'
  const subject = `[${BRAND.productName}] ${count} ${noun} ab`

  const urgency =
    soonestDaysLeft < 0
      ? 'Mindestens eines ist bereits abgelaufen.'
      : soonestDaysLeft === 0
        ? 'Mindestens eines läuft heute ab.'
        : soonestDaysLeft === 1
          ? 'Das dringendste läuft morgen ab.'
          : `Das dringendste läuft in ${soonestDaysLeft} Tagen ab.`

  const url = `${getAppUrl()}/approvals`

  const html = `
    <h2 style="${STYLES.header}">Krankenversicherungen und Ausweise</h2>
    <p style="${STYLES.paragraph}">
      ${count} ${noun} demnächst ab. ${urgency}
    </p>
    <p style="${STYLES.paragraph}">
      Wer betroffen ist, steht in ${BRAND.productName} — dort sieht jede
      Fachperson genau die Angaben, für die sie zuständig ist:<br>
      <a href="${url}">${url}</a>
    </p>
    ${emailFooter()}
  `

  return { subject, html }
}
