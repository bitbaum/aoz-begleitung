import type { Resident } from '@/lib/db'
import type { ResidentSummary } from '@/lib/types'

/**
 * A resident projected to exactly the fields the housing-detail client
 * components render — the union of ResidentSummary, ResidentHouseholdProfile
 * and ResidentBasic (the three narrow prop types those components declare).
 * `choresContribution` is the one field ResidentHouseholdProfile adds on top of
 * ResidentSummary.
 */
export type ResidentUiSummary = ResidentSummary & Pick<Resident, 'choresContribution'>

/**
 * Project a whole Resident row down to what may cross to a client component.
 *
 * WHY THIS EXISTS — the bug it prevents is invisible in the type checker.
 * `src/app/(admin)/housing/[id]/page.tsx` reads whole Resident rows (Prisma
 * returns every scalar when no `select` is given) because server-side
 * compatibility math (`toResidentProfile`, `getUnitFitConcerns`) needs the full
 * functional field set. Those same rows were then passed straight into client
 * components — `ApartmentProfileCard`, `HouseholdFitCard`,
 * `CompatibilityMatrixInteractive`, `RoomVisualizationWithPlacement` — whose
 * props are typed as the NARROW `ResidentSummary`/`…HouseholdProfile`/`…Basic`.
 *
 * TypeScript accepts a wider object where a narrower one is expected
 * (structural typing), so it compiled green — but **Next serializes the object
 * actually passed, not the type it was passed as**, into the page's HTML flight
 * payload. That put caseworker `notes`, `supportLevel`, `bio`, and the
 * `medicalDoc*` / `hasMedicalDocumentation` fields — about refugees — into the
 * page source of a staff screen.
 *
 * So the projection has to happen at the boundary, in code, not be left to the
 * prop type. Call this at every point a resident row crosses into a client
 * component. `code` stays because this repo treats it as semi-public (the login
 * reference, like a room number); the medical and caseworker fields do not.
 */
export function toResidentUiSummary(r: Resident): ResidentUiSummary {
  return {
    id: r.id,
    code: r.code,
    displayName: r.displayName,
    ageRange: r.ageRange,
    gender: r.gender,
    languages: r.languages ?? [],
    socialStyle: r.socialStyle,
    sleepSchedule: r.sleepSchedule,
    smokingStatus: r.smokingStatus,
    noiseTolerance: r.noiseTolerance,
    cleanlinessPractice: r.cleanlinessPractice,
    privacyNeed: r.privacyNeed,
    choresContribution: r.choresContribution,
  }
}
