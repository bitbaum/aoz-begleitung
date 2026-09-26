/**
 * Who may do what — three orthogonal facts, never one.
 *
 * `role`          WHICH CARE DOMAIN a person is staffed for. 1:1 with CareRole.
 * `scope`         HOW WIDE their view is: their own domain, or all of them.
 * `isSystemAdmin` MAY THEY RECONFIGURE the product: invite staff, settings,
 *                 import. Not implied by seeing everything.
 *
 * These were a single enum, and the real AOZ team could not be described by it.
 * A Betreuerin who ALSO sees every client could not be expressed; the only way to say
 * that was to make the account ADMIN, which erased its actual domain and handed it the
 * settings page as a side effect. The Jobcoach and the Freiwilligenarbeit
 * coordinator work one domain each.
 *
 * This used to end "There is no Leitung." — false, corrected 2026-08-31. AOZ
 * was recruiting a Programmleiter*in and a Teamleiter*in Betreuung for the
 * pilot this product is named after; only THOSE THREE PEOPLE have no lead.
 * A Teamleiter*in is BETREUUNG + ALL_DOMAINS + not isSystemAdmin, so the split
 * already expresses it — do NOT add a LEITUNG role for it.
 *
 * Ask each axis exactly one question and the team describes itself:
 *   Betreuerin (all domains)     BETREUUNG          + ALL_DOMAINS
 *   Jobcoach                     JOBCOACH           + OWN_DOMAIN
 *   Freiwilligenarbeit coord.    FREIWILLIGENARBEIT + OWN_DOMAIN
 */

export type StaffRole =
  'ADMIN' | 'BETREUUNG' | 'SOZIALARBEIT' | 'JOBCOACH' | 'FREIWILLIGENARBEIT' | 'LIEGENSCHAFTEN'

export const STAFF_ROLES: readonly StaffRole[] = [
  'ADMIN',
  'BETREUUNG',
  'SOZIALARBEIT',
  'JOBCOACH',
  'FREIWILLIGENARBEIT',
  'LIEGENSCHAFTEN',
] as const

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value)
}

/**
 * Roles a NEW account may be given.
 *
 * ADMIN is excluded: it is the old all-in-one value, kept only so live JWTs
 * and existing rows keep resolving. Anything it used to grant is now `scope`
 * and `isSystemAdmin`, which can be given to any role.
 */
export const ASSIGNABLE_STAFF_ROLES: readonly StaffRole[] = STAFF_ROLES.filter(
  (role) => role !== 'ADMIN',
)

export const STAFF_SCOPES = ['OWN_DOMAIN', 'ALL_DOMAINS'] as const
export type StaffScopeId = (typeof STAFF_SCOPES)[number]

export function isStaffScope(value: string): value is StaffScopeId {
  return (STAFF_SCOPES as readonly string[]).includes(value)
}

/**
 * Everything a permission question needs about the person asking.
 *
 * A bare role is no longer enough to answer "may they?", so the type makes
 * that impossible to forget: every call site must hand over the whole subject.
 * The compiler finds them, which is the same reason `displayName` is required
 * rather than optional on resident-shaped types.
 */
export interface StaffCapabilities {
  role: StaffRole
  scope: StaffScopeId
  isSystemAdmin: boolean
}

/**
 * Configuring the product. Held by NOBODY unless explicitly granted.
 *
 * Kept out of ROLE_PERMISSIONS on purpose: no care domain implies the right to
 * invite colleagues or import a spreadsheet, and bundling them is what made
 * every oversight grant also a systems grant.
 */
export const SYSTEM_ADMIN_PERMISSIONS = [
  'users:manage',
  'system:configure',
  'import:write',
] as const

/**
 * Reading and answering complaints about the organisation itself.
 *
 * Held by NO care role, and — this is the part that matters — not by
 * `ALL_DOMAINS` either. Every other permission widens with oversight, because
 * seeing every domain is the point of that axis. This one must not, because
 * the person with oversight over every domain is one of the people a complaint
 * can be ABOUT. A grievance channel whose reader may be its subject is not a
 * grievance channel.
 *
 * Named separately from SYSTEM_ADMIN_PERMISSIONS even though `isSystemAdmin`
 * is what grants both today. They are different jobs: configuring the product
 * and hearing a complaint against staff. AOZ runs a central Beschwerdestelle
 * that is deliberately independent of the site team, and when a real person
 * fills that seat here they should get these two verbs without also being
 * handed the settings page — which is the whole lesson of retiring ADMIN.
 */
export const COMPLAINT_PERMISSIONS = ['complaints:read', 'complaints:respond'] as const

