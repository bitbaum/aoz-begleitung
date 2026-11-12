/* Runs ON THE BOX inside the deployed release (has `pg`). Inserts a claim
 * invite for one active staff member, given only the SHA-256 HASH of the
 * token. The raw token never leaves the machine of whoever generated it, so
 * nothing usable appears in (public) Actions logs.
 *
 * The staff member is named by USER ID and the log prints only that id: the
 * Actions log is public, and a name printed there is published.
 *
 * env: DATABASE_URL, STAFF_USER_ID, TOKEN_HASH
 */
const { Client } = require('pg')
const { randomUUID } = require('crypto')

async function main() {
  const userId = (process.env.STAFF_USER_ID || '').trim()
  const hash = (process.env.TOKEN_HASH || '').trim()
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(userId)) throw new Error('STAFF_USER_ID must be a user id')
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('TOKEN_HASH must be 64 hex chars')

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const users = await client.query(
      'SELECT u.id, a."passwordHash" IS NOT NULL AS claimed FROM "User" u LEFT JOIN "Account" a ON a."userId" = u.id WHERE u.active AND u.id = $1',
      [userId],
    )
    if (users.rowCount !== 1) throw new Error(`no active staff member with id ${userId}`)
    const target = users.rows[0]
    if (target.claimed) throw new Error(`user ${target.id} has already claimed their account`)
    await client.query('BEGIN')
    await client.query(
      'UPDATE "ClaimInvite" SET "revokedAt" = now() WHERE "userId" = $1 AND "usedAt" IS NULL AND "revokedAt" IS NULL',
      [target.id],
    )
    const res = await client.query(
      'INSERT INTO "ClaimInvite" (id, "tokenHash", "userId", "expiresAt") VALUES ($1, $2, $3, now() + interval \'14 days\') RETURNING "expiresAt"',
      [randomUUID().replace(/-/g, ''), hash, target.id],
    )
    await client.query('COMMIT')
    console.log(
      `claim invite stored for user ${target.id}; expires ${res.rows[0].expiresAt.toISOString()}`,
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(`::error::${error.message}`)
  process.exit(1)
})
