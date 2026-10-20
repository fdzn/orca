import type {
  KerjanIssueUpdate,
  KerjanMutationResult,
  KerjanTaskStatus
} from '../../shared/kerjan-types'
import { kerjanRequest, type KerjanRequestOptions } from './authenticated-request'
import { mapKerjanTicketDetail } from './kerjan-ticket-mapping'
import { loadKerjanMappingContext, requireKerjanTicketKey, withKerjanClient } from './issue-queries'

export const KERJAN_COMMENT_MAX_CHARS = 10_000

// Every Kerjan mutation answers with the full ticket detail, so callers get the fresh ticket back.
async function mutateTicket(
  key: string,
  suffix: string,
  options: Pick<KerjanRequestOptions, 'method' | 'body'>
): Promise<KerjanMutationResult> {
  try {
    const ticket = requireKerjanTicketKey(key)
    return await withKerjanClient(async (client) => {
      const [detail, context] = await Promise.all([
        kerjanRequest(client, `/tickets/${encodeURIComponent(ticket.key)}${suffix}`, {
          ...options,
          workspaceCode: ticket.workspaceCode
        }),
        loadKerjanMappingContext(client, ticket.workspaceCode, { products: true })
      ])
      return { ok: true, issue: mapKerjanTicketDetail(detail, context) }
    })
  } catch (error) {
    // Why the message as-is: 422s name the Kerjan rule ("(SPEC #n)") the user must satisfy.
    return {
      ok: false,
      error: error instanceof Error && error.message ? error.message : 'Kerjan update failed.'
    }
  }
}

/** Tasks only: Story/Epic status is derived from their Tasks, and Done needs an assignee. */
export function setStatus(
  key: string,
  status: KerjanTaskStatus,
  comment?: string
): Promise<KerjanMutationResult> {
  const note = comment?.trim()
  return mutateTicket(key, '/status', {
    method: 'POST',
    body: { status, ...(note ? { comment: note } : {}) }
  })
}

export async function addComment(key: string, body: string): Promise<KerjanMutationResult> {
  const text = body.trim()
  if (!text) {
    return { ok: false, error: 'Comment body is required.' }
  }
  if (text.length > KERJAN_COMMENT_MAX_CHARS) {
    return {
      ok: false,
      error: `Kerjan comments are limited to ${KERJAN_COMMENT_MAX_CHARS} characters.`
    }
  }
  return mutateTicket(key, '/comments', { method: 'POST', body: { body: text } })
}

/** `null` unassigns, which Kerjan allows only while the Task is To Do. */
export async function setAssignee(
  key: string,
  assigneeId: string | null
): Promise<KerjanMutationResult> {
  const id = assigneeId?.trim() || null
  // Why numeric: Kerjan member ids are integers and its JSON decoder rejects a quoted id.
  if (id !== null && !/^\d+$/.test(id)) {
    return { ok: false, error: `"${id}" is not a Kerjan member id.` }
  }
  return mutateTicket(key, '/assignee', {
    method: 'PUT',
    body: { assignee_id: id === null ? null : Number(id) }
  })
}

export async function updateIssue(
  key: string,
  updates: KerjanIssueUpdate
): Promise<KerjanMutationResult> {
  const title = updates.title?.trim()
  if (updates.title !== undefined && !title) {
    return { ok: false, error: 'Title cannot be empty.' }
  }
  const body = {
    ...(title ? { title } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {})
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, error: 'Nothing to update.' }
  }
  return mutateTicket(key, '', { method: 'PATCH', body })
}
