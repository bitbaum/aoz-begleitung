'use client'

/**
 * ClientBoard — Fachpersonen client overview
 *
 * Each card surfaces what matters for the viewer's role:
 *   BETREUUNG      → housing unit + check-in urgency (primary)
 *   SOZIALARBEIT   → social next-step + check-in urgency
 *   JOBCOACH       → work status + job goal + German level
 *   FREIWILLIGENARBEIT → engagement status + interest area
 *   ADMIN          → full overview
 *
 * Filtering lives on the page (config/client-filters.ts) — the board only
 * renders what it is given.
 *
 * Information hierarchy:
 *   1. WHO (name, code, support level)
 *   2. STATUS (is action needed NOW → overdue check-in, unhoused, missing role info)
 *   3. CONTEXT (role-specific progress detail)
 *   4. TEAM (care seat chips — gaps shown as dashed)
 */

import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  Home,
  User,
  Briefcase,
  Heart,
  BookOpen,
  TriangleAlert,
  CheckCircle2,
} from 'lucide-react'
import { GENDER_LABELS_SHORT, RESIDENT_LIST_LABELS, getLabel } from '@/lib/constants'
import { SUPPORT_LEVEL_LABELS, CLIENT_BOARD_LABELS } from '@/lib/constants/labels/residents'
import { CARE_ROLE_LABELS, type CareRoleId } from '@/lib/config/care'
import { residentInitials, residentName } from '@/lib/utils/resident-name'
import type { StaffRole } from '@/lib/auth/role-policy'
import { deskFor } from '@/lib/config/roles'
import { STAFF_ROLE_CARE_DOMAIN } from '@/lib/config/care'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientBoardItem {
  id: string
  code: string
  displayName: string | null
  /** Required, like `displayName`. See ResidentsList for the reasoning. */
  isPlaceholder: boolean
  ageRange: string
  gender: string
  status: string
  supportLevel: string
  languages: string[]
  createdAt: Date | string
  placements: {
    housingUnit: { code: string }
    startDate: Date | string
    checkIns: { createdAt: Date | string }[]
  }[]
  careSeats: {
    role: string
    staff: { name: string } | null
  }[]
  /** Key/value care attributes from the viewer's domain */
  careAttributes: { key: string; value: string }[]
  incidentCount: number
  daysSinceCheckIn: number | null
  checkInIntervalDays: number
}

export interface ClientBoardProps {
  clients: ClientBoardItem[]
  viewerRole: StaffRole
}

// ─── Role icon map ─────────────────────────────────────────────────────────

const ROLE_ICONS: Record<CareRoleId, React.ElementType> = {
  HOUSING: Home,
  SOCIAL: User,
  JOB: Briefcase,
  VOLUNTEERING: Heart,
}