const OPERATIONAL = [
  'dashboard:read',
  'residents:read',
  'residents:write',
  'housing:read',
  'housing:write',
  'placements:read',
  'placements:write',
  'incidents:read',
  'incidents:write',
  'maintenance:read',
  'maintenance:write',
  'learning:read',
  'learning:write',
  'export:read',
  'marketplace:read',
  'marketplace:moderate',
  'events:read',
  'events:write',
  // Every role may READ the directory — Betreuung fields "is there anything I
  // could point them at?" at the kitchen table, not at a desk. Curating it is
  // separate, and belongs to the integration roles below.
  'opportunities:read',
  // Same rule, same reason, for the catalogue of external offers. It used to
  // ride on `residents:write`, which meant the two roles who exist to point
  // people at sport, language and community offers — JOBCOACH and
  // FREIWILLIGENARBEIT — were the two who could not open the page.
  'activities:read',
  // Drafting help — a CV, a reference, a listing, a note. Held by every care
  // role, and named rather than borrowed.
  //
  // It rode on `residents:write` for the same bad reason `activities:read`
  // did, and with a worse symptom: the two roles who write the most prose in
  // this product (a Jobcoach's CVs and references, a Freiwilligenarbeit
  // coordinator's listings) were the two the nav hid it from. Meanwhile
  // /api/ai/chat and /api/ai/form-assist checked only that you were signed in,
  // so the boundary the nav declared and the one the API enforced disagreed —
  // the same defect as the old /algorithm mismatch. One permission now governs
  // the page, the nav and both routes.
  'ai:assist',
] as const

/**
 * Career documents — a CV, a certificate, a reference someone can show an
 * employer.
 *
 * Deliberately NOT part of OPERATIONAL, which BETREUUNG inherits whole.
 * Housing operations is running a house: keys, quiet hours, who is in which
 * room. Someone's CV is not a housing fact, and this product's rule everywhere
 * else is the minimum access the work requires. The roles whose work is
 * literally about what a person can show an employer get it; the role that
 * runs the building does not.
 *
 * Leitung gets both, as it gets everything.
 */
const CAREER_DOCUMENTS_READ = 'documents:read'
const CAREER_DOCUMENTS_WRITE = 'documents:write'

/**
 * The resident's own channel to their support — and the same reasoning as
 * career documents, from the other end.
 *
 * A `MessageThread` belongs to one resident and the other side is always
 * STAFF. It is where somebody writes what is wrong at home, in their own
 * words, to the people responsible for their housing. That is Betreuung and
 * Sozialarbeit's correspondence; it is not a job-coaching or volunteering
 * fact, and a coach who needs to know something about a client has the
 * dossier, the incident list and the person themselves.
 *
 * Both message surfaces had NO permission check at all — the inbox took none,
 * the thread took `requireStaffAuth()` — so every staff member could read
 * every conversation. `residents:read` does not fix that: all four care roles
 * hold it, so gating on it would have been a check that nobody fails.
 *
 * ⚠️ A DECISION, not a derivation: if AOZ wants the Jobcoach or the Freiwilligenarbeit coordinator answering
 * residents directly, this is one line in each list. Better to have to grant
 * it than to have never noticed it was ungranted.
 */
const MESSAGES_READ = 'messages:read'

/**
 * Opening the queue of facts clients entered about their own admin life.
 *
 * This permission only says "you have a queue at all". WHICH facts a person
 * sees, and for which clients, is decided per fact kind against the care seats
 * they hold — `lib/client-facts/policy.ts`. So the Jobcoach holds this and
 * sees permits for the clients they coach, never their insurance and never a
 * client they do not hold.
 *
 * A single grant here would have been the mistake: "the care team may see the
 * client's facts" reads as reasonable and hands a Jobcoach the list of doctors
 * somebody visits. Not `residents:read` either — all four care roles hold
 * that, so gating on it is a check nobody fails, which is the exact error made
 * on the messages pages.
 *
 * LIEGENSCHAFTEN is absent: running the building is not a reason to hold
 * anyone's health insurance.
 */
const CLIENT_FACTS_READ = 'clientFacts:read'

/**
 * Answering a household's proposals, and curating the rule catalogue.
 *
 * ⚠️ EVERY governance action took `requireStaffAuth()` — signed in, nothing
 * more. So any staff member could confirm a house decision, create or archive
 * an AOZ rule, or close voting, including two roles that cannot even see
 * /rules in their navigation. The menu honoured a boundary the code did not,
 * which is the same defect the message and maintenance surfaces shipped with.
 *
 * The dashboard tile for it was gated on `housing:read`, with a comment saying
 * it rode there "not by a governance-specific permission that does not exist".
 * That was fair when `housing:read` implied a care role. It stopped being fair
 * the day LIEGENSCHAFTEN was added: the Liegenschaften lead holds `housing:read` because the role
 * runs the building stock, and it silently handed that role the queue for confirming
 * decisions — the queue where SAFETY and NON-DISCRIMINATION topics land,
 * precisely because those must never be settled by a vote.
 *
 * So the permission now exists. READING the rule book stays on `housing:read`
 * — the Liegenschaften lead should know the rules of a house they run. Answering the people who
 * live there is a different job.
 */
