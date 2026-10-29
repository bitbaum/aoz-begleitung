import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StaffReplyThread } from '../StaffReplyThread'
import { MessageThreadView } from '@/components/portal/MessageThread'

vi.mock('@/lib/i18n/LocaleProvider', () => ({ useT: () => (key: string) => key }))
const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
beforeAll(() =>
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  }),
)
afterAll(() => {
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})
afterEach(() => vi.unstubAllGlobals())

it.each(['staff', 'resident'] as const)(
  'reconciles the %s optimistic bubble with its confirmed row',
  async (party) => {
    let confirm!: (response: Response) => void
    const request = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          confirm = resolve
        }),
    )
    vi.stubGlobal('fetch', request)
    if (party === 'staff')
      render(<StaffReplyThread threadId="thread-1" residentId="resident-1" initialMessages={[]} />)
    else render(<MessageThreadView threadId="thread-1" initialMessages={[]} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Eine Nachricht.' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getAllByText('Eine Nachricht.')).toHaveLength(1)
    expect(request).toHaveBeenCalledTimes(1)
    confirm(
      Response.json({
        success: true,
        data: {
          message: {
            id: 'server-message',
            body: 'Eine Nachricht.',
            createdAt: '2026-08-16T11:00:00Z',
            readAt: null,
            authorResidentId: party === 'resident' ? 'resident-1' : null,
            authorUserId: party === 'staff' ? 'staff-1' : null,
          },
        },
      }),
    )
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())
    await waitFor(() =>
      expect(input.closest('form')?.querySelector('button')).toHaveTextContent(
        party === 'staff' ? 'Senden' : 'messages.send',
      ),
    )
    expect(screen.getAllByText('Eine Nachricht.')).toHaveLength(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  },
)
