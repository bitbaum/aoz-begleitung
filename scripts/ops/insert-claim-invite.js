/* Runs ON THE BOX inside the deployed release (has `pg`). Inserts a claim
 * invite for one active staff member, given only the SHA-256 HASH of the
 * token. The raw token never leaves the machine of whoever generated it, so
 * nothing usable appears in (public) Actions logs.
 *
 * env: DATABASE_URL, STAFF_NAME, TOKEN_HASH
 */
const { Client } = require('pg')
const { randomUUID } = require('crypto')

async function main() {
  const name = (process.env.STAFF_NAME || '').trim()
  const hash = (process.env.TOKEN_HASH || '').trim()
  if (!name) throw new Error('STAFF_NAME required')
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('TOKEN_HASH must be 64 hex chars')

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const base =
      'SELECT u.id, u.name, a."passwordHash" IS NOT NULL AS claimed FROM "User" u LEFT JOIN "Account" a ON a."userId" = u.id WHERE u.active AND '
    let users = await client.query(base + 'lower(u.name) = lower($1)', [name])
    // Fall back to a unique prefix ("Simon B" → the one active Simon B…).
    if (users.rowCount === 0) {
      users = await client.query(base + "lower(u.name) LIKE lower($1) || '%'", [name])
    }
    if (users.rowCount !== 1)
      throw new Error(`expected exactly 1 active staff named "${name}", found ${users.rowCount}`)
    const target = users.rows[0]
    if (target.claimed) throw new Error(`${target.name} has already claimed their account`)
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
      `claim invite stored for ${target.name}; expires ${res.rows[0].expiresAt.toISOString()}`,
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(`::error::${error.message}`)
  process.exit(1)
})
