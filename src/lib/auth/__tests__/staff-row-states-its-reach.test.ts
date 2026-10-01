/**
 * Every place that CREATES a staff row must say how much that person sees.
 *
 * Role, reach and administration used to be one enum, so `role: 'ADMIN'` was a
 * complete description of a staff row and every creation site was correct by
 * saying one thing. Splitting them into three columns quietly invalidated all
 * five of those sites at once: the same line now produces a row holding the
 * column DEFAULTS.
 *
 * That is not hypothetical, and it is not a test-only concern. It shipped:
 *
 *   - The data migration backfilled `scope`/`isSystemAdmin` for rows that
 *     already existed (`WHERE role = 'ADMIN'`). Seeding is the OTHER way an
 *     admin is born, and it runs AFTER the migration, so on a freshly created
 *     database the bootstrap admin came out `OWN_DOMAIN`, `isSystemAdmin:
 *     false` — an instance with no system administrator and an unreachable
 *     settings page. CI caught it only because four E2E specs happen to open
 *     `/settings`; nothing in `npm run verify` could see it.
 *
 * The general shape is the one this repo keeps meeting: a field added to a
 * model is fine, and a field added to a model that FIVE call sites must each
 * remember is a countdown. So the gate is on the call sites, not on the
 * schema — it reads the source and requires the reach to be present in the
 * payload, whether stated field-by-field or spread from an SSOT.
 *
 * An allowlist of "the files I thought of" cannot catch the file nobody
 * thought of, so the list of sites is DISCOVERED by scanning, and the test
 * fails if scanning finds none (which would mean the scan itself broke).
 */

import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '../../../..')
const SCAN_DIRS = ['src', 'scripts']

/** The axes a staff row carries beyond its role. Add one here when one exists. */
const REACH_FIELDS = ['scope', 'isSystemAdmin'] as const

/**
 * A payload states its reach by naming each field, or by spreading a value
 * NAMED for being reach — `reach`,
 * `WIDEST_CAPABILITIES`, `OPERATOR_CAPABILITIES`.
 *
 * Spreading is the better form: it is the one that survives a fourth axis
 * without touching five files. But a spread is only self-evidently about reach
 * if it is named that way, and this gate cannot follow `...opts` to its
 * definition — so the naming convention IS the check. The alternative was an
 * allowlist of the specific identifiers that existed the day this was written,
 * which by construction misses the one somebody adds next month.
 */
const REACH_SPREAD = /\.\.\.\s*[A-Za-z_$][\w$]*(?:\s*\()?/g
const REACH_NAME = /reach|capabilit/i

/**
 * Source with comments removed.
 *
 * The first version of this gate scanned raw text and reported three
 * "offenders" that were the comments EXPLAINING the fix — including the ones
 * in this very change. A gate that reads prose reports the documentation of a
 * bug as the bug, which trains people to add exceptions until it gates
 * nothing.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        walk(full)
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full)
      }
    }
  }
  for (const dir of SCAN_DIRS) walk(path.join(REPO_ROOT, dir))
  return out
}

/**
 * The written payload of each `.insert(user).values(...)` chain in a file —
 * the `.values(...)` argument plus, for upserts, the `.onConflictDoUpdate`
 * argument. `.returning(...)` is deliberately EXCLUDED: it restates column
 * names without writing them, so counting it would let a site pass by merely
 * reading `scope` back.
 *
 * Paren-counted rather than regex-matched: a payload contains nested objects
 * and calls, and a non-greedy regex would stop at the first inner `)` and
 * report a payload that states nothing.
 */
function staffRowPayloads(source: string): string[] {
  const payloads: string[] = []
  // Both spellings live in the tree: `insert(user)` in lib/scripts, and
  // `insert(userTable)` where a route's local variable shadows the table name.
  const callSite = /\.\s*insert\(\s*(?:user|userTable)\s*\)/g
  let match: RegExpExecArray | null

  while ((match = callSite.exec(source)) !== null) {
    let payload = ''
    let i = match.index + match[0].length
    // Walk the fluent chain that follows the insert().
    for (;;) {
      const link = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(source.slice(i))
      if (!link) break
      const open = i + link[0].length - 1
      let depth = 0
      let end = source.length
      for (let j = open; j < source.length; j++) {
        const ch = source[j]
        if (ch === '(') depth++
        else if (ch === ')') {
          depth--
          if (depth === 0) {
            end = j
            break
          }
        }
      }
      if (link[1] === 'values' || link[1] === 'onConflictDoUpdate') {
        payload += source.slice(open + 1, end) + '\n'
      }
      i = end + 1
    }
    if (payload) payloads.push(payload)
  }
  return payloads
}

function statesReach(payload: string): boolean {
  const spreads = payload.match(REACH_SPREAD) ?? []
  if (spreads.some((spread) => REACH_NAME.test(spread))) return true
  // `[,:}\r\n]` and not just `:` — a payload may state a field in ES shorthand
  // (`scope,`), the same syntax blind spot the role filter below documents.
  return REACH_FIELDS.every((field) => new RegExp(`\\b${field}\\s*[,:}\\r\\n]`).test(payload))
}

describe('every staff-row creation site states its reach', () => {
  const sites = sourceFiles()
    .map((file) => ({ file, source: code(fs.readFileSync(file, 'utf8')) }))
    .flatMap(({ file, source }) => staffRowPayloads(source).map((payload) => ({ file, payload })))
    // Only payloads that actually set a role are staff-row births; an update
    // that touches `lastLoginAt` has no business restating anyone's reach.
    //
    // `role\s*[,:}\n]` and not `role\s*:` — the invite route writes the
    // SHORTHAND `role,`, so matching only the colon form skipped the one
    // creation site that was still taking the column defaults. A gate with a
    // syntax blind spot reports all-clear on exactly the file it should catch.
    .filter(
      ({ payload }) =>
        /\brole\s*[,:}\r\n]/.test(payload) ||
        (payload.match(REACH_SPREAD) ?? []).some((s) => REACH_NAME.test(s)),
    )

  it('found the creation sites at all — an empty scan is not a pass', () => {
    // If this ever drops to zero the gate has silently stopped gating, which
    // is the failure mode that makes a green suite worse than no suite.
    expect(sites.length).toBeGreaterThanOrEqual(3)
  })

  it.each(sites.map((site) => [path.relative(REPO_ROOT, site.file), site.payload]))(
    '%s states scope and isSystemAdmin',
    (file, payload) => {
      expect({ file, statesReach: statesReach(payload) }).toEqual({ file, statesReach: true })
    },
  )
})

describe('the retired all-in-one role is not minted anywhere new', () => {
  /**
   * ADMIN survives in the enum so live JWTs and existing rows resolve. What it
   * used to grant is now `scope` + `isSystemAdmin`, which any role can be
   * given — so there is no reason left to write a new one, and every place
   * that did has been converted. The last exception, the generated demo
   * Leitung door, was removed with the invented demo world on 2026-10-01.
   */
  const EXPECTED_LEGACY_MINTS: string[] = []

  it('nothing writes role: ADMIN any more', () => {
    const offenders = sourceFiles()
      .filter((file) => /role:\s*'ADMIN'/.test(code(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(REPO_ROOT, file))
      .sort()

    expect(offenders).toEqual(EXPECTED_LEGACY_MINTS)
  })
})
