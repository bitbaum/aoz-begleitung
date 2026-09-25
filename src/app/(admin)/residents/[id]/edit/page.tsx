import type { Metadata } from 'next'
import { db, resident as residentTable } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ResidentFormFields, FormValidationUX } from '@/components/forms'
import { SubmitButton } from '@/components/ui'
import { PageHeader } from '@/components/ui/Page'
import { updateResident } from '@/lib/actions'
import { ResidentDangerZone } from '@/components/residents/ResidentDangerZone'
import { RESIDENT_EDIT_LABELS } from '@/lib/constants'
import { residentName } from '@/lib/utils/resident-name'
import { requirePermission } from '@/lib/auth'

export const metadata: Metadata = { title: 'Klient*in bearbeiten' }

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditResidentPage({ params }: Props) {
  await requirePermission('residents:write')
  const { id } = await params

  const resident = await db.query.resident.findFirst({
    where: eq(residentTable.id, id),
  })

  if (!resident) {
    notFound()
  }

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={RESIDENT_EDIT_LABELS.title(residentName(resident))}
          description={RESIDENT_EDIT_LABELS.subtitle}
          backHref={`/residents/${id}`}
          backLabel={RESIDENT_EDIT_LABELS.backLink.replace(/^← /, '')}
        />
      </div>

      <form id="resident-edit-form" action={updateResident} className="space-y-6">
        <input type="hidden" name="id" value={id} />

        <div id="resident-edit-validation-summary" className="hidden alert-error" role="alert" />
        <FormValidationUX
          formId="resident-edit-form"
          summaryId="resident-edit-validation-summary"
        />

        <ResidentFormFields
          defaultValues={{
            code: resident.code,
            ageRange: resident.ageRange,
            gender: resident.gender,
            familyStatus: resident.familyStatus,
            sleepSchedule: resident.sleepSchedule,
            noiseTolerance: resident.noiseTolerance,
            cleanlinessPractice: resident.cleanlinessPractice,
            cleanlinessExpectation: resident.cleanlinessExpectation,
            chaosTolerance: resident.chaosTolerance,
            socialStyle: resident.socialStyle,
            languages: resident.languages,
            smokingStatus: resident.smokingStatus,
            dietaryNeeds: resident.dietaryNeeds,
            mobilityNeeds: resident.mobilityNeeds,
            medicalEquipment: resident.medicalEquipment,
            petTolerance: resident.petTolerance,
            sharedBathroom: resident.sharedBathroom,
            sharedKitchen: resident.sharedKitchen,
            privacyNeed: resident.privacyNeed,
            // Household fields
            choresContribution: resident.choresContribution,
            recyclingKnowledge: resident.recyclingKnowledge,
            // Health/Support fields
            roomSharingStatus: resident.roomSharingStatus,
            hasNightDisturbances: resident.hasNightDisturbances,
            needsQuietEnvironment: resident.needsQuietEnvironment,
            hasSleepEquipment: resident.hasSleepEquipment,
            supportLevel: resident.supportLevel,
            livingSkillsSupport: resident.livingSkillsSupport,
            // Medical documentation
            hasMedicalDocumentation: resident.hasMedicalDocumentation,
            medicalDocType: resident.medicalDocType,
            medicalDocDate: resident.medicalDocDate,
            medicalDocNotes: resident.medicalDocNotes,
            notes: resident.notes,
          }}
          isEdit
        />

        {/* Actions */}
        <div className="sticky bottom-0 -mx-4 px-4 py-3 pb-safe sm:static sm:mx-0 sm:px-0 sm:py-0 bg-ui-surface/95 backdrop-blur border-t border-ui-border sm:border-0 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 z-20">
          <SubmitButton className="btn-primary w-full sm:w-auto min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-wait">
            {RESIDENT_EDIT_LABELS.submit}
          </SubmitButton>
          <Link
            href={`/residents/${id}`}
            className="btn-outline w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center"
          >
            {RESIDENT_EDIT_LABELS.cancel}
          </Link>
        </div>
      </form>

      <ResidentDangerZone residentId={id} residentCode={resident.code} />
    </div>
  )
}
