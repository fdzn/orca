import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  KerjanConnectionStatus,
  KerjanIssue,
  KerjanIssueDetail
} from '../../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import { getDefaultSettings } from '../../../../shared/constants'
import { createTestStore } from './store-test-helpers'

const kerjanStatus = vi.fn()
const kerjanConnect = vi.fn()
const kerjanDisconnect = vi.fn()
const kerjanTestConnection = vi.fn()
const kerjanListWorkspaces = vi.fn()
const kerjanListIssues = vi.fn()
const kerjanGetIssue = vi.fn()
const kerjanSetStatus = vi.fn()
const kerjanAddComment = vi.fn()

vi.mock('@/runtime/runtime-kerjan-client', () => ({
  kerjanStatus: (...args: unknown[]) => kerjanStatus(...args),
  kerjanConnect: (...args: unknown[]) => kerjanConnect(...args),
  kerjanDisconnect: (...args: unknown[]) => kerjanDisconnect(...args),
  kerjanTestConnection: (...args: unknown[]) => kerjanTestConnection(...args),
  kerjanListWorkspaces: (...args: unknown[]) => kerjanListWorkspaces(...args),
  kerjanListSprints: vi.fn(),
  kerjanListMembers: vi.fn(),
  kerjanListIssues: (...args: unknown[]) => kerjanListIssues(...args),
  kerjanGetIssue: (...args: unknown[]) => kerjanGetIssue(...args),
  kerjanSetStatus: (...args: unknown[]) => kerjanSetStatus(...args),
  kerjanAddComment: (...args: unknown[]) => kerjanAddComment(...args),
  kerjanSetAssignee: vi.fn(),
  kerjanUpdateIssue: vi.fn()
}))

const REMOTE_SETTINGS = {
  ...getDefaultSettings('/home/test'),
  activeRuntimeEnvironmentId: 'runtime-1'
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function connected(name: string, siteUrl = 'https://kerjan.example'): KerjanConnectionStatus {
  return { connected: true, siteUrl, viewer: { id: name, name, email: null } }
}

function issue(
  key: string,
  title = key,
  statusKey: KerjanIssue['statusKey'] = 'todo'
): KerjanIssue {
  return {
    id: key,
    key,
    title,
    url: `https://kerjan.example/ticket/${key}`,
    project: { id: 'OMX', key: 'OMX', name: 'OMX' },
    issueType: { id: 'task', name: 'Task' },
    status: { id: statusKey, name: statusKey, categoryKey: 'new', categoryName: 'To Do' },
    labels: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    kind: 'task',
    statusKey,
    taskType: 'dev',
    isBug: false,
    assigneeId: null,
    sprintId: null,
    severity: null,
    estimate: null,
    qaKey: null,
    originTaskKey: null,
    doneAt: null,
    canceledAt: null,
    cancelReason: null,
    tasks: []
  }
}

function detail(key: string, statusKey: KerjanIssue['statusKey']): KerjanIssueDetail {
  return { ...issue(key, key, statusKey), comments: [], history: [], stories: [] }
}

describe('createKerjanSlice connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores a status reply that lands after the active runtime changed', async () => {
    const store = createTestStore()
    const localStatus = deferred<KerjanConnectionStatus>()
    const remoteStatus = deferred<KerjanConnectionStatus>()
    kerjanStatus.mockReturnValueOnce(localStatus.promise).mockReturnValueOnce(remoteStatus.promise)

    const localRequest = store.getState().checkKerjanConnection()
    store.setState({ settings: REMOTE_SETTINGS })
    const remoteRequest = store.getState().checkKerjanConnection()

    remoteStatus.resolve(connected('remote'))
    await remoteRequest
    localStatus.resolve(connected('local'))
    await localRequest

    expect(store.getState().kerjanStatus.viewer?.name).toBe('remote')
    expect(store.getState().kerjanStatusContextKey).toBe('runtime:runtime-1#0')
    expect(store.getState().kerjanStatusChecked).toBe(true)
  })

  it('reads a failed status check as disconnected but checked', async () => {
    const store = createTestStore()
    kerjanStatus.mockRejectedValueOnce(new Error('boom'))

    await store.getState().checkKerjanConnection()

    expect(store.getState().kerjanStatus.connected).toBe(false)
    expect(store.getState().kerjanStatusChecked).toBe(true)
  })

  it('connects, drops previous caches, and refreshes the full status', async () => {
    const store = createTestStore()
    store.setState({
      kerjanWorkspaceCache: { 'local#0::workspaces': { data: [], fetchedAt: Date.now() } }
    })
    kerjanConnect.mockResolvedValueOnce({ ok: true, viewer: { id: '7', name: 'Ada', email: null } })
    kerjanStatus.mockResolvedValueOnce(connected('Ada'))

    const result = await store.getState().connectKerjan({
      baseUrl: 'https://kerjan.example',
      token: 'kjt_x'
    })

    expect(result.ok).toBe(true)
    expect(store.getState().kerjanWorkspaceCache).toEqual({})
    await vi.waitFor(() =>
      expect(store.getState().kerjanStatus.siteUrl).toBe('https://kerjan.example')
    )
  })

  it('disconnects and clears the selected workspace', async () => {
    const store = createTestStore()
    store.setState({ kerjanStatus: connected('Ada') })
    store.getState().setKerjanSelectedWorkspaceCode(' omx ')
    expect(store.getState().kerjanSelectedWorkspaceCode).toBe('OMX')
    kerjanDisconnect.mockResolvedValueOnce(undefined)

    await store.getState().disconnectKerjan()

    expect(store.getState().kerjanStatus.connected).toBe(false)
    expect(store.getState().kerjanSelectedWorkspaceCode).toBeNull()
  })
})

