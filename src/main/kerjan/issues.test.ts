import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createKerjanFetch,
  kerjanJson,
  loadKerjanModules,
  type KerjanRoute
} from './kerjan-http-fixture'

const BASE = 'https://kerjan.example.com'
const ME = { id: 7, name: 'Ada', email: 'ada@example.com' }
const MEMBERS = [ME, { id: 8, name: 'Grace', email: 'grace@example.com', active: true }]
const SPRINTS = [{ id: 3, name: 'Sprint 12', state: 'active', start_date: '2026-10-01' }]
const PRODUCTS = [{ id: 5, name: 'Omnix' }]

function ticket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 40,
    key: 'OMX-40',
    workspace_id: 1,
    kind: 'task',
    title: 'Fix login',
    description: 'Users cannot log in.\n\n## Acceptance Criteria\n- [ ] works',
    status: 'in_progress',
    product_id: 5,
    sprint_id: 3,
    story_id: 30,
    story_key: 'OMX-30',
    story_title: 'Login',
    task_type: 'bug',
    assignee_id: 8,
    estimate: 3,
    created_by: 7,
    created_at: '2026-10-01T00:00:00Z',
    tasks: [],
    ...overrides
  }
}

function detail(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ticket: ticket(overrides),
    story: { key: 'OMX-30', title: 'Login', kind: 'story' },
    epic: { key: 'OMX-1', title: 'Auth', kind: 'epic' },
    comments: [{ id: 1, author_id: 7, body: 'On it', created_at: '2026-10-02T00:00:00Z' }],
    history: [{ id: 2, actor_id: 8, created_at: '2026-10-03T00:00:00Z', field: 'status' }]
  }
}

const LOOKUPS = {
  'GET /api/v1/members': MEMBERS,
  'GET /api/v1/sprints': SPRINTS,
  'GET /api/v1/products': PRODUCTS
}

let tempHome = ''

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'orca-kerjan-issues-'))
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

async function connected(routes: Record<string, KerjanRoute | object>) {
  const http = createKerjanFetch({ 'GET /api/v1/auth/me': ME, ...LOOKUPS, ...routes })
  const modules = await loadKerjanModules(tempHome, http.fetch)
  await modules.client.connect({ baseUrl: BASE, token: 'kjt_secret' })
  http.requests.length = 0
  return { ...modules, http }
}

