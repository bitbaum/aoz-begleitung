import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPortalResident } from '@/lib/portal-auth'
import { PageHeader, EmptyState } from '@/components/ui/Page'
import { getRequestTranslator } from '@/lib/i18n/request'
import {
  applicationStageLabel,
  opportunityKindLabel,
  permitRequirementLabel,
} from '@/lib/i18n/opportunity-labels'
import { residentOpportunityBoard } from '@/lib/data/opportunities'
import { expressInterest, withdrawInterest } from '@/lib/actions/opportunities'
import {
  APPLICATION_STAGE_BADGES,
  PERMIT_REQUIREMENT_BADGES,
  type ApplicationStageId,
  type OpportunityKindId,
  type PermitRequirementId,
} from '@/lib/config/opportunities'
import { formatDate } from '@/lib/utils/formatting'
import { residentNextStep } from '@/lib/opportunities/pipeline'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('nav.opportunities') }
}
export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ ok?: string; error?: string; kind?: string }>
}

/** URL params the actions redirect back with, mapped to what the reader sees. */
const OK_KEYS = {
  interest: 'opportunities.okInterest',
  withdrawn: 'opportunities.okWithdrawn',
} as const

/** The four things that can be true of a thread of your own, as one sentence. */
const NEXT_STEP_KEYS = {
  WAITING_ON_STAFF: 'opportunities.nextWaiting',
  YOURS_TO_ATTEND: 'opportunities.nextAttend',
  FINISHED: 'opportunities.nextFinished',
  NOT_THIS_TIME: 'opportunities.nextDeclined',
} as const

const ERROR_KEYS = {
  unavailable: 'opportunities.errorUnavailable',
  full: 'opportunities.errorFull',
  locked: 'opportunities.errorLocked',
  failed: 'opportunities.errorFailed',
} as const

