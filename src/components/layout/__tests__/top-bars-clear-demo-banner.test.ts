/**
 * Every top bar starts under the demo banner.
 *
 * On phones the admin bar is `fixed` at the top, and it covered the demo
 * instance's "invented data — enter nothing real" line completely, on the
 * device most visitors use. A bar pinned with a bare `top-0` does that again,
 * silently: nothing in lint, types or unit tests renders the two together.
 *
 * Checked on the SOURCES: any `chrome-bar` that is sticky or fixed must carry
 * `.below-demo-banner` (globals.css), whose offset is 0 outside the demo.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '..', '..', '..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : tsxFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

/** Every className string literal that makes a chrome-bar sticky or fixed. */
function pinnedBars(): { file: string; className: string }[] {
  return tsxFiles(SRC).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/className=["'`]([^"'`]*chrome-bar[^"'`]*)["'`]/g)]
      .map((m) => m[1])
      .filter((className) => /\b(sticky|fixed)\b/.test(className))
      .map((className) => ({ file: file.slice(SRC.length + 1), className })),
  )
}

describe('top bars and the demo banner', () => {
  it('finds the pinned bars (so this test cannot pass by finding nothing)', () => {
    expect(pinnedBars().length).toBeGreaterThanOrEqual(4)
  })

  it.each(pinnedBars().map((bar) => [bar.file, bar.className]))(
    '%s positions its bar under the banner',
    (_file, className) => {
      expect(className).toContain('below-demo-banner')
      expect(className).not.toMatch(/\btop-0\b/)
    },
  )
})
