/**
 * Small cross-cutting helpers the Prisma client used to provide implicitly.
 */
import { DatabaseError } from 'pg'
import { escapeLike as sharedEscapeLike } from '@bitbaum/listkit'

/**
 * Postgres unique-constraint violation (SQLSTATE 23505) — what Prisma
 * surfaced as `PrismaClientKnownRequestError` with code `P2002`.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof DatabaseError && error.code === '23505') return true
  // drizzle-orm >= 0.44 wraps driver errors in DrizzleQueryError with the
  // original pg error on `cause`.
  if (error instanceof Error && error.cause !== undefined) {
    return isUniqueViolation(error.cause)
  }
  return false
}

/**
 * Escape LIKE/ILIKE wildcards in user input so a search for "100%" matches
 * the literal string. Prisma's `contains` escaped these internally.
 */
export function escapeLike(value: string): string {
  return sharedEscapeLike(value)
}
