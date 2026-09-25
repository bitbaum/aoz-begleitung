/**
 * The living-together half of the demo world: chores, decisions, maintenance.
 *
 * Without this, the demo tour renders three empty pages — "Noch keine
 * Aufgaben", "Zurzeit steht nichts zur Abstimmung", "Keine Wartungsanfragen" —
 * and a visitor concludes those features do not exist. The expense and rule
 * surfaces were seeded; the governance ones were not.
 *
 * The timing matters more than the content. A proposal created today sits in
 * DISCUSSION for three days before voting opens, and the demo world is wiped
 * every night — so a freshly-created proposal can NEVER reach a vote in a demo.
 * Everything here is therefore backdated: the vote is already open, one seat is
 * deliberately left empty, and the demo visitor casts the deciding ballot.
 *
 * Relative-import-safe (no '@/' aliases): loaded through ts-node.
 */

import { eq } from 'drizzle-orm'
import {
  activity,
  eventRsvp,
  houseEvent,
  houseRule,
  householdTask,
  maintenanceRequest,
  marketplacePost,
  proposal,
  taskAttentionFlag,
  taskCompletion,
  vote,
  type db,
} from '../db'
import {
  CATEGORY_DECISION_MODE,
  CATEGORY_THRESHOLD,
  DECISION_TIMING,
  THRESHOLD_APPROVAL_PERCENT,
} from '../config/decisions'
import { tallyVotes } from '../governance/voting'
import { BRAND } from '../config/brand'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)
const daysAhead = (days: number) => new Date(Date.now() + days * DAY_MS)

/**
 * `daysAgo` for anything the CURRENT MONTH's chore balance must contain.
 *
 * The demo world is rebuilt nightly and the balance panel is scoped to the
 * calendar month, so on the 2nd of a month a plain `daysAgo(11)` lands in the
 * previous month and the panel a visitor came to see renders empty. Dates that
 * would fall out of the month are pulled to just after its start instead, which
 * keeps the record uneven — the point of the panel — on every single day.
 */
const daysAgoThisMonth = (days: number): Date => {
  const target = daysAgo(days)
  const now = new Date()
  if (target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear()) {
    return target
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0)
  // Keep the relative ordering of the seeded history: a larger `days` stays older.
  return new Date(Math.min(monthStart.getTime() + (30 - days) * 60 * 1000, now.getTime()))
}

export interface DemoGovernanceContext {
  /**
   * May this seed create rows outside the demo unit? The activity catalogue is
   * the only such content, and the scoped reset cannot delete it — @see
   * DemoSeedOptions.siteWideContent.
   */
  siteWideContent: boolean
  /** The success unit — the one the demo resident lives in. */
  unitId: string
  /** The demo resident (Fatima) — deliberately left without a vote to cast. */
  demoResidentId: string
  /** Their roommates, who have already voted. */
  roommateIds: [string, string, string]
}

/** Policy snapshot for a category, taken as it would be when voting opens. */
function snapshotFor(category: 'NOISE' | 'KITCHEN' | 'CLEANLINESS' | 'SAFETY', voters: number) {
  const threshold = CATEGORY_THRESHOLD[category]
  return {
    decisionMode: CATEGORY_DECISION_MODE[category],
    threshold,
    quorumPercent: DECISION_TIMING.quorumPercent,
    approvalPercent: THRESHOLD_APPROVAL_PERCENT[threshold],
    eligibleVoterCount: voters,
  }
}

