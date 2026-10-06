import {
  cancellationRecipients,
  clientSeesEvent,
  eventUnitOptions,
  mayDeleteEvent,
} from '../events'

describe('a cancelled event does not vanish from the people who were coming', () => {
  const event = (status: string) => ({
    status,
    rsvps: [
      { residentId: 'going', status: 'GOING' as const },
      { residentId: 'maybe', status: 'MAYBE' as const },
      { residentId: 'no', status: 'DECLINED' as const },
    ],
  })

  it('shows a live event to everyone', () => {
    expect(clientSeesEvent(event('PUBLISHED'), 'stranger')).toBe(true)
  })

  it('keeps a cancelled event, marked, for those who said yes or maybe', () => {
    expect(clientSeesEvent(event('CANCELLED'), 'going')).toBe(true)
    expect(clientSeesEvent(event('CANCELLED'), 'maybe')).toBe(true)
  })

  it('drops it for everyone else', () => {
    expect(clientSeesEvent(event('CANCELLED'), 'no')).toBe(false)
    expect(clientSeesEvent(event('CANCELLED'), 'stranger')).toBe(false)
  })

  it('messages exactly the people who said «Ich komme», once each', () => {
    expect(
      cancellationRecipients([
        ...event('PUBLISHED').rsvps,
        { residentId: 'going', status: 'GOING' as const },
      ]),
    ).toEqual(['going'])
  })

  it('lets only a cancelled event be deleted', () => {
    expect(mayDeleteEvent({ status: 'CANCELLED' })).toBe(true)
    expect(mayDeleteEvent({ status: 'PUBLISHED' })).toBe(false)
  })
})

describe('the staff unit picker is something a person can choose from', () => {
  const units = [
    {
      id: 'c',
      code: 'WIT-426-10',
      nickname: null,
      address: 'Witikonerstrasse 426',
      activePlacements: 0,
    },
    {
      id: 'a',
      code: 'WIT-426-02',
      nickname: 'Singapur',
      address: 'Witikonerstrasse 426',
      activePlacements: 2,
    },
    {
      id: 'b',
      code: 'WIT-426-01',
      nickname: null,
      address: 'Witikonerstrasse 426',
      activePlacements: 0,
    },
  ]

  it('puts lived-in units first and names each beyond its code', () => {
    const options = eventUnitOptions(units)
    expect(options.occupied).toEqual([
      { id: 'a', label: 'WIT-426-02 · Singapur · Witikonerstrasse 426' },
    ])
    // Natural order: 01 before 10.
    expect(options.empty.map((unit) => unit.id)).toEqual(['b', 'c'])
    expect(options.empty[0].label).toBe('WIT-426-01 · Witikonerstrasse 426')
  })
})
