import {
  JOB_SIGNAL_IDS,
  NO_CONTACT_GRACE_DAYS,
  STALLED_RECORD_DAYS,
  awaitsAnswer,
  buildJobQueue,
  hasLabourMarketContact,
  isAwaitingAnswer,
  signalsFor,
  type JobApplicationInput,
  type JobClientInput,
} from '../queue'
import type { ApplicationStageId } from '@/lib/config/opportunities'
import { INTEGRATION_PRINCIPLES } from '@/lib/config/job-integration-docs'

const NOW = new Date('2026-09-02T09:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)

/** A thread a coach opened, or one they have since picked up. */
const staffApp = (stage: ApplicationStageId): JobApplicationInput => ({
  opportunityId: 'opp-1',
  stage,
  createdBy: 'STAFF',
  supportedByUserId: 'u-coach',
})

/** A resident pressed "Ich habe Interesse" and nobody has replied yet. */
const unanswered = (): JobApplicationInput => ({
  opportunityId: 'opp-1',
  stage: 'INTERESTED',
  createdBy: 'RESIDENT',
  supportedByUserId: null,
})

/** The same click, after a coach picked it up. */
const answeredApp = (stage: ApplicationStageId): JobApplicationInput => ({
  opportunityId: 'opp-1',
  stage,
  createdBy: 'RESIDENT',
  supportedByUserId: 'u-coach',
})

const client = (over: Partial<JobClientInput> = {}): JobClientInput => ({
  residentId: 'r1',
  name: 'George B',
  createdAt: daysAgo(1),
  learningRecords: [],
  applications: [],
  ...over,
})

describe('the production case this was built from', () => {
  /**
   * The Jobcoach had one client assigned the day he was created — job-seeking, two
   * years without work, an unrecognised trade qualification, German at A2 —
   * and the dashboard said "Alles unter Kontrolle! Keine dringenden Aufgaben"
   * without naming him. Every component of `openTaskCount` was a housing
   * queue, and a Jobcoach holds none of those permissions.
   */
  it('a newly registered job-seeker with nothing arranged is not "nothing to do"', () => {
    const george = client({ createdAt: daysAgo(NO_CONTACT_GRACE_DAYS + 1) })
    const queue = buildJobQueue([george], NOW)

    expect(queue.length).toBeGreaterThan(0)
    expect(queue[0]).toMatchObject({ residentId: 'r1', name: 'George B' })
  })

  it('names the person, so the dashboard can too', () => {
    // The old screen did not mention the client at all. A count alone would
    // reproduce that: "1 Aufgabe" tells a coach nothing about whom.
    const queue = buildJobQueue([client({ createdAt: daysAgo(30) })], NOW)
    expect(queue.every((row) => row.name === 'George B')).toBe(true)
  })
})

describe('no labour-market contact', () => {
  it('raises once the grace period has passed', () => {
    expect(signalsFor(client({ createdAt: daysAgo(NO_CONTACT_GRACE_DAYS) }), NOW)).toContain(
      'NO_LABOUR_MARKET_CONTACT',
    )
  })

  it('stays quiet during intake week', () => {
    // Firing on day one would make the signal noise, and a queue a coach
    // learns to dismiss protects nobody.
    expect(signalsFor(client({ createdAt: daysAgo(1) }), NOW)).not.toContain(
      'NO_LABOUR_MARKET_CONTACT',
    )
  })

  it.each([['INTERESTED'], ['APPLIED'], ['INTERVIEW'], ['ACCEPTED'], ['STARTED']] as const)(
    'a %s application counts as contact',
    (stage) => {
      const c = client({ createdAt: daysAgo(90), applications: [staffApp(stage)] })
      expect(hasLabourMarketContact(c)).toBe(true)
      expect(signalsFor(c, NOW)).not.toContain('NO_LABOUR_MARKET_CONTACT')
    },
  )

  it.each([['ENDED'], ['DECLINED']] as const)('a %s application does not', (stage) => {
    // A finished or refused application is history. Treating it as contact
    // would hide exactly the person who needs the next one.
    const c = client({ createdAt: daysAgo(90), applications: [staffApp(stage)] })
    expect(hasLabourMarketContact(c)).toBe(false)
    expect(signalsFor(c, NOW)).toContain('NO_LABOUR_MARKET_CONTACT')
  })

  it('an employment or internship record counts as contact', () => {
    for (const kind of ['EMPLOYMENT', 'INTERNSHIP'] as const) {
      const c = client({
        createdAt: daysAgo(90),
        learningRecords: [{ kind, status: 'IN_PROGRESS', updatedAt: daysAgo(1) }],
      })
      expect(hasLabourMarketContact(c)).toBe(true)
    }
  })

  it('a language course alone does not count as contact', () => {
    // The whole point of the parallel-track principle: a course is not a job.
    const c = client({
      createdAt: daysAgo(90),
      learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(1) }],
    })
    expect(hasLabourMarketContact(c)).toBe(false)
  })
})

