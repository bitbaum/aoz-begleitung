import type { Resident } from '@/lib/db'
import {
  SLEEP_SCHEDULE_LABELS,
  SOCIAL_STYLE_LABELS,
  SMOKING_STATUS_LABELS,
  MOBILITY_NEED_LABELS,
  LANGUAGE_LABELS,
  DIET_LABELS,
  RECYCLING_KNOWLEDGE_LABELS,
  ROOM_SHARING_STATUS_LABELS,
  SUPPORT_LEVEL_LABELS,
  MEDICAL_DOC_TYPE_LABELS,
  RESIDENT_PROFILE_SIDEBAR_LABELS,
  getLabel,
} from '@/lib/constants'
import { SPOT_TYPE_ICONS } from '@/lib/config/placement-spots'
import { getEligibleSpotTypes } from '@/lib/config/placement-spots'
import { RESIDENT_FACTORS } from '@/lib/config/resident-factors'
import { DetailRow } from '@/components/ui/Card'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'

export interface ResidentProfileSidebarProps {
  resident: Pick<
    Resident,
    | 'hasMedicalDocumentation'
    | 'medicalDocType'
    | 'roomSharingStatus'
    | 'sleepSchedule'
    | 'noiseTolerance'
    | 'cleanlinessPractice'
    | 'socialStyle'
    | 'privacyNeed'
    | 'smokingStatus'
    | 'languages'
    | 'choresContribution'
    | 'recyclingKnowledge'
    | 'mobilityNeeds'
    | 'supportLevel'
    | 'hasNightDisturbances'
    | 'needsQuietEnvironment'
    | 'hasSleepEquipment'
    | 'medicalEquipment'
    | 'dietaryNeeds'
    | 'sharedBathroom'
    | 'sharedKitchen'
    | 'petTolerance'
    | 'notes'
  >
}

function PreferenceItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2 text-ui-muted">
      <span className={value ? 'text-status-success-text' : 'text-ui-muted'}>
        {value ? '✓' : '○'}
      </span>
      {label}
    </div>
  )
}

function ScaleRow({
  label,
  value,
  factorKey,
}: {
  label: string
  value: number
  factorKey: string
}) {
  const factor = RESIDENT_FACTORS[factorKey]
  const scaleFactor = factor?.type === 'scale' ? factor : null
  return (
    <div className="flex justify-between items-start">
      <dt className="text-ui-muted">{label}</dt>
      <dd className="text-right">
        <span className="text-ui-text font-medium">{value}/5</span>
        {scaleFactor && (
          <span className="block text-xs text-ui-muted mt-0.5">
            {scaleFactor.lowLabel} – {scaleFactor.highLabel}
          </span>
        )}
      </dd>
    </div>
  )
}

