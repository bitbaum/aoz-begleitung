/**
 * Quick access configuration (SSOT).
 *
 * The site is fully real (decided by George 2026-10-01). There is no invented
 * world and no nightly reset. What /login offers instead is a set of one-click
 * buttons that sign in as NAMED REAL staff accounts, so the team can use the
 * product before anyone has to bother with registration. Each of those people
 * can later claim their account at /register with their code (email +
 * password), exactly like a placeholder resident claims a profile.
 *
 * Every switch here is server-side and per deployment. The login page asks
 * GET /api/auth/demo which doors exist, so a button appears only where
 * pressing it can succeed.
 *
 * History: until 2026-10-01 this was `lib/demo/config.ts` and served an
 * invented demo world (demo-prefixed residents, DEMO- flats, generated demo
 * staff accounts) that a nightly job deleted and re-seeded. That world was
 * removed at the owner's request.
 *
 * Relative-import-safe (no '@/' aliases).
 */

/** Where "Produkt ansehen" goes: this site's own quick-access buttons. */
export function quickAccessHref(): string {
  return '/login#demo'
}

/**
 * Master switch — `QUICK_ACCESS_ENABLED=true`, or the older name
 * `DEMO_ACCESS_ENABLED=true`, which the live box still sets. Reading both keeps
 * production working across the rename.
 */
export function isQuickAccessEnabled(): boolean {
  return process.env.QUICK_ACCESS_ENABLED === 'true' || process.env.DEMO_ACCESS_ENABLED === 'true'
}

/**
 * The real staff codes offered as buttons, in the order configured
 * (`QUICK_ACCESS_STAFF_CODES=AOZ-AAAAAA,AOZ-BBBBBB`). Codes are trimmed and
 * uppercased like every login code; blanks and duplicates are dropped.
 */
export function quickAccessStaffCodes(): string[] {
  const raw = process.env.QUICK_ACCESS_STAFF_CODES ?? ''
  const codes = raw
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0)
  return [...new Set(codes)]
}

/**
 * The resident behind the client button, or null when none is configured
 * (`DEMO_RESIDENT_CODE`). The route additionally requires that resident to be
 * an unclaimed placeholder.
 */
export function quickAccessResidentCode(): string | null {
  const code = process.env.DEMO_RESIDENT_CODE?.trim().toUpperCase()
  return code ? code : null
}

/**
 * The name a quick-access button shows: first name and last initial
 * («Simon Berger» → «Simon B.»). The button sits on a public page, so it
 * names the person enough to be recognised by colleagues and no further. A
 * single-word name is shown as it is.
 */
export function quickAccessName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? ''
  const last = parts[parts.length - 1]
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`
}