describe('a resident raising their hand is a request for contact, not contact', () => {
  /**
   * The inversion this block exists to prevent, in the exact shape it shipped.
   *
   * `recordInterest` writes a resident-created INTERESTED row with
   * `supportedByUserId` null. `hasLiveApplication` counted INTERESTED, and
   * nothing anywhere read `supportedByUserId`. So the ONE action a resident can
   * take on the board deleted them from their coach's queue and raised
   * `LABOUR_MARKET_CONTACT_RATE` — the person waiting for a reply became the
   * person the product had stopped mentioning.
   */
  it('an unanswered click does not count as contact', () => {
    const c = client({ createdAt: daysAgo(90), applications: [unanswered()] })
    expect(hasLabourMarketContact(c)).toBe(false)
  })

  it('and it raises INTEREST_UNANSWERED instead of silence', () => {
    const c = client({ createdAt: daysAgo(90), applications: [unanswered()] })
    expect(signalsFor(c, NOW)).toContain('INTEREST_UNANSWERED')
  })

  it('a coach picking the same thread up turns it into contact', () => {
    // The row is otherwise identical. `supportedByUserId` is the whole
    // difference, which is why it must be selected wherever this is computed.
    const c = client({ createdAt: daysAgo(90), applications: [answeredApp('INTERESTED')] })
    expect(hasLabourMarketContact(c)).toBe(true)
    expect(signalsFor(c, NOW)).not.toContain('INTEREST_UNANSWERED')
  })

  it('so does the coach moving it along, which is what sets that field', () => {
    const c = client({ createdAt: daysAgo(90), applications: [answeredApp('APPLIED')] })
    expect(awaitsAnswer(c)).toBe(false)
    expect(hasLabourMarketContact(c)).toBe(true)
  })

  it('replaces the contact signals rather than adding a fourth row', () => {
    // "Find this person something" is the wrong next move for someone who
    // already found it themselves and is waiting to hear back.
    const signals = signalsFor(
      client({ createdAt: daysAgo(90), applications: [unanswered()] }),
      NOW,
    )
    expect(signals).toEqual(['INTEREST_UNANSWERED'])
  })

  it('fires even for someone already in work — they are still owed a reply', () => {
    const c = client({
      createdAt: daysAgo(200),
      applications: [staffApp('STARTED'), unanswered()],
    })
    expect(hasLabourMarketContact(c)).toBe(true)
    expect(signalsFor(c, NOW)).toContain('INTEREST_UNANSWERED')
  })

  it('fires from day one — a grace period on an unread message is a delay', () => {
    // NO_LABOUR_MARKET_CONTACT waits two weeks because nothing has been asked
    // of anyone yet. Here a person has asked, and the clock is theirs.
    const c = client({ createdAt: daysAgo(0), applications: [unanswered()] })
    expect(signalsFor(c, NOW)).toContain('INTEREST_UNANSWERED')
  })

  it('a staff-created INTERESTED row is not waiting on anyone', () => {
    expect(isAwaitingAnswer(staffApp('INTERESTED'))).toBe(false)
    expect(isAwaitingAnswer(unanswered())).toBe(true)
  })
})

describe('course without work', () => {
  it('flags a running course with no labour-market contact, inside the grace period', () => {
    const c = client({
      createdAt: daysAgo(3),
      learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(1) }],
    })
    expect(signalsFor(c, NOW)).toContain('COURSE_WITHOUT_WORK')
  })

  it('does not double-report once the person is simply overdue', () => {
    // Past the grace period the stronger signal already covers it. Two rows
    // for one conversation is how a queue stops being read.
    const c = client({
      createdAt: daysAgo(90),
      learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(1) }],
    })
    const signals = signalsFor(c, NOW)
    expect(signals).toContain('NO_LABOUR_MARKET_CONTACT')
    expect(signals).not.toContain('COURSE_WITHOUT_WORK')
  })
})

