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
  status: KerjanTicketStatus | null
  taskType: KerjanTaskType | null
  sprintId: string | null
  /** A member id, or KERJAN_ASSIGNEE_ME for the connected viewer. */
  assignee: string | null
  query: string
}

export const DEFAULT_KERJAN_TASK_LIST_FILTERS: KerjanTaskListFilterState = {
  kind: null,
  status: null,
  taskType: null,
  sprintId: null,
  assignee: null,
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
    ...(state.status ? { status: state.status } : {}),
    // Why: task_type only describes Tasks, so it is meaningless next to an Epic/Story kind.
    ...(state.taskType && (state.kind === null || state.kind === 'task')
      ? { taskType: state.taskType }
      : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(state.sprintId ? { sprintId: state.sprintId } : {})
  }
}

export function hasActiveKerjanTaskListFilters(state: KerjanTaskListFilterState): boolean {
  return (
    state.kind !== null ||
    state.status !== null ||
    state.taskType !== null ||
    state.sprintId !== null ||
    state.assignee !== null ||
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
