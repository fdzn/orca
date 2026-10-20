// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY } from '../../../shared/runtime-capability-constants'
import { createCompatibleRuntimeStatusResponse } from './runtime-compatibility-test-fixture'
import {
  kerjanListIssues,
  kerjanSetStatus,
  kerjanStatus,
  KERJAN_RUNTIME_UPDATE_REQUIRED_MESSAGE
} from './runtime-kerjan-client'
import { parseKerjanConnectionStatus } from './runtime-kerjan-connection-status'
import { clearRuntimeCompatibilityCacheForTests } from './runtime-rpc-client'

const statusLocal = vi.fn()
const listIssuesLocal = vi.fn()
const setStatusLocal = vi.fn()
const runtimeCall = vi.fn<(args: { method: string; params?: unknown }) => Promise<unknown>>()
const runtimeSubscribe = vi.fn()

const remote = { kind: 'environment' as const, environmentId: 'env-1' }
const local = { kind: 'local' as const }

function statusWithoutKerjan() {
  const response = createCompatibleRuntimeStatusResponse()
  if (!response.ok) {
    throw new Error('Expected status fixture')
  }
  response.result.capabilities = response.result.capabilities?.filter(
    (capability) => capability !== KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY
  )
  return response
}

function rpcMethods(): string[] {
  return runtimeCall.mock.calls.map(([args]) => args.method)
}

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    api: {
      kerjan: { status: statusLocal, listIssues: listIssuesLocal, setStatus: setStatusLocal },
      runtimeEnvironments: { call: runtimeCall, subscribe: runtimeSubscribe }
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime Kerjan client', () => {
  it('reads through the local preload bridge without touching the runtime', async () => {
    statusLocal.mockResolvedValue({
      connected: true,
      siteUrl: 'https://kerjan.example',
      viewer: { id: '7', name: 'Ada', email: 'ada@example.com' }
    })
    listIssuesLocal.mockResolvedValue([{ key: 'OMX-1' }])

    await expect(kerjanStatus(local)).resolves.toMatchObject({
      connected: true,
      siteUrl: 'https://kerjan.example',
      viewer: { id: '7', name: 'Ada' }
    })
    await expect(kerjanListIssues(local, 'OMX', { status: 'todo' })).resolves.toEqual([
      { key: 'OMX-1' }
    ])
    expect(listIssuesLocal).toHaveBeenCalledWith({
      workspaceCode: 'OMX',
      filters: { status: 'todo' }
    })
    expect(runtimeCall).not.toHaveBeenCalled()
  })

  it('forwards reads and writes to a paired runtime that advertises Kerjan', async () => {
    runtimeCall.mockImplementation(async (args: { method: string }) => {
      if (args.method === 'status.get') {
        return createCompatibleRuntimeStatusResponse()
      }
      const result =
        args.method === 'kerjan.status'
          ? { connected: true, siteUrl: 'https://kerjan.example', viewer: null }
          : { ok: true, issue: { key: 'OMX-2' } }
      return { id: 'rpc-1', ok: true, result, _meta: { runtimeId: 'remote-runtime' } }
    })

    await expect(kerjanStatus(remote)).resolves.toMatchObject({ connected: true })
    await expect(kerjanSetStatus(remote, 'OMX-2', 'done', '  ')).resolves.toMatchObject({
      ok: true
    })
    const setStatusCall = runtimeCall.mock.calls.find(
      ([args]) => args.method === 'kerjan.setStatus'
    )
    // A blank comment is dropped so the host does not post an empty note.
    expect(setStatusCall?.[0]).toMatchObject({ params: { key: 'OMX-2', status: 'done' } })
    expect(setStatusLocal).not.toHaveBeenCalled()
  })

  it('treats an older runtime without Kerjan as disconnected and refuses its calls', async () => {
    runtimeCall.mockImplementation(async (args: { method: string }) => {
      if (args.method === 'status.get') {
        return statusWithoutKerjan()
      }
      throw new Error(`unexpected ${args.method}`)
    })

    await expect(kerjanStatus(remote)).resolves.toEqual({
      connected: false,
      siteUrl: null,
      viewer: null
    })
    await expect(kerjanListIssues(remote, 'OMX')).rejects.toThrow(
      KERJAN_RUNTIME_UPDATE_REQUIRED_MESSAGE
    )
    expect(rpcMethods().some((method) => method.startsWith('kerjan.'))).toBe(false)
  })
})

describe('parseKerjanConnectionStatus', () => {
  it('falls back to disconnected for a missing reply and drops malformed fields', () => {
    expect(parseKerjanConnectionStatus(undefined)).toEqual({
      connected: false,
      siteUrl: null,
      viewer: null
    })
    expect(
      parseKerjanConnectionStatus({
        connected: true,
        siteUrl: 42,
        viewer: { id: 7, name: 'Ada' },
        credentialProtection: 'mystery'
      })
    ).toEqual({
      connected: true,
      siteUrl: null,
      viewer: null,
      credentialError: undefined,
      credentialProtection: undefined
    })
  })
})
