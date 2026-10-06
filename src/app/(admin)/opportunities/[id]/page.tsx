import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { ButtonLink } from '@/components/ui/Button'
import { PageHeader, PageShell, SectionHeader } from '@/components/ui/Page'
import { ApplicantPipeline } from '@/components/opportunities/ApplicantPipeline'
import { AddApplicantForm } from '@/components/opportunities/AddApplicantForm'
import {
  APPLICATIONS_REVIEW_PATH,
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_STATUS_BADGES,
  OPPORTUNITY_STATUS_LABELS,
  permitStatement,
} from '@/lib/config/opportunities'
import { getOpportunityDetail, residentsAvailableFor } from '@/lib/data/opportunities'
import { mayAttachPeople, openSeats } from '@/lib/opportunities/pipeline'
import { publishOpportunityFromDetail } from '@/lib/actions/opportunities'
import { residentOptionLabel } from '@/lib/utils/resident-name'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  /** A refused publish comes back here with the gate's own words. */
  searchParams: Promise<{ error?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const opportunity = await getOpportunityDetail(id)
  return { title: opportunity?.title ?? L.pageTitle }
}

function formatDate(value: Date | null): string | null {
  return value ? new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(value) : null
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-ui-text">{value}</dd>
    </div>
  )
}

export default async function OpportunityDetailPage({ params, searchParams }: Props) {
  const staff = await requirePermission('opportunities:read')
  const canWrite = hasPermission(staff, 'opportunities:write')
  const { id } = await params
  const { error } = await searchParams

  const opportunity = await getOpportunityDetail(id)
  if (!opportunity) notFound()

  const available =
    canWrite && mayAttachPeople(opportunity.status) ? await residentsAvailableFor(id) : []
  const stages = opportunity.applications.map((a) => a.stage)
  const free = openSeats(opportunity, stages)
  // Read WITH the kind: a paid job at the NONE default is "not yet settled",
  // never «Keine Bewilligung nötig» or «Unbezahlter Einsatz».
  const permit = permitStatement(opportunity.kind, opportunity.permitRequirement)

  return (
    <PageShell>
      <PageHeader
        eyebrow={OPPORTUNITY_KIND_LABELS[opportunity.kind]}
        title={opportunity.title}
        description={opportunity.organisation}
        backHref="/opportunities"
        backLabel={L.detailBack}
        actions={
          canWrite ? (
            <>
              <ButtonLink href={`/opportunities/${id}/edit`} variant="outline">
                {L.edit}
              </ButtonLink>
              {/* A draft could only be published from /edit, while this page
                  told the coach «Erst veröffentlichen». Same action, same
                  work-permit gate; a refusal returns here as `?error=`. */}
              {opportunity.status === 'DRAFT' ? (
                <form action={publishOpportunityFromDetail.bind(null, id)}>
                  <button type="submit" className="btn-secondary">
                    {L.publish}
                  </button>
                </form>
              ) : null}
            </>
          ) : undefined
        }
      />

      {error ? (
        <p className="alert-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${OPPORTUNITY_STATUS_BADGES[opportunity.status]}`}>
          {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
        </span>
        <span className="numeric text-sm text-ui-muted">
          {free === null ? L.seatsUnknown : free === 0 ? L.seatsFull : `${free} ${L.seatsFree}`}
        </span>
      </div>

      <section className="card">
        <SectionHeader title={L.sectionDetails} />
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ui-text">
          {opportunity.description}
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label={L.organisation} value={opportunity.organisation} />
          <Detail label={L.location} value={opportunity.location} />
          <Detail label={L.schedule} value={opportunity.schedule} />
          <Detail
            label={L.hoursPerWeek}
            value={opportunity.hoursPerWeek ? String(opportunity.hoursPerWeek) : null}
          />
          <Detail label={L.startsAt} value={formatDate(opportunity.startsAt)} />
          <Detail label={L.endsAt} value={formatDate(opportunity.endsAt)} />
        </dl>
      </section>

      <section className="card">
        <SectionHeader title={L.sectionRequirements} description={L.requirementsHint} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`chip ${permit.badge}`}>{permit.label}</span>
          <span className="chip chip-neutral">
            {opportunity.germanLevel
              ? `${L.germanLevel} ${opportunity.germanLevel}`
              : L.germanLevelAny}
          </span>
        </div>
        <p className={`mt-3 text-sm ${permit.needsAction ? 'alert-warning' : 'text-ui-muted'}`}>
          {permit.hint}
        </p>
        {opportunity.requirementNote ? (
          <p className="mt-2 text-sm text-ui-text">{opportunity.requirementNote}</p>
        ) : null}
      </section>

      {opportunity.contactName ||
      opportunity.contactEmail ||
      opportunity.contactPhone ||
      opportunity.website ? (
        <section className="card">
          <SectionHeader title={L.sectionContact} />
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label={L.contactName} value={opportunity.contactName} />
            <Detail label={L.contactEmail} value={opportunity.contactEmail} />
            <Detail label={L.contactPhone} value={opportunity.contactPhone} />
            <Detail label={L.website} value={opportunity.website} />
          </dl>
        </section>
      ) : null}

      <section className="card">
        <SectionHeader
          title={L.sectionApplicants}
          description={L.evidenceHint}
          actions={
            opportunity.applications.length > 0 ? (
              <Link
                href={`${APPLICATIONS_REVIEW_PATH}?board=overview&listing=${id}`}
                className="inline-flex min-h-[44px] items-center text-sm text-brand-primary hover:underline"
              >
                {L.reviewOpenListing}
              </Link>
            ) : undefined
          }
        />
        <div className="mt-4">
          <ApplicantPipeline
            applications={opportunity.applications}
            canWrite={canWrite}
            listingStatus={opportunity.status}
          />
        </div>

        {canWrite ? (
          <div className="mt-6 border-t border-ui-border pt-5">
            <h3 className="text-sm font-semibold text-ui-text">{L.addApplicant}</h3>
            {/* Only a published place takes people. A draft may not even have
                its permit route settled; the action refuses it as well. */}
            {!mayAttachPeople(opportunity.status) ? (
              <p className="mt-1 text-sm text-ui-muted">
                {opportunity.status === 'DRAFT' ? L.attachNeedsPublish : L.attachArchived}
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-ui-muted">{L.addApplicantHint}</p>
                {available.length === 0 ? (
                  <p className="mt-3 text-sm text-ui-muted">{L.addApplicantEmpty}</p>
                ) : (
                  <AddApplicantForm
                    opportunityId={id}
                    people={available.map((resident) => ({
                      id: resident.id,
                      name: residentOptionLabel(resident),
                    }))}
                  />
                )}
              </>
            )}
          </div>
        ) : null}
      </section>
    </PageShell>
  )
}
