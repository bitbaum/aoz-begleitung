/**
 * Client filters — SSOT for every way staff can narrow the Klient*innen list,
 * and for what a saved group (`ClientGroup.filters`) may contain.
 *
 * One declaration per filter: its id, German label, kind of control, where
 * its options come from, the zod schema its value must satisfy, and a pure
 * function turning that value into a Drizzle `where` fragment on Resident.
 * The list page, the URL encoding, the saved-group validation and group
 * membership (`lib/client-groups/resolve.ts`) all iterate THIS list, so adding
 * a filter is one entry here and nothing else.
 *
 * ## What may never be a filter
 *
 * A client's own admin facts — insurance, health contacts, permit — are
 * readable by a person looking at one client and by NOTHING that ranks, sorts
 * or selects (CLAUDE.md, "What a CLIENT may keep about themselves"). A filter
 * selects, and a saved group becomes a survey audience, so this file must
 * never reach those tables. `never-an-input-to-a-decision.test.ts` scans it.
 *
 * ## Defaults vs. what a group stores
 *
 * `defaultFor` is a property of the PAGE: an unfiltered visit lands on clients
 * in care, and a caseload holder lands on their own caseload. A saved group
 * never inherits a default — it stores exactly the values that were applied,
 * minus the neutral ones, and is resolved from those alone. Otherwise a group
 * saved by one person would mean something different when another opened it.
 */

import { z } from 'zod'
import { and, arrayOverlaps, eq, gte, inArray, notInArray, type SQL } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { careAssignment, opportunityApplication, placement, resident } from '@/lib/db'
import { awaitingAnswerFilter } from '@/lib/data/opportunities'
import { RESIDENT_FACTORS } from '@/lib/config/resident-factors'
import { IN_CARE_RESIDENT_STATUSES } from '@/lib/config/resident-status'
import { CARE_ROLES, CARE_ROLE_LABELS } from '@/lib/config/care'
import { idSchema } from '@/lib/validation/schemas'
import {
  CLIENT_FILTER_LABELS as L,
  RESIDENT_STATUS_LABELS,
  RESIDENT_STAT_LABELS,
} from '@/lib/constants/labels/residents'
import { RESIDENT_LIST_LABELS, UI_LABELS } from '@/lib/constants/labels/ui'

// Builds sub-selects without touching the lazy db client, so every `where`
// below is pure and can be compiled in a test with no DATABASE_URL.
const qb = new QueryBuilder()

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientFilterKind = 'select' | 'multiselect' | 'toggle'

export interface ClientFilterOption {
  value: string
  label: string
}

/** Data a dynamic option list is built from, loaded once per request. */
export interface ClientFilterOptionSources {
  /** Units holding at least one ACTIVE placement the viewer may see. */
  units: readonly { id: string; code: string; nickname: string | null }[]
  /** Staff holding at least one care seat. */
  staff: readonly { id: string; name: string }[]
  /** Whether "Meine Klient*innen" can mean anything for this viewer. */
  viewerHasCaseload: boolean
}

/** What a `where` may depend on besides the value itself. */
export interface ClientFilterContext {
  viewerId: string
  now: Date
}

/** What a page default may depend on. */
export interface ClientFilterDefaultContext {
  viewerHasCaseload: boolean
}

export interface ClientFilterDef<Id extends string = string, S extends z.ZodType = z.ZodType> {
  id: Id
  /** The URL search param. Usually the id; `stand` keeps the old `view`. */
  param: string
  label: string
  kind: ClientFilterKind
  /** `tabs` renders as the status tab row instead of in the filter bar. */
  presentation: 'bar' | 'tabs'
  schema: S
  options: (sources: ClientFilterOptionSources) => ClientFilterOption[]
  /**
   * The value meaning "no restriction", when the filter needs one spelled out.
   * Required wherever `defaultFor` can return a value — otherwise there would
   * be no URL that says "I chose to see everyone" over the default.
   */
  neutral?: z.infer<S>
  defaultFor?: (ctx: ClientFilterDefaultContext) => z.infer<S> | null
  where: (value: z.infer<S>, ctx: ClientFilterContext) => SQL | undefined
}

function defineFilter<const Id extends string, S extends z.ZodType>(def: ClientFilterDef<Id, S>) {
  return def
}

// ─── Shared fragments ─────────────────────────────────────────────────────────

/** Residents holding a care seat that matches `condition`. */
function withCareSeat(condition: SQL | undefined): SQL {
  return inArray(
    resident.id,
    qb.select({ id: careAssignment.residentId }).from(careAssignment).where(condition),
  )
}

