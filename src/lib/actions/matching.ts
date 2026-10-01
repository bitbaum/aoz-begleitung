'use server'

import { and, eq } from 'drizzle-orm'
import {
  db,
  housingUnit,
  placement as placementTable,
  placementSpot,
  resident as residentTable,
  type Resident,
} from '@/lib/db'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { calculateCompatibility, saveBidirectionalAssessment } from '@/lib/compatibility'
import { toResidentProfile } from '@/lib/compatibility/convert'
import { calculateApartmentProfile, calculateApartmentFit } from '@/lib/compatibility/aggregate'
import { calculateAverageScores } from '@/lib/compatibility/placement-scores'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { requireStaffAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'

/** Minimal schema — scores are now computed server-side */
const placeResidentSchema = z.object({
  residentId: z.string().min(1),
  housingUnitId: z.string().min(1),
  spotId: z.string().nullable(),
  notes: z.string().optional(),
})

/** Build structured placement rationale from computed scores and compatibility data */
function buildPlacementRationale(
  apartmentFitScore: number,
  scores: ReturnType<typeof calculateAverageScores>,
  allStrengths: string[],
  allConcerns: string[],
  roommateCount: number,
  userNotes?: string,
): string {
  const parts: string[] = [`Apartment Fit: ${apartmentFitScore}%`]

  if (allStrengths.length > 0) {
    parts.push('')
    parts.push('Stärken:')
    allStrengths.slice(0, 5).forEach((s) => parts.push(`• ${s}`))
  }

  if (allConcerns.length > 0) {
    parts.push('')
    parts.push('Bedenken:')
    allConcerns.slice(0, 5).forEach((c) => parts.push(`• ${c}`))
  }

  if (roommateCount > 0) {
    parts.push('')
    parts.push(
      `Kompatibilität: ${roommateCount} Mitbewohner, Ø ${scores.compatibilityScore}% Score`,
    )
  } else {
    parts.push('')
    parts.push('Kompatibilität: Keine Mitbewohner (leere Einheit)')
  }

  if (userNotes) {
    parts.push('')
    parts.push(`Notizen: ${userNotes}`)
  }

  return parts.join('\n')
}

export async function placeResident(formData: FormData) {
  const user = await requireStaffAuth()
  // A session is not a right. This took `requireStaffAuth()` alone, so any
  // staff member could place a person into a flat — including roles whose
  // menu does not offer /matching at all. Same verb as createPlacement.
  if (!hasPermission(user, 'placements:write')) {
    throw new Error(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS)
  }
  // Parse minimal form data (scores excluded — computed server-side)
  let validatedData
  try {
    validatedData = placeResidentSchema.parse({
      residentId: formData.get('residentId') as string,
      housingUnitId: formData.get('housingUnitId') as string,
      spotId: (formData.get('spotId') as string) || null,
      notes: (formData.get('notes') as string) || undefined,
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Validierungsfehler: ${error.message}`)
    }
    throw new Error(ERROR_MESSAGES.INVALID_INPUT_DATA)
  }

  const { residentId, housingUnitId, spotId, notes } = validatedData

  // Execute all placement operations in a transaction to ensure atomicity
  let placement
  try {
    placement = await db.transaction(async (tx) => {
      // 1. Check if spot is still available (prevents double-booking)
      if (spotId) {
        const spot = await tx.query.placementSpot.findFirst({
          where: eq(placementSpot.id, spotId),
          with: { placements: { where: eq(placementTable.status, 'ACTIVE') } },
        })

        if (!spot) {
          throw new Error(ERROR_MESSAGES.SPOT_NOT_FOUND_P)
        }

        if (spot.status !== 'AVAILABLE') {
          throw new Error(ERROR_MESSAGES.SPOT_NOT_AVAILABLE_ANYMORE)
        }

        if (spot.placements.length > 0) {
          throw new Error(ERROR_MESSAGES.SPOT_ALREADY_OCCUPIED)
        }
      }

      // 2. Check if resident is still unplaced
      const resident = await tx.query.resident.findFirst({
        where: eq(residentTable.id, residentId),
        with: { placements: { where: eq(placementTable.status, 'ACTIVE') } },
      })

      if (!resident) {
        throw new Error(ERROR_MESSAGES.RESIDENT_NOT_FOUND_P)
      }

      if (resident.placements.length > 0) {
        throw new Error(ERROR_MESSAGES.RESIDENT_ALREADY_PLACED)
      }

      // 3. Fetch existing active placements in the unit for score calculation
      const existingPlacements = await tx.query.placement.findMany({
        where: and(
          eq(placementTable.housingUnitId, housingUnitId),
          eq(placementTable.status, 'ACTIVE'),
        ),
        with: { resident: true },
      })

      // 4. Server-side blocking conflict check (never trust client)
      // (`db.query`'s relation typing collapses to an untyped fallback for
      // this schema; at runtime each `p.resident` is one Resident row.)
      const residentProfile = toResidentProfile(resident)
      const existingProfiles = existingPlacements.map((p) =>
        toResidentProfile(p.resident as unknown as Resident),
      )
      const apartmentProfile = calculateApartmentProfile(existingProfiles)
      const apartmentFit = calculateApartmentFit(residentProfile, apartmentProfile)
      const apartmentFitScore = apartmentFit.fitScore

      const hasBlockingConflicts = apartmentFit.conflicts.some((c) => c.severity === 'BLOCKING')
      if (hasBlockingConflicts) {
        const blockingDetails = apartmentFit.conflicts
          .filter((c) => c.severity === 'BLOCKING')
          .map((c) => c.message)
          .join('; ')
        throw new Error(
          `Placement blockiert: ${blockingDetails}. ` +
            'Bitte wählen Sie eine besser passende Unterkunft.',
        )
      }

      // 5. Calculate scores server-side
      const { compatibilityScore, lifestyleScore, socialScore, practicalScore, riskScore } =
        calculateAverageScores(resident, existingPlacements)

      // 6. Collect strengths/concerns for structured rationale
      const allStrengths: string[] = []
      const allConcerns: string[] = []

      if (existingPlacements.length > 0) {
        for (const existingPlacement of existingPlacements) {
          const otherProfile = toResidentProfile(existingPlacement.resident as unknown as Resident)
          const score = calculateCompatibility(residentProfile, otherProfile)

          // Collect insights
          score.strengths?.forEach((s) => {
            if (!allStrengths.includes(s)) allStrengths.push(s)
          })
          score.concerns?.forEach((c) => {
            if (!allConcerns.includes(c)) allConcerns.push(c)
          })

          await saveBidirectionalAssessment(tx, residentId, existingPlacement.residentId, score)
        }
      }

      // 6. Build structured placement rationale
      const placementNotes = buildPlacementRationale(
        apartmentFitScore,
        { compatibilityScore, lifestyleScore, socialScore, practicalScore, riskScore },
        allStrengths,
        allConcerns,
        existingPlacements.length,
        notes,
      )

      // 7. Create placement with server-computed scores
      const [newPlacement] = await tx
        .insert(placementTable)
        .values({
          residentId,
          housingUnitId,
          spotId,
          startDate: new Date(),
          status: 'ACTIVE',
          compatibilityScore,
          lifestyleScore,
          socialScore,
          practicalScore,
          riskScore,
          placementNotes,
        })
        .returning()

      // 8. Update spot status if assigned
      if (spotId) {
        await tx
          .update(placementSpot)
          .set({ status: 'OCCUPIED' })
          .where(eq(placementSpot.id, spotId))
      }

      // 9. Update resident status
      await tx
        .update(residentTable)
        .set({ status: 'PLACED' })
        .where(eq(residentTable.id, residentId))

      // 10. Check if unit is now full and update status
      const unit = await tx.query.housingUnit.findFirst({
        where: eq(housingUnit.id, housingUnitId),
        with: { placements: { where: eq(placementTable.status, 'ACTIVE') } },
      })

      // placements already includes the newly created one (same transaction)
      if (unit && unit.placements.length >= unit.totalBeds) {
        await tx
          .update(housingUnit)
          .set({ status: 'FULL' })
          .where(eq(housingUnit.id, housingUnitId))
      }

      return {
        placement: newPlacement,
        compatibilityScore,
        lifestyleScore,
        socialScore,
        practicalScore,
        riskScore,
        apartmentFitScore,
      }
    })

    // AUDIT LOG: Record placement for compliance and debugging
    await logAudit({
      action: 'CREATE',
      entity: 'PLACEMENT',
      entityId: placement.placement.id,
      userId: user.id,
      changes: {
        residentId,
        housingUnitId,
        spotId,
        scores: {
          compatibility: placement.compatibilityScore,
          lifestyle: placement.lifestyleScore,
          social: placement.socialScore,
          practical: placement.practicalScore,
          risk: placement.riskScore,
          apartmentFit: placement.apartmentFitScore,
        },
      },
      reason: notes || undefined,
    })
  } catch (error) {
    // Re-throw known validation errors (from inside transaction)
    if (
      error instanceof Error &&
      (error.message.includes('nicht gefunden') ||
        error.message.includes('nicht mehr verfügbar') ||
        error.message.includes('bereits') ||
        error.message.includes('blockiert'))
    ) {
      throw error
    }
    logger.errorWithCause('Failed to place resident', error, { residentId, housingUnitId, spotId })
    throw new Error(ERROR_MESSAGES.PLACEMENT_ERROR)
  }

  redirect(`/residents/${residentId}?placed=true`)
}