export function ResidentProfileSidebar({ resident }: ResidentProfileSidebarProps) {
  return (
    <div className="space-y-6">
      {/* CRITICAL: Housing Authorization - Most important info at top */}
      {/* A hairline card like every other one; only a documented entitlement
          gets the info tint, so the tint means something when it appears. */}
      <div
        className={`card ${resident.hasMedicalDocumentation ? 'border-status-info/40 bg-status-info/8' : ''}`}
      >
        <h2 className="text-lg font-semibold text-ui-text mb-4">
          {RESIDENT_PROFILE_SIDEBAR_LABELS.authCardTitle}
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <dt className="text-ui-muted">{RESIDENT_PROFILE_SIDEBAR_LABELS.authDocLabel}</dt>
            <dd
              className={`font-semibold ${resident.hasMedicalDocumentation ? 'text-status-info-text' : 'text-ui-muted'}`}
            >
              {resident.hasMedicalDocumentation
                ? RESIDENT_PROFILE_SIDEBAR_LABELS.authDocPresent
                : RESIDENT_PROFILE_SIDEBAR_LABELS.authDocAbsent}
            </dd>
          </div>
          {resident.hasMedicalDocumentation && resident.medicalDocType && (
            <div className="flex justify-between items-center">
              <dt className="text-ui-muted">{RESIDENT_PROFILE_SIDEBAR_LABELS.authForLabel}</dt>
              <dd className="font-semibold text-status-info-text">
                {getLabel(MEDICAL_DOC_TYPE_LABELS, resident.medicalDocType)}
              </dd>
            </div>
          )}
          <div className="flex justify-between items-center">
            <dt className="text-ui-muted">{RESIDENT_PROFILE_SIDEBAR_LABELS.roomSharingLabel}</dt>
            <dd className="font-medium text-ui-text">
              {getLabel(ROOM_SHARING_STATUS_LABELS, resident.roomSharingStatus)}
            </dd>
          </div>
          <div className="pt-2 border-t border-ui-border">
            <dt className="text-ui-muted text-xs mb-1">
              {RESIDENT_PROFILE_SIDEBAR_LABELS.eligibleTypesLabel}
            </dt>
            <dd className="flex flex-wrap gap-1">
              {getEligibleSpotTypes(resident.hasMedicalDocumentation, resident.medicalDocType).map(
                (type) => (
                  <span
                    key={type}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      type === 'BED'
                        ? 'bg-ui-subtle text-ui-muted'
                        : 'bg-status-info/15 text-status-info-text'
                    }`}
                  >
                    {SPOT_TYPE_ICONS[type as keyof typeof SPOT_TYPE_ICONS]}{' '}
                    {type === 'BED'
                      ? RESIDENT_PROFILE_SIDEBAR_LABELS.spotTypeBed
                      : type === 'PRIVATE_ROOM'
                        ? RESIDENT_PROFILE_SIDEBAR_LABELS.spotTypePrivate
                        : RESIDENT_PROFILE_SIDEBAR_LABELS.spotTypeStudio}
                  </span>
                ),
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Lifestyle & Daily Habits - Combined */}
      <CollapsibleSection title={RESIDENT_PROFILE_SIDEBAR_LABELS.sectionLifestyle}>
        <dl className="space-y-2 text-sm">
          <DetailRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSleepSchedule}
            value={getLabel(SLEEP_SCHEDULE_LABELS, resident.sleepSchedule)}
          />
          <ScaleRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldNoiseTolerance}
            value={resident.noiseTolerance}
            factorKey="noiseTolerance"
          />
          <ScaleRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldCleanliness}
            value={resident.cleanlinessPractice}
            factorKey="cleanlinessPractice"
          />
          <DetailRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSocialStyle}
            value={getLabel(SOCIAL_STYLE_LABELS, resident.socialStyle)}
          />
          <ScaleRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldPrivacy}
            value={resident.privacyNeed}
            factorKey="privacyNeed"
          />
          <DetailRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSmoking}
            value={getLabel(SMOKING_STATUS_LABELS, resident.smokingStatus)}
          />
        </dl>
      </CollapsibleSection>

      {/* Languages & Background */}
      <CollapsibleSection title={RESIDENT_PROFILE_SIDEBAR_LABELS.sectionLanguages}>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-ui-muted mb-2">{RESIDENT_PROFILE_SIDEBAR_LABELS.fieldLanguages}</dt>
            <dd className="flex flex-wrap gap-1">
              {(resident.languages ?? []).map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-1 bg-brand-accent text-brand-secondary rounded text-xs font-medium"
                >
                  {getLabel(LANGUAGE_LABELS, lang)}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </CollapsibleSection>

      {/* Household & Independence */}
      <CollapsibleSection
        title={RESIDENT_PROFILE_SIDEBAR_LABELS.sectionHousehold}
        defaultOpen={false}
      >
        <dl className="space-y-2 text-sm">
          <ScaleRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldChores}
            value={resident.choresContribution}
            factorKey="choresContribution"
          />
          <DetailRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldRecycling}
            value={getLabel(RECYCLING_KNOWLEDGE_LABELS, resident.recyclingKnowledge)}
          />
          <DetailRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldMobility}
            value={getLabel(MOBILITY_NEED_LABELS, resident.mobilityNeeds)}
          />
          <DetailRow
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSupportLevel}
            value={getLabel(SUPPORT_LEVEL_LABELS, resident.supportLevel)}
          />
        </dl>
      </CollapsibleSection>

      {/* Special Needs - Combined */}
      <CollapsibleSection title={RESIDENT_PROFILE_SIDEBAR_LABELS.sectionNeeds} defaultOpen={false}>
        <div className="space-y-2 text-sm">
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldNightDisturbances}
            value={resident.hasNightDisturbances}
          />
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldQuietEnv}
            value={resident.needsQuietEnvironment}
          />
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSleepEquipment}
            value={resident.hasSleepEquipment}
          />
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldMedEquipment}
            value={resident.medicalEquipment}
          />
          {(resident.dietaryNeeds ?? []).length > 0 && (
            <div className="pt-2">
              <dt className="text-ui-muted mb-1">{RESIDENT_PROFILE_SIDEBAR_LABELS.fieldDiet}</dt>
              <dd className="flex flex-wrap gap-1">
                {(resident.dietaryNeeds ?? []).map((diet) => (
                  <span key={diet} className="px-2 py-0.5 bg-ui-subtle rounded text-xs">
                    {getLabel(DIET_LABELS, diet)}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Sharing Preferences */}
      <CollapsibleSection
        title={RESIDENT_PROFILE_SIDEBAR_LABELS.sectionSharing}
        defaultOpen={false}
      >
        <div className="space-y-2 text-sm">
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSharedBathroom}
            value={resident.sharedBathroom}
          />
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldSharedKitchen}
            value={resident.sharedKitchen}
          />
          <PreferenceItem
            label={RESIDENT_PROFILE_SIDEBAR_LABELS.fieldPets}
            value={resident.petTolerance}
          />
        </div>
      </CollapsibleSection>

      {/* Notes */}
      {resident.notes && (
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">
            {RESIDENT_PROFILE_SIDEBAR_LABELS.notesTitle}
          </h2>
          <p className="text-sm text-ui-muted whitespace-pre-wrap">{resident.notes}</p>
        </div>
      )}
    </div>
  )
}
