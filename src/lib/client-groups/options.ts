/**
 * Loads the data the dynamic filter options are built from (units, staff).
 * I/O only — the options themselves are declared in `config/client-filters.ts`.
 */

import { and, asc, eq, inArray } from 'drizzle-orm'
import { careAssignment, db, housingUnit, placement, user } from '@/lib/db'
import { unitScopeFilter, type SiteCapabilities } from '@/lib/auth/site-access'
import type { ClientFilterOptionSources } from '@/lib/config/client-filters'

export async function loadClientFilterOptionSources(
  viewer: SiteCapabilities | null,
  viewerHasCaseload: boolean,
): Promise<ClientFilterOptionSources> {
  const [units, staff] = await Promise.all([
    db
      .select({ id: housingUnit.id, code: housingUnit.code, nickname: housingUnit.nickname })
      .from(housingUnit)
      .where(
        and(
          viewer ? (unitScopeFilter(viewer) ?? undefined) : undefined,
          inArray(
            housingUnit.id,
            db
              .select({ id: placement.housingUnitId })
              .from(placement)
              .where(eq(placement.status, 'ACTIVE')),
          ),
        ),
      )
      .orderBy(asc(housingUnit.code)),
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(
        and(
          eq(user.active, true),
          inArray(user.id, db.select({ id: careAssignment.staffId }).from(careAssignment)),
        ),
      )
      .orderBy(asc(user.name)),
  ])
  return { units, staff, viewerHasCaseload }
}
