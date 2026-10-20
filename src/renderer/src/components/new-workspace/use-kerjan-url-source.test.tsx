// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import { makeKerjanIssue } from '../kerjan-ticket.test-fixture'
import {
  deriveKerjanUrlSourceContext,
  isResolvedKerjanTicketMatch,
  useKerjanUrlSource
} from './use-kerjan-url-source'
import { parseKerjanTicketUrl } from '../../../../shared/kerjan-ticket-url'

const mocks = vi.hoisted(() => ({
  assertRuntimeEnvironmentCapability: vi.fn(),
  fetchKerjanIssue: vi.fn()
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  assertRuntimeEnvironmentCapability: mocks.assertRuntimeEnvironmentCapability
}))

vi.mock('@/store', () => {
  const state = { fetchKerjanIssue: mocks.fetchKerjanIssue }
  return {
    useAppStore: (selector: (value: typeof state) => unknown): unknown => selector(state)
  }
})

const URL_VALUE = 'https://kerjan.example/ticket/omx-40'

function hostSource(hostId: TaskSourceContext['hostId'] = 'local'): TaskSourceContext {
  return {
    kind: 'task-source',
    provider: 'jira',
    projectId: 'project-1',
    hostId,
    repoId: 'repo-1',
    providerIdentity: null,
    accountLabel: null
  }
}

async function advanceLookup(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200)
  })
}

describe('Kerjan ticket URL matching', () => {
  const parsed = parseKerjanTicketUrl(URL_VALUE)
  if (!parsed) {
    throw new Error('fixture URL must parse')
  }

  it('accepts only the same key on the same site and base path', () => {
    expect(isResolvedKerjanTicketMatch(parsed, makeKerjanIssue())).toBe(true)
    expect(
      isResolvedKerjanTicketMatch(
        parsed,
        makeKerjanIssue({ url: 'https://other.example/ticket/OMX-40' })
      )
    ).toBe(false)
    expect(
      isResolvedKerjanTicketMatch(
        parsed,
        makeKerjanIssue({ url: 'https://kerjan.example/app/ticket/OMX-40' })
      )
    ).toBe(false)
  })

  it('binds a Kerjan source on the composer host with the ticket workspace', () => {
    expect(deriveKerjanUrlSourceContext(hostSource('ssh:box'), parsed)).toMatchObject({
      provider: 'kerjan',
      hostId: 'ssh:box',
      projectId: 'project-1',
      repoId: 'repo-1',
      providerIdentity: {
        provider: 'kerjan',
        siteUrl: 'https://kerjan.example',
        workspaceCode: 'OMX'
      }
    })
    expect(deriveKerjanUrlSourceContext(null, parsed)).toBeNull()
  })
})

describe('useKerjanUrlSource', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.assertRuntimeEnvironmentCapability.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the pasted ticket and binds its source context', async () => {
    mocks.fetchKerjanIssue.mockResolvedValue(makeKerjanIssue())
    const { result } = renderHook(() =>
      useKerjanUrlSource({ value: URL_VALUE, enabled: true, hostSourceContext: hostSource() })
    )
    expect(result.current.intent).toBe(true)
    expect(result.current.loading).toBe(true)
    await advanceLookup()
    expect(mocks.fetchKerjanIssue).toHaveBeenCalledWith('OMX-40', {
      sourceContext: expect.objectContaining({ provider: 'kerjan', hostId: 'local' }),
      force: false
    })
    expect(result.current.issue?.key).toBe('OMX-40')
    expect(result.current.boundSourceContext?.provider).toBe('kerjan')
    expect(result.current.errorKind).toBeNull()
  })

  it('reports a ticket from another site instead of linking it', async () => {
    mocks.fetchKerjanIssue.mockResolvedValue(
      makeKerjanIssue({ url: 'https://other.example/ticket/OMX-40' })
    )
    const { result } = renderHook(() =>
      useKerjanUrlSource({ value: URL_VALUE, enabled: true, hostSourceContext: hostSource() })
    )
    await advanceLookup()
    expect(result.current.issue).toBeNull()
    expect(result.current.errorKind).toBe('site-not-connected')
  })

  it('maps a disconnected Kerjan and forces a fresh read on retry', async () => {
    mocks.fetchKerjanIssue.mockRejectedValueOnce(new Error('Not connected to Kerjan.'))
    const { result } = renderHook(() =>
      useKerjanUrlSource({ value: URL_VALUE, enabled: true, hostSourceContext: hostSource() })
    )
    await advanceLookup()
    expect(result.current.errorKind).toBe('disconnected')

    mocks.fetchKerjanIssue.mockResolvedValue(makeKerjanIssue())
    act(() => result.current.retry())
    await advanceLookup()
    expect(mocks.fetchKerjanIssue).toHaveBeenLastCalledWith('OMX-40', {
      sourceContext: expect.anything(),
      force: true
    })
    expect(result.current.issue?.key).toBe('OMX-40')
  })

  it('asks for a runtime update before reading through an old remote runtime', async () => {
    mocks.assertRuntimeEnvironmentCapability.mockRejectedValue(new Error('update-runtime'))
    const { result } = renderHook(() =>
      useKerjanUrlSource({
        value: URL_VALUE,
        enabled: true,
        hostSourceContext: hostSource('runtime:remote')
      })
    )
    await advanceLookup()
    expect(result.current.errorKind).toBe('update-runtime')
    expect(mocks.fetchKerjanIssue).not.toHaveBeenCalled()
  })

  it('ignores non-Kerjan input and disabled lookups', () => {
    const { result, rerender } = renderHook(
      ({ value, enabled }: { value: string; enabled: boolean }) =>
        useKerjanUrlSource({ value, enabled, hostSourceContext: hostSource() }),
      { initialProps: { value: 'fix login', enabled: true } }
    )
    expect(result.current.intent).toBe(false)
    rerender({ value: URL_VALUE, enabled: false })
    expect(result.current.intent).toBe(false)
  })
})
