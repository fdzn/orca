import {
  KERJAN_TASK_TYPES,
  KERJAN_TICKET_KINDS,
  KERJAN_TICKET_STATUSES,
  type KerjanIssue,
  type KerjanIssueListFilters,
  type KerjanMember,
  type KerjanSprint,
  type KerjanWorkspace
} from '../../shared/kerjan-types'
import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'
import {
  formatKerjanIssue,
  formatKerjanIssueList,
  formatKerjanMemberList,
  formatKerjanSprintList,
  formatKerjanWorkspaceList
} from '../kerjan-format'
import { callKerjan, getKerjanViewerId, readKerjanTicket } from '../kerjan-target'
import { RuntimeClientError } from '../runtime-client'
import { KERJAN_CONNECTION_HANDLERS } from './kerjan-connection'
import { KERJAN_WRITE_HANDLERS } from './kerjan-write'

// Matches the host's zod cap on list limits.
const KERJAN_LIST_LIMIT_MAX = 1000

function readWorkspaceCode(
  flags: Map<string, string | boolean>,
  required: boolean
): string | undefined {
  const value = (
    required ? getRequiredStringFlag(flags, 'workspace') : getOptionalStringFlag(flags, 'workspace')
  )?.trim()
  if (value === undefined) {
    return undefined
  }
  if (!/^[A-Za-z]{2,10}$/.test(value)) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--workspace must be a Kerjan workspace code (2-10 letters); see orca kerjan workspaces.'
    )
  }
  return value.toUpperCase()
}

function readEnumFlag<T extends string>(
  flags: Map<string, string | boolean>,
  name: string,
  values: readonly T[]
): T | undefined {
  const wanted = getOptionalStringFlag(flags, name)?.trim().toLowerCase().replace(/-/g, '_')
  if (wanted === undefined) {
    return undefined
  }
  const match = values.find((value) => value === wanted)
  if (!match) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--${name} must be one of ${values.join(', ')}.`
    )
  }
  return match
}

function readIdFlag(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = getOptionalStringFlag(flags, name)?.trim()
  if (value !== undefined && !/^\d+$/.test(value)) {
    throw new RuntimeClientError('invalid_argument', `--${name} must be a numeric Kerjan id.`)
  }
  return value
}

async function readListFilters(context: HandlerContext): Promise<KerjanIssueListFilters> {
  const { flags } = context
  const mine = flags.get('mine')
  if (mine !== undefined && mine !== true) {
    throw new RuntimeClientError('invalid_argument', '--mine takes no value.')
  }
  const assignee = readIdFlag(flags, 'assignee')
  if (mine === true && assignee) {
    throw new RuntimeClientError('invalid_argument', 'Pass --assignee or --mine, not both.')
  }
  const limit = getOptionalPositiveIntegerFlag(flags, 'limit')
  if (limit !== undefined && limit > KERJAN_LIST_LIMIT_MAX) {
    throw new RuntimeClientError(
      'invalid_argument',
      `--limit must be at most ${KERJAN_LIST_LIMIT_MAX}.`
    )
  }
  const filters: KerjanIssueListFilters = {
    status: readEnumFlag(flags, 'status', KERJAN_TICKET_STATUSES),
    kind: readEnumFlag(flags, 'kind', KERJAN_TICKET_KINDS),
    taskType: readEnumFlag(flags, 'type', KERJAN_TASK_TYPES),
    sprintId: readIdFlag(flags, 'sprint'),
    assigneeId: assignee,
    query: getOptionalStringFlag(flags, 'query')?.trim() || undefined,
    limit
  }
  if (mine === true) {
    filters.assigneeId = await getKerjanViewerId(context.client)
  }
  return filters
}

export const KERJAN_HANDLERS: Record<string, CommandHandler> = {
  ...KERJAN_CONNECTION_HANDLERS,
  ...KERJAN_WRITE_HANDLERS,
  'kerjan workspaces': async (context) => {
    const response = await callKerjan<KerjanWorkspace[]>(context.client, 'kerjan.listWorkspaces')
    printResult(response, context.json, formatKerjanWorkspaceList)
  },
  'kerjan sprints': async (context) => {
    const workspaceCode = readWorkspaceCode(context.flags, true)
    const response = await callKerjan<KerjanSprint[]>(context.client, 'kerjan.listSprints', {
      workspaceCode
    })
    printResult(response, context.json, formatKerjanSprintList)
  },
  'kerjan members': async (context) => {
    const workspaceCode = readWorkspaceCode(context.flags, false)
    const response = await callKerjan<KerjanMember[]>(
      context.client,
      'kerjan.listMembers',
      workspaceCode ? { workspaceCode } : undefined
    )
    printResult(response, context.json, formatKerjanMemberList)
  },
  'kerjan list': async (context) => {
    const workspaceCode = readWorkspaceCode(context.flags, true)
    const filters = await readListFilters(context)
    const response = await callKerjan<KerjanIssue[]>(context.client, 'kerjan.listIssues', {
      workspaceCode,
      filters
    })
    printResult(response, context.json, formatKerjanIssueList)
  },
  'kerjan issue': async (context) => {
    const response = await readKerjanTicket(
      context.client,
      getRequiredStringFlag(context.flags, 'key')
    )
    printResult(response, context.json, formatKerjanIssue)
  }
}
