import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import {
  getLinkedWorkItemSuggestedName,
  getLinkedWorkItemWorkspaceName
} from '../../../shared/workspace-name'
import { getKerjanWorkspaceCodeFromTicketKey } from '../../../shared/kerjan-ticket-url'
import {
  normalizeTaskSourceContext,
  type TaskSourceContext
} from '../../../shared/task-source-context'
import type { ExecutionHostId } from '../../../shared/execution-host'

export type KerjanTicketLike = { key: string; title: string; url: string }

export function buildKerjanTicketLinkedWorkItem(ticket: KerjanTicketLike): LinkedWorkItemSummary {
  return {
    type: 'issue',
    provider: 'kerjan',
    number: 0,
    title: `${ticket.key} ${ticket.title}`,
    url: ticket.url,
    kerjanIdentifier: ticket.key
  }
}

export function getKerjanTicketWorkspaceSeed(ticket: KerjanTicketLike): string {
  const linked = buildKerjanTicketLinkedWorkItem(ticket)
  return getLinkedWorkItemWorkspaceName(linked)?.seedName ?? getLinkedWorkItemSuggestedName(ticket)
}

/** Where Kerjan tickets come from: the account host, the connected site, one workspace. */
export function buildKerjanTaskSourceContext(args: {
  projectId: string
  hostId: ExecutionHostId
  siteUrl: string | null
  workspaceCode: string | null
  projectHostSetupId?: string | null
  repoId?: string | null
}): TaskSourceContext | null {
  let accountLabel: string | null = null
  try {
    accountLabel = args.siteUrl ? new URL(args.siteUrl).host : null
  } catch {
    accountLabel = null
  }
  return normalizeTaskSourceContext({
    provider: 'kerjan',
    projectId: args.projectId,
    hostId: args.hostId,
    projectHostSetupId: args.projectHostSetupId,
    repoId: args.repoId,
    providerIdentity: {
      provider: 'kerjan',
      siteUrl: args.siteUrl,
      workspaceCode: args.workspaceCode
    },
    accountLabel
  })
}

/** Pins the source context to the ticket's own workspace (its key prefix). */
export function bindKerjanTicketSourceContext(
  ticket: Pick<KerjanTicketLike, 'key'>,
  sourceContext: TaskSourceContext | null
): TaskSourceContext | null {
  if (sourceContext?.provider !== 'kerjan') {
    return null
  }
  const identity = sourceContext.providerIdentity
  const workspaceCode = getKerjanWorkspaceCodeFromTicketKey(ticket.key)
  if (identity?.provider !== 'kerjan' || !workspaceCode) {
    return sourceContext
  }
  return normalizeTaskSourceContext({
    ...sourceContext,
    providerIdentity: { ...identity, workspaceCode }
  })
}
