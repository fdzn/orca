import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import {
  KERJAN_TASK_STATUSES,
  KERJAN_TASK_TYPES,
  KERJAN_TICKET_KINDS,
  KERJAN_TICKET_STATUSES,
  type KerjanIssue,
  type KerjanTaskStatus,
  type KerjanTaskType,
  type KerjanTicketKind,
  type KerjanTicketStatus
} from '../../../shared/kerjan-types'

export type KerjanOption<T extends string> = { id: T; label: string }

export const getKerjanKindLabels = createLocalizedCatalog((): Record<KerjanTicketKind, string> => ({
  epic: translate('auto.components.KerjanTickets.kindEpic', 'Epic'),
  story: translate('auto.components.KerjanTickets.kindStory', 'Story'),
  task: translate('auto.components.KerjanTickets.kindTask', 'Task')
}))

export const getKerjanStatusLabels = createLocalizedCatalog(
  (): Record<KerjanTicketStatus, string> => ({
    todo: translate('auto.components.KerjanTickets.statusTodo', 'To Do'),
    in_progress: translate('auto.components.KerjanTickets.statusInProgress', 'In Progress'),
    ready_for_qa: translate('auto.components.KerjanTickets.statusReadyForQa', 'Ready for QA'),
    testing: translate('auto.components.KerjanTickets.statusTesting', 'Testing'),
    done: translate('auto.components.KerjanTickets.statusDone', 'Done'),
    canceled: translate('auto.components.KerjanTickets.statusCanceled', 'Canceled')
  })
)

export const getKerjanTaskTypeLabels = createLocalizedCatalog(
  (): Record<KerjanTaskType, string> => ({
    dev: translate('auto.components.KerjanTickets.taskTypeDev', 'Dev'),
    qa: translate('auto.components.KerjanTickets.taskTypeQa', 'QA'),
    bug: translate('auto.components.KerjanTickets.taskTypeBug', 'Bug')
  })
)

export function getKerjanKindOptions(): KerjanOption<KerjanTicketKind>[] {
  const labels = getKerjanKindLabels()
  return KERJAN_TICKET_KINDS.map((id) => ({ id, label: labels[id] }))
}

export function getKerjanStatusOptions(): KerjanOption<KerjanTicketStatus>[] {
  const labels = getKerjanStatusLabels()
  return KERJAN_TICKET_STATUSES.map((id) => ({ id, label: labels[id] }))
}

export function getKerjanTaskStatusOptions(): KerjanOption<KerjanTaskStatus>[] {
  const labels = getKerjanStatusLabels()
  return KERJAN_TASK_STATUSES.map((id) => ({ id, label: labels[id] }))
}

export function getKerjanTaskTypeOptions(): KerjanOption<KerjanTaskType>[] {
  const labels = getKerjanTaskTypeLabels()
  return KERJAN_TASK_TYPES.map((id) => ({ id, label: labels[id] }))
}

/** "Task · Dev", "Story · Bug", or just the kind. */
export function getKerjanTicketTypeLabel(
  issue: Pick<KerjanIssue, 'kind' | 'taskType' | 'isBug'>
): string {
  const kind = getKerjanKindLabels()[issue.kind]
  if (issue.kind === 'task' && issue.taskType) {
    return `${kind} · ${getKerjanTaskTypeLabels()[issue.taskType]}`
  }
  return issue.isBug ? `${kind} · ${getKerjanTaskTypeLabels().bug}` : kind
}
