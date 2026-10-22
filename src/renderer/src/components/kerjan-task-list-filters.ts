import type {
  KerjanHistoryEntry,
  KerjanIssue,
  KerjanIssueListFilters,
  KerjanTaskType,
  KerjanTicketKind,
  KerjanTicketStatus,
  KerjanWorkspace
} from '../../../shared/kerjan-types'

export const KERJAN_ASSIGNEE_ME = 'me'

export type KerjanTaskListFilterState = {
  kind: KerjanTicketKind | null
  /** Empty means every status; matched client-side so toggling never refetches. */
  statuses: KerjanTicketStatus[]
  taskType: KerjanTaskType | null
  sprintId: string | null
  /** A member id, or KERJAN_ASSIGNEE_ME for the connected viewer. */
  assignee: string | null
  query: string
}

// Why: open on the viewer's own open Tasks, like Kerjan's "My Task" page.
export const DEFAULT_KERJAN_TASK_LIST_FILTERS: KerjanTaskListFilterState = {
  kind: 'task',
  statuses: ['todo', 'in_progress'],
  taskType: null,
  sprintId: null,
  assignee: KERJAN_ASSIGNEE_ME,
  query: ''
}

/** Server-side filters for `listKerjanIssues`; null when "me" cannot resolve yet. */
export function buildKerjanIssueListFilters(
  state: KerjanTaskListFilterState,
  viewerId: string | null | undefined
): KerjanIssueListFilters | null {
  const assigneeId = state.assignee === KERJAN_ASSIGNEE_ME ? viewerId : state.assignee
  if (state.assignee === KERJAN_ASSIGNEE_ME && !viewerId) {
    return null
  }
  return {
    ...(state.kind ? { kind: state.kind } : {}),
    // Why: task_type only describes Tasks, so it is meaningless next to an Epic/Story kind.
    ...(state.taskType && (state.kind === null || state.kind === 'task')
      ? { taskType: state.taskType }
      : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(state.sprintId ? { sprintId: state.sprintId } : {})
  }
}

export function hasActiveKerjanTaskListFilters(state: KerjanTaskListFilterState): boolean {
  const defaults = DEFAULT_KERJAN_TASK_LIST_FILTERS
  return (
    state.kind !== defaults.kind ||
    [...state.statuses].sort().join() !== [...defaults.statuses].sort().join() ||
    state.taskType !== defaults.taskType ||
    state.sprintId !== defaults.sprintId ||
    state.assignee !== defaults.assignee ||
    state.query.trim().length > 0
  )
}

/** The workspace the list reads: the stored pick when it still exists, else the first one. */
export function resolveKerjanWorkspaceSelection(
  workspaces: readonly KerjanWorkspace[],
  selectedCode: string | null
): KerjanWorkspace | null {
  const normalized = selectedCode?.trim().toUpperCase()
  return (
    (normalized ? workspaces.find((workspace) => workspace.code === normalized) : undefined) ??
    workspaces[0] ??
    null
  )
}

/** Only Tasks accept a status write; Story/Epic status is derived from their Tasks. */
export function canSetKerjanTicketStatus(issue: Pick<KerjanIssue, 'kind'>): boolean {
  return issue.kind === 'task'
}

export type KerjanHistorySummary = {
  field: string | null
  from: string | null
  to: string | null
}

function historyText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : null
}

function firstHistoryText(raw: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const text = historyText(raw[key])
    if (text) {
      return text
    }
  }
  return null
}

/** Best-effort reading of Kerjan's free-form history rows (field + before/after). */
export function summarizeKerjanHistoryEntry(entry: KerjanHistoryEntry): KerjanHistorySummary {
  return {
    field: firstHistoryText(entry.raw, ['field', 'action', 'event', 'type']),
    from: firstHistoryText(entry.raw, ['from', 'old_value', 'from_value', 'before']),
    to: firstHistoryText(entry.raw, ['to', 'new_value', 'to_value', 'after'])
  }
}
