import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

// No write mode yet: full credential/provisioning and session parity must ship
// together before this import may become a production cutover operation.
if (process.argv.length > 2) throw new Error('This command only supports rollback rehearsals')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
const client = await pool.connect().catch(async () => {
  console.error('Account import rehearsal could not connect')
  await pool.end()
  process.exit(1)
})
try {
  await client.query('BEGIN')
  await client.query("SET LOCAL lock_timeout = '5s'")
  await client.query("SET LOCAL statement_timeout = '30s'")
  await client.query(
    await readFile(fileURLToPath(new URL('./accountkit-import.sql', import.meta.url)), 'utf8'),
  )
  const { rows } = await client.query(`
    SELECT count(*)::int AS identities,
      count(*) FILTER (WHERE legacy_id IS NOT NULL)::int AS legacy_accounts,
      count(*) FILTER (WHERE password IS NOT NULL)::int AS password_accounts,
      count(*) FILTER (WHERE staff_id IS NOT NULL AND resident_id IS NOT NULL)::int AS dual_identities,
      count(*) FILTER (WHERE legacy_id IS NULL)::int AS code_only_identities
    FROM aoz_accountkit_source
  `)
  await client.query('ROLLBACK')
  console.log(JSON.stringify({ rehearsal: 'rolled_back', ...rows[0] }))
} catch {
  await client.query('ROLLBACK')
  // PostgreSQL constraint errors may contain addresses or credential values.
  // Keep operational output fixed; diagnose conflicts through authorized DB access.
  console.error('Account import rehearsal failed; transaction rolled back')
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