export default async function PortalOpportunitiesPage(props: Props) {
  const searchParams = await props.searchParams
  const resident = await getPortalResident()
  if (!resident) redirect('/login')

  // The translator first, because the board is resolved INTO this reader's
  // language server-side — the payload carries one language, not six.
  const { t, locale } = await getRequestTranslator()
  const [{ mine, open }, params] = await Promise.all([
    residentOpportunityBoard(resident.id, locale),
    searchParams,
  ])

  const okKey =
    params.ok && params.ok in OK_KEYS ? OK_KEYS[params.ok as keyof typeof OK_KEYS] : null
  // One tap narrows the list to a kind of place. Offered only for kinds that
  // are actually open — a filter that leads to "nothing here" is a dead end.
  const kindsOpen = [...new Set(open.map((opportunity) => opportunity.kind as OpportunityKindId))]
  const kindFilter =
    params.kind && kindsOpen.includes(params.kind as OpportunityKindId)
      ? (params.kind as OpportunityKindId)
      : null
  const shown = kindFilter ? open.filter((opportunity) => opportunity.kind === kindFilter) : open

  const errorKey =
    params.error && params.error in ERROR_KEYS
      ? ERROR_KEYS[params.error as keyof typeof ERROR_KEYS]
      : null

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={t('opportunities.title')}
          description={t('opportunities.subtitle')}
          backHref="/portal"
          backLabel={t('nav.overview')}
        />
      </div>

      {okKey ? (
        <p className="alert-success mb-6" role="status">
          {t(okKey)}
        </p>
      ) : null}
      {errorKey ? (
        <p className="alert-error mb-6" role="alert">
          {t(errorKey)}
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-ui-text mb-3">{t('opportunities.yours')}</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-ui-muted">{t('opportunities.yoursEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {mine.map((application) => {
              const stage = application.stage as ApplicationStageId
              // Offered only where the server will actually allow it: your own
              // interest, untouched. Anything further along is a conversation
              // that has started, and a button that quietly failed would be
              // worse than no button.
              const canWithdraw = application.createdBy === 'RESIDENT' && stage === 'INTERESTED'

              const listing = application.opportunity
              const contact = [listing.contactName, listing.contactPhone, listing.contactEmail]
                .filter(Boolean)
                .join(' · ')

              return (
                <li key={application.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-ui-text">{listing.title}</p>
                    <span className={APPLICATION_STAGE_BADGES[stage]}>
                      {applicationStageLabel(t, stage)}
                    </span>
                  </div>
                  <p className="text-sm text-ui-muted mt-1">
                    {listing.organisation}
                    {' · '}
                    {opportunityKindLabel(t, listing.kind as OpportunityKindId)}
                    {' · '}
                    {formatDate(application.stageChangedAt)}
                    {listing.machineTranslated ? ` · ${t('opportunities.machineTranslated')}` : ''}
                  </p>

                  {/* What happens now. A stage badge says where the thread is;
                      it does not say what this person should do about it, and
                      that is the only question they opened the page with. */}
                  <p className="text-sm text-ui-text mt-2">
                    {t(NEXT_STEP_KEYS[residentNextStep(stage)])}
                  </p>

                  {/* The practical facts. All of these were already loaded and
                      none of them was rendered, so somebody who had been
                      ACCEPTED could not find out where to go or when. */}
                  <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {listing.location ? (
                      <div>
                        <dt className="eyebrow">{t('opportunities.where')}</dt>
                        <dd className="text-ui-text">{listing.location}</dd>
                      </div>
                    ) : null}
                    {listing.startsAt ? (
                      <div>
                        <dt className="eyebrow">{t('opportunities.starts')}</dt>
                        <dd className="text-ui-text">{formatDate(listing.startsAt)}</dd>
                      </div>
                    ) : null}
                    {listing.schedule ? (
                      <div>
                        <dt className="eyebrow">{t('opportunities.perWeek')}</dt>
                        <dd className="text-ui-text">
                          {listing.schedule}
                          {listing.hoursPerWeek ? ` · ${listing.hoursPerWeek}` : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {/* Present only once the server sent it — before ACCEPTED
                      these fields are stripped from the row, not hidden here.
                      @see lib/opportunities/pipeline.ts */}
                  {contact ? (
                    <div className="mt-3 rounded-lg border border-ui-border bg-ui-subtle p-3">
                      <p className="eyebrow">{t('opportunities.contactTitle')}</p>
                      <p className="mt-1 text-sm text-ui-text">{contact}</p>
                      <p className="mt-1 text-xs text-ui-muted">{t('opportunities.contactHint')}</p>
                    </div>
                  ) : null}

                  {canWithdraw ? (
                    <form action={withdrawInterest} className="mt-3">
                      <input type="hidden" name="applicationId" value={application.id} />
                      <button type="submit" className="btn-ghost">
                        {t('opportunities.withdraw')}
                      </button>
                    </form>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-sm text-ui-muted mt-3">
          {t('opportunities.evidenceHint')}{' '}
          <Link
            href="/portal/learning"
            className="text-brand-primary hover:underline inline-flex min-h-[44px] items-center"
          >
            {t('opportunities.toLearning')}
          </Link>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-ui-text mb-3">{t('opportunities.open')}</h2>
        <nav aria-label={t('opportunities.filterLabel')} className="mb-4 flex flex-wrap gap-2">
          {[null, ...kindsOpen].map((kind) => {
            const active = kind === kindFilter
            return (
              <Link
                key={kind ?? 'all'}
                href={kind ? `/portal/opportunities?kind=${kind}` : '/portal/opportunities'}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium ${
                  active
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-ui-border text-ui-muted hover:text-ui-text'
                }`}
              >
                {kind ? opportunityKindLabel(t, kind) : t('opportunities.filterAll')}
              </Link>
            )
          })}
          {/* Activities are the other half of "places I could go" — the same
                catalogue on the staff side. One link, so a resident does not
                have to know the two are stored apart. */}
          <Link
            href="/portal/activities"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-ui-border px-4 text-sm font-medium text-ui-muted hover:text-ui-text"
          >
            {t('nav.activities')}
          </Link>
        </nav>
        {open.length === 0 ? (
          <EmptyState title={t('opportunities.openEmpty')} />
        ) : (
          <ul className="space-y-3">
            {shown.map((opportunity) => {
              const permit = opportunity.permitRequirement as PermitRequirementId
              const full = opportunity.seatsLeft === 0

              return (
                <li key={opportunity.id} className="card">
                  <p className="eyebrow">
                    {opportunityKindLabel(t, opportunity.kind as OpportunityKindId)}
                  </p>
                  <p className="font-medium text-ui-text mt-1">{opportunity.title}</p>
                  <p className="text-sm text-ui-muted mt-1">
                    {opportunity.organisation}
                    {opportunity.location ? ` · ${opportunity.location}` : ''}
                  </p>
                  <p className="text-sm text-ui-text mt-2 leading-relaxed">
                    {opportunity.description}
                  </p>

                  {/* Said, not implied. The reader is the person best placed to
                      judge whether a machine translation is good enough here,
                      and they can only do that if they know it is one — the
                      same honesty the language picker already applies to the
                      interface itself. */}
                  {opportunity.machineTranslated && opportunity.original ? (
                    <details className="mt-2">
                      <summary className="flex min-h-[44px] cursor-pointer items-center text-xs text-ui-muted">
                        {t('opportunities.machineTranslated')} · {t('opportunities.showOriginal')}
                      </summary>
                      <div className="mt-2 rounded-lg border border-ui-border bg-ui-subtle p-3">
                        <p className="eyebrow">{t('opportunities.originalTitle')}</p>
                        {/* lang + dir so a screen reader switches voice, and so
                            German inside an RTL card is not laid out backwards. */}
                        <p lang="de" dir="ltr" className="mt-1 text-sm font-medium text-ui-text">
                          {opportunity.original.title}
                        </p>
                        <p
                          lang="de"
                          dir="ltr"
                          className="mt-1 text-sm leading-relaxed text-ui-text"
                        >
                          {opportunity.original.description}
                        </p>
                      </div>
                    </details>
                  ) : null}

                  <p className="mt-3">
                    {/* Never machine-translated. This sentence is a statement
                        about what the place requires and is hand-translated per
                        locale in the dictionaries. @see lib/opportunities/translation.ts */}
                    <span className={PERMIT_REQUIREMENT_BADGES[permit]}>
                      {permitRequirementLabel(t, permit)}
                    </span>
                  </p>

                  <p className="text-xs text-ui-muted mt-2">
                    {[
                      opportunity.germanLevel
                        ? `${t('opportunities.germanLevel')} ${opportunity.germanLevel}`
                        : null,
                      opportunity.hoursPerWeek
                        ? `${opportunity.hoursPerWeek} ${t('opportunities.perWeek')}`
                        : null,
                      opportunity.schedule,
                      // null seats means the listing never stated a number, and
                      // that is not the same fact as "no seats left" — saying
                      // "0 frei" there would hide a place that is open.
                      opportunity.seatsLeft === null
                        ? null
                        : full
                          ? t('opportunities.seatsFull')
                          : `${t('opportunities.seatsFree')} ${opportunity.seatsLeft}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  {full ? null : (
                    <form action={expressInterest} className="mt-3">
                      <input type="hidden" name="opportunityId" value={opportunity.id} />
                      {/* Neutral, not brand — this button repeats once per
                          listing, and brand red is rationed to the single
                          action that matters on a screen. */}
                      <button type="submit" className="btn-primary">
                        {t('opportunities.express')}
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
