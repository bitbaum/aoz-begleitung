import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword, verifyPassword } from '../passwords'

describe('shared password hashing', () => {
  it("checks the entire long Unicode password rather than bcrypt's first 72 bytes", async () => {
    const prefix = 'ä'.repeat(40)
    const stored = await hashPassword(`${prefix}one`)
    expect(await verifyPassword(`${prefix}one`, stored)).toBe(true)
    expect(await verifyPassword(`${prefix}two`, stored)).toBe(false)
  })

  it('keeps existing plain bcrypt passwords readable', async () => {
    const stored = await bcrypt.hash('existing-password', 4)
    expect(await verifyPassword('existing-password', stored)).toBe(true)
    expect(await verifyPassword('wrong-password', stored)).toBe(false)
  })
})