const GOVERNANCE_CONFIRM = 'governance:confirm'

export const ROLE_PERMISSIONS = {
  // Legacy. Equivalent to BETREUUNG; what made it special now lives in `scope`
  // and `isSystemAdmin`, which the migration set on every existing ADMIN row.
  ADMIN: [
    ...OPERATIONAL,
    CAREER_DOCUMENTS_READ,
    CAREER_DOCUMENTS_WRITE,
    'opportunities:write',
    'activities:write',
    MESSAGES_READ,
    CLIENT_FACTS_READ,
    GOVERNANCE_CONFIRM,
  ],
  BETREUUNG: [...OPERATIONAL, MESSAGES_READ, CLIENT_FACTS_READ, GOVERNANCE_CONFIRM],
  SOZIALARBEIT: [
    'dashboard:read',
    'residents:read',
    'residents:write',
    'housing:read',
    'incidents:read',
    'incidents:write',
    'learning:read',
    'learning:write',
    'export:read',
    'marketplace:read',
    'events:read',
    'events:write',
    'opportunities:read',
    'opportunities:write',
    'activities:read',
    'activities:write',
    'ai:assist',
    CAREER_DOCUMENTS_READ,
    CAREER_DOCUMENTS_WRITE,
    MESSAGES_READ,
    CLIENT_FACTS_READ,
    GOVERNANCE_CONFIRM,
  ],
  JOBCOACH: [
    'dashboard:read',
    'residents:read',
    // READ, never write. Logging an incident and working the conflict ladder
    // stay with Betreuung and Sozialarbeit — this is only "is something
    // currently wrong with the person I am coaching".
    //
    // The old boundary was survivable because staff shared a corridor: you
    // overheard that a household was in trouble. `Begleitung im regulären
    // Wohnraum` removes exactly that, spreading residents across apartments
    // nobody but their Betreuer visits. The pilot's own night-shift profile
    // expects staff to spot "herausfordernde Situationen frühzeitig", which
    // cannot be done by the two roles that cannot see any situation at all.
    'incidents:read',
    'learning:read',
    'learning:write',
    'opportunities:read',
    'opportunities:write',
    'activities:read',
    'activities:write',
    'ai:assist',
    CAREER_DOCUMENTS_READ,
    CAREER_DOCUMENTS_WRITE,
    // Permits only, and only for clients they hold — see policy.ts.
    CLIENT_FACTS_READ,
  ],
  /**
   * Runs the buildings, not a caseload.
   *
   * The first role staffed for no CARE DOMAIN at all. `role` answers "which
   * care domain am I staffed for?", and the honest answer here is none —
   * the Liegenschaften lead is responsible for the housing stock: which flats exist, who is
   * placed where, what is broken. The all-domains Betreuerin supports
   * PEOPLE about their housing, and holds their HOUSING care seats. Those
   * are two jobs, and giving both the same role said they were one.
   *
   * What this role does NOT get, and each omission is deliberate:
   *   `residents:write`  — places people into flats; does not edit who
   *                        they are. Intake and preferences stay with care.
   *   `messages:read`    — a resident writing to "die Betreuung" is writing to
   *                        their Betreuer*in, not to the person who owns the
   *                        building.
   *   `learning:*`, `opportunities:*`, `activities:*` — integration work.
   *   `marketplace`, `events` — community life, not the fabric of the house.
   *
   * `incidents:read` IS granted, read-only, for the same reason JOBCOACH and
   * FREIWILLIGENARBEIT have it: somebody placing a person into a flat needs to
   * see that a conflict is live in it. Logging and working the ladder stays
   * with Betreuung and Sozialarbeit.
   */
  LIEGENSCHAFTEN: [
    'dashboard:read',
    // You cannot run a house without knowing who lives in it, and a placement
    // is a statement about a person. Read only.
    'residents:read',
    'housing:read',
    'housing:write',
    'placements:read',
    'placements:write',
    'maintenance:read',
    'maintenance:write',
    'incidents:read',
    // Drafting help. About writing prose, not about clients — this role describes
    // units and maintenance work like everyone else describes their own.
    'ai:assist',
  ],
  FREIWILLIGENARBEIT: [
    'dashboard:read',
    'residents:read',
    // Same reason as JOBCOACH above: read-only sight of an active conflict,
    // for someone placing this person into a shared activity.
    'incidents:read',
    'learning:read',
    'learning:write',
    'marketplace:read',
    'marketplace:moderate',
    'events:read',
    'events:write',
    'opportunities:read',
    'opportunities:write',
    'activities:read',
    'activities:write',
    // Read only: a volunteering coordinator may need to see a reference
    // before placing someone, but the CV is the job coach's working document.
    'ai:assist',
    CAREER_DOCUMENTS_READ,
  ],
} as const

