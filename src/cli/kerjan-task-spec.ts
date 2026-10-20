import type { KerjanIssueDetail } from '../shared/kerjan-types'
import { kerjanKindLabel } from './kerjan-format'

export function kerjanTaskTitle(issue: KerjanIssueDetail): string {
  return `${issue.key}: ${issue.title}`
}

/** The caller's spec (if any), then the ticket; the description carries its acceptance criteria. */
export function buildKerjanTaskSpec(issue: KerjanIssueDetail, spec?: string): string {
  const ticket = [
    `## Kerjan ticket ${kerjanTaskTitle(issue)}`,
    '',
    `URL: ${issue.url}`,
    `Kind: ${kerjanKindLabel(issue)}`,
    `Status: ${issue.statusKey}`,
    '',
    issue.description?.trim() || '(No description.)'
  ].join('\n')
  const extra = spec?.trim()
  return extra ? `${extra}\n\n${ticket}` : ticket
}
