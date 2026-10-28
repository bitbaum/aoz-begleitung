/** Shared AccountKit hashing; legacy bcrypt hashes remain readable. */
import bcrypt from 'bcryptjs'
import { createPasswordHasher } from '@bitbaum/accountkit/auth/hash'

const passwords = createPasswordHasher(bcrypt)

export async function hashPassword(password: string): Promise<string> {
  return passwords.hash(password)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await passwords.verify(password, hash)).valid
}
