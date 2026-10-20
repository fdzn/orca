import type { JiraComment, JiraStatus, JiraUser } from '../../shared/jira-types'
import { buildKerjanTicketUrl } from '../../shared/kerjan-ticket-url'
import {
  KERJAN_TASK_TYPES,
  KERJAN_TICKET_KINDS,
  KERJAN_TICKET_STATUSES,
  type KerjanHistoryEntry,
  type KerjanIssue,
  type KerjanIssueDetail,
  type KerjanMember,
  type KerjanProduct,
  type KerjanSprint,
  type KerjanTaskType,
  type KerjanTicketKind,
  type KerjanTicketRef,
  type KerjanTicketStatus
} from '../../shared/kerjan-types'
import { KerjanApiError } from './authenticated-request'
import {
  asKerjanRecord,
  asKerjanRecords,
  kerjanId,
  kerjanText,
  oneOf,
  type KerjanRecord
} from './kerjan-lookup-mapping'

const STATUS_PRESENTATION: Record<
  KerjanTicketStatus,
  Pick<JiraStatus, 'name' | 'categoryKey' | 'categoryName'>
> = {
  todo: { name: 'To Do', categoryKey: 'new', categoryName: 'To Do' },
  in_progress: { name: 'In Progress', categoryKey: 'indeterminate', categoryName: 'In Progress' },
  ready_for_qa: { name: 'Ready for QA', categoryKey: 'indeterminate', categoryName: 'In Progress' },
  testing: { name: 'Testing', categoryKey: 'indeterminate', categoryName: 'In Progress' },
  done: { name: 'Done', categoryKey: 'done', categoryName: 'Done' },
  canceled: { name: 'Canceled', categoryKey: 'done', categoryName: 'Done' }
}

export function mapKerjanStatus(status: KerjanTicketStatus): JiraStatus {
  return { id: status, ...STATUS_PRESENTATION[status] }
}

export type KerjanMappingContext = {
  baseUrl: string
  workspaceCode: string
  members: ReadonlyMap<string, KerjanMember>
  sprints?: ReadonlyMap<string, KerjanSprint>
  products?: ReadonlyMap<string, KerjanProduct>
}

function toJiraUser(
  id: string | null,
  members: ReadonlyMap<string, KerjanMember>
): JiraUser | undefined {
  if (!id) {
    return undefined
  }
  const member = members.get(id)
  return { accountId: id, displayName: member?.name ?? id, email: member?.email ?? null }
}

function issueTypeName(kind: KerjanTicketKind, isBug: boolean): string {
  if (isBug) {
    return 'Bug'
  }
  return kind === 'epic' ? 'Epic' : kind === 'story' ? 'Story' : 'Task'
}

function ticketRef(key: unknown, title: unknown): KerjanTicketRef | undefined {
  const refKey = kerjanText(key)
  return refKey ? { key: refKey, title: kerjanText(title) ?? refKey } : undefined
}

function latestTimestamp(values: readonly (string | null)[]): string | null {
  let latest: { value: string; time: number } | null = null
  for (const value of values) {
    const time = value ? Date.parse(value) : Number.NaN
    if (value && Number.isFinite(time) && (!latest || time > latest.time)) {
      latest = { value, time }
    }
  }
  return latest?.value ?? null
}

