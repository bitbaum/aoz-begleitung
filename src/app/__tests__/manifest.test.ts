import { describe, expect, it } from 'vitest'
import manifest from '../manifest'
import { BRAND } from '@/lib/config/brand'
import { APP_LABELS } from '@/lib/constants/labels'

/**
 * QA, 12 Nov 2026: the public name is "AOZ", but the tab said "AOZ Begleitung
 * — Integrationsplattform" and the manifest "AOZ Wohnraumverwaltung". Every
 * public name now reads one field.
 */
describe('the public name comes from BRAND', () => {
  it('names the install manifest from the brand', () => {
    const m = manifest()
    expect(m.name).toBe(BRAND.productName)
    expect(m.short_name).toBe(BRAND.shortName)
    expect(m.description).toBe(BRAND.metaDescription)
  })

  it('titles and the og:site_name read the same name', () => {
    expect(APP_LABELS.name).toBe(BRAND.productName)
    expect(APP_LABELS.metaTitle.startsWith(BRAND.productName)).toBe(true)
  })

  it('is just "AOZ" for the AOZ brand', () => {
    if (BRAND.id !== 'aoz') return
    expect(BRAND.productName).toBe('AOZ')
    expect(APP_LABELS.metaTitle).not.toContain('Begleitung')
  })
})
