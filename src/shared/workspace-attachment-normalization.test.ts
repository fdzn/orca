import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeWorkspaceAttachment,
  normalizeWorkspaceAttachments,
  toWorkspaceLinkedItem
} from './workspace-attachment-normalization'
import type { TaskSourceContext } from './task-source-context'
import type { WorkspaceAttachment } from './worktree/types'

function pr(number: number, repository?: string): WorkspaceAttachment {
  return {
    provider: 'github',
    type: 'pr',
    number,
    ...(repository ? { url: `https://github.com/acme/${repository}/pull/${number}` } : {})
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('workspace attachment normalization', () => {
  it('scales URL parsing with references instead of comparing unrelated identities', () => {
    const NativeURL = URL
    let parses = 0
    vi.stubGlobal(
      'URL',
      class extends NativeURL {
        constructor(...args: ConstructorParameters<typeof NativeURL>) {
          super(...args)
          parses++
        }
      }
    )
    const counts = [23, 230].map((count) => {
      const items = Array.from({ length: count }, (_, index) => pr(index + 1, 'repo'))
      parses = 0
      expect(normalizeWorkspaceAttachments(items)).toEqual(items)
      return parses
    })
    expect(counts[0]).toBeGreaterThan(0)
    expect(counts[1]).toBeLessThanOrEqual(counts[0] * 11)
  })

  it('preserves global order, enrichment chains and ambiguous sources across identity groups', () => {
    const origin = { kind: 'observed', tabId: 'terminal' } as const
    const second = pr(2, 'repo')
    const issue: WorkspaceAttachment = {
      provider: 'github',
      type: 'issue',
      number: 1
    }
    const scoped: WorkspaceAttachment = {
      ...pr(1, 'repo'),
      taskSourceContext: {
        kind: 'task-source',
        provider: 'github',
        projectId: 'project',
        hostId: 'local'
      }
    }
    const linearA: WorkspaceAttachment = {
      provider: 'linear',
      type: 'issue',
      number: 0,
      identifier: 'ENG-1'
    }
    const linearB: WorkspaceAttachment = { ...linearA, identifier: 'OPS-1' }
    const normalized = normalizeWorkspaceAttachments([
      { ...pr(1), title: 'First', origins: [origin] },
      second,
      pr(1, 'repo'),
      issue,
      scoped,
      pr(3),
      pr(3, 'a'),
      pr(4),
      pr(3, 'b'),
      linearA,
      linearB,
      { ...second, title: 'Updated second' }
    ])
    expect(normalized).toMatchObject([
      { ...second, title: 'Updated second' },
      issue,
      { ...scoped, title: 'First', origins: [origin] },
      pr(3),
      pr(3, 'a'),
      pr(4),
      pr(3, 'b'),
      linearA,
      linearB
    ])
    expect(normalizeWorkspaceAttachments(normalized)).toEqual(normalized)
  })

  describe('Kerjan tickets', () => {
    const kerjanContext: TaskSourceContext = {
      kind: 'task-source',
      provider: 'kerjan',
      projectId: 'kerjan',
      hostId: 'local',
      providerIdentity: {
        provider: 'kerjan',
        siteUrl: 'https://kerjan.example.com',
        workspaceCode: 'OMX'
      }
    }
    const ticket = {
      provider: 'kerjan',
      type: 'issue',
      number: 0,
      kerjanIdentifier: 'OMX-40',
      title: 'Fix login',
      url: 'https://kerjan.example.com/ticket/OMX-40'
    } as const

    it('keeps keyed Kerjan issues and their matching source context', () => {
      expect(
        normalizeWorkspaceAttachment({
          ...ticket,
          taskSourceContext: kerjanContext
        })
      ).toMatchObject({
        ...ticket,
        identifier: 'OMX-40',
        taskSourceContext: kerjanContext
      })
    })

    it('rejects Kerjan reviews and key-less tickets', () => {
      expect(normalizeWorkspaceAttachment({ ...ticket, type: 'pr' })).toBeNull()
      expect(
        normalizeWorkspaceAttachment({
          ...ticket,
          kerjanIdentifier: undefined
        })
      ).toBeNull()
    })

    it('drops a source context from another site or workspace', () => {
      for (const providerIdentity of [
        {
          provider: 'kerjan',
          siteUrl: 'https://other.example.com',
          workspaceCode: 'OMX'
        },
        {
          provider: 'kerjan',
          siteUrl: 'https://kerjan.example.com',
          workspaceCode: 'ENG'
        }
      ]) {
        expect(
          normalizeWorkspaceAttachment({
            ...ticket,
            taskSourceContext: { ...kerjanContext, providerIdentity }
          })?.taskSourceContext
        ).toBeUndefined()
      }
    })

    it('dedupes the same ticket by key and converts to a linked item', () => {
      const normalized = normalizeWorkspaceAttachments([
        ticket,
        {
          ...ticket,
          url: 'https://kerjan.example.com/ticket/omx-40?tab=history'
        }
      ])
      expect(normalized).toHaveLength(1)
      expect(toWorkspaceLinkedItem(normalized[0])).toEqual({
        provider: 'kerjan',
        type: 'issue',
        number: 0,
        title: 'Fix login',
        url: normalized[0].url,
        kerjanIdentifier: 'OMX-40'
      })
    })
  })
})
