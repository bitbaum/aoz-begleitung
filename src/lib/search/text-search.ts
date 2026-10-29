/**
 * Typo-tolerant text search for staff lists, through @bitbaum/searchkit.
 *
 * Call it only with rows the viewer may already see: role, site and filter
 * restrictions stay in the query that loaded them, so search can only narrow
 * an authorized list, never widen it. An empty query returns the list as is.
 */
import { search, type SearchField } from '@bitbaum/searchkit'
import { residentName, type NamedResident } from '@/lib/utils/resident-name'

export type TextField<T> = SearchField<T>

export function searchText<T>(
  items: readonly T[],
  query: string | null | undefined,
  fields: readonly TextField<T>[],
): readonly T[] {
  if (!query?.trim()) return items
  return search(items, { fields }, query).map((hit) => hit.item)
}

/**
 * A person found by the name they go by or by their login code: staff often
 * have only the code in hand. Searched, never shown — the lists render names.
 */
export function residentSearchFields<T>(pick: (item: T) => NamedResident): TextField<T>[] {
  return [
    { name: 'name', get: (item) => residentName(pick(item)) },
    { name: 'code', get: (item) => pick(item).code },
  ]
}
