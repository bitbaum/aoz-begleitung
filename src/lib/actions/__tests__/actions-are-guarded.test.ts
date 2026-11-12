import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Every export of a `'use server'` module is a Server Action — a POST
 * endpoint anyone can call. So every one must check who is asking, in its own
 * body or in a helper whose name says so.
 *
 * Found 2026-11-12: ten READS in these modules (care team, assignable staff,
 * care attributes, appointments, staff event and marketplace lists, unit
 * addresses, system config) checked nothing. The writes beside them always
 * did, and the pages that called the reads were guarded, so nothing showed —
 * until a client component imports one, when the page guard stops applying.
 */

const ACTIONS_DIR = join(process.cwd(), 'src', 'lib', 'actions')

/** Calls that establish who is asking. */
const GUARD =
  /\b(getCurrentUser|requireStaffAuth|requirePermission|requireRole|requireStaffReader|requireStaffOrSelf|getPortalAuth|getPortalResident|getResidentCookie|getCurrentResident|staffWriter|staffViewerFor|actingResident|actingResidentId)\(/

/**
 * Exports that check by delegating to ONE guarded function, named here with
 * the function that does the check. Adding a name here is a claim someone
 * has to read and believe; keep it short.
 */
const DELEGATES: Record<string, string> = {
  'governance.ts:defaultAgreementReviewDate': 'pure date arithmetic, reads no data',
  'opportunities.ts:publishOpportunity': 'setStatus → requirePermission',
  'opportunities.ts:archiveOpportunity': 'setStatus → requirePermission',
  'opportunities.ts:publishOpportunityFromEdit': 'publishOpportunity → setStatus',
  'opportunities.ts:publishOpportunityFromDetail': 'publishOpportunity → setStatus',
  'opportunities.ts:withdrawInterest': 'actingResidentId',
  'transfers.ts:approveTransferRequest': 'reviewTransferRequest → requireStaffAuth',
  'transfers.ts:denyTransferRequest': 'reviewTransferRequest → requireStaffAuth',
  'learning.ts:updateLearningRecord': 'staffWriter',
  'learning.ts:deleteLearningRecord': 'staffWriter',
  'learning.ts:updateOwnLearningRecord': 'actingResident',
  'learning.ts:deleteOwnLearningRecord': 'actingResident',
}

function exportsOf(source: string): { name: string; body: string }[] {
  const starts = [...source.matchAll(/^export async function (\w+)\(/gm)]
  return starts.map((match, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : source.length
    return { name: match[1], body: source.slice(match.index, end) }
  })
}

const files = readdirSync(ACTIONS_DIR).filter((file) => file.endsWith('.ts'))
/** True when the file opens with the `'use server'` directive (comments may precede it). */
const isServerModule = (source: string) =>
  /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use server['"]/.test(source)

const serverModules = files.filter((file) =>
  isServerModule(readFileSync(join(ACTIONS_DIR, file), 'utf8')),
)

describe('every Server Action checks who is asking', () => {
  it('finds the server action modules', () => {
    expect(serverModules.length).toBeGreaterThan(10)
  })

  it.each(serverModules)('%s: every export is guarded', (file) => {
    const unguarded = exportsOf(readFileSync(join(ACTIONS_DIR, file), 'utf8'))
      .filter(({ name, body }) => !GUARD.test(body) && !(`${file}:${name}` in DELEGATES))
      .map(({ name }) => name)
    expect({ file, unguarded }).toEqual({ file, unguarded: [] })
  })

  it('names no delegate that no longer exists', () => {
    for (const key of Object.keys(DELEGATES)) {
      const [file, name] = key.split(':')
      expect(readFileSync(join(ACTIONS_DIR, file), 'utf8')).toMatch(
        new RegExp(`^export async function ${name}\\(`, 'm'),
      )
    }
  })

  it('the read guards are not themselves Server Actions', () => {
    expect(isServerModule(readFileSync(join(ACTIONS_DIR, 'read-guards.ts'), 'utf8'))).toBe(false)
  })
})
