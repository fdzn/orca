import { parseJiraIssueUrl } from './jira-issue-url'
import {
  getKerjanWorkspaceCodeFromTicketKey,
  normalizeKerjanBaseUrl,
  parseKerjanTicketUrl
} from './kerjan-ticket-url'
import { getWorkspaceSourceProvider } from './new-workspace/workspace-source'
import type { TaskSourceContext } from './task-source-context'
import type { WorkspaceLinkedItem } from './worktree/types'

function resolveLinkedItemProvider(
  item: Pick<WorkspaceLinkedItem, 'type' | 'number' | 'url'> & Partial<WorkspaceLinkedItem>
): WorkspaceLinkedItem['provider'] {
  if (item.provider) {
    return item.provider
  }
  // Why: TaskPage seeds can omit title; provider inference only needs type/url/identifiers.
  return getWorkspaceSourceProvider({
    type: item.type,
    number: item.number,
    url: item.url,
    title: item.title ?? '',
    ...(item.linearIdentifier ? { linearIdentifier: item.linearIdentifier } : {}),
    ...(item.jiraIdentifier ? { jiraIdentifier: item.jiraIdentifier } : {}),
    ...(item.kerjanIdentifier ? { kerjanIdentifier: item.kerjanIdentifier } : {}),
    ...(item.repoId ? { repoId: item.repoId } : {})
  })
}

export function isWorkspaceLinkedItemSourceContextMatch(
  item:
    | (Pick<WorkspaceLinkedItem, 'type' | 'number' | 'url'> & Partial<WorkspaceLinkedItem>)
    | null
    | undefined,
  context: TaskSourceContext | null | undefined
): boolean {
  if (!item || !context) {
    return false
  }
  // Why: TaskPage still seeds some GH/GL items without provider; use the same inference as write paths.
  const itemProvider = resolveLinkedItemProvider(item)
  if (itemProvider !== context.provider) {
    return false
  }
  if (itemProvider === 'kerjan') {
    return isKerjanLinkedItemSourceContextMatch(item, context)
  }
  if (itemProvider !== 'jira') {
    return true
  }
  const identity = context.providerIdentity
  const itemUrl = parseJiraIssueUrl(item.url)
  if (
    item.type !== 'issue' ||
    item.number !== 0 ||
    identity?.provider !== 'jira' ||
    !identity.siteId ||
    !identity.siteUrl ||
    !identity.projectKey ||
    !item.jiraIdentifier ||
    !itemUrl
  ) {
    return false
  }
  const siteUrl = parseJiraIssueUrl(
    `${identity.siteUrl.replace(/\/+$/g, '')}/browse/${itemUrl.issueKey}`
  )
  const projectKey = itemUrl.issueKey.slice(0, itemUrl.issueKey.lastIndexOf('-'))
  return (
    item.jiraIdentifier.toUpperCase() === itemUrl.issueKey &&
    identity.projectKey.toUpperCase() === projectKey &&
    siteUrl !== null &&
    itemUrl.origin === siteUrl.origin &&
    itemUrl.sitePath === siteUrl.sitePath
  )
}

function isKerjanLinkedItemSourceContextMatch(
  item: Pick<WorkspaceLinkedItem, 'type' | 'number' | 'url'> & Partial<WorkspaceLinkedItem>,
  context: TaskSourceContext
): boolean {
  const identity = context.providerIdentity
  const itemUrl = parseKerjanTicketUrl(item.url)
  const siteUrl =
    identity?.provider === 'kerjan' && identity.siteUrl
      ? normalizeKerjanBaseUrl(identity.siteUrl)
      : null
  if (
    item.type !== 'issue' ||
    item.number !== 0 ||
    identity?.provider !== 'kerjan' ||
    !siteUrl ||
    !item.kerjanIdentifier ||
    !itemUrl
  ) {
    return false
  }
  const site = new URL(siteUrl)
  return (
    item.kerjanIdentifier.toUpperCase() === itemUrl.ticketKey &&
    site.origin.toLowerCase() === itemUrl.origin &&
    site.pathname.replace(/\/+$/, '') === itemUrl.basePath &&
    (!identity.workspaceCode ||
      identity.workspaceCode.toUpperCase() ===
        getKerjanWorkspaceCodeFromTicketKey(itemUrl.ticketKey))
  )
}