/** Residents with an ACTIVE placement matching `condition`. */
function withActivePlacement(condition?: SQL): SQL {
  return inArray(
    resident.id,
    qb
      .select({ id: placement.residentId })
      .from(placement)
      .where(and(eq(placement.status, 'ACTIVE'), condition)),
  )
}

/** The option list of an enum/multi factor; empty for any other kind. */
function factorChoices(factorId: 'languages' | 'ageRange'): {
  options: readonly string[]
  optionLabels: Record<string, string>
} {
  const factor = RESIDENT_FACTORS[factorId]
  return 'options' in factor && 'optionLabels' in factor
    ? { options: factor.options, optionLabels: factor.optionLabels }
    : { options: [], optionLabels: {} }
}

function factorOptions(factorId: 'languages' | 'ageRange'): ClientFilterOption[] {
  const { options, optionLabels } = factorChoices(factorId)
  return options.map((value) => ({ value, label: optionLabels[value] ?? value }))
}

function factorValueSchema(factorId: 'languages' | 'ageRange') {
  const { options } = factorChoices(factorId)
  return z.string().refine((value) => options.includes(value))
}

// ─── The filters ──────────────────────────────────────────────────────────────

const STAND_VALUES = ['active', 'placed', 'unplaced', 'archived', 'all'] as const

const stand = defineFilter({
  id: 'stand',
  param: 'view',
  label: L.stand,
  kind: 'select',
  presentation: 'tabs',
  schema: z.enum(STAND_VALUES),
  // Labels are the ones the tabs and stat tiles already use — one word each.
  options: () => [
    { value: 'active', label: RESIDENT_LIST_LABELS.viewCurrent },
    { value: 'placed', label: RESIDENT_STATUS_LABELS.PLACED },
    { value: 'unplaced', label: RESIDENT_STAT_LABELS.unplaced },
    { value: 'archived', label: UI_LABELS.archived },
    { value: 'all', label: UI_LABELS.all },
  ],
  neutral: 'all',
  defaultFor: () => 'active' as const,
  where: (value) => {
    switch (value) {
      case 'active':
        return inArray(resident.status, [...IN_CARE_RESIDENT_STATUSES])
      case 'placed':
        return eq(resident.status, 'PLACED')
      case 'unplaced':
        // Same definition as the "Unplatziert" tile: in care, no active placement.
        return and(
          eq(resident.status, 'ACTIVE'),
          notInArray(
            resident.id,
            qb
              .select({ id: placement.residentId })
              .from(placement)
              .where(eq(placement.status, 'ACTIVE')),
          ),
        )
      case 'archived':
        return eq(resident.status, 'EXITED')
      case 'all':
        return undefined
    }
  },
})

const unit = defineFilter({
  id: 'unit',
  param: 'unit',
  label: L.unit,
  kind: 'select',
  presentation: 'bar',
  schema: idSchema,
  options: ({ units }) =>
    units.map((u) => ({ value: u.id, label: u.nickname ? `${u.code} · ${u.nickname}` : u.code })),
  where: (unitId) => withActivePlacement(eq(placement.housingUnitId, unitId)),
})

const language = defineFilter({
  id: 'lang',
  param: 'lang',
  label: L.language,
  kind: 'multiselect',
  presentation: 'bar',
  schema: z.array(factorValueSchema('languages')).min(1),
  options: () => factorOptions('languages'),
  // Speaks ANY of the chosen languages — the question is "who can I reach in
  // Arabic or Farsi", not "who speaks both".
  where: (codes) => arrayOverlaps(resident.languages, codes),
})

const ageRange = defineFilter({
  id: 'age',
  param: 'age',
  label: L.ageRange,
  kind: 'multiselect',
  presentation: 'bar',
  schema: z.array(factorValueSchema('ageRange')).min(1),
  options: () => factorOptions('ageRange'),
  where: (ranges) =>
    inArray(resident.ageRange, ranges as (typeof resident.ageRange.enumValues)[number][]),
})

const SEAT_STAFF_PREFIX = 'staff:'
const SEAT_OPEN_PREFIX = 'open:'

