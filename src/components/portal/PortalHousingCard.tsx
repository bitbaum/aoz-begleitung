import Link from 'next/link'
import { PORTAL_LABELS } from '@/lib/constants'
import { getRequestTranslator } from '@/lib/i18n/request'
import { formatDate } from '@/lib/utils'

interface HousingUnitData {
  address: string | null
  nickname?: string | null
  totalRooms: number | null
  quietHours: string | null
  smokingAllowed: boolean | null
  petsAllowed: boolean | null
}

interface PlacementData {
  startDate: Date
  compatibilityScore: number | null
}

interface PortalHousingCardProps {
  placement: PlacementData
  housingUnit: HousingUnitData | undefined
  roommatesCount: number
}

export async function PortalHousingCard({ placement, housingUnit, roommatesCount }: PortalHousingCardProps) {
  const { t } = await getRequestTranslator()

  return (
    <div className="card mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ui-text">
            {housingUnit?.nickname || t('dashboard.housing')}
          </h2>
          <p className="text-ui-muted">{housingUnit?.address}</p>
        </div>
        <span className="badge badge-active">{t('dashboard.active')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <InfoBox
          label={t('dashboard.moveIn')}
          value={formatDate(placement.startDate)}
        />
        <InfoBox
          label={t('dashboard.rooms')}
          value={`${housingUnit?.totalRooms || 0}`}
        />
        <InfoBox
          label={t('dashboard.roommatesCount')}
          value={`${roommatesCount}`}
        />
        <InfoBox
          label={t('dashboard.compatibility')}
          value={placement.compatibilityScore
            ? `${Math.round(placement.compatibilityScore)}%`
            : '--'}
        />
      </div>

      {/* House Rules Summary */}
      <div className="pt-4 border-t border-ui-border">
        <Link href="/portal/rules" className="inline-flex items-center min-h-[44px] text-sm text-brand-primary hover:underline">
          {t('dashboard.houseRules')}
        </Link>
        <div className="flex flex-wrap gap-3 text-sm">
          {housingUnit?.quietHours && (
            <span className="px-3 py-1 bg-brand-secondary/10 text-brand-secondary rounded-sm">
              {t('dashboard.quietHours')}: {housingUnit.quietHours}
            </span>
          )}
          <span className={`px-3 py-1 rounded-sm ${
            housingUnit?.smokingAllowed
              ? 'bg-status-success/15 text-status-success-text'
              : 'bg-status-error/10 text-status-error-text'
          }`}>
            {housingUnit?.smokingAllowed ? t('dashboard.smokingAllowed') : t('dashboard.noSmoking')}
          </span>
          <span className={`px-3 py-1 rounded-sm ${
            housingUnit?.petsAllowed
              ? 'bg-status-success/15 text-status-success-text'
              : 'bg-ui-subtle text-ui-muted'
          }`}>
            {housingUnit?.petsAllowed ? t('dashboard.petsAllowed') : t('dashboard.noPets')}
          </span>
        </div>
      </div>
    </div>
  )
}

interface PortalOnboardingCardProps {
  preferencesCompleted: boolean
}

export async function PortalOnboardingCard({ preferencesCompleted }: PortalOnboardingCardProps) {
  const { t } = await getRequestTranslator()
  const steps = [
    t('dashboard.onboarding.step1'),
    t('dashboard.onboarding.step2'),
    t('dashboard.onboarding.step3'),
    t('dashboard.onboarding.step4'),
  ]
  const stepDone = [true, preferencesCompleted, false, false]
  const activeStep = stepDone.indexOf(false)

  return (
    <div className="card mb-6 py-6">
      <h2 className="text-lg font-semibold text-ui-text mb-1">
        {t('dashboard.onboarding.title')}
      </h2>
      <p className="text-ui-muted text-sm mb-6">
        {t('dashboard.onboarding.subtitle')}
      </p>

      {/* Progress timeline */}
      <div className="space-y-4 mb-6">
        {steps.map((label, i) => {
          const done = stepDone[i]
          const isActive = i === activeStep

          return (
            <div key={label} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                  done
                    ? 'bg-status-success/15 text-status-success-text'
                    : isActive
                      ? 'bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary'
                      : 'bg-ui-subtle text-ui-muted'
                }`}>
                  {done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 h-6 mt-1 ${done ? 'bg-status-success/30' : 'bg-ui-border'}`} />
                )}
              </div>
              <div className="pt-1">
                <p className={`text-sm font-medium ${
                  done ? 'text-status-success-text' : isActive ? 'text-brand-primary' : 'text-ui-muted'
                }`}>
                  {label}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <div className="bg-brand-primary/5 rounded-lg p-4">
        <p className="text-sm text-ui-muted mb-3">
          {preferencesCompleted
            ? t('dashboard.onboarding.browseHousingHint')
            : t('dashboard.onboarding.completePreferencesHint')}
        </p>
        <Link
          href={preferencesCompleted ? '/portal/housing' : '/portal/preferences'}
          className="btn-primary inline-flex items-center min-h-[44px] px-6"
        >
          {preferencesCompleted
            ? t('dashboard.onboarding.browseHousing')
            : t('dashboard.onboarding.completePreferences')} →
        </Link>
      </div>

      {/* Contact info */}
      <p className="text-sm text-ui-muted mt-4">
        {PORTAL_LABELS.dashboard.noHousingContact}
      </p>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 bg-ui-subtle rounded-lg">
      <p className="text-sm text-ui-muted">{label}</p>
      <p className="font-semibold text-ui-text">{value}</p>
    </div>
  )
}
