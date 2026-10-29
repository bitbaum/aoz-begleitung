import { searchText } from '@/lib/search/text-search'

/** Call only with the audience already authorized by the survey page. */
export function searchSurveyAudience<T extends { id: string; name: string }>(
  clients: readonly T[],
  query: string,
): readonly T[] {
  return searchText(clients, query, [{ name: 'name', get: (client) => client.name }])
}
