import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock(mocks)
})
vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: mocks.addEnvironmentFromPairingCodeMock,
  listEnvironments: mocks.listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))
vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(mocks.spawnMock)
})

import { main } from './index'
import { pairRuntimeEnvironment, useWorktreeAwarenessEnvironment } from './index-test-harness'
import { buildWorktree, okFixture } from './test-fixtures'
import { RuntimeClientError } from './runtime/types'
import { KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY } from '../shared/runtime-capability-constants'
import { WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY } from '../shared/workspace-attachment-capabilities'
import { parseWorkspaceReferenceUrl } from '../shared/workspace-reference-identity'

const ticketUrl = 'https://kerjan.example.com/ticket/OMX-40'
const ticket = { key: 'OMX-40', title: 'Fix login', url: ticketUrl }
const parsed = parseWorkspaceReferenceUrl(ticketUrl)
const workspace = { ...buildWorktree('/tmp/api', 'api'), kind: 'worktree', name: 'api' }
const addArgs = [
  'reference',
  'add',
  'https://kerjan.example.com/ticket/omx-40',
  '--worktree',
  'name:api'
]
const createArgs = [
  'worktree',
  'create',
  '--name',
  'fix',
  '--repo',
  'id:repo',
  '--no-parent',
  '--reference',
  ticketUrl,
  '--json'
]

function responses(overrides: Record<string, unknown> = {}): void {
  const values: Record<string, unknown> = {
    'status.get': {
      capabilities: [
        WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY,
        KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY
      ]
    },
    'kerjan.getIssue': ticket,
    'reference.list': { worktree: workspace, references: [] },
    'worktree.create': { worktree: workspace },
    ...overrides
  }
  mocks.callMock.mockImplementation(async (method: string) => {
    const result = values[method]
    if (result instanceof Error) {
      throw result
    }
    return okFixture(method, result)
  })
}

function linkedItemsWritten(method: 'worktree.set' | 'worktree.create'): unknown {
  const call = mocks.callMock.mock.calls.find(([name]) => name === method)
  return call?.[1]?.linkedItems
}

describe('Kerjan references', () => {
  useWorktreeAwarenessEnvironment(mocks)
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pairRuntimeEnvironment(mocks.listEnvironmentsMock, 'remote')
    responses()
  })

  it('adds a Kerjan ticket URL with the title from the connected site', async () => {
    await main(addArgs, '/tmp/api')
    expect(parsed).toMatchObject({ provider: 'kerjan', kerjanIdentifier: 'OMX-40' })
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.getIssue', { key: 'OMX-40' })
    expect(linkedItemsWritten('worktree.set')).toEqual([{ ...parsed, title: ticket.title }])
  })

  it.each([
    ['not connected', new RuntimeClientError('runtime_error', 'Not connected to Kerjan.')],
    ['an older host', new RuntimeClientError('method_not_found', 'Unknown method')],
    ['another site', { ...ticket, url: 'https://other.example.com/ticket/OMX-40' }],
    ['a missing ticket', null]
  ])('still links the URL without a title when the lookup finds %s', async (_label, result) => {
    responses({ 'kerjan.getIssue': result })
    await main(addArgs, '/tmp/api')
    expect(linkedItemsWritten('worktree.set')).toEqual([parsed])
  })

  it('refuses to send Kerjan links to a host that would drop them', async () => {
    responses({ 'status.get': { capabilities: [WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY] } })
    await main(addArgs, '/tmp/api')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Kerjan references'))
    expect(linkedItemsWritten('worktree.set')).toBeUndefined()
  })

  it('creates a worktree linked to a Kerjan ticket', async () => {
    await main(createArgs, '/tmp/api')
    expect(linkedItemsWritten('worktree.create')).toEqual([{ ...parsed, title: ticket.title }])
  })

  it('creates nothing on a host without Kerjan support', async () => {
    responses({ 'status.get': { capabilities: [WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY] } })
    await main(createArgs, '/tmp/api')
    expect(linkedItemsWritten('worktree.create')).toBeUndefined()
  })
})
