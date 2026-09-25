/**
 * The product describes households and events, never a verdict on a person.
 *
 * It used to rank residents by how often they were an incident's subject,
 * list them by name, call them people with "Anpassungsprobleme", and tell
 * staff that a placement review was "recommended" — a judgement about a
 * vulnerable person produced from a count. Those surfaces are gone
 * (lib/housing/fit-notes.ts replaced them); this keeps the vocabulary that
 * carried them from creeping back into code or copy.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOTS = [join(__dirname, '..', '..'), join(__dirname, '..', '..', '..', 'scripts')]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === '__tests__') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

/** Each phrase is a verdict about a person that a count cannot justify. */
const FORBIDDEN = [
  /troublemaker/i,
  /Anpassungsproblem/i,
  /Überprüfung der Platzierung wird empfohlen/i,
  /frequentSubjects/,
]

describe('no verdicts about people', () => {
  const files = ROOTS.flatMap(sourceFiles)

  it('scans the whole source tree', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it.each(FORBIDDEN.map((pattern) => [String(pattern), pattern] as const))(
    'no source file says %s',
    (_label, pattern) => {
      const hits = files
        .filter((file) => pattern.test(readFileSync(file, 'utf8')))
        .map((file) => relative(ROOTS[0], file))
      expect(hits).toEqual([])
    },
  )
})
