import {
  messageAuthor,
  mergeMessageRows,
  isOwnMessage,
  isUnreadFor,
  unreadCountFor,
  messagesToMarkRead,
  isSendableBody,
  MESSAGE_BODY_MAX_LENGTH,
  type MessageRow,
  type MessageParty,
} from '@/lib/messaging/thread'

const resident: MessageParty = { kind: 'resident', residentId: 'res-1' }
const staff: MessageParty = { kind: 'staff', userId: 'user-1' }
const otherStaff: MessageParty = { kind: 'staff', userId: 'user-2' }

function fromResident(over: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'm-res',
    authorResidentId: 'res-1',
    authorUserId: null,
    body: 'Die Heizung ist kalt.',
    createdAt: new Date('2026-08-16T09:00:00Z'),
    readAt: null,
    ...over,
  }
}

function fromStaff(over: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'm-staff',
    authorResidentId: null,
    authorUserId: 'user-1',
    body: 'Wir schauen es an.',
    createdAt: new Date('2026-08-16T10:00:00Z'),
    readAt: null,
    ...over,
  }
}

describe('authorship', () => {
  it('sets exactly one author column', () => {
    expect(messageAuthor(resident)).toEqual({ authorResidentId: 'res-1', authorUserId: null })
    expect(messageAuthor(staff)).toEqual({ authorResidentId: null, authorUserId: 'user-1' })
  })

  it('recognises your own message', () => {
    expect(isOwnMessage(fromResident(), resident)).toBe(true)
    expect(isOwnMessage(fromStaff(), staff)).toBe(true)
  })

  it('does not mistake the other side for you', () => {
    expect(isOwnMessage(fromStaff(), resident)).toBe(false)
    expect(isOwnMessage(fromResident(), staff)).toBe(false)
  })

  it('treats the staff team as one side, not as individuals', () => {
    // A second caseworker opening the thread is still "staff". If their
    // colleague's reply counted as unread to them, every handover would
    // resurface answered messages as new work.
    expect(isOwnMessage(fromStaff({ authorUserId: 'user-1' }), otherStaff)).toBe(false)
    expect(isUnreadFor(fromStaff({ authorUserId: 'user-1' }), otherStaff)).toBe(true)
  })
})

describe('unread', () => {
  it('counts the other side’s unread messages', () => {
    expect(isUnreadFor(fromStaff(), resident)).toBe(true)
    expect(isUnreadFor(fromResident(), staff)).toBe(true)
  })

  it('never counts your own message as unread to you', () => {
    // The bug this prevents is a badge nobody can clear: staff reply, and then
    // see "1 unread" pointing at their own words.
    expect(isUnreadFor(fromStaff(), staff)).toBe(false)
    expect(isUnreadFor(fromResident(), resident)).toBe(false)
  })

  it('stops counting once read', () => {
    expect(isUnreadFor(fromStaff({ readAt: new Date() }), resident)).toBe(false)
  })

  it('counts across a whole thread from each side', () => {
    const thread = [
      fromResident({ id: 'a', readAt: new Date() }),
      fromStaff({ id: 'b' }),
      fromStaff({ id: 'c' }),
      fromResident({ id: 'd' }),
    ]

    expect(unreadCountFor(thread, resident)).toBe(2)
    expect(unreadCountFor(thread, staff)).toBe(1)
  })

  it('is zero for an empty thread', () => {
    expect(unreadCountFor([], resident)).toBe(0)
  })
})

describe('marking read', () => {
  it('marks only the other side’s unread messages', () => {
    const thread = [
      fromResident({ id: 'a' }),
      fromStaff({ id: 'b' }),
      fromStaff({ id: 'c', readAt: new Date() }),
    ]

    // Never the resident's own 'a' — overwriting your own readAt would destroy
    // the only record of whether the OTHER side has seen it.
    expect(messagesToMarkRead(thread, resident)).toEqual(['b'])
  })

  it('returns nothing when there is nothing to mark', () => {
    expect(messagesToMarkRead([fromResident()], resident)).toEqual([])
  })
})

describe('what may be sent', () => {
  it('rejects an empty or whitespace-only body', () => {
    expect(isSendableBody('')).toBe(false)
    expect(isSendableBody('   \n  ')).toBe(false)
  })

  it('accepts ordinary text', () => {
    expect(isSendableBody('Die Heizung ist kalt.')).toBe(true)
  })

  it('rejects a body past the limit, measured after trimming', () => {
    expect(isSendableBody('a'.repeat(MESSAGE_BODY_MAX_LENGTH))).toBe(true)
    expect(isSendableBody('a'.repeat(MESSAGE_BODY_MAX_LENGTH + 1))).toBe(false)
    expect(isSendableBody(`  ${'a'.repeat(MESSAGE_BODY_MAX_LENGTH)}  `)).toBe(true)
  })
})

describe('ThreadKit reconciliation adapter', () => {
  it('replaces an optimistic row once and preserves confirmed author/read metadata', () => {
    const pending = fromStaff({ id: 'pending-a', clientId: 'pending-a' })
    const confirmed = fromStaff({
      id: 'saved-a',
      clientId: 'pending-a',
      authorUserId: 'user-2',
      readAt: new Date('2026-08-16T11:00:00Z'),
    })
    const merged = mergeMessageRows('thread-1', [pending], [confirmed])
    expect(merged).toEqual([confirmed])
    expect(mergeMessageRows('thread-1', merged, [confirmed])).toEqual([confirmed])
    expect(pending.id).toBe('pending-a')
  })

  it('orders out-of-order arrivals oldest first with a stable tie break', () => {
    const late = fromStaff({ id: 'late' })
    const first = fromResident({ id: 'a' })
    const second = fromResident({ id: 'b' })
    const existing = [late, second]
    expect(mergeMessageRows('thread-1', existing, [first]).map((row) => row.id)).toEqual([
      'a',
      'b',
      'late',
    ])
    expect(existing.map((row) => row.id)).toEqual(['late', 'b'])
  })
})
