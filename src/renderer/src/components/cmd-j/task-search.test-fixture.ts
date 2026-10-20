import type { JiraIssue } from '../../../../shared/jira-types'
import type { KerjanIssue } from '../../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import { makeCmdJTaskSearchResult } from './task-search-results'

export const jiraTaskIssue: JiraIssue = {
  id: 'other-site-id',
  key: 'DEMO-12',
  siteId: 'other-site',
  title: 'Fix login redirect',
  url: 'https://other.atlassian.net/browse/DEMO-12',
  project: { id: 'p', key: 'DEMO', name: 'Demo' },
  issueType: { id: 'task', name: 'Task' },
  status: {
    id: 'open',
    name: 'In Progress',
    categoryKey: 'indeterminate',
    categoryName: 'In Progress'
  },
  labels: [],
  updatedAt: '2026-10-13T00:00:00Z',
  createdAt: '2026-10-01T00:00:00Z'
}
export const jiraTaskSource: TaskSourceContext = {
  kind: 'task-source',
  provider: 'jira',
  projectId: 'account-backed-task-source',
  hostId: 'local',
  providerIdentity: {
    provider: 'jira',
    siteId: 'other-site',
    siteUrl: 'https://other.atlassian.net',
    projectKey: 'DEMO'
  },
  accountLabel: 'other@example.com'
}
export const jiraTaskResult = makeCmdJTaskSearchResult(
  { provider: 'jira', issue: jiraTaskIssue },
  jiraTaskSource,
  null,
  'Local'
)

export const kerjanTaskIssue: KerjanIssue = {
  id: 'k-40',
  key: 'OMX-40',
  title: 'Fix login redirect',
  url: 'https://kerjan.example/ticket/OMX-40',
  status: {
    id: 'in_progress',
    name: 'In Progress',
    categoryKey: 'indeterminate',
    categoryName: 'In Progress'
  },
  labels: [],
  project: { id: 'w1', key: 'OMX', name: 'Omnix' },
  issueType: { id: 'task', name: 'Task' },
  kind: 'task',
  statusKey: 'in_progress',
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
  createdAt: '2026-10-01T00:00:00Z'
}
export const kerjanTaskSource: TaskSourceContext = {
  kind: 'task-source',
  provider: 'kerjan',
  projectId: 'account-backed-task-source',
  hostId: 'local',
  providerIdentity: { provider: 'kerjan', siteUrl: 'https://kerjan.example', workspaceCode: 'OMX' },
  accountLabel: 'Alice'
}
export const kerjanTaskResult = makeCmdJTaskSearchResult(
  { provider: 'kerjan', issue: kerjanTaskIssue },
  kerjanTaskSource,
  null,
  'Local'
)
