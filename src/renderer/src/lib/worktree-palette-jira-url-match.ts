import { parseJiraIssueUrl, type ParsedJiraIssueUrl } from '../../../shared/jira-issue-url'
import { getWorkspaceAttachments } from '../../../shared/workspace-attachments'
import type { Worktree } from '../../../shared/worktree/types'

export function worktreeMatchesJiraUrl(worktree: Worktree, parsed: ParsedJiraIssueUrl): boolean {
  return getWorkspaceAttachments(worktree).some((item) => {
    if (item.provider !== 'jira') {
      return false
    }
    const linkedUrl = item.url ? parseJiraIssueUrl(item.url) : null
    if (linkedUrl) {
      return (
        linkedUrl.issueKey === parsed.issueKey &&
        linkedUrl.origin === parsed.origin &&
        linkedUrl.sitePath === parsed.sitePath
      )
    }
    return (item.identifier ?? item.jiraIdentifier)?.toUpperCase() === parsed.issueKey
  })
}
