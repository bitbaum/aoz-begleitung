import fs from 'fs'
import { execSync } from 'child_process'
import { SATISFACTION_EMOJIS, SATISFACTION_LABELS } from '@/lib/constants'

/**
 * One satisfaction scale, defined once.
 *
 * There were three. `SATISFACTION_EMOJIS` in constants was the SSOT, and two
 * components had each written their own array literal — both starting 😢 where
 * the SSOT starts 😞. Nobody noticed, because a differently-sad face is not a
 * failure of anything: it type-checks, it lints, it renders. The scale a
 * resident saw in the portal and the one staff saw on the placements list were
 * simply not the same scale, and any comparison between them was quietly
 * comparing two different instruments.
 *
 * A copy of a five-element emoji array is trivially cheap to write and
 * impossible to spot in review, so the rule is enforced rather than documented:
 * the faces live in ONE file and every renderer imports them.
 */

const FACE_EMOJIS = ['😞', '😢', '😕', '😐', '🙂', '😊', '😀', '☹️', '😃', '😍']

/** The one file allowed to spell the faces out, plus this gate describing it. */
const SSOT_FILES = [
  'src/lib/constants/labels/residents.ts',
  'src/lib/__tests__/satisfaction-scale-ssot.test.ts',
]

function sourceFiles(): string[] {
  const out = execSync(`git ls-files 'src/**/*.ts' 'src/**/*.tsx'`, {
    encoding: 'utf8',
    cwd: process.cwd(),
  })
  // A tracked file deleted in the working tree (not yet committed) has nothing
  // left to scan; reading it would fail the gate for a reason unrelated to it.
  return out
    .split('\n')
    .filter(Boolean)
    .filter((file) => fs.existsSync(file))
}

describe('the satisfaction scale is defined once', () => {
  it('no file outside the SSOT spells out a face scale', () => {
    const offenders: string[] = []

    for (const file of sourceFiles()) {
      if (SSOT_FILES.includes(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      const found = FACE_EMOJIS.filter((face) => content.includes(face))
      // Two faces could be an illustration in prose; three is a scale.
      if (found.length >= 3) offenders.push(`${file} (${found.join(' ')})`)
    }

    expect(offenders).toEqual([])
  })

  it('keeps the faces and their labels the same length', () => {
    // A renderer indexes labels by the emoji's position. If these ever differ
    // the last face gets `undefined` as its accessible name — invisible to
    // sighted review and the whole label for a screen reader.
    expect(SATISFACTION_EMOJIS).toHaveLength(5)
    expect(SATISFACTION_LABELS).toHaveLength(SATISFACTION_EMOJIS.length)
    for (const label of SATISFACTION_LABELS) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
