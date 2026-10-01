/**
 * The integration half of the demo world: what people are learning and doing.
 *
 * Without this, `/learning` renders a board with five zeroes and an empty
 * list, the dashboard's "Lernen" pulse reads 0 laufend / 0 abgeschlossen, and
 * a Jobcoach evaluating the product concludes the whole Integration pillar is
 * unbuilt. It is built; it had no data. Housing, expenses and governance were
 * all seeded — this pillar was the one that shipped blank.
 *
 * NOTHING HERE IS ASSIGNED AT RANDOM. Every record is DERIVED from the
 * resident's own profile, because evidence that contradicts the person it
 * describes is worse than no evidence:
 *
 *   - someone whose `languages` already list German holds a German test, so
 *     they do NOT appear in the board's "Kein Deutsch-Test erfasst" panel;
 *   - someone whose languages do not is in a German course instead, and DOES
 *     appear there — which is what makes that panel show real work rather
 *     than either everyone or nobody;
 *   - only working-age residents get vocational records;
 *   - volunteering goes to the people whose `choresContribution` already says
 *     they do unpaid work for the household.
 *
 * Deterministic on purpose (no Math.random): the same database yields the
 * same world, so a demo can be described in advance and a test can assert on
 * it. Variation comes from the resident's position in the code-sorted list.
 *
 * Used by the LOCAL development / E2E seed (scripts/db/seed.ts) only. The
 * invented demo world that also used it was removed on 2026-10-01; production
 * holds no generated people. It takes resident ids and reads their profiles
 * itself, so the caller has nothing to thread through.
 *
 * Relative-import-safe (no '@/' aliases): loaded through ts-node.
 */

import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  appointment,
  careAssignment,
  learningRecord,
  placement,
  resident as residentTable,
  satisfactionCheckIn,
  type db,
} from '../db'
import type { LearningCategoryId, LearningKindId, LearningStatusId } from '../config/learning'
import { LEARNING_PULSE_WINDOW_DAYS } from '../config/learning'
import { BRAND } from '../config/brand'

type Db = typeof db

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)
const daysAhead = (days: number) => new Date(Date.now() + days * DAY_MS)

/**
 * Every spelling of German that actually occurs in `Resident.languages`.
 *
 * There are three, and that is a real defect in the product rather than a
 * quirk of this file: the intake form's SSOT
 * (`RESIDENT_FACTORS.languages.options`) stores uppercase ISO codes `DE`, the
 * development seed stores lowercase `de`, and the demo seed stores the
 * English name `German`. Language OVERLAP feeds the compatibility score, so
 * two people who both speak German score zero overlap if they were entered
 * through different doors.
 *
 * Matching all three here is a tolerance, not an endorsement — the seed must
 * not silently produce a world where nobody has a German test. Normalising
 * the column itself is a separate change: it rewrites scoring inputs on rows
 * that already exist, and that decision is not this module's to make.
 */
const GERMAN_LANGUAGE_MARKERS: readonly string[] = ['de', 'deutsch', 'german']

function speaksGerman(languages: string[]): boolean {
  return languages.some((language) =>
    GERMAN_LANGUAGE_MARKERS.includes(language.trim().toLowerCase()),
  )
}

/** ISO 639-1 uppercased — the shape `LearningRecord.languageCode` stores. */
const GERMAN_CODE = 'DE'

/**
 * Age ranges plausibly in vocational training or job search. SENIOR is
 * deliberately absent: a Jobcoach board listing an apprenticeship for a
 * 70-year-old discredits every other row on the page.
 */
const WORKING_AGE_RANGES: readonly string[] = ['YOUNG_ADULT', 'ADULT', 'MIDDLE_AGED']

/**
 * From this chores contribution upward, someone already does unpaid work for
 * the people they live with — the same disposition the volunteering board is
 * there to recognise. The scale is 1–5 (`resident-factors.ts`).
 */
const VOLUNTEERING_CONTRIBUTION_MIN = 4

