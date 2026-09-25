/**
 * Every place the product calls an AI model is disclosed.
 *
 * Until 2026-09-25 the AI was disclosed nowhere. The disclosure page and the
 * badge now render from config/ai-disclosure.ts; this test finds every file
 * that imports the model client and requires each to be listed there — so a
 * new AI feature cannot ship without somebody writing down what it sends.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { AI_SURFACES } from '../ai-disclosure'
import { PUBLIC_ROUTES } from '@/lib/auth/route-boundaries'

const REPO = join(__dirname, '..', '..', '..', '..')
const SRC = join(REPO, 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

/** Plumbing that talks to the provider without being a user-facing feature. */
const NOT_A_FEATURE = new Set([
  'src/lib/ai/provider.ts', // the client itself
  'src/lib/ai/liveness.ts', // health probe, sends no user data
  'src/lib/ai/staff-chat.ts', // the chat route's engine — disclosed as the chat route
])

describe('AI disclosure', () => {
  const callers = sourceFiles(SRC)
    .filter((file) => /from '@\/lib\/ai\/provider'/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(REPO, file))
    .filter((file) => !NOT_A_FEATURE.has(file))

  it('finds the AI call sites', () => {
    expect(callers.length).toBeGreaterThan(0)
  })

  it('discloses every file that calls a model', () => {
    const disclosed = new Set(AI_SURFACES.map((surface) => surface.source))
    expect(callers.filter((file) => !disclosed.has(file))).toEqual([])
  })

  it('names no call site that no longer exists', () => {
    for (const surface of AI_SURFACES) {
      expect(() => statSync(join(REPO, surface.source))).not.toThrow()
    }
  })

  it('the disclosure is readable without an account', () => {
    expect(PUBLIC_ROUTES).toContain('/ki-datenschutz')
  })
})
