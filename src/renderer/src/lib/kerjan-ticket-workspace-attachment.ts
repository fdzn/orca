import {
  normalizeKerjanBaseUrl,
  normalizeKerjanTicketKey,
  parseKerjanTicketUrl
} from '../../../shared/kerjan-ticket-url'
import { getWorkspaceAttachments } from '../../../shared/workspace-attachments'
import type { WorkspaceAttachment, Worktree } from '../../../shared/worktree/types'
import type { TaskSourceContext } from '../../../shared/task-source-context'

export type KerjanTicketWorkspaceAttachmentIndex = ReadonlyMap<string, readonly Worktree[]>
export type KerjanTicketIdentity = { key: string; url: string }

export function getKerjanAttachmentTicketKey(item: WorkspaceAttachment): string | null {
  if (item.provider !== 'kerjan') {
    return null
  }
  return (
    normalizeKerjanTicketKey(item.kerjanIdentifier ?? item.identifier ?? '') ??
    parseKerjanTicketUrl(item.url ?? '')?.ticketKey ??
    null
  )
}

/** Site the attachment points at: its ticket URL, else the source context's Kerjan site. */
function attachmentSite(item: WorkspaceAttachment): string | null {
  const parsed = parseKerjanTicketUrl(item.url ?? '')
  if (parsed) {
    return `${parsed.origin}${parsed.basePath}`
  }
  const identity = item.taskSourceContext?.providerIdentity
  return identity?.provider === 'kerjan' && identity.siteUrl
    ? (normalizeKerjanBaseUrl(identity.siteUrl)?.toLowerCase() ?? null)
    : null
}

function ticketSite(url: string): string | null {
  const parsed = parseKerjanTicketUrl(url)
  return parsed ? `${parsed.origin}${parsed.basePath}` : null
}

// Why host only: Kerjan has one connection per host, so the host pins the login.
function sameSource(item: WorkspaceAttachment, source?: TaskSourceContext | null): boolean {
  return !source || (item.taskSourceContext?.hostId ?? 'local') === source.hostId
}

export function kerjanAttachmentMatchesTicket(
  item: WorkspaceAttachment,
  ticket: KerjanTicketIdentity,
  source?: TaskSourceContext | null
): boolean {
  if (
    getKerjanAttachmentTicketKey(item) !== normalizeKerjanTicketKey(ticket.key) ||
    !sameSource(item, source)
  ) {
    return false
  }
  const itemSite = attachmentSite(item)
  const issueSite = ticketSite(ticket.url)
  // Why: same key on two self-hosted sites is a different ticket; unknown sites stay matchable.
  return !itemSite || !issueSite || itemSite === issueSite
}

export function buildKerjanTicketWorkspaceAttachmentIndex(
  workspaces: readonly Worktree[]
): KerjanTicketWorkspaceAttachmentIndex {
  const index = new Map<string, Worktree[]>()
  for (const workspace of workspaces) {
    if (workspace.isArchived) {
      continue
    }
    const keys = new Set(getWorkspaceAttachments(workspace).map(getKerjanAttachmentTicketKey))
    for (const key of keys) {
      if (!key) {
        continue
      }
      const bucket = index.get(key)
      if (bucket) {
        bucket.push(workspace)
      } else {
        index.set(key, [workspace])
      }
    }
  }
  return index
}

export function findKerjanTicketWorkspaceAttachmentsInIndex(
  index: KerjanTicketWorkspaceAttachmentIndex,
  ticket: KerjanTicketIdentity,
  source?: TaskSourceContext | null
): readonly Worktree[] {
  const key = normalizeKerjanTicketKey(ticket.key)
  if (!key) {
    return []
  }
  return (index.get(key) ?? [])
    .filter((workspace) =>
      getWorkspaceAttachments(workspace).some((item) =>
        kerjanAttachmentMatchesTicket(item, ticket, source)
      )
    )
    .toSorted((a, b) => b.lastActivityAt - a.lastActivityAt)
}

export function findKerjanTicketWorkspaces(
  workspaces: readonly Worktree[],
  ticket: KerjanTicketIdentity,
  source?: TaskSourceContext | null
): readonly Worktree[] {
  return findKerjanTicketWorkspaceAttachmentsInIndex(
    buildKerjanTicketWorkspaceAttachmentIndex(workspaces),
    ticket,
    source
  )
}
