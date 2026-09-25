import { db, resident as residentTable } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import {
  portalPreferencesSchema,
  validateFormData,
  ValidationError,
} from '@/lib/validation/schemas'
import { logger } from '@/lib/logger'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { getResidentCookie } from '@/lib/portal-auth'

export async function POST(request: NextRequest) {
  const residentCode = await getResidentCookie()

  if (!residentCode) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED },
      { status: 401 },
    )
  }

  const resident = await db.query.resident.findFirst({
    where: eq(residentTable.code, residentCode),
  })

  if (!resident) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.RESIDENT_NOT_FOUND },
      { status: 404 },
    )
  }

  let data: ReturnType<typeof validateFormData<typeof portalPreferencesSchema>>
  try {
    const formData = await request.formData()
    data = validateFormData(portalPreferencesSchema, formData)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_INPUT },
      { status: 400 },
    )
  }

  // Build roommate preferences text (stored in dedicated column, NOT notes)
  const roommatePrefsText =
    [
      data.preferredAgeRange ? `Altersgruppe: ${data.preferredAgeRange}` : null,
      data.additionalPreferences || null,
    ]
      .filter(Boolean)
      .join('. ') || null

  try {
    await db
      .update(residentTable)
      .set({
        sleepSchedule: data.sleepSchedule,
        noiseTolerance: data.noiseTolerance,
        cleanlinessPractice: data.cleanlinessPractice,
        cleanlinessExpectation: data.cleanlinessExpectation,
        chaosTolerance: data.chaosTolerance,
        socialStyle: data.socialStyle,
        privacyNeed: data.privacyNeed,
        smokingStatus: data.smokingStatus,
        petTolerance: data.petTolerance,
        sharedBathroom: data.sharedBathroom,
        sharedKitchen: data.sharedKitchen,
        languages: data.languages,
        dietaryNeeds: data.dietaryNeeds,
        roommatePreferences: roommatePrefsText,
        preferencesCompletedAt: new Date(),
      })
      .where(eq(residentTable.id, resident.id))

    await logAudit({
      action: 'UPDATE',
      entity: 'RESIDENT',
      entityId: resident.id,
      changes: {
        updatedBy: 'portal',
        fields: [
          'sleepSchedule',
          'noiseTolerance',
          'cleanlinessPractice',
          'cleanlinessExpectation',
          'chaosTolerance',
          'socialStyle',
          'privacyNeed',
          'smokingStatus',
          'languages',
          'dietaryNeeds',
          'roommatePreferences',
        ],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.errorWithCause('Failed to update portal preferences', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.PREFERENCES_SAVE_ERROR },
      { status: 500 },
    )
  }
}
