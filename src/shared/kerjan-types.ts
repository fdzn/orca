import type { JiraComment, JiraIssue, JiraIssueType, JiraProject, JiraUser } from './jira-types'
import type { SecretAtRestProtection } from './secret-at-rest-protection'

export const KERJAN_TICKET_KINDS = ['epic', 'story', 'task'] as const
export type KerjanTicketKind = (typeof KERJAN_TICKET_KINDS)[number]

export const KERJAN_TICKET_STATUSES = [
  'todo',
  'in_progress',
  'ready_for_qa',
  'testing',
  'done',
  'canceled'
] as const
export type KerjanTicketStatus = (typeof KERJAN_TICKET_STATUSES)[number]

/** Only Tasks take a status write; Story/Epic status is derived from their Tasks. */
export const KERJAN_TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export type KerjanTaskStatus = (typeof KERJAN_TASK_STATUSES)[number]

export const KERJAN_TASK_TYPES = ['dev', 'qa', 'bug'] as const
export type KerjanTaskType = (typeof KERJAN_TASK_TYPES)[number]

export type KerjanMember = {
  id: string
  name: string
  email: string | null
  active?: boolean
}

export type KerjanConnectArgs = {
  baseUrl: string
  token: string
}

export type KerjanConnectResult = { ok: true; viewer: KerjanMember } | { ok: false; error: string }

export type KerjanConnectionStatus = {
  connected: boolean
  siteUrl: string | null
  viewer: KerjanMember | null
  /** Set when the saved token exists but could not be decrypted. */
  credentialError?: string
  /** 'plaintext' when the token is unsealed, so Settings can warn. */
  credentialProtection?: SecretAtRestProtection | null
}

export type KerjanWorkspace = {
  id: string
  code: string
  name: string
  kind: string | null
  /** Set while the workspace is still synced from Jira; Kerjan rejects writes until cutover. */
  jiraProject: string | null
  readOnly: boolean
}

export type KerjanSprint = {
  id: string
  name: string
  state: string | null
  category: string | null
  goal: string | null
  startDate: string | null
  endDate: string | null
}

export type KerjanProduct = {
  id: string
  name: string
}

export type KerjanIssueListFilters = {
  kind?: KerjanTicketKind
  status?: KerjanTicketStatus
  taskType?: KerjanTaskType
  assigneeId?: string
  sprintId?: string
  epicId?: string
  productId?: string
  backlog?: boolean
  /** Case-insensitive match on key, title, and description; Kerjan has no server-side search. */
  query?: string
  limit?: number
}

export type KerjanTicketRef = { key: string; title: string }

/** Jira-shaped so list/detail presentation can be shared; `project` is the Kerjan workspace. */
export type KerjanIssue = Pick<
  JiraIssue,
  | 'id'
  | 'key'
  | 'title'
  | 'description'
  | 'url'
  | 'status'
  | 'labels'
  | 'assignee'
  | 'reporter'
  | 'parent'
  | 'sprint'
  | 'updatedAt'
  | 'createdAt'
> & {
  project: JiraProject
  issueType: JiraIssueType
  kind: KerjanTicketKind
  statusKey: KerjanTicketStatus
  taskType: KerjanTaskType | null
  isBug: boolean
  assigneeId: string | null
  sprintId: string | null
  product?: KerjanProduct
  epic?: KerjanTicketRef
  story?: KerjanTicketRef
  severity: string | null
  estimate: number | null
  qaKey: string | null
  originTaskKey: string | null
  doneAt: string | null
  canceledAt: string | null
  cancelReason: string | null
  tasks: (KerjanTicketRef & { statusKey: KerjanTicketStatus | null })[]
}

export type KerjanHistoryEntry = {
  id: string
  createdAt: string
  user?: JiraUser
  /** Raw Kerjan history record, kept so callers can render fields this client does not model. */
  raw: Record<string, unknown>
}

export type KerjanIssueDetail = KerjanIssue & {
  comments: JiraComment[]
  history: KerjanHistoryEntry[]
  stories: KerjanIssue[]
}

export type KerjanIssueUpdate = {
  title?: string
  description?: string
}

export type KerjanMutationResult =
  | { ok: true; issue: KerjanIssueDetail }
  | { ok: false; error: string }