describe('kerjan reads', () => {
  it('fails clearly when disconnected', async () => {
    const http = createKerjanFetch({})
    const { queries } = await loadKerjanModules(tempHome, http.fetch)
    await expect(queries.listWorkspaces()).rejects.toThrow('Not connected to Kerjan.')
    expect(http.fetch).not.toHaveBeenCalled()
  })

  it('lists workspaces unscoped and flags Jira-synced ones read-only', async () => {
    const { queries, http } = await connected({
      'GET /api/v1/workspaces': [
        { id: 1, code: 'omx', name: 'Omnix', kind: 'product', jira_project: null },
        { id: 2, code: 'LEG', name: 'Legacy', jira_project: 'LEG' }
      ]
    })
    await expect(queries.listWorkspaces()).resolves.toEqual([
      { id: '1', code: 'OMX', name: 'Omnix', kind: 'product', jiraProject: null, readOnly: false },
      { id: '2', code: 'LEG', name: 'Legacy', kind: null, jiraProject: 'LEG', readOnly: true }
    ])
    expect(http.requests[0].headers.has('x-workspace-id')).toBe(false)
  })

  it('scopes sprint/product/member lookups and rejects malformed workspace codes', async () => {
    const { queries, http } = await connected({})
    await expect(queries.listSprints('omx')).resolves.toMatchObject([
      { id: '3', name: 'Sprint 12', state: 'active', startDate: '2026-10-01' }
    ])
    await expect(queries.listProducts('OMX')).resolves.toEqual([{ id: '5', name: 'Omnix' }])
    await expect(queries.listMembers()).resolves.toHaveLength(2)
    expect(http.requests.map((request) => request.headers.get('x-workspace-id'))).toEqual([
      'OMX',
      'OMX',
      null
    ])
    expect(() => queries.listSprints('OMX-1')).toThrow('workspace code')
  })

  it('lists tickets with server filters, Jira-shaped mapping, and client-side search', async () => {
    const { queries, http } = await connected({
      'GET /api/v1/tickets': [
        ticket(),
        ticket({
          id: 41,
          key: 'OMX-41',
          title: 'Polish signup',
          description: null,
          task_type: 'dev',
          assignee_id: null
        }),
        { key: 'BROKEN' }
      ]
    })

    const all = await queries.listIssues('OMX', {
      kind: 'task',
      status: 'in_progress',
      assigneeId: '8',
      backlog: false
    })
    const ticketsRequest = http.requests.find((request) => request.path === '/api/v1/tickets')
    expect(ticketsRequest?.headers.get('x-workspace-id')).toBe('OMX')
    expect(Object.fromEntries(ticketsRequest?.search ?? [])).toEqual({
      kind: 'task',
      status: 'in_progress',
      assignee_id: '8',
      backlog: 'false'
    })
    expect(all.map((issue) => issue.key)).toEqual(['OMX-40', 'OMX-41'])
    expect(all[0]).toMatchObject({
      id: '40',
      url: `${BASE}/ticket/OMX-40`,
      project: { key: 'OMX' },
      issueType: { id: 'bug', name: 'Bug' },
      status: { id: 'in_progress', name: 'In Progress', categoryKey: 'indeterminate' },
      statusKey: 'in_progress',
      isBug: true,
      assignee: { accountId: '8', displayName: 'Grace' },
      reporter: { accountId: '7', displayName: 'Ada' },
      parent: { key: 'OMX-30', title: 'Login', issueTypeName: 'Story' },
      sprint: 'Sprint 12',
      estimate: 3
    })
    expect(all[1].assignee).toBeUndefined()

    await expect(
      queries.searchIssues('OMX', 'SIGNUP').then((issues) => issues.map((issue) => issue.key))
    ).resolves.toEqual(['OMX-41'])
    await expect(
      queries.searchIssues('OMX', 'acceptance').then((issues) => issues.map((issue) => issue.key))
    ).resolves.toEqual(['OMX-40'])
    await expect(queries.listIssues('OMX', { limit: 1 })).resolves.toHaveLength(1)
  })

  it('keeps tickets readable when a name lookup fails', async () => {
    const { queries } = await connected({
      'GET /api/v1/tickets': [ticket()],
      'GET /api/v1/members': () => kerjanJson({ message: 'forbidden' }, 403)
    })
    const [issue] = await queries.listIssues('OMX')
    expect(issue.assignee).toEqual({ accountId: '8', displayName: '8', email: null })
  })

  it('gets one ticket scoped by its key prefix with comments, history, and parents', async () => {
    const { queries, http } = await connected({ 'GET /api/v1/tickets/OMX-40': detail() })
    const issue = await queries.getIssue('omx-40')
    expect(http.requests.every((request) => request.headers.get('x-workspace-id') === 'OMX')).toBe(
      true
    )
    expect(issue).toMatchObject({
      key: 'OMX-40',
      epic: { key: 'OMX-1', title: 'Auth' },
      story: { key: 'OMX-30', title: 'Login' },
      product: { id: '5', name: 'Omnix' },
      comments: [
        {
          id: '1',
          body: 'On it',
          createdAt: '2026-10-02T00:00:00Z',
          user: { accountId: '7', displayName: 'Ada' }
        }
      ],
      history: [{ id: '2', user: { displayName: 'Grace' }, raw: { field: 'status' } }],
      stories: []
    })
  })

  it('returns null for an unknown ticket and rejects malformed keys before calling Kerjan', async () => {
    const { queries, http } = await connected({})
    await expect(queries.getIssue('OMX-999')).resolves.toBeNull()
    http.requests.length = 0
    expect(() => queries.getIssue('not-a-key')).toThrow('not a Kerjan ticket key')
    expect(http.requests).toHaveLength(0)
  })

  it('surfaces 403 membership errors verbatim and keeps the connection', async () => {
    const { queries, client } = await connected({
      'GET /api/v1/tickets': () => kerjanJson({ message: 'not a member of this workspace' }, 403)
    })
    await expect(queries.listIssues('OMX')).rejects.toThrow('not a member of this workspace')
    expect(client.getStatus().connected).toBe(true)
  })

  it('drops the saved connection when Kerjan rejects the token', async () => {
    const { queries, client } = await connected({
      'GET /api/v1/workspaces': () => kerjanJson({ message: 'token expired' }, 401)
    })
    await expect(queries.listWorkspaces()).rejects.toThrow('token expired')
    expect(client.getStatus().connected).toBe(false)
  })
})

