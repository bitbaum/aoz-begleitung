import {
  FACTOR_COUNT,
  SOURCE_COUNT,
  type MarketingCopy,
  type MarketingRegisters,
} from './marketing-types'

/**
 * English.
 *
 * Translated from `marketing.de.ts`, and bound by the same restraint: no
 * number this product has not measured. The German page deliberately claims no
 * percentage reduction in conflicts and no hours saved, because the pilot has
 * not reported — and a translation is not a fresh opportunity to make a
 * stronger claim to a reader who cannot check it against the original.
 *
 * `FACTOR_COUNT` and `SOURCE_COUNT` are interpolated from the same config the
 * German page reads, never re-typed. A translator writing "27 factors" into a
 * sentence is the drift this whole file structure exists to prevent.
 *
 * NOT VOUCHED FOR by a native speaker yet — see `PUBLIC_LOCALES` in
 * `marketing.ts` for what that does and does not gate.
 */

const PLACEMENT_COPY: MarketingCopy = {
  eyebrow: 'For professionals and clients',
  headline: 'The whole support process, in one place.',
  subline:
    'Housing, daily life in the house, community and integration in a single record — professionals and clients see the same state of play.',
  ctaPrimary: 'See the product',
  ctaSecondary: 'Sign in',
  ctaNote: 'No account needed. You get the real product with example data.',

  problemEyebrow: 'The problem',
  problemTitle: 'Integration usually fails on fragmentation, not on willingness.',
  problems: [
    {
      title: 'Stability and progress run separately',
      body: 'Housing, language, work, participation and support steps sit in different lists, different heads and different inboxes. Nobody sees what matters next quickly enough.',
    },
    {
      title: 'Instability eats the time meant for support',
      body: 'Conflicts, unresolved transfers, missed replies and open follow-ups tie professionals up in exactly the place where they were supposed to be supporting people.',
    },
    {
      title: 'Evidence too often leads nowhere',
      body: 'Courses, language tests, qualifications and volunteering get documented, but are not consistently translated into priorities, boards and next steps.',
    },
  ],

  howEyebrow: 'How it works',
  howTitle: 'Four areas of work, one shared record.',
  steps: [
    {
      title: 'Secure stability',
      body: 'Housing, safety, incidents, transfers and rules form the base that has to hold. Without stability, no integration carries.',
    },
    {
      title: 'Make capability visible',
      body: 'Language, courses, qualifications and steps toward the labour market are recorded as an evidenced history, not as loose notes.',
    },
    {
      title: 'Encourage participation',
      body: 'Volunteering, activities and everyday orientation are made visible as real signals of progress.',
    },
    {
      title: 'Bring support to a close',
      body: 'Boards, follow-ups, messages and next steps lead professionals back into a clear action instead of into open loops.',
    },
  ],

  featuresEyebrow: 'In the product',
  featuresTitle: 'What the product can do for professionals and clients.',
  features: [
    {
      icon: 'building',
      title: 'Stability in housing',
      body: 'Accommodation, placement, transfers, maintenance and incidents in one record — with matching that explains why it suggests this particular combination.',
    },
    {
      icon: 'vote',
      title: 'The house runs its own daily life',
      body: 'House rules with versions and acknowledgement, chores with a fairness balance, and a path for concerns that ends in an answer.',
    },
    {
      icon: 'shop',
      title: 'A neighbourhood that carries',
      body: 'A marketplace for things and for help, house events with attendance, and a directory of what the local area offers.',
    },
    {
      icon: 'learning',
      title: 'Moving forward',
      body: 'Language, courses and qualifications as an evidenced history, plus placements and volunteering with application status.',
    },
    {
      icon: 'message',
      title: 'Answers that actually arrive',
      body: 'Reports go to the desk that can act on them, and the answer comes back. Care team, messages and follow-ups keep responsibility visible.',
    },
    {
      icon: 'chart',
      title: 'Accountable to everyone',
      body: 'Every placement is logged, every score can be taken apart, every vote result stays explainable against the rule in force at the time.',
    },
  ],

  scienceEyebrow: 'Scientific basis',
  scienceTitle: `Method rather than opinion: ${FACTOR_COUNT} matching factors — and everyday mechanics built on documented findings.`,
  scienceBody: `The compatibility factors are derived from published research — Swiss studies first, international ones for context, ${SOURCE_COUNT} sources in total — and the strength of evidence is shown for each factor: some findings come from other forms of housing and are, for collective accommodation, a reasoned assumption that the pilot tests. And the mechanics beyond matching follow the same standard: from self-share bias in the cleaning rota to the rule that safety is never put to a vote. The full methodology including the source list is readable in the product by every professional — and in the demo, by you.`,
  science: [
    {
      title: 'Cleanliness is a direction, not an average',
      body: 'What gets measured is whose expectation of the others goes unmet — not the difference between two numbers. Tidy-but-relaxed next to messy produces no friction; two equally messy people, one of whom expects a lot, very much does.',
    },
    {
      title: 'The hardest pair decides the score',
      body: 'A household is scored by its most conflict-prone pairing, never by the average — the average hides precisely the pairing that goes on to produce the incidents.',
    },
    {
      title: 'Hard requirements are not traded off',
      body: 'Wheelchair access, smoking, a protection need for a single room: what cannot be met is not smoothed over by good partial scores, it blocks the placement.',
    },
    {
      title: 'Every number can be explained',
      body: 'Each score breaks down into named factors with a weight and a strength of evidence, and warnings say who will be bothered by what. Decisions stay with the professionals — and stay defensible to the team and to clients.',
    },
    {
      title: 'Fairness is a balance, not a ranking',
      body: 'People who tidy overestimate their own share — a documented bias, not a character flaw. So the chore plan shows how much each person has actually carried, instead of setting memory against memory.',
    },
    {
      title: 'Safety is never put to a vote',
      body: 'Households decide their own daily life — but a majority cannot vote away a minority’s safety. Those topics always go to the professionals, and every vote result stays explainable against the rule in force at the time.',
    },
  ],

  ethicsEyebrow: 'Limits',
  ethicsTitle: 'What this software refuses to know about people.',
  ethicsBody:
    'The system serves people in a vulnerable situation. It records only what the support work genuinely needs. Clients enter their own permit type and expiry date if they want to — those facts belong to them, exist to remind someone of a deadline, and never feed a placement, a score or a statistic. What is never recorded cannot be used against anyone either.',
  neverTracked: [
    'Medical diagnoses',
    'Case details: the procedure, its stage, the decision',
    'Religion and political conviction',
    'Personal history unrelated to housing',
  ],

  blogEyebrow: 'Blog and product documents',
  blogTitle: 'Why the product is built this way, and how it is developing.',
  blogLink: 'Read all posts',

  surfaceEyebrow: 'Included in the product',
  surfaceTitle: 'Both sides, in full — exactly as they appear in the menu.',
  surfaceBody:
    'This list is not typed out, it is the product’s own navigation. Add an area and it appears here. Remove one and it disappears here too.',
  // Stated, not hidden. The staff interface genuinely is German — translating
  // those menu names would describe a product that does not exist.
  surfaceStaffNote:
    'The staff menu is shown in German because the staff interface is German. The resident portal is the part that is translated, and it is shown here in English.',

  docsEyebrow: 'Accountability',
  docsTitle: 'Product thinking, progress and the scientific basis are public reading.',
  docs: [
    {
      title: 'Roadmap',
      body: 'Where the product is going and which principles set the direction.',
    },
    {
      title: 'Changelog',
      body: 'What has already landed in the product and how the platform is concretely changing.',
    },
    {
      title: 'Blog',
      body: 'Background on decisions, research, product logic and technical implementation.',
    },
  ],

  closingTitle: 'Take a look.',
  closingBody:
    'The demo is the real product with example data — administration, support and the resident portal. Blog, roadmap and changelog make the product decisions traceable.',
}

