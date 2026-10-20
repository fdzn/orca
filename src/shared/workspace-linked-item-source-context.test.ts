import { describe, expect, it } from 'vitest'
import type { TaskSourceContext } from './task-source-context'
import type { WorkspaceLinkedItem } from './worktree/types'
import { isWorkspaceLinkedItemSourceContextMatch } from './workspace-linked-item-source-context'

const JIRA_ITEM: WorkspaceLinkedItem = {
  provider: 'jira',
  type: 'issue',
  number: 0,
  title: 'ORCA-123 Link Jira',
  url: 'https://company.atlassian.net/jira/browse/ORCA-123',
  jiraIdentifier: 'ORCA-123'
}

const JIRA_CONTEXT: TaskSourceContext = {
  kind: 'task-source',
  provider: 'jira',
  projectId: 'project-1',
  hostId: 'local',
  providerIdentity: {
    provider: 'jira',
    siteId: 'site-1',
    siteUrl: 'https://company.atlassian.net/jira',
    projectKey: 'ORCA'
  }
}

describe('workspace linked-item source context', () => {
  it('requires Jira key, site URL, site account, and project identity to agree', () => {
    expect(isWorkspaceLinkedItemSourceContextMatch(JIRA_ITEM, JIRA_CONTEXT)).toBe(true)
    expect(
      isWorkspaceLinkedItemSourceContextMatch(JIRA_ITEM, {
        ...JIRA_CONTEXT,
        providerIdentity: {
          ...JIRA_CONTEXT.providerIdentity!,
          provider: 'jira',
          siteUrl: 'https://other.atlassian.net'
        }
      })
    ).toBe(false)
    expect(
      isWorkspaceLinkedItemSourceContextMatch(JIRA_ITEM, {
        ...JIRA_CONTEXT,
        providerIdentity: {
          ...JIRA_CONTEXT.providerIdentity!,
          provider: 'jira',
          projectKey: 'OTHER'
        }
      })
    ).toBe(false)
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        { ...JIRA_ITEM, jiraIdentifier: 'ORCA-999' },
        JIRA_CONTEXT
      )
    ).toBe(false)
  })

  it('keeps provider matching sufficient for non-Jira items', () => {
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        {
          provider: 'linear',
          type: 'issue',
          number: 0,
          title: 'Linear item',
          url: 'https://linear.app/acme/issue/ENG-1/item'
        },
        {
          kind: 'task-source',
          provider: 'linear',
          projectId: 'project-1',
          hostId: 'local'
        }
      )
    ).toBe(true)
  })

  it('infers GitHub/GitLab provider when TaskPage seeds omit provider', () => {
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        {
          type: 'issue',
          number: 42,
          title: 'GitHub issue',
          url: 'https://github.com/acme/repo/issues/42'
        },
        {
          kind: 'task-source',
          provider: 'github',
          projectId: 'project-1',
          hostId: 'local'
        }
      )
    ).toBe(true)
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        {
          type: 'mr',
          number: 7,
          title: 'GitLab MR',
          url: 'https://gitlab.com/acme/repo/-/merge_requests/7'
        },
        {
          kind: 'task-source',
          provider: 'gitlab',
          projectId: 'project-1',
          hostId: 'local'
        }
      )
    ).toBe(true)
  })

  it('requires Kerjan key, site URL, and workspace code to agree', () => {
    const item: WorkspaceLinkedItem = {
      provider: 'kerjan',
      type: 'issue',
      number: 0,
      title: 'Fix login',
      url: 'https://kerjan.example.com/app/ticket/OMX-40',
      kerjanIdentifier: 'OMX-40'
    }
    const context: TaskSourceContext = {
      kind: 'task-source',
      provider: 'kerjan',
      projectId: 'kerjan',
      hostId: 'local',
      providerIdentity: {
        provider: 'kerjan',
        siteUrl: 'https://kerjan.example.com/app/',
        workspaceCode: 'omx'
      }
    }
    expect(isWorkspaceLinkedItemSourceContextMatch(item, context)).toBe(true)
    for (const providerIdentity of [
      { provider: 'kerjan', siteUrl: 'https://kerjan.example.com', workspaceCode: 'OMX' },
      { provider: 'kerjan', siteUrl: 'https://kerjan.example.com/app', workspaceCode: 'ENG' },
      { provider: 'kerjan', siteUrl: null, workspaceCode: 'OMX' }
    ] as const) {
      expect(isWorkspaceLinkedItemSourceContextMatch(item, { ...context, providerIdentity })).toBe(
        false
      )
    }
    expect(
      isWorkspaceLinkedItemSourceContextMatch({ ...item, kerjanIdentifier: 'OMX-41' }, context)
    ).toBe(false)
  })
})
