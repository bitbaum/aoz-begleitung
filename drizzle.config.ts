import { defineConfig } from 'drizzle-kit'

// Fleet house pattern (see reparaturbonus-zh, vitareba). Migrations in
// ./drizzle are applied two ways:
//   - fresh databases (dev, CI service containers): `npm run db:migrate`
//     (drizzle-kit's own journal)
//   - the live box: loki's scripts/hetzner/apply-schema.sh on every
//     deploy — forward-only, ledgered in public._deploy_schema_history,
//     refuses destructive statements
export default defineConfig({
  schema: ['./src/lib/db/schema.ts', './src/lib/db/relations.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