const seat = defineFilter({
  id: 'seat',
  param: 'seat',
  label: L.seat,
  kind: 'select',
  presentation: 'bar',
  schema: z.union([
    z.literal('all'),
    z.literal('mine'),
    z.string().regex(/^staff:.{1,64}$/),
    z.enum(CARE_ROLES.map((role) => `${SEAT_OPEN_PREFIX}${role}`) as [string, ...string[]]),
  ]),
  options: ({ staff, viewerHasCaseload }) => [
    ...(viewerHasCaseload ? [{ value: 'mine', label: L.seatMine }] : []),
    ...staff.map((s) => ({ value: `${SEAT_STAFF_PREFIX}${s.id}`, label: s.name })),
    ...CARE_ROLES.map((role) => ({
      value: `${SEAT_OPEN_PREFIX}${role}`,
      label: L.seatOpen(CARE_ROLE_LABELS[role]),
    })),
  ],
  neutral: 'all',
  // Folds the board's old "Meine / Alle" toggle in: a caseload holder lands
  // on their own people, everyone else on everybody.
  defaultFor: ({ viewerHasCaseload }) => (viewerHasCaseload ? 'mine' : null),
  where: (value, ctx) => {
    if (value === 'all') return undefined
    if (value === 'mine') return withCareSeat(eq(careAssignment.staffId, ctx.viewerId))
    if (value.startsWith(SEAT_STAFF_PREFIX)) {
      return withCareSeat(eq(careAssignment.staffId, value.slice(SEAT_STAFF_PREFIX.length)))
    }
    const role = value.slice(SEAT_OPEN_PREFIX.length) as (typeof CARE_ROLES)[number]
    return notInArray(
      resident.id,
      qb
        .select({ id: careAssignment.residentId })
        .from(careAssignment)
        .where(eq(careAssignment.role, role)),
    )
  },
})

const MOVED_IN_WINDOWS = ['30', '90'] as const

const movedIn = defineFilter({
  id: 'moved',
  param: 'moved',
  label: L.movedIn,
  kind: 'select',
  presentation: 'bar',
  schema: z.enum(MOVED_IN_WINDOWS),
  options: () =>
    MOVED_IN_WINDOWS.map((days) => ({ value: days, label: L.movedInWithin(Number(days)) })),
  where: (days, ctx) =>
    withActivePlacement(
      gte(placement.startDate, new Date(ctx.now.getTime() - Number(days) * MS_PER_DAY)),
    ),
})

const awaitingAnswer = defineFilter({
  id: 'waiting',
  param: 'waiting',
  label: L.awaitingAnswer,
  kind: 'toggle',
  presentation: 'bar',
  schema: z.literal(true),
  options: () => [{ value: '1', label: L.awaitingAnswerHint }],
  // The SAME three clauses the Jobcoach queue uses (`awaitingAnswerFilter`),
  // so "has an open request" here and "Wartet auf Antwort" there cannot drift.
  where: () =>
    inArray(
      resident.id,
      qb
        .select({ id: opportunityApplication.residentId })
        .from(opportunityApplication)
        .where(awaitingAnswerFilter()),
    ),
})

/** Every filter, in the order the bar shows them. */
export const CLIENT_FILTERS = [
  stand,
  seat,
  unit,
  language,
  ageRange,
  movedIn,
  awaitingAnswer,
] as const

type FilterList = typeof CLIENT_FILTERS
export type ClientFilterId = FilterList[number]['id']

/** A set of applied filter values, keyed by filter id. */
export type ClientFilterState = {
  [F in FilterList[number] as F['id']]?: z.infer<F['schema']>
}

/** The list as plain defs, for code that treats every filter alike. */
const FILTERS: readonly ClientFilterDef[] = CLIENT_FILTERS as unknown as readonly ClientFilterDef[]

export function clientFilter(id: ClientFilterId): ClientFilterDef {
  const def = FILTERS.find((f) => f.id === id)
  if (!def) throw new Error(`Unknown client filter: ${id}`)
  return def
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * What `ClientGroup.filters` must satisfy. `strict`: an id this config does
 * not know is REJECTED, never ignored — dropping it would silently widen the
 * group, and a survey sent to a wider group than the one that was named is
 * the failure that matters here.
 */
export const clientFilterStateSchema = z
  .object(Object.fromEntries(FILTERS.map((f) => [f.id, f.schema.optional()])))
  .strict() as unknown as z.ZodType<ClientFilterState>

// ─── Pure operations ──────────────────────────────────────────────────────────

/** The `where` for a set of values; undefined when nothing restricts. */
export function clientFilterWhere(
  state: ClientFilterState,
  ctx: ClientFilterContext,
): SQL | undefined {
  const values = state as Record<string, unknown>
  const parts = FILTERS.map((def) =>
    values[def.id] === undefined ? undefined : def.where(values[def.id], ctx),
  ).filter((part): part is SQL => part !== undefined)
  return parts.length > 0 ? and(...parts) : undefined
}

function encodeValue(def: ClientFilterDef, value: unknown): string {
  if (def.kind === 'toggle') return '1'
  if (def.kind === 'multiselect') return [...(value as string[])].sort().join(',')
  return String(value)
}

function sameValue(def: ClientFilterDef, a: unknown, b: unknown): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return a == b
  return encodeValue(def, a) === encodeValue(def, b)
}