/** CEFR levels a resident can plausibly have reached, rotated deterministically. */
const GERMAN_LEVELS: readonly string[] = ['A2', 'B1', 'B1', 'B2']

interface EvidenceTemplate {
  title: string
  provider: string
  category: LearningCategoryId
  /** Only for kinds that track hours — @see kindTracksHours */
  hours?: number
}

/** Courses for residents who do not speak German yet. */
const GERMAN_COURSES: readonly EvidenceTemplate[] = [
  { title: 'Deutschkurs A1', provider: BRAND.orgName, category: 'language' },
  { title: 'Deutschkurs A2', provider: 'EB Zürich', category: 'language' },
  { title: 'Deutsch im Alltag', provider: BRAND.orgName, category: 'language' },
  { title: 'Alphabetisierung Deutsch', provider: 'EB Zürich', category: 'language' },
]

/** Real Swiss entry-level qualifications, the ones a Jobcoach actually works toward. */
const VOCATIONAL_TEMPLATES: readonly EvidenceTemplate[] = [
  {
    title: 'Pflegehelfer/in SRK',
    provider: 'SRK Kanton Zürich',
    category: 'vocational',
    hours: 120,
  },
  {
    title: 'Hygieneschulung Gastronomie',
    provider: 'Gastro Zürich',
    category: 'vocational',
    hours: 16,
  },
  { title: 'Velomechanik Grundkurs', provider: 'EB Zürich', category: 'vocational', hours: 40 },
  { title: 'Staplerfahrausweis', provider: 'Suva-anerkannt', category: 'vocational', hours: 24 },
  { title: 'Computer-Grundlagen', provider: 'EB Zürich', category: 'digital', hours: 30 },
  { title: 'Bewerbungswerkstatt', provider: BRAND.orgName, category: 'vocational', hours: 12 },
]

/** Neighbourhood work — the volunteering board's reason to exist. */
const VOLUNTEERING_TEMPLATES: readonly EvidenceTemplate[] = [
  {
    title: 'Mittagstisch im Quartiertreff',
    provider: 'Quartiertreff',
    category: 'community',
    hours: 48,
  },
  {
    title: 'Velowerkstatt im Quartier',
    provider: 'Quartiertreff',
    category: 'community',
    hours: 32,
  },
  {
    title: 'Deutsch-Café: Gastgeber*in',
    provider: BRAND.orgName,
    category: 'community',
    hours: 24,
  },
  {
    title: 'Nachbarschaftshilfe Einkauf',
    provider: BRAND.orgName,
    category: 'community',
    hours: 16,
  },
]

/**
 * Status rotation for vocational records, so the board's status filter has
 * something behind every option. A board where everything is "Abgeschlossen"
 * demonstrates a filter that appears broken.
 */
const VOCATIONAL_STATUS_CYCLE: readonly LearningStatusId[] = ['COMPLETED', 'IN_PROGRESS', 'PLANNED']

/**
 * How far back a "completed" record sits, and how far ahead a planned one.
 * Named because a bare `daysAgo(140)` in a template tells the next reader
 * nothing about which surface it was chosen for.
 */
const TIMELINE = {
  /** Vocational courses finished a while back — the person's history. */
  completedStartedDaysAgo: 210,
  completedFinishedDaysAgo: 140,
  /** Currently running: started, no end date. */
  inProgressStartedDaysAgo: 45,
  /** Booked but not begun. */
  plannedStartsInDays: 21,
  /** Volunteering runs long and is still running. */
  volunteeringStartedDaysAgo: 120,
  /** Spacing between residents, so no two rows share a date. */
  perResidentDays: 3,
} as const

/**
 * German tests land INSIDE the dashboard's pulse window on purpose: that tile
 * counts completions from the last `LEARNING_PULSE_WINDOW_DAYS` days, and a
 * world full of finished courses that all finished six months ago reports
 * "0 abgeschlossen" — which reads as a broken tile, not a quiet month.
 */
const GERMAN_TEST_COMPLETED_DAYS_AGO = Math.floor(LEARNING_PULSE_WINDOW_DAYS / 3)

