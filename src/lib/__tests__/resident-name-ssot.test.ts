/**
 * Gate: a resident is displayed by NAME, never by raw login code.
 *
 * `residentName()` / `residentInitials()` are the SSOT (lib/utils/resident-name.ts)
 * and degrade to the code on their own when someone chose no display name. A
 * component that renders `resident.code` directly type-checks, lints and
 * renders — as a bare code — which is how the chore board came to say
 * "erledigt von RES-XXXXXX" to the person's own flatmates, and how the staff
 * queues showed codes for people whose names were sitting in the same row.
 *
 * Selecting only `{ code: true }` in Prisma causes the same defect one layer
 * earlier, so use RESIDENT_NAME_SELECT in queries whose rows reach the UI.
 *
 * Showing the code IS right in a few places (it is the login identity, and
 * staff read it out to residents). Those opt out explicitly with the marker
 * below — the point is that it becomes a decision, not an accident.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { sync as globSync } from 'glob'

const SRC = join(process.cwd(), 'src')
const OPT_OUT = 'resident-code-intentional'

/**
 * Everything that legitimately owns a `code` WITHOUT being a person.
 *
 * This is a denylist on purpose. The first version of this rule listed the
 * resident-ish accessor names instead and silently missed `candidate.code` in
 * the agreements panel — a rule that enumerates what to catch cannot catch the
 * name nobody thought of, and reads as "all clear" while doing it. The set of
 * things that are NOT people is small, closed, and easy to keep honest.
 */
const NON_RESIDENT_CODE_HOLDERS = [
  'unit',
  'units',
  'problemUnits',
  'housingUnit',
  'targetUnit',
  'currentUnit',
  'worstUnit',
  'topUnit',
  'spot',
  'room',
  'childSpot',
  'user',
  'u',
  'rule',
  'orgRule',
  'parentRule',
  'lang',
]

// `X.code` inside a JSX expression. Only the accessor DIRECTLY before `.code`
// decides: `resident.placements[0].housingUnit.code` is a unit code that
// happens to be reached through a resident, and is none of this rule's business.
// The optional `[...]` lets `unplacedResidents[0]?.code` still resolve to the
// `unplacedResidents` accessor — a bracket index sat between the identifier
// and `.code` and the rule simply never matched the line, which is how a
// dashboard tile rendered a raw code with this very guard already in the repo.
const CODE_ACCESS = /\{[^{}]*?([A-Za-z0-9_]+)(?:\[[^[\]]*\])?\??\.code\b/g

/**
 * Carrying the code as DATA is fine — `{ code: resident.code }` feeds the very
 * helpers this rule exists to enforce, and `residentCode={…}` hands the login
 * code to a component that asks for exactly that. Only rendering it is a bug.
 */
const PASSES_CODE_AS_DATA = /\bcode:\s*[A-Za-z0-9_.?[\]]*\.code\b/
const PASSES_CODE_AS_PROP = /[Cc]ode=\{/

/** `LOGIN_LABELS.code` is a label key on a constants object, not a person. */
const IS_CONSTANTS_OBJECT = /^[A-Z0-9_]+$/

function rendersResidentCode(line: string): boolean {
  if (PASSES_CODE_AS_DATA.test(line) || PASSES_CODE_AS_PROP.test(line)) return false
  return Array.from(line.match(CODE_ACCESS) ?? []).some((fragment) => {
    const accessor = /([A-Za-z0-9_]+)(?:\[[^[\]]*\])?\??\.code\b/.exec(fragment)?.[1]
    if (!accessor) return false
    if (IS_CONSTANTS_OBJECT.test(accessor)) return false
    return !NON_RESIDENT_CODE_HOLDERS.includes(accessor)
  })
}

function componentFiles(): string[] {
  return globSync('**/*.tsx', { cwd: SRC, absolute: true }).filter((f) => !f.includes('__tests__'))
}

describe('resident display-name SSOT', () => {
  it('renders residents by name, never by raw login code', () => {
    const violations: string[] = []

    for (const file of componentFiles()) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!rendersResidentCode(line)) return
        // An opt-out on this line or the line above documents the exception.
        const context = `${lines[i - 1] ?? ''}\n${line}`
        if (context.includes(OPT_OUT)) return
        violations.push(`${file.replace(SRC, 'src')}:${i + 1}  ${line.trim()}`)
      })
    }

    expect(violations).toEqual([])
  })

  // A rule that has quietly stopped matching looks exactly like a clean
  // codebase, so prove the detector still fires and still holds its fire.
  it('detects a regression, and does not cry wolf', () => {
    expect(rendersResidentCode('<p>{resident.code}</p>')).toBe(true)
    expect(rendersResidentCode('<span>{p.resident.code.slice(-3)}</span>')).toBe(true)
    expect(rendersResidentCode('Betrifft: {incident.subject.code}')).toBe(true)

    // The denylist must catch an accessor nobody thought to enumerate — this
    // exact case (`candidate.code`) escaped the first version of this rule.
    expect(rendersResidentCode('<span>{candidate.code}</span>')).toBe(true)

    // A bracket index between the accessor and `.code` — this exact shape
    // (`unplacedResidents[0]?.code`) rendered a raw code on the admin
    // dashboard while this rule, unable to match past the `[0]`, stayed
    // silent about it.
    expect(rendersResidentCode('{unplacedResidents[0]?.code}')).toBe(true)
    expect(rendersResidentCode('<span>{list[i].code}</span>')).toBe(true)

    expect(rendersResidentCode('<p>{residentName(resident)}</p>')).toBe(false)
    // A UNIT code reached through a resident is not a resident name.
    expect(rendersResidentCode('{resident.placements[0]?.housingUnit?.code}')).toBe(false)
    expect(rendersResidentCode('<p>{spot.code}</p>')).toBe(false)
    expect(rendersResidentCode('{ id: p.resident.id, code: p.resident.code }')).toBe(false)
    expect(rendersResidentCode('<Danger residentCode={resident.code} />')).toBe(false)
  })

  it('keeps the opt-out marker meaningful — it must be used sparingly', () => {
    const marked = componentFiles().filter((f) => readFileSync(f, 'utf8').includes(OPT_OUT))
    // If this trips, the exception has become the rule: check whether those
    // screens really mean to show a login code.
    expect(marked.length).toBeLessThanOrEqual(6)
  })
})