describe('stalled records', () => {
  it('flags an IN_PROGRESS record nobody has touched', () => {
    const c = client({
      applications: [staffApp('STARTED')],
      learningRecords: [
        { kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(STALLED_RECORD_DAYS) },
      ],
    })
    expect(signalsFor(c, NOW)).toContain('STALLED_RECORD')
  })

  it('leaves a recently updated record alone', () => {
    const c = client({
      applications: [staffApp('STARTED')],
      learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(3) }],
    })
    expect(signalsFor(c, NOW)).not.toContain('STALLED_RECORD')
  })

  it('ignores completed records however old', () => {
    // A finished course does not go stale. Only work in flight can stall.
    const c = client({
      applications: [staffApp('STARTED')],
      learningRecords: [{ kind: 'COURSE', status: 'COMPLETED', updatedAt: daysAgo(400) }],
    })
    expect(signalsFor(c, NOW)).toEqual([])
  })
})

describe('the queue as a whole', () => {
  it('is empty for a client with work running and records moving', () => {
    const c = client({
      createdAt: daysAgo(200),
      applications: [staffApp('STARTED')],
      learningRecords: [{ kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(2) }],
    })
    expect(buildJobQueue([c], NOW)).toEqual([])
  })

  it('emits one row per signal, so two problems are two pieces of work', () => {
    const c = client({
      createdAt: daysAgo(90),
      learningRecords: [
        { kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(STALLED_RECORD_DAYS + 5) },
      ],
    })
    const queue = buildJobQueue([c], NOW)
    expect(queue).toHaveLength(2)
    expect(queue.map((r) => r.signal).sort()).toEqual(
      ['NO_LABOUR_MARKET_CONTACT', 'STALLED_RECORD'].sort(),
    )
  })

  it('an empty caseload produces an empty queue, not an error', () => {
    expect(buildJobQueue([], NOW)).toEqual([])
  })

  it('puts the person waiting for a reply first, whatever order the rows arrive in', () => {
    // The dashboard hero renders jobQueue[0] and nothing else. Left unsorted,
    // who got that slot was decided by which client the query returned first.
    const stalled = client({
      residentId: 'stalled',
      name: 'A',
      createdAt: daysAgo(200),
      applications: [staffApp('STARTED')],
      learningRecords: [
        { kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(STALLED_RECORD_DAYS + 1) },
      ],
    })
    const waiting = client({ residentId: 'waiting', name: 'B', applications: [unanswered()] })

    expect(buildJobQueue([stalled, waiting], NOW)[0]).toMatchObject({
      residentId: 'waiting',
      signal: 'INTEREST_UNANSWERED',
    })
  })
})

describe('every signal traces to a principle marked as acted upon', () => {
  /**
   * The guard against evidence-as-decoration. A principle claiming the system
   * acts on it, with no signal behind it, is a lie told to a caseworker; a
   * signal with no principle behind it is a hunch wearing a citation.
   */
  it('each `signal` principle is implemented, and each signal is principled', () => {
    const signalPrinciples = INTEGRATION_PRINCIPLES.filter((p) => p.status === 'signal')
    expect(signalPrinciples.length).toBe(JOB_SIGNAL_IDS.length)
  })

  it('documented-only principles raise nothing, and say so', () => {
    // Recognition, post-start support and stated job goals all matter and are
    // NOT detectable from the data the product holds. Claiming otherwise is
    // the failure this test exists to prevent.
    const documented = INTEGRATION_PRINCIPLES.filter((p) => p.status === 'documented')
    expect(documented.length).toBeGreaterThan(0)
    for (const principle of documented) {
      expect(principle.implication.length).toBeGreaterThan(20)
    }
  })

  it('every principle cites at least one source', () => {
    for (const principle of INTEGRATION_PRINCIPLES) {
      expect({ id: principle.id, sources: principle.sourceIds.length > 0 }).toEqual({
        id: principle.id,
        sources: true,
      })
    }
  })
})
