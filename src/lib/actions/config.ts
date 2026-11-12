'use server'

import { revalidatePath } from 'next/cache'
import { db, systemConfig } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { requirePermission, requireStaffAuth } from '@/lib/auth'

export interface SystemConfigData {
  pilotBaselineIncidentsPerMonth: number | null
  pilotBaselineRelocationsPerMonth: number | null
  pilotBaselineMediationHoursPerWeek: number | null
  pilotStartDate: Date | null
}

export async function getSystemConfig(): Promise<SystemConfigData> {
  await requireStaffAuth()
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.id, 'singleton'),
  })
  return {
    pilotBaselineIncidentsPerMonth: config?.pilotBaselineIncidentsPerMonth ?? null,
    pilotBaselineRelocationsPerMonth: config?.pilotBaselineRelocationsPerMonth ?? null,
    pilotBaselineMediationHoursPerWeek: config?.pilotBaselineMediationHoursPerWeek ?? null,
    pilotStartDate: config?.pilotStartDate ?? null,
  }
}

export async function saveSystemConfig(formData: FormData): Promise<void> {
  await requirePermission('system:configure')

  const parseFloat = (v: FormDataEntryValue | null) => {
    const n = Number(v)
    return v && !isNaN(n) && n >= 0 ? n : null
  }

  const pilotStartRaw = formData.get('pilotStartDate')
  const pilotStartDate = pilotStartRaw ? new Date(pilotStartRaw as string) : null

  // Prisma's upsert had identical create and update payloads, so the insert
  // values double as the conflict-update set.
  const values = {
    pilotBaselineIncidentsPerMonth: parseFloat(formData.get('pilotBaselineIncidentsPerMonth')),
    pilotBaselineRelocationsPerMonth: parseFloat(formData.get('pilotBaselineRelocationsPerMonth')),
    pilotBaselineMediationHoursPerWeek: parseFloat(
      formData.get('pilotBaselineMediationHoursPerWeek'),
    ),
    pilotStartDate,
  }

  await db
    .insert(systemConfig)
    .values({ id: 'singleton', ...values })
    .onConflictDoUpdate({ target: systemConfig.id, set: values })

  revalidatePath('/settings')
  revalidatePath('/analytics')
}
