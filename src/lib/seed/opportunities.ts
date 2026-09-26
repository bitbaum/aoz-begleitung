/**
 * Seeds the opportunity directory and a pipeline that is actually in motion.
 *
 * DELIBERATELY NOT part of the unit-scoped demo world. `Opportunity` is
 * org-wide, like `Activity` — which no seed touches either, for this reason:
 * on the live instance the scoped demo lives ALONGSIDE a real flat, and there
 * is no code prefix to isolate an org-wide row behind. Seeding invented
 * volunteering places there would drop them onto a real coach's working board,
 * and this is a board whose entries people phone. An honest empty state is the
 * better failure. Dev seed and full-scope demo resets only.
 *
 * Everything is derived and deterministic — no `Math.random`, so a demo can be
 * described in advance and a reset never silently changes what a reviewer saw
 * yesterday.
 *
 * Relative-import-safe (no '@/' aliases): loaded through plain ts-node.
 */

import {
  learningRecord,
  opportunity as opportunityTable,
  opportunityApplication,
  type db,
} from '../db'
import { evidenceForStartedApplication } from '../opportunities/pipeline'

type Db = typeof db

type Kind = 'VOLUNTEERING' | 'COMMUNITY_SERVICE' | 'EMPLOYMENT' | 'INTERNSHIP'
type Permit = 'NONE' | 'EMPLOYER_NOTIFIES' | 'PERMIT_REQUIRED'
type Stage = 'INTERESTED' | 'APPLIED' | 'INTERVIEW' | 'ACCEPTED' | 'STARTED' | 'ENDED' | 'DECLINED'

interface OpportunityTemplate {
  kind: Kind
  title: string
  description: string
  organisation: string
  location: string
  schedule: string
  hoursPerWeek: number
  seats: number
  germanLevel: string | null
  permitRequirement: Permit
  requirementNote: string | null
  contactName: string
  contactPhone: string
  /** Stages to hand out, in order, to the residents assigned to this listing. */
  stages: readonly Stage[]
}

/**
 * Five listings that between them cover every branch the board can render:
 * all three permit requirements, a listing with no German requirement and one
 * with B1, a full one and one with seats left, plus a draft.
 */
