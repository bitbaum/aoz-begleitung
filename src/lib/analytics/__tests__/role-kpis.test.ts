import {
  JOB_KPI_DEFS,
  VOLUNTEERING_KPI_DEFS,
  computeJobKpis,
  computeVolunteeringKpis,
  kpiDefsForDomain,
  type JobKpiClient,
} from '../role-kpis'
import { JOB_RESEARCH_SOURCES } from '@/lib/config/job-integration-docs'
import { CARE_ROLES } from '@/lib/config/care'
import type { JobApplicationInput } from '@/lib/jobcoach/queue'
import type { ApplicationStageId } from '@/lib/config/opportunities'

const NOW = new Date('2026-09-03T09:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)

/** A thread a coach opened or has picked up — contact by definition. */
const staffApp = (stage: ApplicationStageId): JobApplicationInput => ({
  opportunityId: 'opp-1',
  stage,
  createdBy: 'STAFF',
  supportedByUserId: 'u-coach',
})

/** A resident pressed "Ich habe Interesse" and nobody has replied. */
const unanswered = (): JobApplicationInput => ({
  opportunityId: 'opp-1',
  stage: 'INTERESTED',
  createdBy: 'RESIDENT',
  supportedByUserId: null,
})

const client = (over: Partial<JobKpiClient> = {}): JobKpiClient => ({
  residentId: 'r1',
  name: 'George B',
  createdAt: daysAgo(30),
  learningRecords: [],
  applications: [],
  ...over,
})

const value = (rows: ReturnType<typeof computeJobKpis>, id: string) => rows.find((r) => r.id === id)

describe('an empty caseload is not a score of zero', () => {
  /**
   * The distinction this whole file turns on. On the live instance three of
   * five real residents have no care team at all, and the all-domains Betreuerin's and the Freiwilligenarbeit coordinator's
   * caseloads are empty. Reporting 0% would read as "this coach is failing"
   * when the true statement is "nobody has been assigned to them".
   */
  it('reports null, not 0, for every job KPI', () => {
    const rows = computeJobKpis([])
    expect(rows.every((r) => r.value === null)).toBe(true)
    expect(rows.every((r) => r.denominator === 0)).toBe(true)
  })

  it('reports null, not 0, for every volunteering KPI', () => {
    const rows = computeVolunteeringKpis([])
    expect(rows.every((r) => r.value === null)).toBe(true)
  })

  it('carries the denominator, so 1 of 1 cannot read as a trend', () => {
    const rows = computeJobKpis([client({ applications: [staffApp('APPLIED')] })])
    expect(value(rows, 'LABOUR_MARKET_CONTACT_RATE')).toEqual({
      id: 'LABOUR_MARKET_CONTACT_RATE',
      value: 100,
      denominator: 1,
    })
  })
})

describe('labour-market contact', () => {
  it('counts an applying client and not an idle one', () => {
    const rows = computeJobKpis([
      client({ residentId: 'a', applications: [staffApp('STARTED')] }),
      client({ residentId: 'b' }),
    ])
    expect(value(rows, 'LABOUR_MARKET_CONTACT_RATE')?.value).toBe(50)
  })

  it('does not count a finished or refused application as contact', () => {
    // Same rule the dashboard queue applies. History is not contact, and
    // treating it as such hides the person who needs the next application.
    const rows = computeJobKpis([client({ applications: [staffApp('DECLINED')] })])
    expect(value(rows, 'LABOUR_MARKET_CONTACT_RATE')?.value).toBe(0)
  })

  it('a resident clicking "Interesse" does not move this coach\'s number', () => {
    // The inversion in KPI form. An unanswered click used to read 100% — the
    // metric improving fastest at the moment nobody had done anything, and
    // improving precisely where a person was left waiting.
    const rows = computeJobKpis([client({ applications: [unanswered()] })])
    expect(value(rows, 'LABOUR_MARKET_CONTACT_RATE')?.value).toBe(0)
  })

  it('answering it does', () => {
    const rows = computeJobKpis([
      client({
        applications: [
          {
            opportunityId: 'opp-1',
            stage: 'INTERESTED',
            createdBy: 'RESIDENT',
            supportedByUserId: 'u-coach',
          },
        ],
      }),
    ])
    expect(value(rows, 'LABOUR_MARKET_CONTACT_RATE')?.value).toBe(100)
  })
})

describe('course without work — the lock-in measure', () => {
  it('counts a running course with no contact', () => {
    const rows = computeJobKpis([
      client({
        learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(1) }],
      }),
    ])
    expect(value(rows, 'COURSE_WITHOUT_WORK_RATE')?.value).toBe(100)
  })

  it('does not count a course held ALONGSIDE work — that is the good case', () => {
    // The OECD parallel-track finding. Penalising this would push coaches away
    // from exactly the combination the evidence supports.
    const rows = computeJobKpis([
      client({
        applications: [staffApp('STARTED')],
        learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(1) }],
      }),
    ])
    expect(value(rows, 'COURSE_WITHOUT_WORK_RATE')?.value).toBe(0)
  })
})

