import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

/**
 * A confirmed fact must still be findable.
 *
 * THE BUG THIS PINS SHIPPED. `/approvals` queries `status = 'PENDING'`, and
 * for a day nothing else on the staff side read the client-fact tables at all.
 * So the moment a Betreuerin pressed "Gesehen", the insurance disappeared from
 * every staff surface: she could never afterwards look up which insurance a
 * client holds, or who their dentist is — the entire reason the client entered
 * it. Written, then read by nobody, inside the feature built to end exactly
 * that.
 *
 * It was found by walking the product as the Jobcoach, not by reading the code. No
 * test failed, because "the queue is empty" is indistinguishable from "there
 * is nothing to do".
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function codeOf(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const DOSSIER = 'src/lib/client-facts/dossier.ts'
const PAGE = 'src/app/(admin)/residents/[id]/page.tsx'

describe('a fact survives being confirmed', () => {
  it('the dossier query does NOT filter by status', () => {
    // The whole defect in one line. A status filter here would recreate it —
    // and filtering to CONFIRMED would be just as wrong in the other
    // direction, hiding the entry somebody typed this morning.
    const source = codeOf(DOSSIER)
    expect(source).not.toMatch(/status,\s*'PENDING'/)
    expect(source).not.toMatch(/status,\s*'CONFIRMED'/)
  })

  it('the client page asks for them', () => {
    expect(codeOf(PAGE)).toMatch(/clientFactsForDossier\(/)
  })

  it('and renders them', () => {
    expect(codeOf(PAGE)).toMatch(/<ClientFactsCard/)
  })
})

describe('the dossier applies the same visibility rule as the queue', () => {
  it('narrows by mayReadFact rather than inventing a second rule', () => {
    // Two rules about who may see an insurance is one rule too many; the
    // second one drifts and nobody notices which is authoritative.
    expect(codeOf(DOSSIER)).toMatch(/mayReadFact\(/)
  })

  it('decides before querying, not in the markup', () => {
    // A kind the viewer may not read must be a query never issued. Fetching
    // and hiding puts the rows in the payload, which is the leak.
    const source = codeOf(DOSSIER)
    expect(source).toMatch(/mayInsurance\s*\?/)
    expect(source).toMatch(/mayContacts\s*\?/)
    expect(source).toMatch(/mayPermit\s*\?/)
  })

  it('distinguishes "may not see" from "nothing here"', () => {
    // null means forbidden, [] means empty. Collapsing them tells a Jobcoach
    // that a client has no doctors, when the truth is that it is not his to
    // know.
    const source = codeOf(DOSSIER)
    expect(source).toMatch(/Promise\.resolve\(null\)/)
    expect(source).toMatch(/anyVisible/)
  })
})