const TEMPLATES: readonly OpportunityTemplate[] = [
  {
    kind: 'VOLUNTEERING',
    title: 'Mittagstisch im Quartiertreff',
    description:
      'Zweimal pro Woche kochen und servieren wir ein günstiges Mittagessen für das Quartier. Du hilfst beim Vorbereiten, Schöpfen und Aufräumen. Deutsch ist keine Voraussetzung — es wird viel gezeigt statt erklärt.',
    organisation: 'Quartierverein Beispielquartier (erfunden)',
    location: 'Beispielstrasse 405, 8000 Zürich',
    schedule: 'Di + Do, 10–14 Uhr',
    hoursPerWeek: 8,
    seats: 3,
    germanLevel: null,
    permitRequirement: 'NONE',
    requirementNote: null,
    contactName: 'Regula Kunz',
    contactPhone: '000 000 00 01',
    stages: ['STARTED', 'ACCEPTED', 'INTERESTED'],
  },
  {
    kind: 'VOLUNTEERING',
    title: 'Velowerkstatt im Quartier',
    description:
      'Offene Werkstatt: Velos flicken, Bremsen einstellen, Ersatzteile sortieren. Wer schon geschraubt hat, ist schnell drin. Werkzeug ist vorhanden.',
    organisation: 'Velowerkstatt Beispiel (erfunden)',
    location: 'Zürich Oerlikon',
    schedule: 'Sa, 10–16 Uhr',
    hoursPerWeek: 6,
    seats: 2,
    germanLevel: 'A2',
    permitRequirement: 'NONE',
    requirementNote: 'Sicherheitseinweisung am ersten Tag, dauert eine halbe Stunde.',
    contactName: 'Marc Baumgartner',
    contactPhone: '000 000 00 02',
    stages: ['STARTED', 'DECLINED'],
  },
  {
    kind: 'COMMUNITY_SERVICE',
    title: 'Grünpflege in der Stadtgärtnerei',
    description:
      'Gemeinnütziger Einsatz im Team: Beete pflegen, Wege freihalten, im Winter Werkzeugunterhalt. Feste Zeiten, feste Ansprechperson, Arbeitskleidung wird gestellt.',
    organisation: 'Stadtgärtnerei Beispiel (erfunden)',
    location: 'Beispielstrasse 27, 8000 Zürich',
    schedule: 'Mo–Mi, 8–12 Uhr',
    hoursPerWeek: 12,
    seats: 4,
    germanLevel: 'A2',
    permitRequirement: 'EMPLOYER_NOTIFIES',
    requirementNote:
      'Die Stadtgärtnerei meldet den Einsatz selbst an. Wir brauchen nur deinen Namen.',
    contactName: 'Lea Keller',
    contactPhone: '000 000 00 03',
    stages: ['INTERVIEW', 'APPLIED', 'ENDED'],
  },
  {
    kind: 'VOLUNTEERING',
    title: 'Deutsch-Café: Gastgeber*in',
    description:
      'Beim wöchentlichen Deutsch-Café Tische decken, Gäste begrüssen und mit Neuen ins Gespräch kommen. Ideal, wenn du selbst Deutsch übst — du redest zwei Stunden am Stück.',
    organisation: 'Nachbarschaftshilfe Beispiel (erfunden)',
    location: 'Zürich Riesbach',
    schedule: 'Mi, 14–17 Uhr',
    hoursPerWeek: 3,
    seats: 2,
    germanLevel: 'A2',
    permitRequirement: 'NONE',
    requirementNote: null,
    contactName: 'Peter Lehmann',
    contactPhone: '000 000 00 04',
    stages: ['ACCEPTED', 'INTERESTED'],
  },
  {
    kind: 'COMMUNITY_SERVICE',
    title: 'Lagerhilfe Brockenhaus (in Abklärung)',
    description:
      'Waren annehmen, sortieren und einräumen. Noch nicht ausgeschrieben: die Bewilligungsfrage ist offen, deshalb Entwurf.',
    organisation: 'Brockenstube Beispiel (erfunden)',
    location: 'Zürich Altstetten',
    schedule: 'nach Absprache',
    hoursPerWeek: 20,
    seats: 2,
    germanLevel: 'B1',
    permitRequirement: 'PERMIT_REQUIRED',
    requirementNote: 'Kleine Entschädigung pro Einsatztag. Arbeitskleidung wird gestellt.',
    contactName: 'Doris Frei',
    contactPhone: '000 000 00 05',
    stages: [],
  },
  // Work, so the Jobcoach's board and Eingang are not structurally empty: the
  // demo used to seed only volunteering and community service, and a visitor
  // opening the Jobcoach door saw nothing to do. A work listing must state
  // its permit route (permitRequirementIsStated), so both do.
  {
    kind: 'EMPLOYMENT',
    title: 'Mitarbeit Küche, Kantine Beispiel',
    description:
      'Vorbereiten, Abwaschen und Ausgabe über Mittag in einer Betriebskantine. Arbeitskleidung wird gestellt. Einarbeitung vor Ort, einfache Deutschkenntnisse reichen für den Anfang.',
    organisation: 'Kantine Beispiel AG (erfunden)',
    location: 'Beispielstrasse 12, 8000 Zürich',
    schedule: 'Mo–Fr, 10–14 Uhr',
    hoursPerWeek: 20,
    seats: 2,
    germanLevel: 'A2',
    permitRequirement: 'EMPLOYER_NOTIFIES',
    requirementNote: 'Die Arbeitgeberin meldet die Stelle bei der Behörde an.',
    contactName: 'Nora Brunner',
    contactPhone: '000 000 00 06',
    stages: ['INTERVIEW', 'INTERESTED'],
  },
  {
    kind: 'INTERNSHIP',
    title: 'Schnupperpraktikum Logistik',
    description:
      'Zwei Wochen in einem Lager mitarbeiten: Ware annehmen, einräumen, Bestellungen bereitstellen. Am Ende gibt es ein Zeugnis.',
    organisation: 'Logistik Beispiel GmbH (erfunden)',
    location: 'Beispielstrasse 30, 8000 Zürich',
    schedule: 'Mo–Fr, 8–16 Uhr, zwei Wochen',
    hoursPerWeek: 38,
    seats: 1,
    germanLevel: 'A2',
    permitRequirement: 'PERMIT_REQUIRED',
    requirementNote: 'Staplerausweis ist kein Muss — wer ihn nicht hat, wird im Betrieb geschult.',
    contactName: 'Luca Meier',
    contactPhone: '000 000 00 07',
    stages: ['INTERESTED'],
  },
]