const ROLE_ACCENT: Record<CareRoleId, string> = {
  HOUSING: 'text-score-good',
  SOCIAL: 'text-brand-primary',
  JOB: 'text-score-medium',
  VOLUNTEERING: 'text-score-excellent',
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SupportBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    INTENSIVE: 'bg-score-critical/10 text-score-critical border-score-critical/25',
    ELEVATED: 'bg-score-medium/10 text-score-medium border-score-medium/25',
    STANDARD: 'bg-ui-subtle text-ui-muted border-ui-border',
  }
  const cls = variants[level] ?? variants.STANDARD
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${cls}`}
    >
      {SUPPORT_LEVEL_LABELS[level] ?? level}
    </span>
  )
}

function CheckInChip({
  daysSince,
  intervalDays,
  compact = false,
}: {
  daysSince: number | null
  intervalDays: number
  compact?: boolean
}) {
  if (daysSince === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ui-muted">
        <Clock className="w-3 h-3 shrink-0" />
        {compact ? 'Kein CI' : 'Noch kein Check-in'}
      </span>
    )
  }

  const daysUntilDue = intervalDays - daysSince
  const isVeryOverdue = daysSince > intervalDays + 14
  const isOverdue = daysSince > intervalDays
  const isDueSoon = !isOverdue && daysUntilDue <= 5

  if (isVeryOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-score-critical">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        {compact ? `${daysSince}T` : `Überfällig — ${daysSince} Tage ohne Check-in`}
      </span>
    )
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-score-medium">
        <Clock className="w-3 h-3 shrink-0" />
        {compact ? `${daysSince}T` : `${daysSince} Tage ohne Check-in`}
      </span>
    )
  }
  if (isDueSoon) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-score-good">
        <Clock className="w-3 h-3 shrink-0" />
        {compact
          ? `in ${daysUntilDue}T`
          : `Fällig in ${daysUntilDue} Tag${daysUntilDue !== 1 ? 'en' : ''}`}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ui-muted">
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      {compact ? `vor ${daysSince}T` : daysSince === 1 ? 'Vor 1 Tag' : `Vor ${daysSince} Tagen`}
    </span>
  )
}

/** Domain-specific context line shown below the housing/status row */
function RoleContextLine({
  client,
  domain,
}: {
  client: ClientBoardItem
  domain: CareRoleId | undefined
}) {
  if (!domain) return null

  const attr = (key: string) => client.careAttributes.find((a) => a.key === key)?.value

  if (domain === 'JOB') {
    const workStatus = attr('work_status')
    const jobGoal = attr('job_goal')
    const german = attr('german_focus')
    const statusLabel: Record<string, string> = {
      searching: 'Jobsuche',
      course: 'Kurs / Qualifikation',
      employed: 'Erwerbstätig',
      other: 'Anderes',
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ui-muted">
        {workStatus && (
          <span
            className={`font-medium ${workStatus === 'employed' ? 'text-score-good' : 'text-ui-text'}`}
          >
            {statusLabel[workStatus] ?? workStatus}
          </span>
        )}
        {jobGoal && (
          <span className="truncate max-w-[120px]" title={jobGoal}>
            {jobGoal}
          </span>
        )}
        {german && german !== 'none' && (
          <span className="inline-flex items-center gap-0.5">
            <BookOpen className="w-3 h-3" />
            {german}
          </span>
        )}
        {!workStatus && !jobGoal && (
          <span className="text-ui-muted/60 italic">Noch keine Angaben</span>
        )}
      </div>
    )
  }

  if (domain === 'VOLUNTEERING') {
    const status = attr('engagement_status')
    const interest = attr('interest_area')
    const statusLabel: Record<string, string> = {
      interested: 'Interessiert',
      matched: 'Vermittelt',
      active: 'Aktiv engagiert',
      paused: 'Pausiert',
    }
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ui-muted">
        {status && (
          <span
            className={`font-medium ${status === 'active' ? 'text-score-good' : 'text-ui-text'}`}
          >
            {statusLabel[status] ?? status}
          </span>
        )}
        {interest && (
          <span className="truncate max-w-[140px]" title={interest}>
            {interest}
          </span>
        )}
        {!status && !interest && (
          <span className="text-ui-muted/60 italic">Noch keine Angaben</span>
        )}
      </div>
    )
  }

  if (domain === 'SOCIAL') {
    const nextStep = attr('next_step')
    return nextStep ? (
      <p className="text-xs text-ui-muted truncate" title={nextStep}>
        {nextStep}
      </p>
    ) : (
      <p className="text-xs text-ui-muted/60 italic">Kein Nächster Schritt erfasst</p>
    )
  }

  // HOUSING — check-in is already shown, nothing extra needed here
  return null
}

function CareTeamChips({ seats }: { seats: ClientBoardItem['careSeats'] }) {
  if (!seats.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {seats.map((seat) => {
        const Icon = ROLE_ICONS[seat.role as CareRoleId] ?? User
        const accent = ROLE_ACCENT[seat.role as CareRoleId] ?? 'text-ui-muted'
        const label = CARE_ROLE_LABELS[seat.role as CareRoleId] ?? seat.role
        if (seat.staff) {
          return (
            <span
              key={seat.role}
              className="inline-flex items-center gap-1 text-[11px] text-ui-muted bg-ui-subtle rounded-full px-2 py-0.5"
              title={`${label}: ${seat.staff.name}`}
            >
              <Icon className={`w-3 h-3 shrink-0 ${accent}`} aria-hidden />
              <span className="truncate max-w-[72px]">{seat.staff.name.split(' ')[0]}</span>
            </span>
          )
        }
        return (
          <span
            key={seat.role}
            className="inline-flex items-center gap-1 text-[11px] text-ui-muted/50 bg-ui-subtle/50 rounded-full px-2 py-0.5 border border-dashed border-ui-border"
            title={`${label}: nicht zugewiesen`}
          >
            <Icon className="w-3 h-3 shrink-0" aria-hidden />
            <span>—</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── Main card ─────────────────────────────────────────────────────────────

function ClientCard({ client, viewerRole }: { client: ClientBoardItem; viewerRole: StaffRole }) {
  const domain = STAFF_ROLE_CARE_DOMAIN[viewerRole]
  const placement = client.placements[0]
  const isVeryOverdue =
    client.daysSinceCheckIn !== null && client.daysSinceCheckIn > client.checkInIntervalDays + 14
  const isOverdue =
    client.daysSinceCheckIn !== null && client.daysSinceCheckIn > client.checkInIntervalDays
  const isUnhoused = !placement && client.status === 'ACTIVE'

  const borderCls = isVeryOverdue
    ? 'border-score-critical/50 hover:border-score-critical'
    : isOverdue
      ? 'border-score-medium/40 hover:border-score-medium'
      : isUnhoused
        ? 'border-status-warning/40 hover:border-status-warning'
        : 'border-ui-border hover:border-brand-primary/40'

  const avatarCls = isVeryOverdue
    ? 'bg-score-critical/10 text-score-critical'
    : 'bg-ui-subtle text-ui-text group-hover:bg-brand-primary/10 group-hover:text-brand-primary'

  return (
    <Link
      href={`/residents/${client.id}`}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-ui-surface p-4 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${borderCls}`}
      aria-label={`${residentName(client)} — Profil öffnen`}
    >
      {/* ── Row 1: Identity + support level ── */}
      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold transition-colors ${avatarCls}`}
          aria-hidden
        >
          {residentInitials(client)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ui-text group-hover:text-brand-primary leading-tight">
            <span className="truncate">{residentName(client)}</span>
            {/*
              THIS BOARD IS THE DEFAULT VIEW (`layout || 'board'`), so this is
              the marker that actually gets seen. It was added to ResidentsList
              first and verified on the live site — where it did not appear,
              because the list is the OTHER view, reachable only via
              ?layout=list. A marker on the screen nobody opens is no marker.
            */}
            {client.isPlaceholder && (
              <span className="chip-neutral shrink-0">{RESIDENT_LIST_LABELS.placeholder}</span>
            )}
          </p>
          {/* Without a chosen name, residentName() already shows the code —
              repeating it as a subtitle printed the same string twice. */}
          {client.displayName && (
            <p className="font-mono text-[11px] text-ui-muted">
              {/* resident-code-intentional */}
              {client.code}
            </p>
          )}
        </div>
        <SupportBadge level={client.supportLevel} />
      </div>

      {/* ── Row 2: Housing / placement status (always shown) ── */}
      <div className="text-sm">
        {placement ? (
          <span className="inline-flex items-center gap-1.5 text-ui-muted">
            <Home className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {placement.housingUnit.code}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium text-status-warning-text">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Nicht platziert
          </span>
        )}
      </div>

      {/* ── Row 3: Check-in status — for the desks whose signal it is (config/roles.ts) ── */}
      {deskFor(viewerRole).checkInChip && (
        <CheckInChip
          daysSince={client.daysSinceCheckIn}
          intervalDays={client.checkInIntervalDays}
        />
      )}

      {/* ── Row 4: Role-specific context (Jobcoach / Volunteering / Social next step) ── */}
      {domain && domain !== 'HOUSING' && <RoleContextLine client={client} domain={domain} />}

      {/* ── Row 5: Care team chips ── */}
      <CareTeamChips seats={client.careSeats} />

      {/* ── Footer: incidents (shown only when > 0) ── */}
      {client.incidentCount > 0 && (
        <div className="mt-auto pt-2 border-t border-ui-border">
          <span className="inline-flex items-center gap-1 text-xs text-score-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden />
            {CLIENT_BOARD_LABELS.incidentCount(client.incidentCount)}
          </span>
        </div>
      )}
    </Link>
  )
}

// ─── Board root ────────────────────────────────────────────────────────────

export function ClientBoard({ clients, viewerRole }: ClientBoardProps) {
  // Filtering — including the old "Meine / Alle" toggle, now the Zuständig
  // filter — happens on the server from `config/client-filters.ts`, for both
  // layouts. The page renders the empty state, so `clients` is never empty here.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} viewerRole={viewerRole} />
      ))}
    </div>
  )
}
