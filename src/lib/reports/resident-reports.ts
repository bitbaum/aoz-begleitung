/**
 * "Ihre Meldungen" — one list of everything a resident reported, pure.
 *
 * A resident does not know, and should not have to know, that a conflict is
 * worked on the incident ladder while a broken tap is worked on the maintenance
 * board. They reported something; they want to know what happened to it. So the
 * two tables are folded into one view model here, and the answer staff wrote
 * travels with it — a resolution stored and never shown is the same as no
 * answer at all.
 */

import type { MaintenanceStatus } from '@/lib/db'
import { INCIDENT_TYPE_LABELS, MAINTENANCE_CATEGORY_LABELS, getLabel } from '@/lib/constants'

/**
 * Anchor for the dashboard card that shows this list.
 *
 * Lives here, not on the card component: the report FORM links to it and is a
 * client component, so importing it from the server-rendered card would drag
 * that whole module into the client bundle.
 */
export const RESIDENT_REPORTS_ANCHOR = 'meine-meldungen'

export type ResidentReportKind = 'INCIDENT' | 'MAINTENANCE'

export interface ResidentReport {
  id: string
  kind: ResidentReportKind
  /** What was reported, in the resident's language. */
  title: string
  description: string
  reportedAt: Date
  isDone: boolean
  /** What staff wrote back. Null while nobody has answered yet. */
  answer: string | null
}

export interface IncidentReportRow {
  id: string
  type: string
  description: string
  date: Date
  resolvedAt: Date | null
  resolution: string | null
}

export interface MaintenanceReportRow {
  id: string
  category: string
  description: string
  createdAt: Date
  status: MaintenanceStatus
  resolution: string | null
}

/** Terminal maintenance states — nothing further will happen to the request. */
const CLOSED_MAINTENANCE_STATUSES: MaintenanceStatus[] = ['COMPLETED', 'CANCELLED']

export function fromIncident(row: IncidentReportRow): ResidentReport {
  return {
    id: row.id,
    kind: 'INCIDENT',
    title: getLabel(INCIDENT_TYPE_LABELS, row.type),
    description: row.description,
    reportedAt: row.date,
    isDone: row.resolvedAt !== null,
    answer: row.resolution,
  }
}

export function fromMaintenanceRequest(row: MaintenanceReportRow): ResidentReport {
  return {
    id: row.id,
    kind: 'MAINTENANCE',
    title: getLabel(MAINTENANCE_CATEGORY_LABELS, row.category),
    description: row.description,
    reportedAt: row.createdAt,
    isDone: CLOSED_MAINTENANCE_STATUSES.includes(row.status),
    answer: row.resolution,
  }
}

/**
 * Newest first, and open before done at the same instant: an unanswered report
 * is the one the resident came to the page for.
 */
export function mergeResidentReports(
  incidents: IncidentReportRow[],
  maintenance: MaintenanceReportRow[],
  /**
   * Omit to get everything. The dashboard shows a preview and passes a limit;
   * the reports page passes none, because a list that silently drops the sixth
   * report is how a resident ends up unable to find something they filed.
   */
  limit?: number,
): ResidentReport[] {
  const all = [...incidents.map(fromIncident), ...maintenance.map(fromMaintenanceRequest)].sort(
    (a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
      return b.reportedAt.getTime() - a.reportedAt.getTime()
    },
  )

  return limit === undefined ? all : all.slice(0, limit)
}
