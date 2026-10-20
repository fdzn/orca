import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
import { okFixture } from './test-fixtures'
import { pairRuntimeEnvironment, useWorktreeAwarenessEnvironment } from './index-test-harness'
import { RuntimeClientError } from './runtime/types'

const SITE = 'https://kerjan.example.com'
const viewer = { id: '7', name: 'Ada', email: 'ada@example.com' }
const ticket = {
  id: '40',
  key: 'OMX-40',
  title: 'Fix login',
  url: `${SITE}/ticket/OMX-40`,
  statusKey: 'todo',
  kind: 'task',
  taskType: 'dev',
  issueType: { id: 'task', name: 'Task' },
  project: { id: 'OMX', key: 'OMX', name: 'OMX' },
  tasks: [],
  comments: []
}

function responses(overrides: Record<string, unknown> = {}): void {
  const values: Record<string, unknown> = {
    'kerjan.status': { connected: true, siteUrl: SITE, viewer },
    'kerjan.connect': { ok: true, viewer },
    'kerjan.disconnect': { ok: true },
    'kerjan.testConnection': { ok: true, viewer },
    'kerjan.listWorkspaces': [],
    'kerjan.listSprints': [],
    'kerjan.listMembers': [viewer],
    'kerjan.listIssues': [],
    'kerjan.getIssue': ticket,
    'kerjan.addComment': { ok: true, issue: ticket },
    'kerjan.setStatus': { ok: true, issue: { ...ticket, statusKey: 'in_progress' } },
    'kerjan.setAssignee': { ok: true, issue: ticket },
    ...overrides
  }
  mocks.callMock.mockImplementation(async (method: string) => {
    if (!(method in values)) {
      throw new Error(`Unexpected RPC: ${method}`)
    }
    const value = values[method]
    if (value instanceof Error) {
      throw value
    }
    return okFixture('req-kerjan', value)
  })
}

async function run(args: string[], overrides: Record<string, unknown> = {}): Promise<void> {
  responses(overrides)
  await main(['kerjan', ...args, '--json'], '/tmp/workspace')
}

function output() {
  const calls = vi.mocked(console.log).mock.calls
  return JSON.parse(String(calls.at(-1)?.[0]))
}

function rpcMethods(): string[] {
  return mocks.callMock.mock.calls.map(([method]) => String(method))
}

