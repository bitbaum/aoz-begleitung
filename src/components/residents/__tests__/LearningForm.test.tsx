import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LearningForm } from '../LearningForm'
import { STAFF_LEARNING_FORM_COPY } from '@/lib/config/learning'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'

vi.mock('next/navigation', async () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('LearningForm', () => {
  it('opens a language test with NO level chosen, and requires one', () => {
    // It opened on «A1»: every test saved through it read «DE A1» whether or
    // not anyone chose A1.
    render(<LearningForm action={vi.fn()} copy={STAFF_LEARNING_FORM_COPY} />)
    fireEvent.change(screen.getByLabelText(STAFF_LEARNING_FORM_COPY.kind), {
      target: { value: 'LANGUAGE_TEST' },
    })

    const level = screen.getByLabelText(STAFF_LEARNING_FORM_COPY.cefr) as HTMLSelectElement
    expect(level.value).toBe('')
    expect(level).toBeRequired()
    const language = screen.getByLabelText(STAFF_LEARNING_FORM_COPY.language) as HTMLSelectElement
    expect(language.value).toBe('')
    expect(language).toBeRequired()
  })

  it('opens an existing record with its own values for editing', () => {
    render(
      <LearningForm
        action={vi.fn()}
        copy={STAFF_LEARNING_FORM_COPY}
        initial={{
          id: 'rec-1',
          kind: 'LANGUAGE_TEST',
          title: 'fide',
          status: 'COMPLETED',
          languageCode: 'DE',
          cefrLevel: 'B1',
          provider: null,
          category: 'language',
          hours: null,
          startedAt: null,
          completedAt: '2026-05-01T00:00:00.000Z',
          notes: null,
        }}
      />,
    )
    expect((screen.getByLabelText(STAFF_LEARNING_FORM_COPY.cefr) as HTMLSelectElement).value).toBe(
      'B1',
    )
    expect(
      (screen.getByLabelText(STAFF_LEARNING_FORM_COPY.completedAt) as HTMLInputElement).value,
    ).toBe('2026-05-01')
  })
})

describe('LocaleProvider', () => {
  it('puts the reader’s language and direction on <html>, and restores them after', () => {
    document.documentElement.lang = 'de'
    document.documentElement.dir = ''
    const { unmount } = render(
      <LocaleProvider locale="ar">
        <p>نص</p>
      </LocaleProvider>,
    )
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    unmount()
    expect(document.documentElement.lang).toBe('de')
    expect(document.documentElement.dir).toBe('')
  })
})