export async function seedDemoGovernance(
  dbClient: typeof db,
  ctx: DemoGovernanceContext,
): Promise<void> {
  const { unitId, demoResidentId, roommateIds, siteWideContent } = ctx
  const [yasmin, amira, sara] = roommateIds
  const voters = roommateIds.length + 1

  // ==========================================================================
  // HOUSEHOLD TASKS — the chore board, with a fairness record behind it
  // ==========================================================================
  // Completion counts are uneven on purpose: an even board shows nothing, while
  // "who has actually been doing this" is the conversation the page exists for.
  const [kitchen] = await dbClient
    .insert(householdTask)
    .values({
      housingUnitId: unitId,
      createdByResidentId: demoResidentId,
      title: 'Küche putzen',
      description: 'Abfläche, Herd und Spüle. Kühlschrank einmal im Monat.',
      taskType: 'RECURRING_SCHEDULED',
      category: 'CLEANING',
      priority: 'NORMAL',
      scheduleHuman: 'Jeden Samstag',
      estimatedMinutes: 30,
      currentStatus: 'IDLE',
      checklist: [
        'Spüle leer, nichts steht mehr drin',
        'Herd abgewischt',
        'Arbeitsflächen abgewischt',
        'Boden gewischt',
      ],
      // A rota so the demo shows whose turn it is; the order is just the house.
      rotationResidentIds: [demoResidentId, yasmin, amira, sara],
    })
    .returning()

  const [trash] = await dbClient
    .insert(householdTask)
    .values({
      housingUnitId: unitId,
      createdByResidentId: yasmin,
      title: 'Abfall und Recycling rausbringen',
      description: 'Abfallsack am Dienstagabend, Karton und PET nach Bedarf.',
      taskType: 'RECURRING_AS_NEEDED',
      category: 'TRASH',
      priority: 'NORMAL',
      estimatedMinutes: 10,
      // Someone flagged it — the board shows an open call for help, not a
      // uniform list where nothing ever needs doing.
      currentStatus: 'NEEDS_ATTENTION',
      checklist: ['Sack zum Container gebracht', 'Neuer Sack eingesetzt'],
    })
    .returning()

  const [bathroom] = await dbClient
    .insert(householdTask)
    .values({
      housingUnitId: unitId,
      createdByResidentId: amira,
      title: 'Bad putzen',
      description: 'Dusche, WC und Lavabo. Handtücher wechseln.',
      taskType: 'RECURRING_SCHEDULED',
      category: 'CLEANING',
      priority: 'NORMAL',
      scheduleHuman: 'Jeden Mittwoch',
      estimatedMinutes: 25,
      currentStatus: 'IDLE',
      checklist: [
        'WC innen und aussen gereinigt',
        'Lavabo und Spiegel gewischt',
        'Dusche ausgespült',
        'Boden gewischt',
        'Handtücher gewechselt',
      ],
      rotationResidentIds: [amira, demoResidentId, yasmin],
    })
    .returning()

  // Minutes, not row counts, are what the balance panel reads — so the seeded
  // record is uneven in TIME as well as in count. Sara has done nothing this
  // month and sits visibly behind; that gap is the conversation the panel is
  // for, and an even board would show a visitor nothing at all.
  const kitchenItems = kitchen.checklist ?? []
  const bathItems = bathroom.checklist ?? []
  const trashItems = trash.checklist ?? []

  await dbClient.insert(taskCompletion).values([
    {
      taskId: kitchen.id,
      completedById: demoResidentId,
      completedAt: daysAgoThisMonth(2),
      durationMinutes: 35,
      completedItems: kitchenItems,
    },
    {
      taskId: kitchen.id,
      completedById: yasmin,
      completedAt: daysAgoThisMonth(9),
      durationMinutes: 30,
      completedItems: kitchenItems,
    },
    {
      taskId: bathroom.id,
      completedById: demoResidentId,
      completedAt: daysAgoThisMonth(4),
      durationMinutes: 20,
      completedItems: bathItems,
    },
    // A deliberately PARTIAL completion: the floor and the towels were left.
    // "Erledigt" with two items unticked is exactly the situation the
    // checklist exists to make visible instead of arguable.
    {
      taskId: bathroom.id,
      completedById: amira,
      completedAt: daysAgoThisMonth(11),
      durationMinutes: 25,
      completedItems: bathItems.slice(0, 3),
    },
    {
      taskId: trash.id,
      completedById: yasmin,
      completedAt: daysAgoThisMonth(3),
      durationMinutes: 10,
      completedItems: trashItems,
    },
    {
      taskId: trash.id,
      completedById: demoResidentId,
      completedAt: daysAgoThisMonth(10),
      durationMinutes: 10,
      completedItems: trashItems,
    },
  ])

  await dbClient.insert(taskAttentionFlag).values({
    taskId: trash.id,
    flaggedById: sara,
    message: 'Der Abfallsack ist voll — kann das jemand heute noch rausbringen?',
    createdAt: daysAgo(1),
  })

  // ==========================================================================
  // PROPOSALS — one at each stage a resident can actually learn something from
  // ==========================================================================

  // 1. VOTING, and the demo visitor holds the deciding vote.
  //    Backdated so the discussion window has genuinely elapsed; without that
  //    the vote buttons refuse ("Die Abstimmung hat noch nicht begonnen") and
  //    the single most important screen in the tour is unreachable.
  await dbClient.transaction(async (tx) => {
    const [dishesProposal] = await tx
      .insert(proposal)
      .values({
        housingUnitId: unitId,
        type: 'HOUSE_DECISION',
        category: 'KITCHEN',
        title: 'Abwasch am selben Abend',
        body:
          'Wer kocht, wäscht am selben Abend ab. Das Geschirr bleibt nicht über Nacht stehen, ' +
          'damit die Küche am Morgen für alle nutzbar ist.',
        proposedByResidentId: yasmin,
        status: 'VOTING',
        ...snapshotFor('KITCHEN', voters),
        createdAt: daysAgo(5),
        discussionEndsAt: daysAgo(2),
        votingOpenedAt: daysAgo(2),
        votingEndsAt: daysAhead(5),
      })
      .returning()
    await tx.insert(vote).values([
      { proposalId: dishesProposal.id, residentId: yasmin, choice: 'YES', castAt: daysAgo(2) },
      { proposalId: dishesProposal.id, residentId: amira, choice: 'YES', castAt: daysAgo(1) },
      // Sara is against; Fatima — the demo login — has not voted yet.
      {
        proposalId: dishesProposal.id,
        residentId: sara,
        choice: 'NO',
        reason: 'Nach der Spätschicht schaffe ich das nicht immer.',
        castAt: daysAgo(1),
      },
    ])
  })

  // 2. DISCUSSION — still being talked about, voting has not opened.
  await dbClient.insert(proposal).values({
    housingUnitId: unitId,
    type: 'HOUSE_DECISION',
    category: 'SHARED_SPACES',
    title: 'Pflanzen im Wohnzimmer',
    body:
      'Wir stellen ein paar Pflanzen ins Wohnzimmer und teilen das Giessen auf. ' +
      'Kosten ca. CHF 40, aus der gemeinsamen Kasse.',
    proposedByResidentId: amira,
    status: 'DISCUSSION',
    decisionMode: CATEGORY_DECISION_MODE.SHARED_SPACES,
    threshold: CATEGORY_THRESHOLD.SHARED_SPACES,
    quorumPercent: DECISION_TIMING.quorumPercent,
    approvalPercent: THRESHOLD_APPROVAL_PERCENT[CATEGORY_THRESHOLD.SHARED_SPACES],
    eligibleVoterCount: voters,
    createdAt: daysAgo(1),
    discussionEndsAt: daysAhead(2),
    votingEndsAt: daysAhead(9),
  })

  // 3. ACCEPTED — a decision the house already took, with the house rule it
  //    produced. The outcome text is computed by the real tally function, never
  //    written by hand: a demo that explains a result differently from the
  //    product is a demo of something that does not exist.
  const quietVotes = [
    { residentId: demoResidentId, choice: 'YES' as const },
    { residentId: yasmin, choice: 'YES' as const },
    { residentId: amira, choice: 'YES' as const },
    { residentId: sara, choice: 'ABSTAIN' as const },
  ]
  const quietSnapshot = snapshotFor('NOISE', voters)
  const quietTally = tallyVotes({
    votes: quietVotes,
    eligibleVoterCount: quietSnapshot.eligibleVoterCount,
    threshold: quietSnapshot.threshold,
    quorumPercent: quietSnapshot.quorumPercent,
    approvalPercent: quietSnapshot.approvalPercent,
  })

  const nightQuiet = await dbClient.query.houseRule.findFirst({
    where: eq(houseRule.key, 'night_quiet'),
  })

  const quietProposal = await dbClient.transaction(async (tx) => {
    const [created] = await tx
      .insert(proposal)
      .values({
        housingUnitId: unitId,
        type: 'ADD_RULE',
        category: 'NOISE',
        title: 'Ruhe ab 21:30 statt 22:00',
        body:
          'Wir ziehen die Nachtruhe eine halbe Stunde vor. Ab 21:30 keine Musik ohne Kopfhörer ' +
          'und keine Waschmaschine mehr.',
        parentOrgRuleId: nightQuiet?.id ?? null,
        proposedByResidentId: demoResidentId,
        status: 'ACCEPTED',
        ...quietSnapshot,
        createdAt: daysAgo(24),
        discussionEndsAt: daysAgo(21),
        votingOpenedAt: daysAgo(21),
        votingEndsAt: daysAgo(14),
        decidedAt: daysAgo(14),
        outcomeSummary: quietTally.explanation,
      })
      .returning()
    await tx
      .insert(vote)
      .values(quietVotes.map((v) => ({ ...v, proposalId: created.id, castAt: daysAgo(18) })))
    return created
  })

  if (nightQuiet) {
    await dbClient.insert(houseRule).values({
      scope: 'UNIT',
      housingUnitId: unitId,
      parentRuleId: nightQuiet.id,
      category: 'NOISE',
      title: 'Ruhe ab 21:30',
      body:
        'In dieser Wohnung beginnt die Ruhezeit um 21:30 Uhr — eine halbe Stunde früher als ' +
        `die ${BRAND.orgName}-Regel verlangt. Beschlossen von den Bewohnenden am ` +
        `${daysAgo(14).toLocaleDateString('de-CH')}.`,
      status: 'ACTIVE',
      version: 1,
      adoptedByProposalId: quietProposal.id,
    })
  }

  // 4. NEEDS_STAFF_CONFIRMATION — safety is never put to a vote, but the house
  //    must still be answered. This is also what fills the staff decision queue,
  //    which is otherwise empty in the staff tour.
  await dbClient.insert(proposal).values({
    housingUnitId: unitId,
    type: 'HOUSE_DECISION',
    category: 'SAFETY',
    title: 'Zweiter Schlüssel für den Veloraum',
    body:
      'Es gibt nur einen Schlüssel für den Veloraum. Wir hätten gern einen zweiten, ' +
      'damit nicht immer dieselbe Person aufschliessen muss.',
    proposedByResidentId: sara,
    status: 'NEEDS_STAFF_CONFIRMATION',
    ...snapshotFor('SAFETY', voters),
    createdAt: daysAgo(3),
    outcomeSummary:
      'Sicherheitsthemen werden nicht abgestimmt. Die Betreuung beantwortet den Vorschlag.',
  })

  // ==========================================================================
  // MAINTENANCE — the board staff work, seen from the resident side too
  // ==========================================================================
  await dbClient.insert(maintenanceRequest).values({
    housingUnitId: unitId,
    reportedById: demoResidentId,
    category: 'PLUMBING',
    priority: 'NORMAL',
    title: 'Sanitär',
    description: 'Der Wasserhahn im Bad tropft, auch wenn er ganz zugedreht ist.',
    location: 'Bad',
    status: 'IN_PROGRESS',
    assignedTo: 'Hauswart',
    assignedAt: daysAgo(2),
    startedAt: daysAgo(1),
    createdAt: daysAgo(3),
  })

  // Reported by the DEMO LOGIN and already answered, so the tour shows the one
  // thing a resident actually wants from reporting something: a reply. An
  // answered request belonging to a roommate proves nothing to the visitor.
  await dbClient.insert(maintenanceRequest).values({
    housingUnitId: unitId,
    reportedById: demoResidentId,
    category: 'HEATING_COOLING',
    priority: 'NORMAL',
    title: 'Heizung/Klima',
    description: 'Die Heizung im Zimmer wird nur oben warm.',
    location: 'Zimmer',
    status: 'COMPLETED',
    assignedTo: 'Hauswart',
    completedAt: daysAgo(6),
    resolution: 'Heizkörper entlüftet. Bitte melden, falls es wieder auftritt.',
    createdAt: daysAgo(12),
  })

  await dbClient.insert(maintenanceRequest).values({
    housingUnitId: unitId,
    reportedById: sara,
    category: 'APPLIANCE',
    priority: 'HIGH',
    title: 'Gerät defekt',
    description: 'Die Waschmaschine schleudert nicht mehr und bleibt mitten im Programm stehen.',
    location: 'Waschküche',
    status: 'OPEN',
    createdAt: daysAgo(1),
  })

  await dbClient.insert(maintenanceRequest).values({
    housingUnitId: unitId,
    reportedById: yasmin,
    category: 'ELECTRICAL',
    priority: 'NORMAL',
    title: 'Elektrik',
    description: 'Das Licht im Korridor flackert.',
    location: 'Korridor',
    status: 'COMPLETED',
    assignedTo: 'Hauswart',
    completedAt: daysAgo(5),
    // The answer travels back to the resident who reported it.
    resolution: 'Leuchtmittel und Starter ersetzt. Bitte melden, falls es erneut flackert.',
    createdAt: daysAgo(9),
  })

  // ==========================================================================
  // MARKETPLACE — both halves of the board
  // ==========================================================================
  // Three more pages rendered empty in the demo, and an empty page reads as a
  // missing feature. The SERVICE half especially: an exchange of half an hour
  // is the whole reason the board stopped being a giveaway shelf, and a visitor
  // who only sees furniture concludes that is all it does.
  //
  // The states are deliberately mixed — open, claimed, closed — because a board
  // where nothing has ever been taken does not demonstrate a handover.
  await dbClient.insert(marketplacePost).values([
    {
      housingUnitId: unitId,
      postedById: yasmin,
      title: 'Wasserkocher',
      description: 'Funktioniert einwandfrei, ich habe jetzt zwei. Wer mag?',
      kind: 'GIVE_AWAY',
      category: 'KITCHEN',
      status: 'OPEN',
      contactNote: 'Zimmer 2, meistens ab 18 Uhr da.',
      createdAt: daysAgo(2),
    },
    {
      housingUnitId: unitId,
      postedById: amira,
      title: 'Koffer für eine Woche',
      description: 'Ich brauche einen grossen Koffer für eine Reise Ende Monat.',
      kind: 'WANTED',
      category: 'OTHER',
      status: 'OPEN',
      createdAt: daysAgo(4),
    },
    {
      housingUnitId: unitId,
      postedById: sara,
      title: 'Briefe auf Deutsch erklären',
      description:
        'Ich kann Deutsch und Arabisch. Wenn ein Brief von einer Behörde kommt, lese ich ihn mit dir zusammen durch.',
      kind: 'OFFER_HELP',
      category: 'PAPERWORK',
      status: 'OPEN',
      contactNote: 'Klopf einfach, Zimmer 4.',
      createdAt: daysAgo(6),
    },
    {
      housingUnitId: unitId,
      postedById: demoResidentId,
      title: 'Schrank in den 3. Stock tragen',
      description: 'Zu zweit ist es in zehn Minuten erledigt. Samstagvormittag würde mir passen.',
      kind: 'NEED_HELP',
      category: 'MOVING',
      status: 'CLAIMED',
      claimedById: yasmin,
      claimedAt: daysAgo(1),
      createdAt: daysAgo(3),
    },
    {
      housingUnitId: unitId,
      postedById: yasmin,
      title: 'Kinderkleider Grösse 98',
      description: 'Zwei Jacken und vier Pullover, alles gewaschen.',
      kind: 'GIVE_AWAY',
      category: 'KIDS',
      status: 'CLOSED',
      claimedById: amira,
      claimedAt: daysAgo(9),
      closedAt: daysAgo(8),
      createdAt: daysAgo(11),
    },
  ])

  // ==========================================================================
  // HOUSE EVENTS — one past, one imminent, one further out
  // ==========================================================================
  // The RSVP counts are uneven and the demo resident has deliberately NOT
  // answered the next one, so the visitor has a decision to make rather than a
  // finished record to read.
  const [houseMeeting] = await dbClient
    .insert(houseEvent)
    .values({
      housingUnitId: unitId,
      createdByResidentId: yasmin,
      title: 'Hausversammlung',
      description:
        'Wir besprechen die Ruhezeiten und den Putzplan für den nächsten Monat. Bringt eure Themen mit.',
      category: 'HOUSE_MEETING',
      location: 'Gemeinschaftsraum',
      startsAt: daysAhead(3),
      status: 'PUBLISHED',
      createdAt: daysAgo(2),
    })
    .returning()

  await dbClient.insert(eventRsvp).values([
    { eventId: houseMeeting.id, residentId: yasmin, status: 'GOING' },
    { eventId: houseMeeting.id, residentId: amira, status: 'GOING' },
    { eventId: houseMeeting.id, residentId: sara, status: 'MAYBE' },
  ])

  const [cooking] = await dbClient
    .insert(houseEvent)
    .values({
      housingUnitId: unitId,
      createdByResidentId: amira,
      title: 'Zusammen kochen',
      description: 'Jede*r bringt etwas aus der eigenen Küche mit. Kinder sind willkommen.',
      category: 'SOCIAL',
      location: 'Küche',
      startsAt: daysAhead(10),
      status: 'PUBLISHED',
      createdAt: daysAgo(1),
    })
    .returning()

  await dbClient.insert(eventRsvp).values([
    { eventId: cooking.id, residentId: amira, status: 'GOING' },
    { eventId: cooking.id, residentId: demoResidentId, status: 'GOING' },
  ])

  const [pastEvent] = await dbClient
    .insert(houseEvent)
    .values({
      housingUnitId: unitId,
      createdByResidentId: sara,
      title: 'Frühlingsputz im Hof',
      description: 'Zwei Stunden, dann Kaffee. Handschuhe sind vorhanden.',
      category: 'SOCIAL',
      location: 'Innenhof',
      startsAt: daysAgo(14),
      status: 'PUBLISHED',
      createdAt: daysAgo(21),
    })
    .returning()

  await dbClient.insert(eventRsvp).values([
    { eventId: pastEvent.id, residentId: sara, status: 'GOING' },
    { eventId: pastEvent.id, residentId: yasmin, status: 'GOING' },
    { eventId: pastEvent.id, residentId: demoResidentId, status: 'GOING' },
    { eventId: pastEvent.id, residentId: amira, status: 'DECLINED' },
  ])

  // ==========================================================================
  // ACTIVITIES — the external catalogue
  // ==========================================================================
  // Not unit-scoped: these are offers in the city, curated by staff, and the
  // portal's own page filters by category. One per category, so the filter row
  // a visitor presses actually returns something in every position — a filter
  // that lands on "Keine Ergebnisse" reads as a broken feature, not an empty one.
  //
  // Which is also exactly why they are gated. Having no unit and no code, they
  // are invisible to a reset that deletes by demo prefix, so on an instance
  // sharing a database with a real flat they would pile up nightly and show
  // real residents invented offers with invented phone numbers.
  if (!siteWideContent) return

  await dbClient.insert(activity).values([
    {
      title: 'Offenes Fussballtraining',
      description:
        'Jeden Mittwoch, alle Niveaus, keine Anmeldung nötig. Fussballschuhe können vor Ort geliehen werden.',
      category: 'SPORT',
      cost: 'FREE',
      location: 'Sportplatz Beispielquartier',
      schedule: 'Mittwoch 18:00–20:00',
      status: 'PUBLISHED',
      highlight: true,
    },
    {
      title: 'Deutsch-Konversation im Quartiertreff',
      description:
        'Zwanglos Deutsch sprechen mit Freiwilligen. Einsteigen ist jederzeit möglich, auch mit wenig Vorkenntnissen.',
      category: 'LANGUAGE',
      cost: 'FREE',
      location: 'Quartiertreff Beispielquartier',
      schedule: 'Dienstag und Donnerstag, 14:00–16:00',
      status: 'PUBLISHED',
      highlight: true,
    },
    {
      title: 'Museum für Gestaltung — Eintritt mit KulturLegi',
      description:
        'Mit der KulturLegi ist der Eintritt stark vergünstigt. Ausstellungen wechseln alle paar Monate.',
      category: 'CULTURE',
      cost: 'REDUCED',
      costNote: 'CHF 6 statt CHF 12 mit KulturLegi',
      location: 'Beispielstrasse 60, 8000 Zürich',
      website: 'https://example.org',
      status: 'PUBLISHED',
    },
    {
      title: 'Nachbarschaftscafé',
      description:
        'Kaffee, Kuchen und Leute aus dem Quartier. Ein guter Ort, um jemanden kennenzulernen.',
      category: 'COMMUNITY',
      cost: 'FREE',
      location: 'Gemeinschaftszentrum Beispielquartier',
      schedule: 'Jeden Freitagnachmittag',
      status: 'PUBLISHED',
    },
    {
      title: 'Spielgruppe für Kinder von 2 bis 5',
      description:
        'Betreute Spielgruppe am Vormittag. Die Eltern können bleiben oder etwas erledigen.',
      category: 'FAMILY',
      cost: 'REDUCED',
      costNote: 'Nach Einkommen abgestuft; frag bei der Betreuung nach',
      location: 'Familienzentrum Beispielquartier',
      schedule: 'Montag bis Donnerstag, 9:00–11:30',
      phone: '044 000 00 00',
      status: 'PUBLISHED',
    },
    {
      title: 'Rechtsberatung für Asylsuchende',
      description:
        'Kostenlose und vertrauliche Beratung zu Verfahren und Fristen. Dolmetschen kann organisiert werden.',
      category: 'SUPPORT',
      cost: 'FREE',
      location: 'Beratungsstelle Beispielquartier',
      schedule: 'Montag 13:00–17:00, ohne Voranmeldung',
      phone: '044 000 00 01',
      status: 'PUBLISHED',
    },
  ])
}
