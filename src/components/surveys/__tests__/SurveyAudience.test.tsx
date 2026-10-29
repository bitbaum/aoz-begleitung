import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { SendSurveyForm } from '../SurveyForms'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/actions/surveys', () => ({
  sendSurvey: vi.fn(async () => ({})),
  createSurvey: vi.fn(async () => ({})),
  closeSurvey: vi.fn(async () => ({})),
}))

test('a picked recipient stays in the submission while a typo search shows another person', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <SendSurveyForm
      surveyId="synthetic-survey"
      isDraft={false}
      groups={[]}
      clients={[
        { id: 'synthetic-a', name: 'Müller' },
        { id: 'synthetic-b', name: 'Schneider' },
      ]}
    />,
  )
  await user.click(screen.getByRole('checkbox', { name: 'Müller' }))
  await user.type(screen.getByRole('searchbox'), 'Schneidre')
  expect(screen.queryByRole('checkbox', { name: 'Müller' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: 'Schneider' }))
  const form = container.querySelector('form')!
  expect(new FormData(form).getAll('residentIds')).toEqual(['synthetic-a', 'synthetic-b'])
  await user.clear(screen.getByRole('searchbox'))
  await user.click(screen.getByRole('checkbox', { name: 'Müller' }))
  expect(new FormData(form).getAll('residentIds')).toEqual(['synthetic-b'])
})
