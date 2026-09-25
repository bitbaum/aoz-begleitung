import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { ROLE_PERMISSIONS, hasPermission, type StaffRole } from '@/lib/auth/role-policy'
import { DASHBOARD_SECTIONS, sectionVisible } from '@/lib/config/dashboard'

/**
 * A resident's messages to staff are readable by the roles that correspond with
 * them, and by no one else.
 *
 * Both surfaces shipped with no permission check — the inbox had none, the
 * thread took `requireStaffAuth()`, which proves only that somebody is staff.
 * Every colleague could read every conversation.
 *
 * The first attempt to fix it gated on `residents:read` and guarded NOTHING:
 * all four care roles hold that. That is the failure this file is built to
 * prevent — a check nobody fails looks exactly like a check that works, on a
 * green test suite. So these tests assert the DENIAL, not just the grant.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function subject(role: StaffRole) {
  return { role, scope: 'OWN_DOMAIN' as const, isSystemAdmin: false }
}

describe('who may read a resident conversation', () => {
  it('grants the roles whose work is that correspondence', () => {
    expect(hasPermission(subject('BETREUUNG'), 'messages:read')).toBe(true)
    expect(hasPermission(subject('SOZIALARBEIT'), 'messages:read')).toBe(true)
  })

  it('DENIES the integration roles — this is the half that has to hold', () => {
    expect(hasPermission(subject('JOBCOACH'), 'messages:read')).toBe(false)
    expect(hasPermission(subject('FREIWILLIGENARBEIT'), 'messages:read')).toBe(false)
  })

  it('IS widened by oversight, unlike complaints — and that is deliberate', () => {
    // `ALL_DOMAINS` grants the union of every role, because covering every seat
    // means doing every seat's work. Complaints are the one carve-out, and for
    // a reason that does not apply here: their reader may be their subject.
    // Reading a resident's message is simply part of covering Betreuung.
    //
    // Pinned because it is the difference between "The Jobcoach cannot read these" and
    // "nobody but the all-domains Betreuerin can", and only the first is true.
    const anyRoleWithOversight = {
      role: 'JOBCOACH' as const,
      scope: 'ALL_DOMAINS' as const,
      isSystemAdmin: false,
    }
    expect(hasPermission(anyRoleWithOversight, 'messages:read')).toBe(true)
    expect(hasPermission(anyRoleWithOversight, 'complaints:read')).toBe(false)
  })

  it('leaves the two real coaches out, which is the whole point', () => {
    // The Jobcoach and the Freiwilligenarbeit coordinator are OWN_DOMAIN on the live instance; the all-domains Betreuerin is
    // BETREUUNG + ALL_DOMAINS and keeps her inbox either way.
    expect(
      hasPermission(
        { role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        'messages:read',
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        'messages:read',
      ),
    ).toBe(false)
    expect(
      hasPermission(
        { role: 'BETREUUNG', scope: 'ALL_DOMAINS', isSystemAdmin: false },
        'messages:read',
      ),
    ).toBe(true)
  })

  it('is a permission some role lacks — a grant everyone holds is not a boundary', () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as StaffRole[]
    const without = roles.filter((role) => !hasPermission(subject(role), 'messages:read'))
    expect(without.length).toBeGreaterThan(0)
  })
})

describe('both message surfaces are actually guarded', () => {
  const surfaces = [
    'src/app/(admin)/messages/page.tsx',
    'src/app/(admin)/messages/[residentId]/page.tsx',
  ]

  it.each(surfaces)('%s requires messages:read', (relative) => {
    // Comments are stripped so the doc block explaining the guard cannot BE the
    // guard — the same self-alibi that would have made this file useless.
    const source = readFileSync(join(ROOT, relative), 'utf8')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n')

    expect(source).toMatch(/requirePermission\(\s*'messages:read'\s*\)/)
    expect(source).not.toMatch(/requireStaffAuth\s*\(/)
  })
})

describe('the dashboard tile follows the same boundary as the inbox', () => {
  /**
   * The tile names a Klient*in and links into a conversation, so it must never
   * render for somebody who may not open that conversation. Gating it on the
   * SAME permission as the page means the two cannot drift — the failure mode
   * would be a coach seeing "Hana wartet seit 4 Tagen" on a thread they are
   * not allowed to read.
   */
  it('is gated on messages:read, exactly like /messages', () => {
    expect(DASHBOARD_SECTIONS.messages).toBe('messages:read')
  })

  it('so the integration roles get no tile', () => {
    expect(sectionVisible(subject('JOBCOACH'), 'messages')).toBe(false)
    expect(sectionVisible(subject('FREIWILLIGENARBEIT'), 'messages')).toBe(false)
    expect(sectionVisible(subject('LIEGENSCHAFTEN'), 'messages')).toBe(false)
  })

  it('and the correspondence roles do', () => {
    expect(sectionVisible(subject('BETREUUNG'), 'messages')).toBe(true)
    expect(sectionVisible(subject('SOZIALARBEIT'), 'messages')).toBe(true)
  })
})