/**
 * How far apart two people's certificates sit — and it WRAPS.
 *
 * The per-resident spacing used elsewhere is unbounded (`index * 3`), which is
 * fine for history but wrong here: in a 25-person world the German speaker at
 * index 20 landed 70 days back, outside the window the dashboard counts, and
 * the pulse tile reported 1 completion where four had been seeded. Wrapping
 * keeps every certificate inside the month while still spreading the dates.
 */
const GERMAN_TEST_SPREAD_DAYS = Math.floor(LEARNING_PULSE_WINDOW_DAYS / 3)

function germanTestCompletedDaysAgo(index: number): number {
  return GERMAN_TEST_COMPLETED_DAYS_AGO + (index % GERMAN_TEST_SPREAD_DAYS)
}

/** Deterministic rotation through a template list. */
function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]
}

interface EvidenceProfile {
  id: string
  languages: string[]
  ageRange: string | null
  choresContribution: number | null
}

type RecordPayload = {
  residentId: string
  kind: LearningKindId
  title: string
  status: LearningStatusId
  languageCode: string | null
  cefrLevel: string | null
  provider: string
  category: LearningCategoryId
  hours: number | null
  startedAt: Date | null
  completedAt: Date | null
  notes: string | null
  recordedBy: 'RESIDENT' | 'STAFF'
}

/**
 * The evidence one resident carries, derived from who they are.
 *
 * Exported for the test: the derivation rules are the whole point of this
 * module, and asserting them through a database round-trip would test the ORM
 * instead of the rules.
 */
export function evidenceForResident(resident: EvidenceProfile, index: number): RecordPayload[] {
  const records: RecordPayload[] = []
  const spacing = index * TIMELINE.perResidentDays
  const hasGerman = speaksGerman(resident.languages)

  // ---------------------------------------------------------------------
  // German — the single most consequential fact on a Jobcoach's board
  // ---------------------------------------------------------------------
  if (hasGerman) {
    // A certificate is something staff enter: it arrives on paper.
    records.push({
      residentId: resident.id,
      kind: 'LANGUAGE_TEST',
      title: `fide-Test Deutsch ${pick(GERMAN_LEVELS, index)}`,
      status: 'COMPLETED',
      languageCode: GERMAN_CODE,
      cefrLevel: pick(GERMAN_LEVELS, index),
      provider: 'fide',
      category: 'language',
      hours: null,
      startedAt: daysAgo(germanTestCompletedDaysAgo(index) + TIMELINE.completedStartedDaysAgo),
      completedAt: daysAgo(germanTestCompletedDaysAgo(index)),
      notes: null,
      recordedBy: 'STAFF',
    })
  } else {
    // No test, a course in progress: this person SHOULD appear in the
    // board's "Kein Deutsch-Test erfasst" panel, and now does — with the
    // course that explains why they are already being worked with.
    const course = pick(GERMAN_COURSES, index)
    records.push({
      residentId: resident.id,
      kind: 'COURSE',
      title: course.title,
      status: 'IN_PROGRESS',
      languageCode: GERMAN_CODE,
      cefrLevel: null,
      provider: course.provider,
      category: course.category,
      hours: null,
      startedAt: daysAgo(TIMELINE.inProgressStartedDaysAgo + spacing),
      completedAt: null,
      notes: null,
      // The person signed themselves up — the portal's own entry path.
      recordedBy: 'RESIDENT',
    })
  }

  // ---------------------------------------------------------------------
  // Vocational — only for people of working age
  // ---------------------------------------------------------------------
  if (resident.ageRange && WORKING_AGE_RANGES.includes(resident.ageRange)) {
    const template = pick(VOCATIONAL_TEMPLATES, index)
    const status = pick(VOCATIONAL_STATUS_CYCLE, index)
    const isQualification = template.hours !== undefined && template.hours >= 40

    records.push({
      residentId: resident.id,
      kind: isQualification ? 'QUALIFICATION' : 'COURSE',
      title: template.title,
      status,
      languageCode: null,
      cefrLevel: null,
      provider: template.provider,
      category: template.category,
      hours: template.hours ?? null,
      startedAt:
        status === 'PLANNED'
          ? daysAhead(TIMELINE.plannedStartsInDays + index)
          : daysAgo(
              (status === 'COMPLETED'
                ? TIMELINE.completedStartedDaysAgo
                : TIMELINE.inProgressStartedDaysAgo) + spacing,
            ),
      completedAt:
        status === 'COMPLETED' ? daysAgo(TIMELINE.completedFinishedDaysAgo + spacing) : null,
      notes: null,
      // A certificate is filed by staff; a plan is made together, but the
      // person is the one who committed to it.
      recordedBy: status === 'COMPLETED' ? 'STAFF' : 'RESIDENT',
    })
  }

  // ---------------------------------------------------------------------
  // Volunteering — for people already doing unpaid work at home
  // ---------------------------------------------------------------------
  if ((resident.choresContribution ?? 0) >= VOLUNTEERING_CONTRIBUTION_MIN) {
    const template = pick(VOLUNTEERING_TEMPLATES, index)
    records.push({
      residentId: resident.id,
      kind: 'VOLUNTEERING',
      title: template.title,
      status: 'IN_PROGRESS',
      languageCode: null,
      cefrLevel: null,
      provider: template.provider,
      category: template.category,
      hours: template.hours ?? null,
      startedAt: daysAgo(TIMELINE.volunteeringStartedDaysAgo + spacing),
      completedAt: null,
      notes: null,
      recordedBy: 'RESIDENT',
    })
  }

  return records
}

