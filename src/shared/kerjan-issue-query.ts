import type { KerjanIssue, KerjanIssueListFilters } from './kerjan-types'

/** Client-side text match: Kerjan's ticket list has no search parameter. */
export function matchesKerjanQuery(issue: KerjanIssue, query: string | undefined): boolean {
  const needle = query?.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return [issue.key, issue.title, issue.description ?? ''].some((field) =>
    field.toLowerCase().includes(needle)
  )
}

/** Applies the filters Kerjan cannot evaluate server-side: text query and result limit. */
export function applyKerjanClientFilters(
  issues: readonly KerjanIssue[],
  filters: Pick<KerjanIssueListFilters, 'query' | 'limit'> = {}
): KerjanIssue[] {
  const matches = issues.filter((issue) => matchesKerjanQuery(issue, filters.query))
  return filters.limit && filters.limit > 0 ? matches.slice(0, filters.limit) : matches
}
