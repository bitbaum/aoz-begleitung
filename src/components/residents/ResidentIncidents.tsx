import Link from 'next/link'
import type { Incident, HousingUnit } from '@/lib/db'
import {
  INCIDENT_TYPE_LABELS,
  RESIDENT_INCIDENTS_LABELS,
  UI_LABELS,
  getLabel,
} from '@/lib/constants'
import { getSeverityBorderClass, formatRelativeDate } from '@/lib/utils'
import { INCIDENT_THRESHOLDS, getIncidentLevel, INCIDENT_BG_COLORS } from '@/lib/config/thresholds'

type IncidentWithUnit = Incident & { housingUnit: HousingUnit }

interface ResidentIncidentsProps {
  incidentsAsSubject: IncidentWithUnit[]
  incidentsReportedCount: number
  currentPlacement: { id: string; housingUnitId: string } | null
  residentId: string
  canWriteIncidents?: boolean
}

export function ResidentIncidents({
  incidentsAsSubject,
  incidentsReportedCount,
  currentPlacement,
  residentId,
  canWriteIncidents = false,
}: ResidentIncidentsProps) {
  const subjectLevel = getIncidentLevel(incidentsAsSubject.length)

  return (
    <>
      {/* Incident involvement — facts, never a recommendation about the person */}
      <div className="card">
        <h2 className="text-lg font-semibold text-ui-text mb-4">
          {RESIDENT_INCIDENTS_LABELS.sectionTitle}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-ui-subtle rounded-lg">
            <p className="text-sm text-ui-muted">{RESIDENT_INCIDENTS_LABELS.reportedLabel}</p>
            <p className="text-xl sm:text-2xl font-bold text-ui-text">{incidentsReportedCount}</p>
            <p className="text-xs text-ui-muted mt-1">{RESIDENT_INCIDENTS_LABELS.reportedDesc}</p>
          </div>
          <div className={`p-4 rounded-lg ${INCIDENT_BG_COLORS[subjectLevel]}`}>
            <p className="text-sm text-ui-muted">{RESIDENT_INCIDENTS_LABELS.subjectLabel}</p>
            <p
              className={`text-2xl font-bold ${
                subjectLevel === 'severe'
                  ? 'text-status-error-text'
                  : subjectLevel !== 'none'
                    ? 'text-status-warning-text'
                    : 'text-ui-text'
              }`}
            >
              {incidentsAsSubject.length}
            </p>
            <p className="text-xs text-ui-muted mt-1">{RESIDENT_INCIDENTS_LABELS.subjectDesc}</p>
          </div>
        </div>
      </div>

      {/* Recent Incidents List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ui-text">
            {RESIDENT_INCIDENTS_LABELS.subjectTitle(incidentsAsSubject.length)}
          </h2>
          {currentPlacement && canWriteIncidents && (
            <Link
              href={`/incidents/new?subject=${residentId}&unit=${currentPlacement.housingUnitId}`}
              className="btn-outline text-sm"
            >
              {RESIDENT_INCIDENTS_LABELS.reportIncident}
            </Link>
          )}
        </div>
        {incidentsAsSubject.length === 0 ? (
          <p className="text-ui-muted text-center py-8">{RESIDENT_INCIDENTS_LABELS.noIncidents}</p>
        ) : (
          <div className="space-y-3">
            {incidentsAsSubject.map((incident) => (
              <div
                key={incident.id}
                className={`p-4 bg-ui-subtle rounded-lg border-l-4 ${getSeverityBorderClass(
                  incident.severity,
                )}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ui-text">
                      {getLabel(INCIDENT_TYPE_LABELS, incident.type)}
                    </p>
                    <p className="text-sm text-ui-muted mt-1">{incident.description}</p>
                    <p className="text-sm text-ui-muted mt-1">
                      {incident.housingUnit.code} · {formatRelativeDate(incident.date)}
                    </p>
                  </div>
                  {incident.resolvedAt ? (
                    <span className="badge badge-active">{UI_LABELS.resolved}</span>
                  ) : (
                    <span className="badge badge-pending">{UI_LABELS.open}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
