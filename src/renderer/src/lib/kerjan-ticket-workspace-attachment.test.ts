import { describe, expect, it } from 'vitest'
import { makeWorktree } from '@/store/slices/worktrees-slice-test-fixtures'
import type { Worktree } from '../../../shared/worktree/types'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import {
  findKerjanTicketWorkspaces,
  getKerjanAttachmentTicketKey,
  kerjanAttachmentMatchesTicket
} from './kerjan-ticket-workspace-attachment'

const ticket = { key: 'OMX-40', url: 'https://kerjan.example/app/ticket/OMX-40' }
const source: TaskSourceContext = {
  kind: 'task-source',
  provider: 'kerjan',
  projectId: 'project-a',
  hostId: 'local',
  providerIdentity: {
    provider: 'kerjan',
    siteUrl: 'https://kerjan.example/app',
    workspaceCode: 'OMX'
  }
}
function linked(id: string, overrides: Partial<Worktree> = {}) {
  return makeWorktree({
    id,
    repoId: 'repo',
    linkedItems: [
      {
        provider: 'kerjan',
        type: 'issue',
        number: 0,
        identifier: 'omx-40',
        url: ticket.url,
        taskSourceContext: source
      }
    ],
    ...overrides
  })
}

describe('Kerjan workspace attachment identity', () => {
  it('reads the key from the identifier, kerjanIdentifier, or ticket URL', () => {
    expect(
      getKerjanAttachmentTicketKey({
        provider: 'kerjan',
        type: 'issue',
        number: 0,
        identifier: 'omx-1'
      })
    ).toBe('OMX-1')
    expect(
      getKerjanAttachmentTicketKey({
        provider: 'kerjan',
        type: 'issue',
        number: 0,
        url: 'https://kerjan.example/ticket/omx-2'
      })
    ).toBe('OMX-2')
    expect(
      getKerjanAttachmentTicketKey({
        provider: 'jira',
        type: 'issue',
        number: 0,
        identifier: 'OMX-1'
      })
    ).toBeNull()
  })

  it('finds every linked workspace and puts recent activity first', () => {
    const first = linked('api', { repoId: 'api', lastActivityAt: 1 })
    const second = linked('web', { repoId: 'web', lastActivityAt: 2 })
    expect(findKerjanTicketWorkspaces([first, second], ticket, source)).toEqual([second, first])
  })

  it('reads secondary attachments and skips archived workspaces', () => {
    const workspace = linked('secondary')
    workspace.linkedWorkItem = {
      provider: 'github',
      type: 'issue',
      number: 42,
      title: 'Selected',
      url: 'https://github.com/acme/api/issues/42'
    }
    expect(
      findKerjanTicketWorkspaces([linked('archived', { isArchived: true }), workspace], ticket)
    ).toEqual([workspace])
  })

  it('rejects the same key on another site or base path, or from another host', () => {
    const workspace = linked('same-key')
    expect(
      findKerjanTicketWorkspaces([workspace], {
        ...ticket,
        url: 'https://other.example/ticket/OMX-40'
      })
    ).toEqual([])
    expect(
      findKerjanTicketWorkspaces([workspace], {
        ...ticket,
        url: 'https://kerjan.example/ticket/OMX-40'
      })
    ).toEqual([])
    expect(
      findKerjanTicketWorkspaces([workspace], ticket, { ...source, hostId: 'runtime:cloud' })
    ).toEqual([])
    expect(
      findKerjanTicketWorkspaces([workspace], ticket, { ...source, projectId: 'other-project' })
    ).toEqual([workspace])
  })

  it('falls back to the source site for key-only links and stays permissive when unknown', () => {
    const keyOnly = {
      provider: 'kerjan' as const,
      type: 'issue' as const,
      number: 0,
      kerjanIdentifier: 'OMX-40',
      taskSourceContext: source
    }
    expect(kerjanAttachmentMatchesTicket(keyOnly, ticket)).toBe(true)
    expect(
      kerjanAttachmentMatchesTicket(keyOnly, {
        ...ticket,
        url: 'https://other.example/ticket/OMX-40'
      })
    ).toBe(false)
    const { taskSourceContext: _source, ...bare } = keyOnly
    expect(
      kerjanAttachmentMatchesTicket(bare, { ...ticket, url: 'https://other.example/ticket/OMX-40' })
    ).toBe(true)
  })
})
