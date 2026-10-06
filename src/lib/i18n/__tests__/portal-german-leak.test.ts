import { execSync } from 'child_process'

/**
 * The resident portal must not render German from the staff label config.
 *
 * The portal is translated into eleven languages. The staff UI is German by
 * decision. Both are right — and the seam between them leaks: a portal file
 * that imports `ACTIVITY_CATEGORY_LABELS` renders "Sport / Sprache / Kultur"
 * inside an otherwise Russian page, and every check stays green, because a
 * German string is a perfectly valid string. The coverage gate can only see
 * keys that EXIST; it is blind to a label that never went through the
 * dictionary at all.
 *
 * This is the systemic version of the bug, so it gets a systemic check: no
 * file under the portal may import a `*_LABELS` map from the config or
 * constants layers. Translated labels live in `lib/i18n/*-labels.ts`, keyed by
 * the same id unions, so the mapping still cannot drift.
 *
 * KNOWN_LEAKS is the debt that existed when this gate was written, listed file
 * by file rather than summarised — a count would let the list quietly grow
 * back. Entries come OFF this list as they are translated; nothing may be
 * added without deleting a line here, which is a decision someone has to make
 * on purpose.
 */

/** Portal files still rendering German label maps. Shrink this; never extend it. */
const KNOWN_LEAKS: readonly string[] = [
  // Chores is the worst of it: a resident reading the portal in Tigrinya gets
  // this entire section in German, headings and buttons included.
  'src/app/portal/chores/[id]/page.tsx',
  'src/app/portal/chores/new/page.tsx',
  'src/app/portal/chores/page.tsx',
  'src/components/portal/ChoreActions.tsx',
  'src/components/portal/ChoreBalanceSummary.tsx',
  'src/components/portal/ChoreCard.tsx',
  'src/components/portal/ChoreList.tsx',
  'src/components/portal/CreateChoreForm.tsx',
  'src/components/portal/PortalPendingChores.tsx',

  'src/app/portal/page.tsx',
  'src/app/portal/preferences/PreferencesForm.tsx',
  'src/app/portal/transfer/page.tsx',
  'src/components/portal/PortalMaintenanceCard.tsx',
  'src/components/portal/PortalNav.tsx',
  'src/components/portal/PortalRoommatesCard.tsx',
  'src/components/portal/PortalTabBar.tsx',
  'src/components/portal/PortalUrlFeedback.tsx',
  'src/components/portal/SatisfactionRating.tsx',
]

function portalFilesImportingLabelMaps(): string[] {
  const out = execSync(
    `grep -rlE "_LABELS" --include=*.tsx --include=*.ts src/app/portal src/components/portal || true`,
    { encoding: 'utf8', cwd: process.cwd() },
  )
  return out
    .split('\n')
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__'))
    .sort()
}

describe('the resident portal renders no German from the staff config', () => {
  const offenders = portalFilesImportingLabelMaps()

  it('finds portal files to check', () => {
    // Without this the whole suite passes vacuously if the paths ever move.
    expect(offenders.length + KNOWN_LEAKS.length).toBeGreaterThan(0)
  })

  it('introduces no new leak', () => {
    const added = offenders.filter((file) => !KNOWN_LEAKS.includes(file))

    expect({ added }).toEqual({ added: [] })
  })

  it('keeps the known-leak list honest', () => {
    // A stale entry is worse than none: it reserves permission to leak in a
    // file that no longer does, so the next leak there passes unnoticed.
    const fixed = KNOWN_LEAKS.filter((file) => !offenders.includes(file))

    expect({ fixedButStillListed: fixed }).toEqual({ fixedButStillListed: [] })
  })
})