export function mapKerjanTicket(raw: KerjanRecord, context: KerjanMappingContext): KerjanIssue {
  const key = kerjanText(raw.key)?.trim().toUpperCase()
  const id = kerjanId(raw.id) ?? key
  const kind = oneOf(KERJAN_TICKET_KINDS, raw.kind)
  if (!key || !id || !kind) {
    throw new KerjanApiError('Kerjan returned a ticket without a key or kind.')
  }
  const statusKey = oneOf(KERJAN_TICKET_STATUSES, raw.status) ?? 'todo'
  const taskType: KerjanTaskType | null = oneOf(KERJAN_TASK_TYPES, raw.task_type)
  const isBug =
    (kind === 'task' && taskType === 'bug') || (kind === 'story' && raw.bug_story === true)
  const assigneeId = kerjanId(raw.assignee_id)
  const sprintId = kerjanId(raw.sprint_id)
  const productId = kerjanId(raw.product_id)
  const createdAt = kerjanText(raw.created_at) ?? ''
  const doneAt = kerjanText(raw.done_at)
  const canceledAt = kerjanText(raw.canceled_at)
  const story = ticketRef(raw.story_key, raw.story_title)
  const product = productId ? context.products?.get(productId) : undefined
  const sprint = sprintId ? context.sprints?.get(sprintId) : undefined
  const estimate =
    typeof raw.estimate === 'number' && Number.isFinite(raw.estimate) ? raw.estimate : null
  const description = kerjanText(raw.description)
  const reporterId = kerjanId(raw.created_by)
  return {
    id,
    key,
    title: kerjanText(raw.title) ?? key,
    ...(description ? { description } : {}),
    url: buildKerjanTicketUrl(context.baseUrl, key) ?? `${context.baseUrl}/ticket/${key}`,
    project: { id: context.workspaceCode, key: context.workspaceCode, name: context.workspaceCode },
    issueType: { id: isBug ? 'bug' : kind, name: issueTypeName(kind, isBug) },
    status: mapKerjanStatus(statusKey),
    labels: [],
    ...(assigneeId ? { assignee: toJiraUser(assigneeId, context.members) } : {}),
    ...(reporterId ? { reporter: toJiraUser(reporterId, context.members) } : {}),
    ...(story ? { parent: { ...story, issueTypeName: 'Story' } } : {}),
    ...(sprint ? { sprint: sprint.name } : {}),
    updatedAt: latestTimestamp([createdAt, doneAt, canceledAt]) ?? createdAt,
    createdAt,
    kind,
    statusKey,
    taskType,
    isBug,
    assigneeId,
    sprintId,
    ...(product ? { product } : {}),
    ...(story ? { story } : {}),
    severity: kerjanText(raw.severity),
    estimate,
    qaKey: kerjanText(raw.qa_key),
    originTaskKey: kerjanText(raw.origin_task_key),
    doneAt,
    canceledAt,
    cancelReason: kerjanText(raw.cancel_reason),
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks.flatMap((entry) => {
          const task = asKerjanRecord(entry)
          const ref = task ? ticketRef(task.key, task.title) : undefined
          return task && ref
            ? [{ ...ref, statusKey: oneOf(KERJAN_TICKET_STATUSES, task.status) }]
            : []
        })
      : []
  }
}

export function mapKerjanTickets(value: unknown, context: KerjanMappingContext): KerjanIssue[] {
  return asKerjanRecords(value, 'tickets').flatMap((raw) => {
    try {
      return [mapKerjanTicket(raw, context)]
    } catch {
      // One malformed row must not hide the rest of the workspace.
      return []
    }
  })
}

function mapComment(raw: KerjanRecord, members: ReadonlyMap<string, KerjanMember>): JiraComment[] {
  const id = kerjanId(raw.id)
  if (!id) {
    return []
  }
  const user = toJiraUser(kerjanId(raw.author_id), members)
  return [
    {
      id,
      body: typeof raw.body === 'string' ? raw.body : '',
      createdAt: kerjanText(raw.created_at) ?? '',
      ...(user ? { user } : {})
    }
  ]
}

function mapHistory(
  raw: KerjanRecord,
  index: number,
  members: ReadonlyMap<string, KerjanMember>
): KerjanHistoryEntry {
  const user = toJiraUser(kerjanId(raw.actor_id ?? raw.author_id ?? raw.user_id), members)
  return {
    id: kerjanId(raw.id) ?? String(index),
    createdAt: kerjanText(raw.created_at) ?? '',
    ...(user ? { user } : {}),
    raw
  }
}

export function mapKerjanTicketDetail(
  value: unknown,
  context: KerjanMappingContext
): KerjanIssueDetail {
  const detail = asKerjanRecord(value)
  const ticket = asKerjanRecord(detail?.ticket)
  if (!detail || !ticket) {
    throw new KerjanApiError('Kerjan returned an unexpected ticket response.')
  }
  const issue = mapKerjanTicket(ticket, context)
  const epicRecord = asKerjanRecord(detail.epic)
  const storyRecord = asKerjanRecord(detail.story)
  const epic = epicRecord ? ticketRef(epicRecord.key, epicRecord.title) : undefined
  const story = storyRecord ? ticketRef(storyRecord.key, storyRecord.title) : undefined
  const parent = story ?? (issue.kind === 'story' ? epic : undefined)
  return {
    ...issue,
    ...(epic ? { epic } : {}),
    ...(story ? { story } : {}),
    ...(parent
      ? { parent: { ...parent, issueTypeName: parent === story ? 'Story' : 'Epic' } }
      : {}),
    comments: Array.isArray(detail.comments)
      ? detail.comments.flatMap((entry) => {
          const comment = asKerjanRecord(entry)
          return comment ? mapComment(comment, context.members) : []
        })
      : [],
    history: Array.isArray(detail.history)
      ? detail.history.flatMap((entry, index) => {
          const record = asKerjanRecord(entry)
          return record ? [mapHistory(record, index, context.members)] : []
        })
      : [],
    stories: Array.isArray(detail.stories) ? mapKerjanTickets(detail.stories, context) : []
  }
}
