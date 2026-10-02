import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

/**
 * A client's own admin facts must never reach a decision the product makes.
 *
 * CLAUDE.md forbids tracking "anything that could be used for discrimination",
 * and this feature stores insurance, health contacts and a permit category —
 * exactly the material that rule is about. What makes it consistent rather
 * than an exception is the mechanism: the harm runs through a field that the
 * placement algorithm, the KPIs, or a staff filter can see. Close that, and
 * what remains is a person's own record, held where they can reach it instead
 * of in their Betreuerin's inbox.
 *
 * "We promise not to" is not a mechanism. This is. If someone later joins
 * ClientPermit into the matching query — the single most plausible way this
 * goes wrong, because permit type genuinely correlates with things a matcher
 * would love — the build goes red here with the reason attached.
 *
 * The forbidden directories are named as PATHS, and the tables as the literal
 * strings any query must use, so the check cannot be satisfied by a rename.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

/** The tables holding client-entered admin facts. */
const FACT_TABLES = ['clientInsurance', 'clientHealthContact', 'clientPermit'] as const

/** The SQL names, for a raw query that bypasses the Drizzle identifiers. */
const FACT_SQL_NAMES = ['ClientInsurance', 'ClientHealthContact', 'ClientPermit'] as const

/**
 * Where these facts must never appear, and why each one matters.
 *
 * compatibility → decides who lives with whom
 * analytics     → the numbers the pilot is judged on
 * export        → a spreadsheet leaves the product and stops being governed
 * client-filters, client-groups → select people, and become survey audiences
 *
 * An entry may be a directory or a single file.
 */
const FORBIDDEN_DIRS = [
  'src/lib/compatibility',
  'src/lib/analytics',
  'src/lib/export',
  // A staff filter SELECTS people, and a saved group becomes a survey
  // audience — "who holds permit F" must never be a filter or a group.
  'src/lib/config/client-filters.ts',
  'src/lib/client-groups',
  // A survey asks people about themselves and is sent to a selection of
  // them. A client fact must be neither a question nor an audience.
  'src/lib/surveys',
  'src/lib/config/survey-templates.ts',
  'src/lib/actions/surveys.ts',
] as const

function filesUnder(dir: string): string[] {
  const absolute = join(ROOT, dir)
  const found: string[] = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue
        walk(path)
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        found.push(path)
      }
    }
  }
  const stat = statSync(absolute)
  if (stat.isDirectory()) walk(absolute)
  else if (stat.isFile()) found.push(absolute)
  return found
}

/** Source with comments stripped — a mention in prose is not a read. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('the facts are invisible to anything that decides', () => {
  it('has directories to check, so an empty scan cannot pass silently', () => {
    for (const dir of FORBIDDEN_DIRS) {
      expect(filesUnder(dir).length).toBeGreaterThan(0)
    }
  })

  it.each(FORBIDDEN_DIRS)('%s does not touch a client fact table', (dir) => {
    const offenders = filesUnder(dir)
      .filter((path) => {
        const code = codeOf(path)
        return [...FACT_TABLES, ...FACT_SQL_NAMES].some((table) =>
          new RegExp(`\\b${table}\\b`).test(code),
        )
      })
      .map((path) => path.replace(ROOT, ''))

    expect(offenders).toEqual([])
  })

  it('the CSV export config never names one', () => {
    // The export is the boundary where data stops being governed by this
    // product's rules at all — once it is a spreadsheet on a laptop, no
    // permission check applies to it.
    const code = codeOf(join(ROOT, 'src/lib/export/config.ts'))
    for (const table of [...FACT_TABLES, ...FACT_SQL_NAMES]) {
      expect(code).not.toMatch(new RegExp(`\\b${table}\\b`))
    }
  })
})
