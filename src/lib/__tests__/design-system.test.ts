import { execSync } from 'child_process'
import { readFileSync } from 'fs'

/**
 * Design-system SSOT guard.
 *
 * The promise the design layer makes is that re-theming or re-badging the
 * product is an edit to `globals.css` alone. That promise only survives if
 * nothing downstream re-states a design value. Every check below is a class of
 * violation that has to stay at zero, not a style preference:
 *
 *  - a literal colour anywhere but globals.css means a re-theme misses it
 *  - a `var(--x)` in the Tailwind config with no matching definition produces
 *    a utility that silently does nothing (tsc and ESLint cannot see it — this
 *    is the same blind spot that once shipped a broken build)
 *  - a drifted AOZ palette breaks "we can hand it back to AOZ unchanged"
 *
 * Grep-based on purpose: it runs in milliseconds and needs no build step, so
 * there is no excuse to skip it.
 */

const SRC_GLOBS = '--include=*.tsx --include=*.ts --include=*.css'

/** Run a grep across src/, returning matching lines (empty when none match). */
function grepSrc(pattern: string, extraArgs = ''): string[] {
  const out = execSync(
    `grep -rEn ${extraArgs} ${SRC_GLOBS} -e ${JSON.stringify(pattern)} src || true`,
    { encoding: 'utf8', cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  )
  return out
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.includes('__tests__'))
}

/**
 * Strip block and line comments. Every check below looks for a pattern in
 * CODE; prose explaining why the pattern is banned — including in this file —
 * must not be reported as a violation of it.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('design tokens are defined in exactly one place', () => {
  /**
   * Files allowed to contain literal colour, and why. Keeping this list here —
   * rather than letting the check quietly not cover some directory — means an
   * exemption is a decision someone made on purpose.
   */
  const HEX_ALLOWED = [
    // The token SSOT itself has to state the values somewhere.
    'src/app/globals.css',
    // Mail clients strip <style> and cannot read CSS custom properties, so
    // email colour must be inlined as hex. It is confined to this one file.
    'src/lib/email/tokens.ts',
    // Same constraint, different renderer: the social-preview card is drawn by
    // Satori, which also cannot read CSS custom properties.
    'src/app/opengraph-image.tsx',
  ]

  it('has no hardcoded hex colour outside the token files', () => {
    // `bg-[#fff]`, `style={{ color: '#fff' }}` — both make a re-theme partial.
    const hits = grepSrc('#[0-9a-fA-F]{3,8}\\b').filter(
      (line) => !HEX_ALLOWED.some((allowed) => line.startsWith(`${allowed}:`)),
    )
    expect(hits).toEqual([])
  })

  it('has no raw Tailwind palette colour', () => {
    // `text-gray-500` / `bg-emerald-100` duplicate the ui-* and status-* tokens,
    // and they do not flip with the theme.
    const palette =
      'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
    const hits = grepSrc(
      `\\b(bg|text|border|ring|divide|from|via|to|decoration|outline)-(${palette})-(50|[1-9]00|950)\\b`,
    )
    expect(hits).toEqual([])
  })

  it('has no raw black or white colour utility outside the token layer', () => {
    // The modal scrim is the one legitimate use of black, and it has its own
    // `.scrim` class so all six dialogs dim by the same amount.
    const hits = grepSrc('\\b(bg|text|border|ring|divide)-(white|black)(/[0-9]+)?\\b').filter(
      (line) => !line.startsWith('src/app/globals.css'),
    )
    expect(hits).toEqual([])
  })

  it('builds no Tailwind class name by string interpolation', () => {
    /**
     * Tailwind generates CSS by scanning source text for complete class names.
     * `bg-${color}-500` or `sm:grid-cols-${count}` is therefore never emitted,
     * and the element renders with that style simply missing — no error, no
     * type failure, no lint warning. Two of these were live in this codebase:
     * an invisible dimension dot and a stat-card grid stuck at one column.
     * Write the variants out in full and pick between them with a lookup.
     */
    const prefixes =
      'bg|text|border|ring|divide|from|via|to|fill|stroke|shadow|rounded|grid-cols|col-span|row-span|gap|w|h|p[xytblr]?|m[xytblr]?|space-[xy]|opacity|z'
    // Class names start after whitespace or a string delimiter. Matched in JS
    // rather than in the grep pattern: the delimiter set includes a backtick,
    // which would open command substitution inside the shell invocation.
    const pattern = new RegExp(`(^|[\\s'":\`])(${prefixes})-\\$\\{`)

    // Narrow to candidate files with a shell-safe grep, then apply the real
    // pattern to comment-stripped source, so prose explaining the rule (this
    // file, and the two fixes that prompted it) does not trip it.
    const hits = grepSrc('-\\$\\{', '-l').flatMap((file) =>
      stripComments(readFileSync(file, 'utf8'))
        .split('\n')
        .filter((line) => pattern.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    )

    expect(hits).toEqual([])
  })

  it('uses no shadow other than the single overlay token', () => {
    // In-page surfaces are flat by design; depth is reserved for content that
    // genuinely floats. `shadow-md` etc. would quietly reintroduce elevation.
    const hits = grepSrc('\\bshadow-(sm|md|lg|xl|2xl|inner|card|card-hover)\\b')
    expect(hits).toEqual([])
  })
})

