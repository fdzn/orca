import type { KerjanIssue } from '../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../shared/task-source-context'

export function makeKerjanIssue(overrides: Partial<KerjanIssue> = {}): KerjanIssue {
  return {
    id: 'k-40',
    key: 'OMX-40',
    title: 'Fix login redirect',
    url: 'https://kerjan.example/ticket/OMX-40',
    status: { id: 'todo', name: 'To Do', categoryKey: 'new', categoryName: 'To Do' },
    labels: [],
    project: { id: 'OMX', key: 'OMX', name: 'OMX' },
    issueType: { id: 'task', name: 'Task' },
    kind: 'task',
    statusKey: 'todo',
    taskType: 'dev',
    isBug: false,
    assigneeId: null,
    sprintId: null,
    severity: null,
    estimate: null,
    qaKey: null,
    originTaskKey: null,
    doneAt: null,
    canceledAt: null,
    cancelReason: null,
    tasks: [],
    updatedAt: '2026-10-13T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides
  }
}

export const KERJAN_SOURCE: TaskSourceContext = {
  kind: 'task-source',
  provider: 'kerjan',
  projectId: 'account-backed-task-source',
  hostId: 'local',
  providerIdentity: { provider: 'kerjan', siteUrl: 'https://kerjan.example', workspaceCode: 'OMX' },
  accountLabel: 'kerjan.example'
}
