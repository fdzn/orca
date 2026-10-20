import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../dispatcher'
import type { RpcRequest } from '../core'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { KERJAN_METHODS } from './kerjan'

function makeRequest(method: string, params?: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method, params }
}

function makeRuntime(overrides: Record<string, unknown>): OrcaRuntimeService {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the dispatcher only calls the stubbed kerjan* methods these tests route.
  return { getRuntimeId: () => 'test-runtime', ...overrides } as unknown as OrcaRuntimeService
}

describe('kerjan RPC methods', () => {
  it('routes account methods with trimmed connect input', async () => {
    const runtime = makeRuntime({
      kerjanConnect: vi.fn().mockResolvedValue({ ok: true, viewer: { id: '1', name: 'Ada' } }),
      kerjanDisconnect: vi.fn().mockReturnValue({ ok: true }),
      kerjanStatus: vi.fn().mockReturnValue({ connected: false, siteUrl: null, viewer: null }),
      kerjanTestConnection: vi.fn().mockResolvedValue({ ok: false, error: 'Not connected' })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: KERJAN_METHODS })

    await dispatcher.dispatch(
      makeRequest('kerjan.connect', { baseUrl: ' https://kerjan.example.com/ ', token: ' kjt_x ' })
    )
    await dispatcher.dispatch(makeRequest('kerjan.status'))
    await dispatcher.dispatch(makeRequest('kerjan.testConnection'))
    await dispatcher.dispatch(makeRequest('kerjan.disconnect'))

    expect(runtime.kerjanConnect).toHaveBeenCalledWith({
      baseUrl: 'https://kerjan.example.com/',
      token: 'kjt_x'
    })
    expect(runtime.kerjanStatus).toHaveBeenCalled()
    expect(runtime.kerjanTestConnection).toHaveBeenCalled()
    expect(runtime.kerjanDisconnect).toHaveBeenCalled()
  })

  it('routes reads with workspace scope and normalized filter ids', async () => {
    const runtime = makeRuntime({
      kerjanListWorkspaces: vi.fn().mockResolvedValue([]),
      kerjanListSprints: vi.fn().mockResolvedValue([]),
      kerjanListProducts: vi.fn().mockResolvedValue([]),
      kerjanListMembers: vi.fn().mockResolvedValue([]),
      kerjanListIssues: vi.fn().mockResolvedValue([]),
      kerjanSearchIssues: vi.fn().mockResolvedValue([]),
      kerjanGetIssue: vi.fn().mockResolvedValue(null)
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: KERJAN_METHODS })

    await dispatcher.dispatch(makeRequest('kerjan.listWorkspaces'))
    await dispatcher.dispatch(makeRequest('kerjan.listSprints', { workspaceCode: 'OMX' }))
    await dispatcher.dispatch(makeRequest('kerjan.listProducts', { workspaceCode: 'OMX' }))
    await dispatcher.dispatch(makeRequest('kerjan.listMembers'))
    await dispatcher.dispatch(
      makeRequest('kerjan.listIssues', {
        workspaceCode: 'OMX',
        filters: { kind: 'task', status: 'in_progress', assigneeId: 7, sprintId: '12' }
      })
    )
    await dispatcher.dispatch(
      makeRequest('kerjan.searchIssues', { workspaceCode: 'OMX', query: 'login' })
    )
    await dispatcher.dispatch(makeRequest('kerjan.getIssue', { key: 'OMX-40' }))

    expect(runtime.kerjanListSprints).toHaveBeenCalledWith('OMX')
    expect(runtime.kerjanListProducts).toHaveBeenCalledWith('OMX')
    expect(runtime.kerjanListMembers).toHaveBeenCalledWith(undefined)
    expect(runtime.kerjanListIssues).toHaveBeenCalledWith('OMX', {
      kind: 'task',
      status: 'in_progress',
      assigneeId: '7',
      sprintId: '12'
    })
    expect(runtime.kerjanSearchIssues).toHaveBeenCalledWith('OMX', 'login', undefined)
    expect(runtime.kerjanGetIssue).toHaveBeenCalledWith('OMX-40')
  })

  it('routes writes and rejects invalid write params before reaching the runtime', async () => {
    const runtime = makeRuntime({
      kerjanSetStatus: vi.fn().mockResolvedValue({ ok: true }),
      kerjanAddComment: vi.fn().mockResolvedValue({ ok: true }),
      kerjanSetAssignee: vi.fn().mockResolvedValue({ ok: true }),
      kerjanUpdateIssue: vi.fn().mockResolvedValue({ ok: true })
    })
    const dispatcher = new RpcDispatcher({ runtime, methods: KERJAN_METHODS })

    await dispatcher.dispatch(
      makeRequest('kerjan.setStatus', { key: 'OMX-40', status: 'done', comment: 'Shipped' })
    )
    await dispatcher.dispatch(makeRequest('kerjan.addComment', { key: 'OMX-40', body: 'Hi' }))
    await dispatcher.dispatch(
      makeRequest('kerjan.setAssignee', { key: 'OMX-40', assigneeId: null })
    )
    await dispatcher.dispatch(
      makeRequest('kerjan.updateIssue', { key: 'OMX-40', updates: { title: 'New' } })
    )

    expect(runtime.kerjanSetStatus).toHaveBeenCalledWith('OMX-40', 'done', 'Shipped')
    expect(runtime.kerjanAddComment).toHaveBeenCalledWith('OMX-40', 'Hi')
    expect(runtime.kerjanSetAssignee).toHaveBeenCalledWith('OMX-40', null)
    expect(runtime.kerjanUpdateIssue).toHaveBeenCalledWith('OMX-40', { title: 'New' })

    for (const request of [
      makeRequest('kerjan.setStatus', { key: 'OMX-40', status: 'testing' }),
      makeRequest('kerjan.setAssignee', { key: 'OMX-40', assigneeId: 'ada' }),
      makeRequest('kerjan.updateIssue', { key: 'OMX-40', updates: {} }),
      makeRequest('kerjan.listIssues', { filters: {} })
    ]) {
      await expect(dispatcher.dispatch(request)).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_argument' }
      })
    }
    expect(runtime.kerjanSetStatus).toHaveBeenCalledTimes(1)
    expect(runtime.kerjanSetAssignee).toHaveBeenCalledTimes(1)
    expect(runtime.kerjanUpdateIssue).toHaveBeenCalledTimes(1)
  })
})
