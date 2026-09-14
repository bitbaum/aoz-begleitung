/**
 * Column configurations for CSV export.
 * Headers sourced from EXPORT_COLUMN_HEADERS (SSOT in lib/constants/labels/export.ts).
 */

import { EXPORT_COLUMN_HEADERS } from '@/lib/constants/labels/export'
import { formatDateISOCell } from '@/lib/utils/formatting'

export interface ExportColumn<T = Record<string, unknown>> {
  key: string
  header: string // German — from EXPORT_COLUMN_HEADERS
  transform?: (value: unknown, row: T) => string
}

function formatArray(v: unknown): string {
  return Array.isArray(v) ? v.join(', ') : String(v || '')
}

const h = EXPORT_COLUMN_HEADERS

export const EXPORT_COLUMNS: Record<string, ExportColumn[]> = {
  residents: [
    { key: 'code', header: h.code },
    { key: 'status', header: h.status },
    { key: 'ageRange', header: h.ageRange },
    { key: 'gender', header: h.gender },
    { key: 'familyStatus', header: h.familyStatus },
    { key: 'sleepSchedule', header: h.sleepSchedule },
    { key: 'noiseTolerance', header: h.noiseTolerance },
    { key: 'cleanlinessPractice', header: h.cleanlinessPractice },
    { key: 'cleanlinessExpectation', header: h.cleanlinessExpectation },
    { key: 'chaosTolerance', header: h.chaosTolerance },
    { key: 'socialStyle', header: h.socialStyle },
    { key: 'smokingStatus', header: h.smokingStatus },
    { key: 'mobilityNeeds', header: h.mobilityNeeds },
    { key: 'supportLevel', header: h.supportLevel },
    { key: 'languages', header: h.languages, transform: formatArray },
    { key: 'createdAt', header: h.createdAt, transform: formatDateISOCell },
  ],
  incidents: [
    { key: 'id', header: h.id },
    { key: 'date', header: h.date, transform: formatDateISOCell },
    { key: 'category', header: h.category },
    { key: 'type', header: h.type },
    { key: 'severity', header: h.severity },
    { key: 'description', header: h.description },
    { key: 'resolution', header: h.resolution },
    { key: 'resolvedAt', header: h.resolvedAt, transform: formatDateISOCell },
  ],
  placements: [
    { key: 'id', header: h.id },
    { key: 'startDate', header: h.startDate, transform: formatDateISOCell },
    { key: 'endDate', header: h.endDate, transform: formatDateISOCell },
    { key: 'status', header: h.status },
    { key: 'endReason', header: h.endReason },
    { key: 'compatibilityScore', header: h.compatibilityScore },
    { key: 'satisfactionRating', header: h.satisfactionRating },
  ],
  satisfaction: [
    { key: 'id', header: h.id },
    { key: 'createdAt', header: h.date, transform: formatDateISOCell },
    { key: 'checkInType', header: h.checkInType },
    { key: 'overallSatisfaction', header: h.overallSatisfaction },
    { key: 'roommateRelations', header: h.roommateRelations },
    { key: 'facilitySatisfaction', header: h.facilitySatisfaction },
    { key: 'safetyFeeling', header: h.safetyFeeling },
    { key: 'concerns', header: h.concerns },
    { key: 'improvements', header: h.improvements },
  ],
}
