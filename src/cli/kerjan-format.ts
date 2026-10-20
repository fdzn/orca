import type {
  KerjanConnectionStatus,
  KerjanIssue,
  KerjanIssueDetail,
  KerjanMember,
  KerjanSprint,
  KerjanWorkspace
} from '../shared/kerjan-types'
import { formatJiraCommentList } from './jira-format'

function memberLabel(member: KerjanMember | null | undefined): string {
  if (!member) {
    return 'unknown'
  }
  return member.email ? `${member.name} <${member.email}>` : member.name
}

export function formatKerjanConnection(status: KerjanConnectionStatus): string {
  const lines = status.connected
    ? [`Connected to ${status.siteUrl ?? 'Kerjan'} as ${memberLabel(status.viewer)}`]
    : ['Not connected to Kerjan.']
  if (status.credentialError) {
    lines.push(status.credentialError)
  }
  if (status.credentialProtection === 'plaintext') {
    lines.push('Warning: the saved token is stored unencrypted on this host.')
  }
  return lines.join('\n')
}

export function formatKerjanWorkspaceList(workspaces: KerjanWorkspace[]): string {
  if (workspaces.length === 0) {
    return 'No workspaces.'
  }
  return workspaces
    .map(
      (workspace) =>
        `${workspace.code}\t${workspace.name}${workspace.readOnly ? `\t(read-only: synced from Jira ${workspace.jiraProject})` : ''}`
    )
    .join('\n')
}

export function formatKerjanSprintList(sprints: KerjanSprint[]): string {
  if (sprints.length === 0) {
    return 'No sprints.'
  }
  return sprints
    .map((sprint) =>
      [
        sprint.id,
        sprint.name,
        sprint.state ?? '',
        sprint.startDate || sprint.endDate
          ? `${sprint.startDate ?? '?'} → ${sprint.endDate ?? '?'}`
          : ''
      ]
        .join('\t')
        .trimEnd()
    )
    .join('\n')
}

export function formatKerjanMemberList(members: KerjanMember[]): string {
  if (members.length === 0) {
    return 'No members.'
  }
  return members
    .map((member) => `${member.id}\t${member.name}${member.email ? `\t${member.email}` : ''}`)
    .join('\n')
}

export function formatKerjanIssueList(issues: KerjanIssue[]): string {
  if (issues.length === 0) {
    return 'No tickets.'
  }
  return issues
    .map(
      (issue) =>
        `${issue.key}\t${issue.statusKey}\t${issue.assignee?.displayName ?? 'unassigned'}\t${issue.title}`
    )
    .join('\n')
}

export function kerjanKindLabel(issue: KerjanIssue): string {
  return issue.taskType ? `${issue.issueType.name} (${issue.taskType})` : issue.issueType.name
}

export function formatKerjanIssue(issue: KerjanIssueDetail): string {
  const lines = [
    `${issue.key} ${issue.title}`,
    `URL: ${issue.url}`,
    `Kind: ${kerjanKindLabel(issue)}`,
    `Status: ${issue.statusKey}`,
    `Workspace: ${issue.project.key}`,
    `Assignee: ${issue.assignee?.displayName ?? 'unassigned'}`
  ]
  if (issue.sprint) {
    lines.push(`Sprint: ${issue.sprint}`)
  }
  if (issue.epic) {
    lines.push(`Epic: ${issue.epic.key} ${issue.epic.title}`)
  }
  if (issue.story) {
    lines.push(`Story: ${issue.story.key} ${issue.story.title}`)
  }
  if (issue.severity) {
    lines.push(`Severity: ${issue.severity}`)
  }
  if (issue.tasks.length > 0) {
    lines.push(
      `Tasks: ${issue.tasks.map((task) => `${task.key} [${task.statusKey ?? '?'}]`).join(', ')}`
    )
  }
  if (issue.description) {
    lines.push('', issue.description)
  }
  if (issue.comments.length > 0) {
    lines.push('', 'Comments:', formatJiraCommentList(issue.comments))
  }
  return lines.join('\n')
}