describe('tailwind.config.ts holds no design values of its own', () => {
  const config = readFileSync('tailwind.config.ts', 'utf8')

  it('contains no literal hex colour', () => {
    expect(config.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull()
  })

  it('contains no literal rgb() triple', () => {
    // `rgb(var(--x))` is the correct form; `rgb(230 57 70)` is a second source
    // of truth for a colour that globals.css already defines.
    expect(config.match(/rgb\(\s*\d/g)).toBeNull()
  })

  it('references only CSS variables that globals.css actually defines', () => {
    // A typo here yields a utility that renders nothing at all, invisibly:
    // neither tsc nor ESLint can see an unresolvable CSS variable.
    const css = readFileSync('src/app/globals.css', 'utf8')
    const defined = new Set(Array.from(css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm), (m) => m[1]))

    // Injected at runtime by next/font onto <html>, so they are legitimately
    // absent from the stylesheet. @see src/app/fonts.ts (generated by @bitbaum/design-tokens)
    const PROVIDED_BY_NEXT_FONT = ['--font-inter', '--font-mono']
    PROVIDED_BY_NEXT_FONT.forEach((name) => defined.add(name))

    const referenced = Array.from(
      new Set(Array.from(config.matchAll(/var\((--[a-z0-9-]+)\)/g), (m) => m[1])),
    )

    const missing = referenced.filter((name) => !defined.has(name))
    expect(missing).toEqual([])
  })
})

describe('the AOZ palette stays restorable', () => {
  /**
   * CLAUDE.md promises AOZ that switching back is lossless rather than a
   * reconstruction. That promise lives in these exact numbers, so it gets a
   * test rather than a comment.
   */
  const ORIGINAL_AOZ_PALETTE: Record<string, string> = {
    '--color-brand-primary': '230 57 70',
    '--color-brand-primary-light': '236 80 92',
    '--color-brand-primary-dark': '186 34 46',
    '--color-brand-secondary': '25 82 82',
    '--color-brand-secondary-light': '45 112 112',
    '--color-brand-secondary-dark': '17 55 55',
    '--color-brand-accent': '235 244 243',
    '--color-brand-accent-light': '245 249 249',
    '--color-brand-accent-dark': '198 222 220',
    '--color-brand-background': '247 247 248',
    '--color-brand-surface': '255 255 255',
  }

  const css = readFileSync('src/app/globals.css', 'utf8')
  // The default (`:root`) block, up to the first nested/alternate selector.
  const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('/* ── Dark theme'))

  it.each(Object.entries(ORIGINAL_AOZ_PALETTE))('%s is unchanged in :root', (token, expected) => {
    const match = rootBlock.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
    expect(match?.[1].trim()).toBe(expected)
  })
})

describe('the organisation name is never hardcoded in UI copy', () => {
  /**
   * German copy is full of constructions like "AOZ-Regel" and "AOZ Begleitung".
   * Spelled literally they survive a re-badge and the product ends up showing
   * two different organisation names at once.
   */
  const files = execSync(`grep -rl --include=*.tsx --include=*.ts -e "AOZ" src || true`, {
    encoding: 'utf8',
    cwd: process.cwd(),
  })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__'))
    // brand.ts is where the acronym is legitimately spelled out.
    .filter((f) => f !== 'src/lib/config/brand.ts')

  it.each(files)('%s mentions AOZ only in comments', (file) => {
    const code = stripComments(readFileSync(file, 'utf8'))
    const offenders = code
      .split('\n')
      .filter((line) => /\bAOZ\b/.test(line))
      // `aoz-theme` and JWT_ISSUER are deliberate non-branding identifiers.
      // So is `freeChain('AOZ')`: that argument is an ENV-VAR PREFIX, naming
      // AOZ_GROQ_MODELS / AOZ_OPENROUTER_DAILY_TOKENS. Same class as the theme
      // key and the JWT issuer — an operator-facing identifier that must stay
      // stable across a re-badge, never a word any user reads. The rule this
      // gate enforces is about UI COPY; matching the bare token would push the
      // next person to rename an env var to satisfy a lint.
      .filter((line) => !/aoz-theme|aoz-housing|freeChain\('AOZ'\)/.test(line))

    expect(offenders).toEqual([])
  })
})
