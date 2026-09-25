import Link from 'next/link'
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_CATEGORY_ICONS,
  UI_LABELS,
  UNIT_INCIDENT_LABELS,
} from '@/lib/constants'
import { getSeverityBorderClass, formatRelativeDate } from '@/lib/utils'
import { residentInitials, residentName, type NamedResident } from '@/lib/utils/resident-name'

interface Incident {
  id: string
  type: string
  category: string
  severity: string
  description: string
  date: Date | string
  resolvedAt: Date | string | null
  resolution: string | null
  subjectId: string | null
  reportedBy: NamedResident | null
  subject: NamedResident | null
}

interface Props {
  unitId: string
  incidents: Incident[]
  interpersonalCount: number
  maintenanceCount: number
}

export function UnitIncidentSection({
  unitId,
  incidents,
  interpersonalCount,
  maintenanceCount,
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ui-text">{UNIT_INCIDENT_LABELS.title}</h2>
        <Link href={`/incidents/new?unit=${unitId}`} className="btn-outline text-sm">
          {UNIT_INCIDENT_LABELS.newIncident}
        </Link>
      </div>

      <div className="mb-4">
        <div className="flex gap-2 border-b border-ui-border">
          <TabButton active>
            {UNIT_INCIDENT_LABELS.tabs.all} ({incidents.length})
          </TabButton>
          <TabButton>
            {UNIT_INCIDENT_LABELS.tabs.conflicts} ({interpersonalCount})
          </TabButton>
          <TabButton>
            {UNIT_INCIDENT_LABELS.tabs.maintenance} ({maintenanceCount})
          </TabButton>
        </div>
      </div>

      {incidents.length === 0 ? (
        <p className="text-ui-muted text-center py-8">{UNIT_INCIDENT_LABELS.noIncidents}</p>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      )}
    </div>
  )
}

function IncidentCard({ incident }: { incident: Incident }) {
  const categoryIcon = INCIDENT_CATEGORY_ICONS[incident.category] || '💬'

  return (
    <div
      className={`p-4 bg-ui-subtle rounded-lg border-l-4 ${getSeverityBorderClass(incident.severity)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-lg" aria-hidden="true">
            {categoryIcon}
          </span>
          <div>
            <p className="font-medium text-ui-text">
              {INCIDENT_TYPE_LABELS[incident.type] || incident.type}
            </p>
            <p className="text-sm text-ui-muted mt-1">{incident.description}</p>
            {incident.subject && (
              <p className="text-sm text-ui-muted mt-1">
                Betrifft: {residentName(incident.subject)}
              </p>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-ui-muted">{formatRelativeDate(incident.date)}</p>
          {incident.resolvedAt ? (
            <span className="badge badge-active">{UI_LABELS.resolved}</span>
          ) : (
            <span className="badge badge-pending">{UI_LABELS.open}</span>
          )}
        </div>
      </div>
      {incident.resolution && (
        <div className="mt-3 pt-3 border-t border-ui-border">
          <p className="text-sm text-ui-muted">
            <span className="font-medium">{UI_LABELS.solution}</span> {incident.resolution}
          </p>
        </div>
      )}
    </div>
  )
}

function TabButton({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-brand-primary text-brand-primary'
          : 'border-transparent text-ui-muted hover:text-ui-muted'
      }`}
    >
      {children}
    </button>
  )
}
