/**
 * No code that READS survey responses may also handle a client identity, and
 * no export or API route may touch responses at all.
 *
 * The schema already makes a response unattributable (schema-anonymity.test).
 * This closes the other way it could go wrong: a page or loader that selects
 * responses alongside invitations or clients, then renders "these answers came
 * in while these people were marked answered" — a re-identification built out
 * of two harmless queries. So the files that mention the response table are
 * listed, and each must name no client.
 *
 * The one exception is `submit.ts`, the single place that writes a response
 * and flips an invitation in one transaction. Its inserted values are pinned
 * to three keys by `submit.test.ts`.
 */

import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(__dirname, '..', '..', '..', '..')
const SRC = join(ROOT, 'src')

/** Files allowed to mention both, each with its reason. */
const ALLOWED = new Set([
  'src/lib/db/schema.ts', // declares the tables
  'src/lib/surveys/submit.ts', // the write transaction; values pinned by submit.test.ts
])

const RESPONSE = /\b(surveyResponse|SurveyResponse)\b/
const CLIENT_IDENTITY = /\b(resident|residentId|surveyInvitation|SurveyInvitation|displayName)\b/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** Code with comments stripped — a mention in prose is not a read. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const files = sourceFiles(SRC).map((path) => ({ path: relative(ROOT, path), code: codeOf(path) }))
const readers = files.filter((file) => RESPONSE.test(file.code))

describe('survey responses never meet a client identity', () => {
  it('finds the code that touches responses — an empty scan is not a pass', () => {
    expect(readers.map((file) => file.path)).toContain('src/lib/surveys/staff-data.ts')
    expect(readers.map((file) => file.path)).toContain('src/lib/surveys/submit.ts')
  })

  it('every file that reads responses names no client', () => {
    const offenders = readers
      .filter((file) => !ALLOWED.has(file.path))
      .filter((file) => CLIENT_IDENTITY.test(file.code))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })

  it('no export and no API route touches responses', () => {
    const leaks = readers
      .map((file) => file.path)
      .filter((path) => path.startsWith('src/lib/export/') || path.startsWith('src/app/api/'))
    expect(leaks).toEqual([])
  })

  it('no page renders responses directly — only through the k-rule summary', () => {
    const pages = readers.map((file) => file.path).filter((path) => path.startsWith('src/app/'))
    expect(pages).toEqual([])
  })

  it('would catch a reader that also selects clients', () => {
    const sample = 'db.select().from(surveyResponse).innerJoin(resident, …)'
    expect(RESPONSE.test(sample) && CLIENT_IDENTITY.test(sample)).toBe(true)
  })
})