/** Days ago each stage was last touched, so the board is not one flat timestamp. */
const STAGE_AGE_DAYS: Record<Stage, number> = {
  INTERESTED: 2,
  APPLIED: 6,
  INTERVIEW: 11,
  ACCEPTED: 16,
  STARTED: 24,
  ENDED: 40,
  DECLINED: 30,
}

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

export interface OpportunitySeedContext {
  /** Residents to distribute across the listings, in a stable order. */
  residentIds: readonly string[]
  /** Staff account credited as curator and supporter. */
  staffId: string | null
  /** Injected so callers can pin the world; defaults to now. */
  now?: Date
}

export interface OpportunitySeedSummary {
  opportunities: number
  applications: number
  evidenceRecords: number
}

export async function seedOpportunities(
  dbc: Db,
  ctx: OpportunitySeedContext,
): Promise<OpportunitySeedSummary> {
  const now = ctx.now ?? new Date()
  const residents = [...ctx.residentIds]

  let opportunities = 0
  let applications = 0
  let evidenceRecords = 0
  let residentCursor = 0

  for (const template of TEMPLATES) {
    const { stages, ...columns } = template

    const [opportunity] = await dbc
      .insert(opportunityTable)
      .values({
        ...columns,
        // The draft listing is the one with no applicants — a board where
        // everything is published shows a filter that looks broken.
        status: stages.length === 0 ? 'DRAFT' : 'PUBLISHED',
        startsAt: daysAgo(60, now),
        createdByUserId: ctx.staffId,
        updatedByUserId: ctx.staffId,
      })
      .returning()
    opportunities += 1

    // One application per resident per listing is a unique constraint. With
    // fewer residents than stages the cursor would wrap onto someone already
    // attached and the whole seed would abort — so a listing simply gets fewer
    // applicants rather than a crash.
    const usedHere = new Set<string>()

    for (const stage of stages) {
      const residentId = residents
        .slice(residentCursor % residents.length)
        .concat(residents)
        .find((id) => !usedHere.has(id))
      residentCursor += 1
      if (!residentId) break
      usedHere.add(residentId)

      const stageChangedAt = daysAgo(STAGE_AGE_DAYS[stage], now)

      // STARTED and ENDED carry evidence, because that is what the product
      // does when a coach moves the stage. Writing the row without it would
      // seed a world the running code cannot produce — a demo of something
      // that does not exist.
      let learningRecordId: string | null = null
      if (stage === 'STARTED' || stage === 'ENDED') {
        const [record] = await dbc
          .insert(learningRecord)
          .values({
            residentId,
            ...evidenceForStartedApplication(opportunity, stageChangedAt),
            ...(stage === 'ENDED'
              ? { status: 'COMPLETED' as const, completedAt: daysAgo(7, now), hours: 48 }
              : {}),
          })
          .returning()
        learningRecordId = record.id
        evidenceRecords += 1
      }

      await dbc.insert(opportunityApplication).values({
        opportunityId: opportunity.id,
        residentId,
        stage,
        stageChangedAt,
        createdAt: daysAgo(STAGE_AGE_DAYS[stage] + 4, now),
        createdBy: stage === 'INTERESTED' ? 'RESIDENT' : 'STAFF',
        // Same rule as the evidence above, one field along. `recordInterest`
        // leaves `supportedByUserId` null — that IS a resident-raised interest
        // nobody has answered, and it is what the Jobcoach queue is built to
        // surface. Seeding a supporter onto it produced a row the running code
        // can never produce, and a demo in which "Wartet auf Antwort" is
        // permanently empty. @see lib/jobcoach/queue.ts
        supportedByUserId: stage === 'INTERESTED' ? null : ctx.staffId,
        learningRecordId,
      })
      applications += 1
    }
  }

  return { opportunities, applications, evidenceRecords }
}
