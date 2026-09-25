/**
 * No third-party script on a page that shows residents' data.
 *
 * The feedback widget used to load from the ROOT layout, which wraps the
 * resident portal and every staff screen — a script from another origin
 * running beside health contacts, permits and incident reports, disclosed
 * nowhere. It now loads only from the (public) marketing layout.
 *
 * Checked on the layout SOURCES rather than a rendered page, because a
 * layout is what decides it for every route beneath it at once.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const APP = join(__dirname, '..')
const read = (relative: string) => readFileSync(join(APP, relative), 'utf8')

/** Any <script>/<Script> whose src points off this origin. */
const THIRD_PARTY_SCRIPT = /<Script[^>]*src=["']https?:\/\//i

describe('third-party scripts', () => {
  it.each(['layout.tsx', 'portal/layout.tsx', '(admin)/layout.tsx', '(auth)/layout.tsx'])(
    '%s wraps private pages and loads none',
    (layout) => {
      expect(read(layout)).not.toMatch(THIRD_PARTY_SCRIPT)
    },
  )

  it('the public marketing layout is where the feedback widget lives', () => {
    // The other half: if the widget is removed entirely, that is a decision
    // to make on purpose, not by losing it in a refactor.
    expect(read('(public)/layout.tsx')).toMatch(/widget\.js/)
  })
})