const HOUSEHOLD_COPY: MarketingCopy = {
  eyebrow: 'Living together',
  headline: 'The flat you can actually agree on.',
  subline:
    'Who took the rubbish out, who paid for the toilet paper, and when is it too loud? All in one place — so it does not get renegotiated from scratch every time.',
  ctaPrimary: 'Try it',
  ctaSecondary: 'Sign in',
  ctaNote: 'No account needed. You get the real product with example data.',

  problemEyebrow: 'Why',
  problemTitle: 'An argument in a shared flat is rarely an argument about the thing itself.',
  problems: [
    {
      title: 'Everyone believes they do more',
      body: 'You remember your own work better than everyone else’s. That is normal — and it is enough to leave everybody feeling hard done by.',
    },
    {
      title: 'Agreements disappear',
      body: 'What was settled in the hallway holds exactly until two people remember it differently.',
    },
    {
      title: 'Money makes it personal',
      body: 'Small amounts nobody writes down turn into a feeling about who behaves how.',
    },
  ],

  howEyebrow: 'How it goes',
  howTitle: 'Write it down, agree on it, look it up.',
  steps: [
    {
      title: 'Record the chores',
      body: 'Cleaning, rubbish, shopping. Who did it is on the record — not just whose turn it would have been.',
    },
    {
      title: 'Split the costs',
      body: 'Enter an expense, the shares are calculated. The balance says who owes whom what.',
    },
    {
      title: 'Decide together',
      body: 'Put a proposal in, everyone votes, the result is the house rule. Readable afterwards, with a date.',
    },
    {
      title: 'Report what is broken',
      body: 'The dripping tap goes to the caretakers, the conflict goes to support. You see the answer.',
    },
  ],

  featuresEyebrow: 'Inside',
  featuresTitle: 'What you can use.',
  features: [
    {
      icon: 'wallet',
      title: 'Shared expenses',
      body: 'Who paid what, who owes whom. Accurate to the rappen, with the shortest way to settle up.',
    },
    {
      icon: 'calendar',
      title: 'Chores and fairness',
      body: 'The cleaning rota as a balance rather than a league table: it shows how much each person has carried.',
    },
    {
      icon: 'scroll',
      title: 'House rules',
      body: 'What applies in this flat, in one place — and every change is put to everyone again.',
    },
    {
      icon: 'vote',
      title: 'Voting',
      body: 'Proposals, deadlines, a result with reasoning. Safety is never put to a vote.',
    },
    {
      icon: 'building',
      title: 'Your flat',
      body: 'A name you choose, the rooms and who lives here. With a photo, if you want one.',
    },
    {
      icon: 'alert',
      title: 'Reporting',
      body: 'Damage or conflict — it lands with the desk that can act on it, and the answer comes back.',
    },
  ],

  scienceEyebrow: 'Why this works',
  scienceTitle: 'There is research behind the rules, not a gut feeling.',
  scienceBody:
    'Shared-flat conflict is well researched: people who tidy overestimate their own share; agreements without a date fall apart; arguments about cleanliness come from disappointed expectations, not from difference as such. The app is built around those findings.',
  science: [
    {
      title: 'Everyone believes they do more — measurably',
      body: 'The documented self-share bias is why the chore plan is a balance: it shows how much each person has carried, instead of setting memory against memory.',
    },
    {
      title: 'Cleanliness is a direction',
      body: 'What counts is whose expectation goes unmet — not who is "tidier". So the app asks about your own standard, your expectation of others and your tolerance, rather than for a grade.',
    },
    {
      title: 'Agreements need a date',
      body: 'What was settled in the hallway holds until the next gap in memory. Decisions with a deadline, a result and a reason hold — and safety is never put to a vote.',
    },
  ],

  ethicsEyebrow: 'Privacy',
  ethicsTitle: 'What the app refuses to know about you.',
  ethicsBody:
    'By default you do not even have a name in the app — your code is enough. Name, photo and text are optional, and photos are visible only to you and the people you live with.',
  neverTracked: [
    'Medical diagnoses',
    'Case details: the procedure, its stage, the decision',
    'Religion and political conviction',
    'Personal history unrelated to housing',
  ],

  blogEyebrow: 'Engineering blog',
  blogTitle: 'Why the product is built the way it is.',
  blogLink: 'Read all posts',

  surfaceEyebrow: 'All of it',
  surfaceTitle: 'What you will find in the app — exactly as it appears in the menu.',
  surfaceBody:
    'This list is not typed out, it is the app’s own menu. Add something and it appears here.',
  surfaceStaffNote:
    'The staff menu is shown in German because the staff interface is German. The resident portal is the part that is translated, and it is shown here in English.',

  docsEyebrow: 'Further reading',
  docsTitle: 'How the app came about and what is coming next.',
  docs: [
    {
      title: 'Roadmap',
      body: 'What is being worked on right now and what is coming next.',
    },
    {
      title: 'Changelog',
      body: 'What changed most recently, with dates.',
    },
    {
      title: 'Blog',
      body: 'Why the app works the way it works.',
    },
  ],

  closingTitle: 'Have a look.',
  closingBody:
    'The demo is the real product with example data — you see exactly what the residents see.',
}

export const marketingEn: MarketingRegisters = {
  placement: PLACEMENT_COPY,
  household: HOUSEHOLD_COPY,
}