describe('createKerjanSlice reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters text and limit client-side so typing reuses one server list', async () => {
    const store = createTestStore()
    kerjanListIssues.mockResolvedValue([issue('OMX-1', 'Fix login'), issue('OMX-2', 'Add export')])

    const all = await store.getState().listKerjanIssues('omx', { status: 'todo' })
    const searched = await store
      .getState()
      .listKerjanIssues('OMX', { status: 'todo', query: 'export' })
    const limited = await store.getState().listKerjanIssues('OMX', { status: 'todo', limit: 1 })

    expect(all.map((entry) => entry.key)).toEqual(['OMX-1', 'OMX-2'])
    expect(searched.map((entry) => entry.key)).toEqual(['OMX-2'])
    expect(limited.map((entry) => entry.key)).toEqual(['OMX-1'])
    expect(kerjanListIssues).toHaveBeenCalledTimes(1)
    expect(kerjanListIssues.mock.calls[0]?.[1]).toBe('OMX')
    expect(kerjanListIssues.mock.calls[0]?.[2]).toMatchObject({ status: 'todo' })
    expect(kerjanListIssues.mock.calls[0]?.[2]).not.toHaveProperty('query')
  })

  it('shares one in-flight read and keys caches by runtime', async () => {
    const store = createTestStore()
    const pending = deferred<{ id: string; code: string; name: string }[]>()
    kerjanListWorkspaces.mockReturnValueOnce(pending.promise)

    const first = store.getState().listKerjanWorkspaces()
    const second = store.getState().listKerjanWorkspaces()
    pending.resolve([{ id: '1', code: 'OMX', name: 'Omnix' }])
    await expect(first).resolves.toHaveLength(1)
    await expect(second).resolves.toHaveLength(1)
    expect(kerjanListWorkspaces).toHaveBeenCalledTimes(1)

    store.setState({ settings: REMOTE_SETTINGS })
    kerjanListWorkspaces.mockResolvedValueOnce([])
    await expect(store.getState().listKerjanWorkspaces()).resolves.toEqual([])
    expect(kerjanListWorkspaces).toHaveBeenCalledTimes(2)
  })

  it('keeps task-source reads apart from the default scope', async () => {
    const store = createTestStore()
    const sourceContext: TaskSourceContext = {
      kind: 'task-source',
      provider: 'kerjan',
      projectId: 'logical-project',
      hostId: 'runtime:env-2',
      providerIdentity: { provider: 'kerjan', workspaceCode: 'OMX' }
    }
    kerjanGetIssue.mockResolvedValue(detail('OMX-3', 'todo'))

    await store.getState().fetchKerjanIssue('omx-3')
    await store.getState().fetchKerjanIssue('OMX-3', { sourceContext })

    expect(kerjanGetIssue).toHaveBeenCalledTimes(2)
    expect(kerjanGetIssue.mock.calls[0]?.[1]).toBe('OMX-3')
    expect(kerjanGetIssue.mock.calls[1]?.[0]).toBe(sourceContext)
  })

  it('re-checks status after a failed read so a dropped token shows reconnect', async () => {
    const store = createTestStore()
    store.setState({ kerjanStatus: connected('Ada') })
    kerjanListIssues.mockRejectedValueOnce(new Error('Not connected to Kerjan.'))
    kerjanStatus.mockResolvedValueOnce({ connected: false, siteUrl: null, viewer: null })

    await expect(store.getState().listKerjanIssues('OMX')).rejects.toThrow('Not connected')
    await vi.waitFor(() => expect(store.getState().kerjanStatus.connected).toBe(false))
  })
})

describe('createKerjanSlice mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes the returned detail and marks the workspace lists stale', async () => {
    const store = createTestStore()
    kerjanListIssues.mockResolvedValueOnce([issue('OMX-1'), issue('OMX-2')])
    await store.getState().listKerjanIssues('OMX')
    kerjanSetStatus.mockResolvedValueOnce({ ok: true, issue: detail('OMX-2', 'done') })

    const result = await store.getState().setKerjanIssueStatus('OMX-2', 'done', 'shipped')

    expect(result.ok).toBe(true)
    expect(kerjanSetStatus.mock.calls[0]?.slice(1)).toEqual(['OMX-2', 'done', 'shipped'])
    const [listKey, listEntry] = Object.entries(store.getState().kerjanIssueListCache)[0] ?? []
    expect(listKey).toContain('issues::OMX::')
    expect(listEntry?.fetchedAt).toBe(0)
    expect(listEntry?.data?.find((entry) => entry.key === 'OMX-2')?.statusKey).toBe('done')
    expect(listEntry?.data?.find((entry) => entry.key === 'OMX-2')).not.toHaveProperty('comments')
    expect(store.getState().kerjanIssueCache['local#0::issue::OMX-2']?.data?.statusKey).toBe('done')

    kerjanListIssues.mockResolvedValueOnce([issue('OMX-1')])
    await expect(store.getState().listKerjanIssues('OMX')).resolves.toHaveLength(1)
    expect(kerjanListIssues).toHaveBeenCalledTimes(2)
  })

  it('returns a transport failure as an error result without touching caches', async () => {
    const store = createTestStore()
    kerjanAddComment.mockRejectedValueOnce(
      new Error('Update the remote Orca server to use Kerjan.')
    )

    await expect(store.getState().addKerjanIssueComment('OMX-2', 'hi')).resolves.toEqual({
      ok: false,
      error: 'Update the remote Orca server to use Kerjan.'
    })
    expect(store.getState().kerjanIssueCache).toEqual({})
  })
})
