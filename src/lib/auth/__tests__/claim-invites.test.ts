import { CLAIM_INVITE_TTL_MS, claimPath, hashClaimToken } from '../claim-invites'

describe('claim-invites helpers', () => {
  it('expires after 14 days', () => {
    expect(CLAIM_INVITE_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000)
  })
  it('stores a SHA-256 hash, never the raw token', () => {
    const hash = hashClaimToken('abc')
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain('abc')
    expect(hashClaimToken('abc')).toBe(hash)
  })
  it('builds the public claim path', () => {
    expect(claimPath('a b')).toBe('/claim?token=a%20b')
  })
})
