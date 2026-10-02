/**
 * What each permission means, in the words a colleague would use.
 *
 * The access-denied page needs to say what was missing WITHOUT printing an
 * internal token like `placements:write` at a caseworker. Keyed by the
 * permission itself and exhaustively checked against ROLE_PERMISSIONS by
 * `permission-descriptions.test.ts`, so a new permission cannot ship without
 * a human-readable name.
 */

import {
  SYSTEM_ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  type StaffPermission,
} from '@/lib/auth/role-policy'
import { LEARNING_AREA_NAME } from './learning'
import { OPPORTUNITY_AREA_NAME } from './opportunities'

export const PERMISSION_DESCRIPTIONS: Record<StaffPermission, string> = {
  'dashboard:read': 'das Dashboard ansehen',
  'residents:read': 'Klient*innen ansehen',
  'residents:write': 'Klient*innen erfassen und bearbeiten',
  'housing:read': 'Unterkünfte ansehen',
  'housing:write': 'Unterkünfte erfassen und bearbeiten',
  'placements:read': 'Platzierungen ansehen',
  'placements:write': 'platzieren, verlegen und Matching durchführen',
  'incidents:read': 'Vorfälle ansehen',
  'incidents:write': 'Vorfälle erfassen und bearbeiten',
  'maintenance:read': 'Wartungstickets ansehen',
  'maintenance:write': 'Wartungstickets bearbeiten',
  'learning:read': `${LEARNING_AREA_NAME} ansehen`,
  'learning:write': `Nachweise in ${LEARNING_AREA_NAME} erfassen`,
  'export:read': 'Daten exportieren',
  'marketplace:read': 'den Marktplatz ansehen',
  'marketplace:moderate': 'den Marktplatz moderieren',
  'events:read': 'Veranstaltungen ansehen',
  'events:write': 'Veranstaltungen erstellen',
  'opportunities:read': `${OPPORTUNITY_AREA_NAME} und laufende Einsätze ansehen`,
  'opportunities:write': `${OPPORTUNITY_AREA_NAME} erfassen und Personen zuordnen`,
  'activities:read': 'externe Aktivitäten ansehen',
  'ai:assist': 'den KI-Assistenten beim Schreiben nutzen',
  'activities:write': 'externe Aktivitäten erfassen und veröffentlichen',
  'messages:read': 'Nachrichten von Klient*innen lesen und beantworten',
  // Deliberately vague about WHICH angaben: the page shows only the kinds this
  // role may see for the clients it holds, so a precise list here would be
  // wrong for three of the four roles that hold it.
  'clientFacts:read': 'Selbst erfasste Angaben der eigenen Klient*innen prüfen',
  // Answering the household, not reading its rules — the rule book itself stays
  // on housing:read so the person who runs the building can read it.
  'governance:confirm': 'Anträge der Häuser beantworten und den Regelkatalog pflegen',
  'surveys:read': 'Ergebnisse anonymer Umfragen zusammengefasst einsehen',
  'surveys:write': 'Anonyme Umfragen erstellen, an Klient*innen senden und schliessen',
  'documents:read': 'Lebenslauf, Zeugnisse und Referenzen einsehen',
  'documents:write': 'Lebenslauf, Zeugnisse und Referenzen hinzufügen und entfernen',
  'users:manage': 'Benutzer*innen und Einstellungen verwalten',
  'system:configure': 'Systemeinstellungen ändern',
  'import:write': 'Daten importieren',
  'complaints:read': 'Beschwerden über die Organisation einsehen',
  'complaints:respond': 'Beschwerden über die Organisation beantworten',
}

/**
 * Which roles hold a permission — DERIVED from the policy, never listed by
 * hand. "Ask someone who can" is only useful if the names are still true
 * after the next permission change.
 */
export function rolesWithPermission(permission: string): string[] {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, permissions]) => (permissions as readonly string[]).includes(permission))
    .map(([role]) => role)
}

/**
 * Is this something only a system administrator can do?
 *
 * These three are held by a PERSON, not by a role — `User.isSystemAdmin` —
 * so no list of roles can answer "who do I ask". The page has to say
 * "whoever administers this instance" instead of naming a role nobody holds.
 */
export function isSystemAdminPermission(permission: string): boolean {
  return (SYSTEM_ADMIN_PERMISSIONS as readonly string[]).includes(permission)
}

/** Type guard so a hand-typed query string cannot index the record blindly. */
export function isKnownPermission(value: string): value is StaffPermission {
  return value in PERMISSION_DESCRIPTIONS
}
