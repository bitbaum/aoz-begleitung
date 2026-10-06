/**
 * The staff desks (config/roles.ts) are the ONE place a role's working day is
 * declared. These tests run over every StaffRole, so a new role or an edited
 * desk is checked by construction rather than by someone remembering to add a
 * case.
 */

import { describe, expect, it } from 'vitest'

import {
  STAFF_ROLES,
  hasPermission,
  type StaffCapabilities,
  type StaffRole,
} from '@/lib/auth/role-policy'
import {
  DASHBOARD_SECTIONS,
  HERO_SOURCES,
  WORK_SECTIONS,
  dashboardSections,
  fallbackCta,
  heroOrder,
} from '@/lib/config/dashboard'
import { defaultDossierTab } from '@/lib/config/dossier'
import { defaultIntegrationBoardForRole } from '@/lib/config/integration-boards'
import { STAFF_DESKS, caseloadQueueFor, deskFor } from '@/lib/config/roles'

const own = (role: StaffRole): StaffCapabilities => ({
  role,
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
})

describe.each(STAFF_ROLES.map((role) => [role]))('the %s desk', (role) => {
  const desk = deskFor(role)

  it('is the dashboard: sections render in exactly the desk order', () => {
    expect(dashboardSections(own(role))).toEqual(desk.sections)
  })

  it('never lists a section the role may not see (nothing is dropped silently)', () => {
    for (const section of desk.sections) {
      expect({ section, held: hasPermission(own(role), DASHBOARD_SECTIONS[section]) }).toEqual({
        section,
        held: true,
      })
    }
  })

  it('is the hero priority: the hero reads the desk list, in order', () => {
    expect(heroOrder(own(role))).toEqual(desk.hero)
  })

  it('lets every counted queue claim the hero, and nothing else', () => {
    // A work section without a hero source is how the header said "3
    // Aufgaben" while the hero said "Alles erledigt!" — shipped for
    // Freiwilligenarbeit, whose queue was never handed to the hero.
    for (const section of desk.sections.filter((s) => WORK_SECTIONS.includes(s))) {
      const sources = desk.hero.filter((source) => HERO_SOURCES[source] === section)
      expect({ section, claimsHero: sources.length > 0 }).toEqual({ section, claimsHero: true })
    }
    for (const source of desk.hero) {
      expect(desk.sections).toContain(HERO_SOURCES[source])
    }
  })

  it('decides the dossier tab and the integration board', () => {
    expect(defaultDossierTab(role)).toBe(desk.dossierTab)
    expect(defaultIntegrationBoardForRole(role)).toBe(desk.integrationBoard)
  })

  it('offers a quiet-day button the role may actually press', () => {
    expect(hasPermission(own(role), desk.quietDay.permission)).toBe(true)
    expect(fallbackCta(own(role)).href).toBe(desk.quietDay.href)
  })

  it('names the work in one line of Swiss German', () => {
    expect(desk.description.length).toBeGreaterThan(10)
    expect(desk.description).not.toContain('\n')
    expect(desk.description).not.toContain('ß')
  })
})

describe('what each desk is FOR', () => {
  it('keeps check-ins off the Liegenschaften desk entirely', () => {
    const desk = STAFF_DESKS.LIEGENSCHAFTEN
    expect(desk.sections).not.toContain('checkIns')
    expect(desk.hero).not.toContain('checkIns')
    expect(desk.hero).not.toContain('checkInsVeryOverdue')
    expect(desk.checkInChip).toBe(false)
    // Its quiet day is the housing stock, never somebody else's statistics.
    expect(desk.quietDay.href).not.toBe('/analytics')
  })

  it('leads Liegenschaften with placing people, and lists maintenance', () => {
    expect(heroOrder(own('LIEGENSCHAFTEN'))[0]).toBe('matching')
    expect(dashboardSections(own('LIEGENSCHAFTEN'))).toContain('maintenance')
  })

  it('leads Freiwilligenarbeit with waiting requests, then its own volunteering queue', () => {
    expect(heroOrder(own('FREIWILLIGENARBEIT')).slice(0, 2)).toEqual([
      'applications',
      'volunteeringQueue',
    ])
    expect(caseloadQueueFor('FREIWILLIGENARBEIT')).toBe('volunteering')
  })

  it('leads the Jobcoach with waiting requests, then the job queue', () => {
    expect(heroOrder(own('JOBCOACH')).slice(0, 2)).toEqual(['applications', 'jobQueue'])
    expect(caseloadQueueFor('JOBCOACH')).toBe('job')
  })

  it('ranks an unanswered request above everything on every integration desk', () => {
    // "The clock is theirs": a person asked. The caseload queue holds only the
    // clients on this seat, so a requester nobody holds reaches the hero
    // through `applications` alone — ranked lower, they lost it to a client
    // who had asked for nothing (live 2026-10-02, Stepan vs Georgy).
    for (const role of STAFF_ROLES.filter((r) => caseloadQueueFor(r) !== null)) {
      expect({ role, first: heroOrder(own(role))[0] }).toEqual({ role, first: 'applications' })
    }
  })

  it('leads Sozialarbeit with deadlines, after safety', () => {
    expect(heroOrder(own('SOZIALARBEIT')).slice(0, 2)).toEqual(['criticalIncidents', 'renewals'])
  })

  it('builds a caseload queue only for the two integration desks', () => {
    expect(STAFF_ROLES.filter((role) => caseloadQueueFor(role) !== null)).toEqual([
      'JOBCOACH',
      'FREIWILLIGENARBEIT',
    ])
  })
})

describe('reach over every domain', () => {
  it('puts the own desk first, then every other section the viewer may see', () => {
    const allDomains: StaffCapabilities = {
      role: 'BETREUUNG',
      scope: 'ALL_DOMAINS',
      isSystemAdmin: false,
    }
    const sections = dashboardSections(allDomains)
    expect(sections.slice(0, STAFF_DESKS.BETREUUNG.sections.length)).toEqual(
      STAFF_DESKS.BETREUUNG.sections,
    )
    expect(sections).toContain('maintenance')
    expect(sections).toContain('transferRequests')
    expect(sections).not.toContain('team')
  })

  it('gives system administration every section, whatever its stored scope', () => {
    const admin: StaffCapabilities = { role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: true }
    expect([...dashboardSections(admin)].sort()).toEqual(Object.keys(DASHBOARD_SECTIONS).sort())
    expect(heroOrder(admin)[0]).toBe('applications')
    expect([...heroOrder(admin)].sort()).toEqual(Object.keys(HERO_SOURCES).sort())
  })
})