describe('German level recorded', () => {
  it('counts only a German language test, not any course', () => {
    const rows = computeJobKpis([
      client({
        residentId: 'a',
        learningRecords: [
          { kind: 'LANGUAGE_TEST', status: 'COMPLETED', updatedAt: daysAgo(5), languageCode: 'DE' },
        ],
      }),
      client({
        residentId: 'b',
        learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(5) }],
      }),
      client({
        residentId: 'c',
        // A language test in another language is not a German level.
        learningRecords: [
          { kind: 'LANGUAGE_TEST', status: 'COMPLETED', updatedAt: daysAgo(5), languageCode: 'EN' },
        ],
      }),
    ])
    expect(value(rows, 'GERMAN_LEVEL_RECORDED_RATE')?.value).toBe(33.3)
  })
})

describe('time to first contact', () => {
  it('takes the median and counts only people who have had contact', () => {
    const rows = computeJobKpis([
      client({ residentId: 'a', createdAt: daysAgo(40), firstContactAt: daysAgo(30) }), // 10
      client({ residentId: 'b', createdAt: daysAgo(40), firstContactAt: daysAgo(10) }), // 30
      client({ residentId: 'c', createdAt: daysAgo(40) }), // never — excluded
    ])
    const row = value(rows, 'MEDIAN_DAYS_TO_FIRST_CONTACT')
    expect(row?.value).toBe(20)
    // The denominator is the people it could be measured on, not the caseload —
    // otherwise "nobody has started yet" would drag the median toward zero.
    expect(row?.denominator).toBe(2)
  })
})

describe('volunteering', () => {
  it('counts an active engagement and ignores a closed one', () => {
    const rows = computeVolunteeringKpis([
      { residentId: 'a', applications: [staffApp('ACCEPTED')], rsvpStatuses: [] },
      { residentId: 'b', applications: [staffApp('ENDED')], rsvpStatuses: [] },
    ])
    expect(rows.find((r) => r.id === 'ENGAGEMENT_RATE')?.value).toBe(50)
  })

  it('an unanswered interest is not a running engagement either', () => {
    // The same inversion on the Freiwilligenarbeit coordinator's side: a resident's own click would have
    // reported an engagement she had not arranged and did not know about.
    const rows = computeVolunteeringKpis([
      { residentId: 'a', applications: [unanswered()], rsvpStatuses: [] },
    ])
    expect(rows.find((r) => r.id === 'ENGAGEMENT_RATE')?.value).toBe(0)
  })

  it('counts a GOING rsvp as participation, but not MAYBE or DECLINED', () => {
    // A maybe is not attendance. Counting it would let the number rise without
    // anybody turning up.
    const rows = computeVolunteeringKpis([
      { residentId: 'a', applications: [], rsvpStatuses: ['GOING'] },
      { residentId: 'b', applications: [], rsvpStatuses: ['MAYBE'] },
      { residentId: 'c', applications: [], rsvpStatuses: ['DECLINED'] },
      { residentId: 'd', applications: [], rsvpStatuses: [] },
    ])
    expect(rows.find((r) => r.id === 'EVENT_PARTICIPATION_RATE')?.value).toBe(25)
  })
})

describe('every KPI traces to evidence', () => {
  /**
   * The guard against a number nobody can defend. AOZ has to explain these to
   * a funder; "the system computes it" is not an explanation.
   */
  const known = new Set(JOB_RESEARCH_SOURCES.map((s) => s.id))

  it.each([...JOB_KPI_DEFS, ...VOLUNTEERING_KPI_DEFS])('$id cites a real source', (def) => {
    expect(def.sourceIds.length).toBeGreaterThan(0)
    for (const id of def.sourceIds) expect(known.has(id)).toBe(true)
  })

  it('every defined KPI is actually computed, and every computed one is defined', () => {
    expect(
      computeJobKpis([])
        .map((r) => r.id)
        .sort(),
    ).toEqual(JOB_KPI_DEFS.map((d) => d.id).sort())
    expect(
      computeVolunteeringKpis([])
        .map((r) => r.id)
        .sort(),
    ).toEqual(VOLUNTEERING_KPI_DEFS.map((d) => d.id).sort())
  })

  it('says what a dash MEANS, per KPI', () => {
    /**
     * Shipped without this and it was wrong on screen within the hour: the Jobcoach's
     * median-days tile read "noch niemand zugewiesen" while he plainly had a
     * client. That tile's denominator is the people who have HAD contact, so
     * nought means "nobody has started yet" — the state a coach acts on — and
     * one shared string cannot say both.
     */
    for (const def of [...JOB_KPI_DEFS, ...VOLUNTEERING_KPI_DEFS]) {
      expect(def.emptyHint.length).toBeGreaterThan(0)
    }

    const median = JOB_KPI_DEFS.find((d) => d.id === 'MEDIAN_DAYS_TO_FIRST_CONTACT')
    const rate = JOB_KPI_DEFS.find((d) => d.id === 'LABOUR_MARKET_CONTACT_RATE')
    expect(median?.emptyHint).not.toBe(rate?.emptyHint)
  })

  it('names which care domains still have no KPIs, rather than pretending', () => {
    // HOUSING is covered by mission-kpis.ts; SOCIAL genuinely has none yet, and
    // this test exists so that stays a visible decision rather than an oversight.
    const withKpis = CARE_ROLES.filter((d) => kpiDefsForDomain(d) !== null)
    expect(withKpis.sort()).toEqual(['JOB', 'VOLUNTEERING'])
  })
})
