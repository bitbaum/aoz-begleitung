/**
 * CLI wrapper for the demo reset — wipe + reseed the presentation dataset.
 *
 * The actual logic lives in src/lib/demo/reset.ts (SSOT), shared with the
 * daily reset endpoint (api/cron/reset-demo).
 *
 * Run: npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/db/seed-demo.ts
 */

import { db } from '@/lib/db'
import { resetDemoData } from '@/lib/demo/reset'

resetDemoData(db)
  .then((summary) => {
    console.log('✅ Demo data reset:', summary)
    // The pg Pool keeps the event loop alive — exit explicitly on success.
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