export interface IntegrationSeedContext {
  /** Residents to write evidence for. Profiles are read from the database. */
  residentIds: string[]
  /**
   * The staff member who takes the care seats, when this deployment has one.
   * Null skips care assignments entirely rather than inventing a colleague:
   * fake staff would show up in every real "zuständig" picker on the instance.
   */
  staffId?: string | null
}

export interface IntegrationSeedSummary {
  records: number
  careAssignments: number
  appointments: number
}

/**
 * Appointments, in the two states a visitor needs to see.
 *
 * Recording how someone is doing now happens ONLY when staff close an
 * appointment — the always-on scale that used to sit on the client page and in
 * the placements table is gone. So a demo world with no appointments
 * demonstrates no check-in at all, and a visitor meets four empty care panels
 * and concludes the care team does nothing. That is the same failure the chore
 * and proposal seeds exist to prevent.
 *
 * The timing is load-bearing, exactly as it is for the seeded proposal. One
 * appointment is BACKDATED and already COMPLETED with its check-in attached, so
 * the history and the attribution are visible on arrival. The other is
 * SCHEDULED a day out, so the visitor can close it themselves and watch the
 * reading appear — the equivalent of the deciding vote left uncast.
 */
const APPOINTMENT_SCRIPT = [
  { domain: 'JOB', past: 'Standortgespräch Arbeit', next: 'Bewerbung durchgehen' },
  { domain: 'SOCIAL', past: 'Erstgespräch Sozialarbeit', next: 'Anschlusslösung besprechen' },
  { domain: 'HOUSING', past: 'Ankommen in der Wohnung', next: 'Wohnsituation nachfragen' },
  { domain: 'VOLUNTEERING', past: 'Einsatz nachbesprochen', next: 'Neuen Einsatz suchen' },
] as const

/**
 * The four care seats.
 *
 * All four go to the same person when only one staff account exists, which is
 * the honest state of a small deployment — and it is what makes the board's
 * "Meine Klient*innen" filter show anything at all. Without an assignment the
 * filter is every non-Leitung role's DEFAULT view, so a Jobcoach's first
 * screen is empty even when the database is full.
 */
const CARE_ROLES = ['HOUSING', 'SOCIAL', 'JOB', 'VOLUNTEERING'] as const

