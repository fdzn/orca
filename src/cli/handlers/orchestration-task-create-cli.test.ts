import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.hoisted(() => vi.fn())
const getTerminalHandleMock = vi.hoisted(() => vi.fn())
const originalTerminalHandle = process.env.ORCA_TERMINAL_HANDLE

// Why: isolate flag-to-RPC mapping; printResult only writes output.
vi.mock('../format', () => ({ printResult: vi.fn() }))
vi.mock('../selectors', () => ({ getTerminalHandle: getTerminalHandleMock }))

import { ORCHESTRATION_HANDLERS } from './orchestration'
import { RuntimeClientError } from '../runtime-client'

describe('orchestration task-create CLI mapping', () => {
  beforeEach(() => {
    callMock.mockReset()
    getTerminalHandleMock.mockReset()
    process.env.ORCA_TERMINAL_HANDLE = 'term_creator'
  })

  afterEach(() => {
    if (originalTerminalHandle === undefined) {
      delete process.env.ORCA_TERMINAL_HANDLE
    } else {
      process.env.ORCA_TERMINAL_HANDLE = originalTerminalHandle
    }
  })

  it('passes PowerShell-stripped deps through to the runtime', async () => {
    callMock
      .mockResolvedValueOnce({ result: { identity: { handle: 'term_creator', live: true } } })
      .mockResolvedValueOnce({ result: { task: { id: 'task_2', status: 'pending' } } })

    await ORCHESTRATION_HANDLERS['orchestration task-create']({
      flags: new Map<string, string | boolean>([
        ['spec', 'do child work'],
        ['deps', '[task_b2a580db74d8]']
      ]),
      client: { call: callMock },
      cwd: '/tmp/repo',
      json: true
    } as never)

    expect(callMock).toHaveBeenNthCalledWith(2, 'orchestration.taskCreate', {
      spec: 'do child work',
      taskTitle: undefined,
      displayName: undefined,
      deps: '[task_b2a580db74d8]',
      parent: undefined,
      run: undefined,
      callerTerminalHandle: 'term_creator'
    })
    expect(getTerminalHandleMock).not.toHaveBeenCalled()
  })

  describe('--kerjan', () => {
    const ticket = {
      key: 'OMX-40',
      title: 'Fix login',
      url: 'https://kerjan.example.com/ticket/OMX-40',
      statusKey: 'todo',
      taskType: 'dev',
      issueType: { id: 'task', name: 'Task' },
      description: 'Login fails.\n\n## Acceptance Criteria\n- [ ] User can log in'
    }

    function respond(issue: unknown): void {
      callMock.mockImplementation(async (method: string) => {
        if (method === 'kerjan.getIssue') {
          if (issue instanceof Error) {
            throw issue
          }
          return { result: issue }
        }
        if (method === 'orchestration.taskCreate') {
          return { result: { task: { id: 'task_3', status: 'pending' } } }
        }
        return { result: { identity: { handle: 'term_creator', live: true } } }
      })
    }

    function taskCreate(flags: [string, string][]) {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: task-create reads only flags, cwd, json, and client.call, which this stub provides.
      return ORCHESTRATION_HANDLERS['orchestration task-create']({
        flags: new Map<string, string | boolean>(flags),
        client: { call: callMock },
        cwd: '/tmp/repo',
        json: true
      } as never)
    }

    function taskCreateParams(): Record<string, unknown> | undefined {
      return callMock.mock.calls.find(([method]) => method === 'orchestration.taskCreate')?.[1]
    }

    it('builds the title and spec from the ticket after any --spec text', async () => {
      respond(ticket)
      await taskCreate([
        ['kerjan', 'omx-40'],
        ['spec', 'Keep the change small.']
      ])
      expect(callMock).toHaveBeenCalledWith('kerjan.getIssue', { key: 'OMX-40' })
      expect(taskCreateParams()).toMatchObject({ taskTitle: 'OMX-40: Fix login' })
      const spec = String(taskCreateParams()?.spec)
      expect(spec.startsWith('Keep the change small.\n\n## Kerjan ticket OMX-40: Fix login')).toBe(
        true
      )
      expect(spec).toContain(`URL: ${ticket.url}`)
      expect(spec).toContain('Kind: Task (dev)')
      expect(spec).toContain('Status: todo')
      expect(spec).toContain('- [ ] User can log in')
    })

    it('keeps an explicit --task-title', async () => {
      respond(ticket)
      await taskCreate([
        ['kerjan', 'OMX-40'],
        ['task-title', 'Login fix']
      ])
      expect(taskCreateParams()).toMatchObject({ taskTitle: 'Login fix' })
      expect(String(taskCreateParams()?.spec).startsWith('## Kerjan ticket OMX-40')).toBe(true)
    })

    it.each([
      ['a missing ticket', null, 'kerjan_ticket_unavailable'],
      [
        'no connection',
        new RuntimeClientError('runtime_error', 'Not connected to Kerjan.'),
        'kerjan_not_connected'
      ]
    ])('creates no task for %s', async (_label, issue, code) => {
      respond(issue)
      await expect(taskCreate([['kerjan', 'OMX-40']])).rejects.toMatchObject({ code })
      expect(taskCreateParams()).toBeUndefined()
    })

    it('still requires --spec without --kerjan', async () => {
      respond(ticket)
      await expect(taskCreate([])).rejects.toMatchObject({ code: 'invalid_argument' })
      expect(callMock).not.toHaveBeenCalled()
    })
  })
})