export type StaffPermission =
  | (typeof ROLE_PERMISSIONS)[StaffRole][number]
  | (typeof SYSTEM_ADMIN_PERMISSIONS)[number]
  | (typeof COMPLAINT_PERMISSIONS)[number]

/**
 * The narrowest possible subject, derived rather than named.
 *
 * Used only where a page renders in the instant between session expiry and the
 * redirect that replaces it. That render previously defaulted to ADMIN — it
 * showed EVERYTHING to a session that had just ended. Showing the least is the
 * safe direction to be wrong in.
 */
export const NARROWEST_CAPABILITIES: StaffCapabilities = {
  role: ASSIGNABLE_STAFF_ROLES.reduce((a, b) =>
    ROLE_PERMISSIONS[a].length <= ROLE_PERMISSIONS[b].length ? a : b,
  ),
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
}

/**
 * What EVERY role holds, and therefore the most that can be granted without
 * knowing which role a subject is. All reads — not a coincidence, and the
 * reason this is the right answer for a session that has just ended.
 *
 * ⚠️ `NARROWEST_CAPABILITIES` picks the role with the FEWEST permissions, and
 * fewest is not narrowest: a short list can still contain writes. That was
 * survivable while the shortest role happened to be an integration one, and
 * stopped being survivable when LIEGENSCHAFTEN arrived with three permissions
 * and `housing:write` among them — the stand-in for an expired session would
 * have rendered as somebody who may create housing. The count never expressed
 * the intent; this does.
 */
const UNIVERSAL_PERMISSIONS: readonly string[] = ASSIGNABLE_STAFF_ROLES.map(
  (role) => ROLE_PERMISSIONS[role] as readonly string[],
).reduce((a, b) => a.filter((permission) => b.includes(permission)))

/**
 * The widest real account: sees every domain and may configure the product.
 *
 * Note it does NOT use the legacy ADMIN role — that is the point of the split.
 * "Widest" is now a combination anyone can be given, not a role only one
 * person can hold.
 */
export const WIDEST_CAPABILITIES: StaffCapabilities = {
  role: 'BETREUUNG',
  scope: 'ALL_DOMAINS',
  isSystemAdmin: true,
}

export function canRoleAccess(allowedRoles: StaffRole[], currentRole: StaffRole): boolean {
  return allowedRoles.includes(currentRole)
}

function grantsPermission(role: StaffRole, permission: string): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)
}

/**
 * May this person do this?
 *
 * Each axis answers its own question and nothing else:
 *  - a system permission is granted by `isSystemAdmin` ALONE, never by a role;
 *  - ALL_DOMAINS works every seat, so it holds every domain's verbs;
 *  - otherwise the answer is their own domain's verbs.
 */
export function hasPermission(subject: StaffCapabilities, permission: string): boolean {
  // The expired-session stand-in gets the intersection of every role, never
  // its own role's list. Compared by identity because it is a singleton and
  // every call site passes it through unchanged (`user ?? NARROWEST`); a
  // spread copy falls back to the role, which is the older, wider behaviour.
  if (subject === NARROWEST_CAPABILITIES) {
    return UNIVERSAL_PERMISSIONS.includes(permission)
  }

  if ((SYSTEM_ADMIN_PERMISSIONS as readonly string[]).includes(permission)) {
    return subject.isSystemAdmin
  }

  // Checked HERE, above the role and scope logic, for the same reason system
  // permissions are: falling through would let the `ALL_DOMAINS` branch below
  // grant it, and oversight over every domain must not include reading
  // complaints that may name the person holding it.
  if ((COMPLAINT_PERMISSIONS as readonly string[]).includes(permission)) {
    return subject.isSystemAdmin
  }

  if (grantsPermission(subject.role, permission)) return true

  // Seeing every domain means working every seat — a Betreuerin covering the
  // whole house records learning and reads a CV like the coach would.
  if (subject.scope === 'ALL_DOMAINS') {
    return STAFF_ROLES.some((role) => grantsPermission(role, permission))
  }

  return false
}
