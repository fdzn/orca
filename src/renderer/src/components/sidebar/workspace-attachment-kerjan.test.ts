import { describe, expect, it } from 'vitest'
import type { WorkspaceAttachment } from '../../../../shared/worktree/types'
import { getWorkspaceAttachmentSourceLabel } from './workspace-attachment-source-label'
import {
  parseWorkspaceAttachmentInput,
  workspaceAttachmentLabel,
  workspaceAttachmentProviderLabel
} from './worktree-attachment-editing'

const kerjan: WorkspaceAttachment = {
  provider: 'kerjan',
  type: 'issue',
  number: 0,
  kerjanIdentifier: 'OMX-40',
  url: 'https://kerjan.example/app/ticket/OMX-40',
  taskSourceContext: {
    kind: 'task-source',
    provider: 'kerjan',
    projectId: 'project',
    hostId: 'local',
    providerIdentity: {
      provider: 'kerjan',
      siteUrl: 'https://kerjan.example/app',
      workspaceCode: 'OMX'
    },
    accountLabel: 'Alice'
  }
}

describe('Kerjan workspace attachments in the sidebar', () => {
  it('labels the ticket by key with its site, workspace, and account', () => {
    expect(workspaceAttachmentLabel(kerjan)).toBe('OMX-40')
    expect(workspaceAttachmentProviderLabel(kerjan)).toBe('Kerjan')
    expect(getWorkspaceAttachmentSourceLabel(kerjan)).toBe('kerjan.example/app · OMX · Alice')
    const { taskSourceContext: _source, ...bare } = kerjan
    expect(getWorkspaceAttachmentSourceLabel(bare)).toBe('kerjan.example/app')
  })

  it('parses a pasted Kerjan ticket URL into a Kerjan reference', () => {
    expect(
      parseWorkspaceAttachmentInput('https://kerjan.example/ticket/omx-40', 'github-issue')
    ).toEqual({
      provider: 'kerjan',
      type: 'issue',
      number: 0,
      identifier: 'OMX-40',
      kerjanIdentifier: 'OMX-40',
      url: 'https://kerjan.example/ticket/omx-40'
    })
    expect(
      parseWorkspaceAttachmentInput('https://jira.example/browse/OMX-40', 'jira-issue')?.provider
    ).toBe('jira')
  })
})
