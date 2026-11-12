import { readFileSync } from 'fs'
import { join } from 'path'
import { PUBLIC_ROUTES } from '@/lib/auth/route-boundaries'
import { AI_DISCLOSURE_COPY, AI_PROVIDERS_TODAY } from '../ai-disclosure'
import {
  IMPRESSUM_COPY,
  IMPRESSUM_HREF,
  OPERATOR,
  PRIVACY_COPY,
  PRIVACY_HREF,
  PROCESSORS,
  PROCESSORS_SECTION_ID,
} from '../legal'

/**
 * The legal pages exist, are reachable without an account, and stay in step
 * with the code they describe.
 */
describe('legal pages', () => {
  const text = (copy: { sections: readonly { paragraphs: readonly string[] }[] }) =>
    copy.sections.flatMap((section) => section.paragraphs).join(' ')

  it('both are readable without an account', () => {
    expect(PUBLIC_ROUTES).toContain(IMPRESSUM_HREF)
    expect(PUBLIC_ROUTES).toContain(PRIVACY_HREF)
  })

  it('both are linked from the public footer', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/(public)/layout.tsx'), 'utf8')
    expect(layout).toContain('IMPRESSUM_HREF')
    expect(layout).toContain('PRIVACY_HREF')
  })

  it('both name the operator contact', () => {
    expect(text(IMPRESSUM_COPY)).toContain(OPERATOR.email)
    expect(text(PRIVACY_COPY)).toContain(OPERATOR.email)
  })

  it('the privacy statement lists every AI provider the disclosure names', () => {
    const listed = PROCESSORS.map((processor) => processor.name)
    for (const provider of AI_PROVIDERS_TODAY) expect(listed).toContain(provider.name)
  })

  it('the processor list has a section to render under', () => {
    expect(PRIVACY_COPY.sections.map((section) => section.id)).toContain(PROCESSORS_SECTION_ID)
  })

  it('the feedback widget loads only where the privacy statement says it does', () => {
    const publicLayout = readFileSync(join(process.cwd(), 'src/app/(public)/layout.tsx'), 'utf8')
    expect(publicLayout).toContain('loki.orangecat.ch/widget.js')
    for (const gated of [
      'src/app/(admin)/layout.tsx',
      'src/app/portal/layout.tsx',
      'src/app/layout.tsx',
    ]) {
      expect(readFileSync(join(process.cwd(), gated), 'utf8')).not.toContain('widget.js')
    }
  })

  it('says what the signed-in area really holds and how an account really starts', () => {
    // Found 2026-11-12: the statement claimed accounts exist only by invitation
    // while the live sign-in offers open sign-up, and it left out the health,
    // insurance and permit data the product stores.
    const privacy = text(PRIVACY_COPY)
    expect(privacy).not.toMatch(/Konto entsteht nur/)
    for (const word of ['Krankenversicherung', 'Aufenthaltsausweis', 'medizinische Geräte']) {
      expect(privacy).toContain(word)
    }
  })

  it('discloses that the feedback window can record voice and uses AI', () => {
    const privacy = text(PRIVACY_COPY)
    expect(privacy).toMatch(/Mikrofon/)
    expect(privacy).toMatch(/KI/)
  })

  it('never calls real data a placeholder', () => {
    // The instance holds real data only; the AI page called the AI a
    // placeholder that would be switched off "before real data" is used.
    const ai = JSON.stringify(AI_DISCLOSURE_COPY)
    expect(ai).not.toMatch(/Platzhalter|placeholders/)
    expect(ai).not.toMatch(/bevor echte Daten|before real data/i)
  })
})
