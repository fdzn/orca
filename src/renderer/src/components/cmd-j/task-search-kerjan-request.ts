import { useAppStore } from '@/store'
import { kerjanStatus } from '@/runtime/runtime-kerjan-client'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import {
  normalizeTaskSourceContext,
  type TaskSourceContext
} from '../../../../shared/task-source-context'
import { makeCmdJTaskSearchResult, type CmdJTaskSearchResult } from './task-search-results'

export async function searchKerjanTasks(args: {
  source: TaskSourceContext
  target: RuntimeClientTarget
  query: string
  signal: AbortSignal
  initialRepoId: string | null
  hostLabel: string
  limit: number
}): Promise<CmdJTaskSearchResult[]> {
  // Why: Kerjan lists are per workspace, so search only the one the Tasks page has selected.
  const workspaceCode = useAppStore.getState().kerjanSelectedWorkspaceCode
  if (!workspaceCode) {
    return []
  }
  const status = await kerjanStatus(args.target)
  if (args.signal.aborted || !status.connected) {
    return []
  }
  const itemSource = normalizeTaskSourceContext({
    ...args.source,
    providerIdentity: { provider: 'kerjan', siteUrl: status.siteUrl, workspaceCode },
    accountLabel: status.viewer?.name ?? status.siteUrl
  })
  if (!itemSource) {
    return []
  }
  const issues = await useAppStore
    .getState()
    .listKerjanIssues(
      workspaceCode,
      { query: args.query, limit: args.limit },
      { sourceContext: itemSource }
    )
  return issues.map((issue) =>
    makeCmdJTaskSearchResult(
      { provider: 'kerjan', issue },
      itemSource,
      args.initialRepoId,
      args.hostLabel
    )
  )
}