describe('Kerjan CLI', () => {
  useWorktreeAwarenessEnvironment(mocks)
  const originalToken = process.env.ORCA_KERJAN_TOKEN
  beforeEach(() => {
    process.exitCode = undefined
    delete process.env.ORCA_KERJAN_TOKEN
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pairRuntimeEnvironment(mocks.listEnvironmentsMock, 'remote')
  })
  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.ORCA_KERJAN_TOKEN
    } else {
      process.env.ORCA_KERJAN_TOKEN = originalToken
    }
  })

  it('reports the saved connection through a selected remote host', async () => {
    await run(['connection', 'status', '--environment', 'remote'])
    expect(mocks.runtimeClientConstructorMock).toHaveBeenCalledWith(undefined, 'remote')
    expect(rpcMethods()).toEqual(['kerjan.status'])
    expect(output()).toMatchObject({ ok: true, result: { connected: true, siteUrl: SITE } })
  })

  it('connects with a token from the environment, never argv', async () => {
    process.env.ORCA_KERJAN_TOKEN = ' kjt_secret '
    await run(['connection', 'connect', '--url', SITE])
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.connect', {
      baseUrl: SITE,
      token: 'kjt_secret'
    })
  })

  it.each([
    [['connection', 'connect', '--url', SITE]],
    [['connection', 'connect', '--url', SITE, '--token', 'kjt_secret']],
    [['connection', 'connect', '--url', 'ftp://kerjan.example.com']]
  ])('refuses connects without a safe token source or URL: %s', async (args) => {
    await run(args)
    expect(output()).toMatchObject({ error: { code: 'invalid_argument' } })
    expect(mocks.callMock).not.toHaveBeenCalled()
  })

  it('surfaces a rejected connect as a failure', async () => {
    process.env.ORCA_KERJAN_TOKEN = 'kjt_bad'
    await run(['connection', 'connect', '--url', SITE], {
      'kerjan.connect': { ok: false, error: 'Invalid token' }
    })
    expect(output()).toMatchObject({
      error: { code: 'kerjan_connect_failed', message: 'Invalid token' }
    })
  })

  it('reads a ticket by key or by a URL on the connected site', async () => {
    await run(['issue', 'omx-40'])
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.getIssue', { key: 'OMX-40' })
    expect(rpcMethods()).not.toContain('kerjan.status')
    await run(['issue', `${SITE}/ticket/omx-40?tab=history`])
    expect(rpcMethods()).toContain('kerjan.status')
    expect(output()).toMatchObject({ ok: true, result: { key: 'OMX-40' } })
  })

  it('refuses a ticket URL from another Kerjan site', async () => {
    await run(['issue', 'https://other.example.com/ticket/OMX-40'])
    expect(output()).toMatchObject({ error: { code: 'invalid_argument' } })
    expect(rpcMethods()).not.toContain('kerjan.getIssue')
  })

  it.each([null, { ...ticket, key: 'OMX-41' }])(
    'does not claim a missing ticket was read',
    async (result) => {
      await run(['issue', 'OMX-40'], { 'kerjan.getIssue': result })
      expect(output()).toMatchObject({ error: { code: 'kerjan_ticket_unavailable' } })
    }
  )

  it('names a missing connection instead of a generic runtime error', async () => {
    await run(['issue', 'OMX-40'], {
      'kerjan.getIssue': new RuntimeClientError('runtime_error', 'Not connected to Kerjan.')
    })
    expect(output()).toMatchObject({ error: { code: 'kerjan_not_connected' } })
  })

  it('names an execution host that predates Kerjan', async () => {
    await run(['workspaces'], {
      'kerjan.listWorkspaces': new RuntimeClientError('method_not_found', 'Unknown method')
    })
    expect(output()).toMatchObject({ error: { code: 'incompatible_runtime' } })
  })

  it('maps list flags to workspace-scoped filters', async () => {
    await run([
      'list',
      '--workspace',
      'omx',
      '--status',
      'in-progress',
      '--kind',
      'task',
      '--type',
      'bug',
      '--sprint',
      '3',
      '--mine',
      '--query',
      'login',
      '--limit',
      '5'
    ])
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.listIssues', {
      workspaceCode: 'OMX',
      filters: {
        status: 'in_progress',
        kind: 'task',
        taskType: 'bug',
        sprintId: '3',
        assigneeId: viewer.id,
        query: 'login',
        limit: 5
      }
    })
  })

  it.each([
    [['list']],
    [['list', '--workspace', 'O1']],
    [['list', '--workspace', 'OMX', '--status', 'blocked']],
    [['list', '--workspace', 'OMX', '--assignee', '7', '--mine']],
    [['list', '--workspace', 'OMX', '--limit', '1001']],
    [['sprints']]
  ])('rejects invalid list input before access: %s', async (args) => {
    await run(args)
    expect(output()).toMatchObject({ error: { code: 'invalid_argument' } })
    expect(mocks.callMock).not.toHaveBeenCalled()
  })

  it('comments on a ticket', async () => {
    await run(['comment', 'OMX-40', '--body', 'Ready for review'])
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.addComment', {
      key: 'OMX-40',
      body: 'Ready for review'
    })
  })

  it.each([
    [['comment', 'OMX-40']],
    [['comment', 'OMX-40', '--body', ' ']],
    [['comment', 'OMX-40', '--body', 'x'.repeat(10_001)]]
  ])('refuses unsafe comment input before access: %s', async (args) => {
    await run(args)
    expect(mocks.callMock).not.toHaveBeenCalled()
  })

  it('moves a Task with an optional comment', async () => {
    await run(['status', 'OMX-40', 'in_progress', '--comment', 'Starting'])
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.setStatus', {
      key: 'OMX-40',
      status: 'in_progress',
      comment: 'Starting'
    })
    expect(output()).toMatchObject({ result: { statusKey: 'in_progress' } })
  })

  it('refuses statuses Kerjan does not accept on writes', async () => {
    await run(['status', 'OMX-40', 'testing'])
    expect(output()).toMatchObject({ error: { code: 'invalid_argument' } })
    expect(mocks.callMock).not.toHaveBeenCalled()
  })

  it('surfaces Kerjan rule violations verbatim', async () => {
    await run(['status', 'OMX-40', 'done'], {
      'kerjan.setStatus': { ok: false, error: 'Done needs an assignee (SPEC #12)' }
    })
    expect(output()).toMatchObject({
      error: {
        code: 'kerjan_write_failed',
        message: expect.stringContaining('Done needs an assignee (SPEC #12)')
      }
    })
  })

  it.each([
    [['assign', 'OMX-40', '12'], '12'],
    [['assign', 'OMX-40', '--me'], viewer.id],
    [['assign', 'OMX-40', '--none'], null]
  ])('assigns %s', async (args, assigneeId) => {
    await run(args)
    expect(mocks.callMock).toHaveBeenCalledWith('kerjan.setAssignee', {
      key: 'OMX-40',
      assigneeId
    })
  })

  it.each([[['assign', 'OMX-40']], [['assign', 'OMX-40', '12', '--none']]])(
    'requires exactly one assignee choice: %s',
    async (args) => {
      await run(args)
      expect(mocks.callMock).not.toHaveBeenCalled()
    }
  )

  it('does not claim a timed-out write failed or retry it', async () => {
    await run(['comment', 'OMX-40', '--body', 'Ready'], {
      'kerjan.addComment': new RuntimeClientError('runtime_timeout', 'Timed out')
    })
    expect(output()).toMatchObject({ error: { code: 'kerjan_write_unverified' } })
    expect(rpcMethods().filter((method) => method === 'kerjan.addComment')).toHaveLength(1)
  })
})
