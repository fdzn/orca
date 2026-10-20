import {
  KERJAN_TASK_STATUSES,
  type KerjanIssueDetail,
  type KerjanMutationResult
} from '../../shared/kerjan-types'
import { readPipedStdin } from '../command-body-input'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { callKerjan, getKerjanViewerId, resolveKerjanTicketKey } from '../kerjan-target'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'

// Why: Kerjan rejects longer comments; fail before any write is attempted.
const KERJAN_COMMENT_MAX_CHARS = 10_000

const UNCONFIRMED_TRANSPORT_CODES = new Set([
  'runtime_timeout',
  'runtime_connection_failed',
  'runtime_disconnected',
  'runtime_unavailable'
])

async function callKerjanWrite(
  context: HandlerContext,
  method: string,
  params: unknown
): Promise<RuntimeRpcSuccess<KerjanIssueDetail>> {
  let response: RuntimeRpcSuccess<KerjanMutationResult>
  try {
    response = await callKerjan<KerjanMutationResult>(context.client, method, params)
  } catch (error) {
    if (error instanceof RuntimeClientError && UNCONFIRMED_TRANSPORT_CODES.has(error.code)) {
      throw new RuntimeClientError(
        'kerjan_write_unverified',
        `${error.message} The Kerjan change may have been applied. Read the ticket before retrying.`
      )
    }
    throw error
  }
  const { result } = response
  if (!result.ok) {
    // Why verbatim: 422s name the Kerjan rule ("(SPEC #n)") the caller must satisfy.
    throw new RuntimeClientError(
      'kerjan_write_failed',
      `${result.error} Kerjan did not confirm the change; read the ticket before retrying.`
    )
  }
  return { ...response, result: result.issue }
}

function rejectValuedSwitch(flags: Map<string, string | boolean>, name: string): boolean {
  const value = flags.get(name)
  if (value !== undefined && value !== true) {
    throw new RuntimeClientError('invalid_argument', `--${name} takes no value.`)
  }
  return value === true
}

async function readCommentBody(flags: Map<string, string | boolean>): Promise<string> {
  const fromStdin = rejectValuedSwitch(flags, 'body-stdin')
  if (fromStdin === flags.has('body')) {
    throw new RuntimeClientError('invalid_argument', 'Pass exactly one of --body or --body-stdin.')
  }
  const body = fromStdin ? await readPipedStdin('body') : getRequiredStringFlag(flags, 'body')
  if (!body.trim()) {
    throw new RuntimeClientError('invalid_argument', 'Comment body cannot be blank.')
  }
  if (body.length > KERJAN_COMMENT_MAX_CHARS) {
    throw new RuntimeClientError(
      'kerjan_body_too_large',
      `Kerjan comments must be at most ${KERJAN_COMMENT_MAX_CHARS} characters.`
    )
  }
  return body
}

function readTaskStatus(flags: Map<string, string | boolean>) {
  const wanted = getRequiredStringFlag(flags, 'to').trim().toLowerCase().replace(/-/g, '_')
  const status = KERJAN_TASK_STATUSES.find((value) => value === wanted)
  if (!status) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Status must be one of ${KERJAN_TASK_STATUSES.join(', ')}. Only Tasks take a status; Story and Epic status follows their Tasks.`
    )
  }
  return status
}

async function readAssignee(context: HandlerContext): Promise<string | null> {
  const member = getOptionalStringFlag(context.flags, 'member')?.trim()
  const me = rejectValuedSwitch(context.flags, 'me')
  const none = rejectValuedSwitch(context.flags, 'none')
  if ([Boolean(member), me, none].filter(Boolean).length !== 1) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pass exactly one of <memberId>, --me, or --none.'
    )
  }
  if (none) {
    return null
  }
  if (member) {
    if (!/^\d+$/.test(member)) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Kerjan member ids are numeric; see orca kerjan members.'
      )
    }
    return member
  }
  return getKerjanViewerId(context.client)
}

export const KERJAN_WRITE_HANDLERS: Record<string, CommandHandler> = {
  'kerjan comment': async (context) => {
    const body = await readCommentBody(context.flags)
    const key = await resolveKerjanTicketKey(
      context.client,
      getRequiredStringFlag(context.flags, 'key')
    )
    const response = await callKerjanWrite(context, 'kerjan.addComment', { key, body })
    printResult(response, context.json, () => `Commented on ${key}`)
  },
  'kerjan status': async (context) => {
    const status = readTaskStatus(context.flags)
    const comment = getOptionalStringFlag(context.flags, 'comment')
    const key = await resolveKerjanTicketKey(
      context.client,
      getRequiredStringFlag(context.flags, 'key')
    )
    const response = await callKerjanWrite(context, 'kerjan.setStatus', {
      key,
      status,
      ...(comment?.trim() ? { comment } : {})
    })
    printResult(response, context.json, (issue) => `${key} is now ${issue.statusKey}`)
  },
  'kerjan assign': async (context) => {
    const assigneeId = await readAssignee(context)
    const key = await resolveKerjanTicketKey(
      context.client,
      getRequiredStringFlag(context.flags, 'key')
    )
    const response = await callKerjanWrite(context, 'kerjan.setAssignee', { key, assigneeId })
    printResult(response, context.json, (issue) =>
      issue.assignee ? `Assigned ${key} to ${issue.assignee.displayName}` : `Unassigned ${key}`
    )
  }
}
