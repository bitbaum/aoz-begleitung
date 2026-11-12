import { readFileSync } from 'fs'
import { join } from 'path'
import { PUBLIC_ROUTES } from '@/lib/auth/route-boundaries'
import { AI_PROVIDERS_TODAY } from '../ai-disclosure'
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

  it('both are linked from the sign-in screens', () => {
    const shell = readFileSync(join(process.cwd(), 'src/components/auth/AuthShell.tsx'), 'utf8')
    expect(shell).toContain('IMPRESSUM_HREF')
    expect(shell).toContain('PRIVACY_HREF')
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
})
