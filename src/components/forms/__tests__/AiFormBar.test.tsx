/**
 * Words that touch only through a CSS margin are ONE word to copy, search and
 * screen readers. Live 2026-10-02 the opportunity form's heading read
 * "KI · TestbetriebAus einem Inserat ausfüllen". textContent is what those
 * readers get; a screenshot cannot show this.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { UseAiForm } from '@fleet/ai-forms/react'
import { AiFormBar } from '../AiFormBar'

vi.mock('next/link', async () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const form = {
  isEmpty: true,
  busy: false,
  suggesting: false,
  canUndo: false,
  suggestions: [],
  changed: [],
  applySuggestion: vi.fn(),
  error: null,
  ask: vi.fn(),
  suggest: vi.fn(),
  undo: vi.fn(),
} as unknown as UseAiForm

describe('AiFormBar heading', () => {
  it('keeps the AI badge and the title two phrases', () => {
    render(<AiFormBar form={form} fillTitle="Aus einem Inserat ausfüllen" />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toMatch(/Testbetrieb\s+Aus einem Inserat/)
  })

  it('gives the badge link a 44px hit area', () => {
    render(<AiFormBar form={form} fillTitle="Aus einem Inserat ausfüllen" />)
    const link = screen.getByRole('link', { name: /Testbetrieb/ })
    expect(link.className).toContain('min-h-[44px]')
  })
})