export async function seedIntegrationEvidence(
  dbc: Db,
  ctx: IntegrationSeedContext,
): Promise<IntegrationSeedSummary> {
  const residents = ctx.residentIds.length
    ? await dbc.query.resident.findMany({
        where: inArray(residentTable.id, ctx.residentIds),
        columns: {
          id: true,
          languages: true,
          ageRange: true,
          choresContribution: true,
        },
        // Sorted so the index — and therefore the whole world — is reproducible.
        orderBy: [asc(residentTable.code)],
      })
    : []

  const payloads = residents.flatMap((resident, index) =>
    evidenceForResident(
      {
        id: resident.id,
        languages: resident.languages ?? [],
        ageRange: resident.ageRange,
        choresContribution: resident.choresContribution,
      },
      index,
    ),
  )

  if (payloads.length > 0) {
    await dbc.insert(learningRecord).values(payloads)
  }

  let careAssignments = 0
  if (ctx.staffId && residents.length > 0) {
    const result = await dbc
      .insert(careAssignment)
      .values(
        residents.flatMap((resident) =>
          CARE_ROLES.map((role) => ({
            residentId: resident.id,
            staffId: ctx.staffId as string,
            role,
          })),
        ),
      )
      // The seed may run over a world that already has real assignments.
      .onConflictDoNothing()
    careAssignments = result.rowCount ?? 0
  }

  // ---------------------------------------------------------------------
  // Appointments — see APPOINTMENT_SCRIPT for why both states are seeded.
  // Guarded by the same staffId rule as the care seats: with no staff account
  // there is nobody to hold the appointment, and inventing one would put a
  // fake colleague in front of a real user.
  // ---------------------------------------------------------------------
  let appointments = 0
  if (ctx.staffId) {
    const staffId = ctx.staffId

    // The check-in hangs off a placement, so only a placed resident can carry
    // the completed half. Everyone still gets the scheduled one.
    const placements = residents.length
      ? await dbc.query.placement.findMany({
          where: and(
            inArray(
              placement.residentId,
              residents.map((r) => r.id),
            ),
            eq(placement.status, 'ACTIVE'),
          ),
          columns: { id: true, residentId: true, startDate: true },
        })
      : []
    const placementByResident = new Map(placements.map((p) => [p.residentId, p]))

    for (let index = 0; index < residents.length; index += 1) {
      const resident = residents[index]
      const script = APPOINTMENT_SCRIPT[index % APPOINTMENT_SCRIPT.length]

      await dbc.insert(appointment).values({
        residentId: resident.id,
        staffId,
        domain: script.domain,
        title: script.next,
        // A day out, so it is still upcoming however late in the day the
        // visitor arrives — the demo world is rebuilt nightly.
        startsAt: daysAhead(1),
        status: 'SCHEDULED',
      })
      appointments += 1

      const residentPlacement = placementByResident.get(resident.id)
      if (!residentPlacement) continue

      const [held] = await dbc
        .insert(appointment)
        .values({
          residentId: resident.id,
          staffId,
          domain: script.domain,
          title: script.past,
          startsAt: daysAgo(6 + (index % 5)),
          status: 'COMPLETED',
        })
        .returning()
      appointments += 1

      // The reading this product now produces: attached to the conversation it
      // came from, and attributed to the account that recorded it. A demo that
      // showed a score with neither would be demonstrating the old behaviour.
      await dbc.insert(satisfactionCheckIn).values({
        placementId: residentPlacement.id,
        appointmentId: held.id,
        checkInType: 'AD_HOC',
        weekNumber: Math.max(
          0,
          Math.floor((Date.now() - residentPlacement.startDate.getTime()) / (7 * DAY_MS)),
        ),
        // Deliberately not all 5s: an even record shows nothing, the same
        // reason the seeded chore history is uneven.
        overallSatisfaction: 3 + (index % 3),
        concerns: index % 3 === 0 ? 'Sucht eine Anschlusslösung für den Winter.' : null,
        collectedByUserId: staffId,
        isAnonymous: false,
      })
    }
  }

  return { records: payloads.length, careAssignments, appointments }
}
