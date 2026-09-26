/**
 * The dashboard section map is what makes the admin dashboard role-aware:
 * these tests pin the OUTCOME per role, so a permission edit in role-policy
 * that silently reshapes someone's dashboard fails here first.
 */

import {
  DASHBOARD_SECTIONS,
  DASHBOARD_FALLBACK_CTAS,
  sectionVisible,
  fallbackCta,
  workspaceState,
  setupCta,
  type DashboardSection,
} from '../dashboard'
import {
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  WIDEST_CAPABILITIES,
  hasPermission,
} from '@/lib/auth/role-policy'
import { DASHBOARD_LABELS } from '@/lib/constants/labels'

const ALL_SECTIONS = Object.keys(DASHBOARD_SECTIONS) as DashboardSection[]

function visibleSections(role: (typeof STAFF_ROLES)[number]): DashboardSection[] {
  return ALL_SECTIONS.filter((s) =>
    sectionVisible({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false }, s),
  )
}

describe('DASHBOARD_SECTIONS', () => {
  it('every section permission is held by the widest account', () => {
    // Not "is in ROLE_PERMISSIONS.ADMIN" any more: the team section maps to
    // users:manage, which no ROLE grants. It is held by whoever administers
    // the instance, which is a property of the person.
    for (const permission of Object.values(DASHBOARD_SECTIONS)) {
      expect(hasPermission(WIDEST_CAPABILITIES, permission)).toBe(true)
    }
  })

  it('the widest account sees every section', () => {
    expect(ALL_SECTIONS.filter((s) => sectionVisible(WIDEST_CAPABILITIES, s))).toEqual(ALL_SECTIONS)
  })

  it('BETREUUNG sees the operational sections but not team health', () => {
    // This is the assertion that used to read `toEqual(ALL_SECTIONS)` for both
    // roles — and it was true, which was the bug. Leitung and Betreuung
    // rendered byte-identical dashboards, because every section mapped to an
    // OPERATIONAL permission and `BETREUUNG: [...OPERATIONAL]`. Leitung's five
    // extra permissions were all page-level, so nothing on the dashboard could
    // tell the two apart.
    // `applications` is absent too, and deliberately: Betreuung READS the
    // Einsatzplätze board but may not act on it, and a request queue shown to
    // someone who cannot answer it is a list of things they must watch undone.
    expect(visibleSections('BETREUUNG')).toEqual(
      ALL_SECTIONS.filter((section) => section !== 'team' && section !== 'applications'),
    )
  })

  it('administration, not the role, is what adds the team section', () => {
    // The difference used to be Leitung-vs-Betreuung. It is now the axis that
    // actually decides it: the SAME role with and without administration.
    // The all-domains Betreuerin sees everything; whether that account also manages
    // accounts is a separate question, and this is where that shows.
    const plain = ALL_SECTIONS.filter((s) =>
      sectionVisible({ role: 'BETREUUNG', scope: 'ALL_DOMAINS', isSystemAdmin: false }, s),
    )
    const administering = ALL_SECTIONS.filter((s) =>
      sectionVisible({ role: 'BETREUUNG', scope: 'ALL_DOMAINS', isSystemAdmin: true }, s),
    )

    expect(plain).not.toEqual(administering)
    expect(administering.filter((s) => !plain.includes(s))).toEqual(['team'])
  })

  it('team health is visible to exactly the roles that can manage users', () => {
    // Gated on what the role can ACT on, not on seniority. A section reporting
    // unfinished handovers to someone who cannot finish them is noise.
    const canSeeTeam = STAFF_ROLES.filter((role) =>
      sectionVisible({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false }, 'team'),
    )
    const canManageUsers = STAFF_ROLES.filter((role) =>
      (ROLE_PERMISSIONS[role] as readonly string[]).includes('users:manage'),
    )

    expect(canSeeTeam).toEqual(canManageUsers)
  })

  it('JOBCOACH sees their board and the requests they answer — nothing housing', () => {
    // `applications`: the residents waiting on a listing of theirs.
    // `approvals`: the permits of the clients they coach (@see client-facts).
    expect(visibleSections('JOBCOACH')).toEqual(['learning', 'applications', 'approvals'])
  })

  it('FREIWILLIGENARBEIT sees learning, events and its requests, nothing housing', () => {
    expect(visibleSections('FREIWILLIGENARBEIT')).toEqual(['learning', 'events', 'applications'])
  })

  it('SOZIALARBEIT sees people/conflict/governance sections but no placement writes', () => {
    const sections = visibleSections('SOZIALARBEIT')
    expect(sections).toContain('incidents')
    expect(sections).toContain('proposals')
    expect(sections).toContain('learning')
    expect(sections).toContain('events')
    expect(sections).toContain('occupancy')
    expect(sections).not.toContain('checkIns')
    expect(sections).not.toContain('maintenance')
    expect(sections).not.toContain('matching')
    expect(sections).not.toContain('transferRequests')
  })

  it('every role sees at least one section — nobody gets an empty dashboard', () => {
    for (const role of STAFF_ROLES) {
      expect(visibleSections(role).length).toBeGreaterThan(0)
    }
  })
})

