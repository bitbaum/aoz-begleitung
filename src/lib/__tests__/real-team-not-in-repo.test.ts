import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

import { parseTeamConfig } from '../../../scripts/db/real/aoz-team'

/**
 * The real team is personal data and is not in this public repository.
 *
 * Until 2026-11-12 `scripts/db/real/aoz-team.ts` listed four real staff members
 * by name with their roles. The list now lives in a gitignored local file; the
 * committed example shows the shape with invented people, and this keeps it so.
 */
describe('the real team is not committed', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('the committed example is a valid team config', () => {
    const team = parseTeamConfig(JSON.parse(read('scripts/db/real/aoz-team.example.json')))
    expect(team.length).toBeGreaterThan(0)
  })

  it('every example person is visibly invented', () => {
    const team = parseTeamConfig(JSON.parse(read('scripts/db/real/aoz-team.example.json')))
    expect(team.filter((person) => !person.name.startsWith('Beispiel '))).toEqual([])
  })

  it('the loader file carries no list of people', () => {
    expect(read('scripts/db/real/aoz-team.ts')).not.toMatch(/name:\s*['"`]/)
  })

  it('a local team file cannot be committed', () => {
    const ignored = execFileSync('git', ['check-ignore', 'scripts/db/real/aoz-team.local.json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(ignored.trim()).toBe('scripts/db/real/aoz-team.local.json')
  })

  it('rejects one name listed twice, because matching is by name', () => {
    const person = {
      name: 'Beispiel Doppelt',
      role: 'JOBCOACH',
      scope: 'OWN_DOMAIN',
      isSystemAdmin: false,
      note: 'x',
    }
    expect(() => parseTeamConfig({ team: [person, person] })).toThrow(/listed twice/)
  })
})