describe('kerjan writes', () => {
  it('posts a task status with an optional comment and returns the fresh ticket', async () => {
    const { mutations, http } = await connected({
      'POST /api/v1/tickets/OMX-40/status': detail({ status: 'done' })
    })
    const result = await mutations.setStatus('OMX-40', 'done', ' shipped ')
    expect(result).toMatchObject({ ok: true, issue: { key: 'OMX-40', statusKey: 'done' } })
    const request = http.requests.find((entry) => entry.method === 'POST')
    expect(request?.body).toEqual({ status: 'done', comment: 'shipped' })
    expect(request?.headers.get('x-workspace-id')).toBe('OMX')
    expect(request?.headers.get('content-type')).toBe('application/json')
  })

  it('returns Kerjan 422 rule messages verbatim', async () => {
    const message = 'Done needs an assignee (SPEC #12)'
    const { mutations } = await connected({
      'POST /api/v1/tickets/OMX-40/status': () => kerjanJson({ message }, 422)
    })
    await expect(mutations.setStatus('OMX-40', 'done')).resolves.toEqual({
      ok: false,
      error: message
    })
  })

  it('adds a comment within the length limit', async () => {
    const { mutations, http } = await connected({
      'POST /api/v1/tickets/OMX-40/comments': detail()
    })
    await expect(mutations.addComment('OMX-40', '  hello  ')).resolves.toMatchObject({ ok: true })
    expect(http.requests.find((entry) => entry.method === 'POST')?.body).toEqual({ body: 'hello' })
    await expect(mutations.addComment('OMX-40', 'x'.repeat(10_001))).resolves.toMatchObject({
      ok: false
    })
    await expect(mutations.addComment('OMX-40', '   ')).resolves.toMatchObject({ ok: false })
  })

  it('sets or clears the assignee with a numeric member id', async () => {
    const { mutations, http } = await connected({
      'PUT /api/v1/tickets/OMX-40/assignee': detail()
    })
    await mutations.setAssignee('OMX-40', '8')
    await mutations.setAssignee('OMX-40', null)
    expect(
      http.requests.filter((entry) => entry.method === 'PUT').map((entry) => entry.body)
    ).toEqual([{ assignee_id: 8 }, { assignee_id: null }])
    await expect(mutations.setAssignee('OMX-40', 'grace')).resolves.toMatchObject({ ok: false })
  })

  it('patches only the provided title/description fields', async () => {
    const { mutations, http } = await connected({ 'PATCH /api/v1/tickets/OMX-40': detail() })
    await mutations.updateIssue('OMX-40', { description: '' })
    await mutations.updateIssue('OMX-40', { title: ' New title ' })
    expect(
      http.requests.filter((entry) => entry.method === 'PATCH').map((entry) => entry.body)
    ).toEqual([{ description: '' }, { title: 'New title' }])
    await expect(mutations.updateIssue('OMX-40', {})).resolves.toEqual({
      ok: false,
      error: 'Nothing to update.'
    })
    await expect(mutations.updateIssue('OMX-40', { title: '  ' })).resolves.toMatchObject({
      ok: false
    })
  })

  it('reports malformed keys and missing connections as failed results', async () => {
    const http = createKerjanFetch({})
    const { mutations } = await loadKerjanModules(tempHome, http.fetch)
    await expect(mutations.setStatus('OMX-40', 'todo')).resolves.toEqual({
      ok: false,
      error: 'Not connected to Kerjan.'
    })
    await expect(mutations.addComment('bad key', 'hi')).resolves.toMatchObject({ ok: false })
  })
})
