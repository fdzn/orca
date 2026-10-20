import type { ParsedKerjanTicketUrl } from '../../../shared/kerjan-ticket-url'
import { getWorkspaceAttachments } from '../../../shared/workspace-attachments'
import type { Worktree } from '../../../shared/worktree/types'
import { kerjanAttachmentMatchesTicket } from './kerjan-ticket-workspace-attachment'

export function kerjanTicketUrlFromParsed(parsed: ParsedKerjanTicketUrl): string {
  return `${parsed.origin}${parsed.basePath}/ticket/${parsed.ticketKey}`
}

export function worktreeMatchesKerjanUrl(
  worktree: Worktree,
  parsed: ParsedKerjanTicketUrl
): boolean {
  const ticket = { key: parsed.ticketKey, url: kerjanTicketUrlFromParsed(parsed) }
  return getWorkspaceAttachments(worktree).some((item) =>
    kerjanAttachmentMatchesTicket(item, ticket)
  )
}

export function getKerjanTaskUrlCreatePreview(parsed: ParsedKerjanTicketUrl): {
  provider: 'kerjan'
  identifier: string
  subtitle: string
  kindLabel: string
  createLabel: string
} {
  return {
    provider: 'kerjan',
    identifier: parsed.ticketKey,
    subtitle: `${parsed.origin.replace(/^https?:\/\//, '')}${parsed.basePath}`,
    kindLabel: 'Kerjan ticket',
    createLabel: `Create worktree from Kerjan ticket ${parsed.ticketKey}`
  }
}
