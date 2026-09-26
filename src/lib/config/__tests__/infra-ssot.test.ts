import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Guards the failure mode that sent an agent at a dead cloud host: tracked
 * env templates and the db client module describing production as a pooler,
 * or naming the wrong database. Docs may name the decommissioned host as a
 * negative example so a search for it finds "that is stale".
 */

const ROOT = resolve(__dirname, '../../../../')

function read(relative: string) {
  return readFileSync(resolve(ROOT, relative), 'utf8')
}

describe('production is Hetzner Postgres, not a cloud pooler', () => {
  it('does not put a cloud-pooler host in the env template or db client', () => {
    for (const file of ['.env.example', 'src/lib/db/index.ts'] as const) {
      const text = read(file)
      expect({ file, hasNeonHost: /neon\.tech|neondb|@neondatabase/.test(text) }).toEqual({
        file,
        hasNeonHost: false,
      })
    }
  })

  it('documents the live database name and host', () => {
    const infra = read('docs/INFRASTRUCTURE.md')
    expect(infra).toMatch(/aoz_wohnen/)
    expect(infra).toMatch(/Hetzner/)
    expect(infra).toMatch(/167\.233\.22\.31/)
    expect(infra).toMatch(/\/opt\/aoz-wohnen/)
  })

  it('gives .env.example the production database name on self-hosted Postgres', () => {
    const example = read('.env.example')
    expect(example).toMatch(/Hetzner/)
    expect(example).toMatch(/aoz_wohnen/)
    expect(example).not.toMatch(/aoz_housing"/)
  })

  it('tells CLAUDE.md and README the live host before they mention a database URL', () => {
    for (const file of ['CLAUDE.md', 'README.md'] as const) {
      const text = read(file)
      expect(text).toMatch(/aoz_wohnen/)
      expect(text).toMatch(/Hetzner/)
      expect(text).not.toMatch(/postgresql:\/\/[^\s]*neon/i)
    }
  })
})

describe('i18n stays on the resident portal', () => {
  it('does not mount LocaleProvider or LanguageSwitcher on the staff shell', () => {
    const layout = read('src/app/(admin)/layout.tsx')
    expect(layout).not.toMatch(/LocaleProvider/)
    expect(layout).not.toMatch(/LanguageSwitcher/)
  })
})

describe('a failed deploy is retried', () => {
  it('tells auto-merge to reconcile deploy.yml against master', () => {
    const yml = read('.github/workflows/auto-merge.yml')
    expect(yml).toMatch(/deploy_workflow:\s*deploy\.yml/)
  })
})

describe('the demo lives on the main site', () => {
  // A separate demo app (aoz-demo) ran for one day and was retired on
  // 2026-09-26: the demo is invented rows on the main site, cleaned nightly by
  // the scoped reset. Only one app is deployed.
  const yml = read('.github/workflows/deploy.yml')

  it('deploys production only', () => {
    expect(yml).toMatch(/app:\s*aoz-wohnen/)
    expect(yml).not.toMatch(/app:\s*aoz-demo/)
  })

  it('keeps the old hand-rolled demo deploy path gone', () => {
    expect(() => read('scripts/deploy-demo.sh')).toThrow()
    expect(() => read('.github/workflows/deploy-demo.yml')).toThrow()
  })
})