function isNeutral(def: ClientFilterDef, value: unknown): boolean {
  return def.neutral !== undefined && sameValue(def, value, def.neutral)
}

type RawParams = Record<string, string | string[] | undefined>

/**
 * Read filter values from URL search params. A value that fails its schema
 * is dropped (a stale link must still open the list); repeated params and
 * comma lists are both accepted for multiselects.
 */
export function parseClientFilterParams(params: RawParams): ClientFilterState {
  const state: Record<string, unknown> = {}
  for (const def of FILTERS) {
    const raw = params[def.param]
    if (raw === undefined) continue
    const parts = (Array.isArray(raw) ? raw : [raw])
      .flatMap((part) => part.split(','))
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) continue
    const candidate =
      def.kind === 'multiselect'
        ? [...new Set(parts)].sort()
        : def.kind === 'toggle'
          ? parts[0] === '1' || parts[0] === 'true' || undefined
          : parts[0]
    const parsed = def.schema.safeParse(candidate)
    if (parsed.success) state[def.id] = parsed.data
  }
  return state as ClientFilterState
}

/** Page defaults for a viewer — the values an unfiltered visit lands on. */
export function clientFilterDefaults(ctx: ClientFilterDefaultContext): ClientFilterState {
  const state: Record<string, unknown> = {}
  for (const def of FILTERS) {
    const value = def.defaultFor?.(ctx)
    if (value !== undefined && value !== null) state[def.id] = value
  }
  return state as ClientFilterState
}

/** URL values over page defaults: what the list actually applies. */
export function effectiveClientFilters(
  fromUrl: ClientFilterState,
  defaults: ClientFilterState,
): ClientFilterState {
  return { ...defaults, ...fromUrl }
}

/**
 * Encode a state as search params relative to the page defaults: a value equal
 * to its default is left out (clean links), and a filter whose default would
 * re-apply itself is written as its neutral value — that is what keeps a
 * group without a care-seat filter from turning into "Meine" on the way in.
 */
export function encodeClientFilters(
  state: ClientFilterState,
  defaults: ClientFilterState,
): URLSearchParams {
  const values = state as Record<string, unknown>
  const defaultValues = defaults as Record<string, unknown>
  const params = new URLSearchParams()
  for (const def of FILTERS) {
    const value = values[def.id]
    const fallback = defaultValues[def.id]
    if (value === undefined) {
      if (fallback !== undefined && def.neutral !== undefined) {
        params.set(def.param, encodeValue(def, def.neutral))
      }
      continue
    }
    if (sameValue(def, value, fallback)) continue
    params.set(def.param, encodeValue(def, value))
  }
  return params
}

/**
 * What a group stores: the applied values, without the neutral ones. Never
 * the defaults' absence — `stand: 'active'` is kept, because a group resolves
 * from what it stores alone.
 */
export function savableClientFilters(state: ClientFilterState): ClientFilterState {
  const values = state as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  for (const def of FILTERS) {
    const value = values[def.id]
    if (value === undefined || isNeutral(def, value)) continue
    kept[def.id] = value
  }
  return kept as ClientFilterState
}

/** How many bar/tab filters differ from the page defaults — the "(n)". */
export function activeClientFilterCount(
  state: ClientFilterState,
  defaults: ClientFilterState,
  presentation: ClientFilterDef['presentation'] = 'bar',
): number {
  const values = state as Record<string, unknown>
  const defaultValues = defaults as Record<string, unknown>
  return FILTERS.filter((def) => {
    if (def.presentation !== presentation) return false
    const value = values[def.id]
    if (value === undefined || isNeutral(def, value)) return false
    return !sameValue(def, value, defaultValues[def.id])
  }).length
}

/** Encoded value for a control (string, or list for a multiselect). */
export function encodedClientFilterValue(
  def: ClientFilterDef,
  state: ClientFilterState,
): string | string[] | null {
  const value = (state as Record<string, unknown>)[def.id]
  if (value === undefined) return null
  if (def.kind === 'multiselect') return [...(value as string[])]
  return encodeValue(def, value)
}

export function clientFilterParamNames(): string[] {
  return FILTERS.map((def) => def.param)
}

export function clientFiltersFor(presentation: ClientFilterDef['presentation']) {
  return FILTERS.filter((def) => def.presentation === presentation)
}