describe('team health wording', () => {
  // Lives here rather than in ActionDashboard.test.tsx, which mocks QuickStat
  // down to `label: value` and so cannot render a subtext at all.
  it('is singular for one account and plural beyond', () => {
    expect(DASHBOARD_LABELS.statTeamNeverSignedIn(1)).toBe('1 Konto war noch nie angemeldet')
    expect(DASHBOARD_LABELS.statTeamNeverSignedIn(3)).toBe('3 Konten waren noch nie angemeldet')
  })

  it('uses Swiss German — no ß anywhere in the dashboard labels', () => {
    expect(JSON.stringify(DASHBOARD_LABELS)).not.toContain('ß')
  })
})

describe('fallbackCta', () => {
  it('resolves for every role (last entry is readable by all staff)', () => {
    for (const role of STAFF_ROLES) {
      expect(fallbackCta({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false })).toBeDefined()
    }
  })

  it('offers resident intake to roles that can create residents', () => {
    expect(fallbackCta({ role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true }).href).toBe(
      '/residents/new',
    )
    expect(fallbackCta({ role: 'BETREUUNG', scope: 'OWN_DOMAIN', isSystemAdmin: false }).href).toBe(
      '/residents/new',
    )
    expect(
      fallbackCta({ role: 'SOZIALARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }).href,
    ).toBe('/residents/new')
  })

  it('offers learning to the Jobcoach, whose domain it names', () => {
    // "Lernen & Beruf" is learning AND work, so the generic ladder lands the Jobcoach
    // on something that is the Jobcoach's.
    expect(fallbackCta({ role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false }).href).toBe(
      '/learning',
    )
  })

  it('does NOT offer learning to Freiwilligenarbeit', () => {
    // This assertion used to say '/learning' for FREIWILLIGENARBEIT too, and that was the
    // bug: the Freiwilligenarbeit coordinator holds learning:write, so a ladder matched on permission
    // alone gave the coordinator one quiet-day button and it opened the Jobcoach's
    // surface. Nothing about Lernen & Beruf is Freiwilligenarbeit.
    // @see config/__tests__/quiet-day-cta.test.ts
    expect(
      fallbackCta({ role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }).href,
    ).toContain('board=volunteering')
  })

  it('final fallback is gated on a permission every role holds', () => {
    const last = DASHBOARD_FALLBACK_CTAS[DASHBOARD_FALLBACK_CTAS.length - 1]
    for (const role of STAFF_ROLES) {
      expect(ROLE_PERMISSIONS[role] as readonly string[]).toContain(last.permission)
    }
  })

  // ── Empty vs quiet ────────────────────────────────────────────────────────

  it('calls a workspace with no people empty, however many queues are clear', () => {
    expect(workspaceState({ residentCount: 0, openTaskCount: 0 })).toBe('empty')
  })

  it('distinguishes a quiet day from an unstarted one', () => {
    expect(workspaceState({ residentCount: 12, openTaskCount: 0 })).toBe('quiet')
    expect(workspaceState({ residentCount: 12, openTaskCount: 3 })).toBe('busy')
  })

  it('never calls an empty workspace busy, even with stray queue rows', () => {
    // Work listed for nobody is a data fault, not a to-do list.
    expect(workspaceState({ residentCount: 0, openTaskCount: 5 })).toBe('empty')
  })

  it('starts setup at housing while there is none', () => {
    expect(
      setupCta(
        { role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true },
        { housingUnitCount: 0 },
      )?.href,
    ).toBe('/housing/new')
  })

  it('moves setup to resident intake once housing exists', () => {
    expect(
      setupCta(
        { role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true },
        { housingUnitCount: 3 },
      )?.href,
    ).toBe('/residents/new')
  })

  it('sends roles that cannot create housing straight to resident intake', () => {
    // Sozialarbeit holds residents:write but not housing:write.
    expect(
      setupCta(
        { role: 'SOZIALARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        { housingUnitCount: 0 },
      )?.href,
    ).toBe('/residents/new')
  })

  it('offers no setup step to a role that may create neither', () => {
    // Any button here would land on /kein-zugriff — the dead end PR #88 removed.
    expect(
      setupCta(
        { role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        { housingUnitCount: 0 },
      ),
    ).toBeNull()
    expect(
      setupCta(
        { role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        { housingUnitCount: 2 },
      ),
    ).toBeNull()
  })

  it('never tells a role with no setup rights to wait for a named job title', () => {
    // This message used to say "Sobald die Leitung ... erfasst hat" — naming
    // a role AOZ's real team does not have. The Betreuung, Jobcoach and Freiwilligenarbeit staff hold
    // Betreuung/Jobcoach/Freiwilligenarbeit; ADMIN survives only as the
    // retired system-administrator seat, not a care role anyone is staffed
    // for. A Jobcoach or Freiwilligenarbeit account opening a genuinely empty
    // workspace was told to wait for a person who does not exist. The line
    // must name the CAPABILITY (housing:write / residents:write), never a
    // job title — so it stays true for whatever the org structure is, on
    // this deployment or the next rebrand.
    expect(DASHBOARD_LABELS.emptyNoSetupRights).not.toMatch(/Leitung|Admin/)
  })
})
