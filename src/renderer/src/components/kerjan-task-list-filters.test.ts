import { describe, expect, it } from 'vitest'
import type { KerjanWorkspace } from '../../../shared/kerjan-types'
import {
  buildKerjanIssueListFilters,
  canSetKerjanTicketStatus,
  DEFAULT_KERJAN_TASK_LIST_FILTERS,
  hasActiveKerjanTaskListFilters,
  KERJAN_ASSIGNEE_ME,
  resolveKerjanWorkspaceSelection,
  summarizeKerjanHistoryEntry
} from './kerjan-task-list-filters'

const workspace = (code: string): KerjanWorkspace => ({
  id: code,
  code,
  name: code,
  kind: null,
  jiraProject: null,
  readOnly: false
})

const NO_FILTERS = {
  ...DEFAULT_KERJAN_TASK_LIST_FILTERS,
  kind: null,
  assignee: null,
  statuses: []
}

describe('Kerjan task list filters', () => {
  it("defaults to the viewer's own Tasks", () => {
    expect(buildKerjanIssueListFilters(DEFAULT_KERJAN_TASK_LIST_FILTERS, 'u1')).toEqual({
      kind: 'task',
      assigneeId: 'u1'
    })
  })

  it('sends only the set server filters and leaves text search client-side', () => {
    expect(
      buildKerjanIssueListFilters(
        { ...NO_FILTERS, statuses: ['in_progress'], sprintId: 's1', query: 'x' },
        'u1'
      )
    ).toEqual({ sprintId: 's1' })
  })

  it('resolves "me" to the viewer and waits while the viewer is unknown', () => {
    const mine = { ...NO_FILTERS, assignee: KERJAN_ASSIGNEE_ME }
    expect(buildKerjanIssueListFilters(mine, 'u1')).toEqual({ assigneeId: 'u1' })
    expect(buildKerjanIssueListFilters(mine, null)).toBeNull()
  })

  it('drops the task type when the kind is not Task', () => {
    const base = { ...NO_FILTERS, taskType: 'bug' as const }
    expect(buildKerjanIssueListFilters({ ...base, kind: 'story' }, null)).toEqual({ kind: 'story' })
    expect(buildKerjanIssueListFilters({ ...base, kind: 'task' }, null)).toEqual({
      kind: 'task',
      taskType: 'bug'
    })
    expect(buildKerjanIssueListFilters(base, null)).toEqual({ taskType: 'bug' })
  })

  it('treats a whitespace-only query as no filter', () => {
    expect(hasActiveKerjanTaskListFilters(DEFAULT_KERJAN_TASK_LIST_FILTERS)).toBe(false)
    expect(
      hasActiveKerjanTaskListFilters({ ...DEFAULT_KERJAN_TASK_LIST_FILTERS, query: '  ' })
    ).toBe(false)
    expect(hasActiveKerjanTaskListFilters(NO_FILTERS)).toBe(true)
  })

  it('keeps a stored workspace pick that still exists, else falls back to the first', () => {
    const list = [workspace('OMX'), workspace('HV')]
    expect(resolveKerjanWorkspaceSelection(list, 'hv')?.code).toBe('HV')
    expect(resolveKerjanWorkspaceSelection(list, 'GONE')?.code).toBe('OMX')
    expect(resolveKerjanWorkspaceSelection([], 'OMX')).toBeNull()
  })

  it('allows status writes on Tasks only', () => {
    expect(canSetKerjanTicketStatus({ kind: 'task' })).toBe(true)
    expect(canSetKerjanTicketStatus({ kind: 'story' })).toBe(false)
    expect(canSetKerjanTicketStatus({ kind: 'epic' })).toBe(false)
  })

  it('reads the common history field spellings', () => {
    expect(
      summarizeKerjanHistoryEntry({
        id: '1',
        createdAt: '',
        raw: { field: 'status', old_value: 'todo', new_value: 'done' }
      })
    ).toEqual({ field: 'status', from: 'todo', to: 'done' })
    expect(summarizeKerjanHistoryEntry({ id: '2', createdAt: '', raw: { estimate: 3 } })).toEqual({
      field: null,
      from: null,
      to: null
    })
  })
})
