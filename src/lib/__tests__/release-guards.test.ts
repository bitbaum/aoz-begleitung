import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()

function read(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('release guards', () => {
  it('does not ship a hardcoded resident activity catalog', () => {
    const activityConfig = read('src/lib/config/activities.ts')

    expect(activityConfig).not.toContain('export const ACTIVITIES')
    expect(activityConfig).not.toContain('https://www.stadt-zuerich.ch')
    expect(activityConfig).not.toContain('GZ Wipkingen')
  })

  it('does not hardcode demo credentials in the production login page', () => {
    const loginPage = read('src/app/(auth)/login/page.tsx')

    expect(loginPage).not.toContain('RES-001')
    expect(loginPage).not.toContain('RES-DEMO')
    expect(loginPage).not.toContain('AOZ-ADMIN1')
    expect(loginPage).not.toContain('NEXT_PUBLIC_DEMO_ACCESS_ENABLED')
    // The public one-click quick access into real staff accounts is gone for
    // good (2026-10-21). Colleagues claim their account via a personal link.
    expect(loginPage).not.toContain('/api/auth/demo')
    expect(existsSync(join(root, 'src/app/api/auth/demo/route.ts'))).toBe(false)
  })
})
