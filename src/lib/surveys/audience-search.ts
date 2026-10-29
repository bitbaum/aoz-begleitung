import { createSearch } from '@bitbaum/searchkit'

/** Call only with the audience already authorized by the survey page. */
export function searchSurveyAudience<T extends { id: string; name: string }>(
  clients: readonly T[],
  query: string,
): readonly T[] {
  if (!query.trim()) return clients
  return createSearch(clients, {
    fields: [{ name: 'name', get: (client) => client.name }],
  })
    .search(query)
    .map((hit) => hit.item)
}
