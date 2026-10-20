import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { createCmdJTaskSearchRequests } from './task-search-requests'
import { findCmdJTaskWorkspace, openCmdJTask } from './task-search-activation'
import { kerjanTaskIssue, kerjanTaskResult, kerjanTaskSource } from './task-search.test-fixture'
import { makeRepo, makeWorktree } from '../worktree-jump-palette-test-fixtures'
import { kerjanStatus } from '@/runtime/runtime-kerjan-client'
import type { KerjanConnectionStatus } from '../../../../shared/kerjan-types'

vi.mock('@/runtime/runtime-kerjan-client', () => ({ kerjanStatus: vi.fn() }))
const initial = useAppStore.getInitialState()
afterEach(() => {
  useAppStore.setState(initial, true)
  vi.resetAllMocks()
})
const connected: KerjanConnectionStatus = {
  connected: true,
  siteUrl: 'https://kerjan.example',
  viewer: { id: 'u1', name: 'Alice', email: 'alice@example.com' }
}

function kerjanRequests() {
  return createCmdJTaskSearchRequests({
    query: 'login',
    settings: createGlobalSettingsFixture({ visibleTaskProviders: ['kerjan'] }),
    accountBackedTaskSourceHostId: 'local',
    repos: [makeRepo()],
    filter: { hostIds: [], repoIds: [] },
    hostLabels: new Map(),
    signal: new AbortController().signal
  })
}

it('searches the selected Kerjan workspace and binds results to the connected site', async () => {
  vi.mocked(kerjanStatus).mockResolvedValue(connected)
  const listKerjanIssues = vi.fn().mockResolvedValue([kerjanTaskIssue])
  useAppStore.setState({ kerjanSelectedWorkspaceCode: 'OMX', listKerjanIssues })
  const [request] = kerjanRequests()
  expect(request).toMatchObject({ id: 'kerjan:local', provider: 'kerjan' })
  const [result] = await request.run()
  expect(listKerjanIssues).toHaveBeenCalledWith(
    'OMX',
    { query: 'login', limit: 12 },
    { sourceContext: expect.objectContaining({ provider: 'kerjan', hostId: 'local' }) }
  )
  expect(result).toMatchObject({
    identifier: 'OMX-40',
    status: 'In Progress',
    sourceContext: {
      providerIdentity: {
        provider: 'kerjan',
        siteUrl: 'https://kerjan.example',
        workspaceCode: 'OMX'
      },
      accountLabel: 'Alice'
    }
  })
})

it('returns nothing without a selected workspace or a connection', async () => {
  const listKerjanIssues = vi.fn()
  useAppStore.setState({ kerjanSelectedWorkspaceCode: null, listKerjanIssues })
  expect(await kerjanRequests()[0].run()).toEqual([])
  expect(kerjanStatus).not.toHaveBeenCalled()

  vi.mocked(kerjanStatus).mockResolvedValue({ connected: false, siteUrl: null, viewer: null })
  useAppStore.setState({ kerjanSelectedWorkspaceCode: 'OMX' })
  expect(await kerjanRequests()[0].run()).toEqual([])
  expect(listKerjanIssues).not.toHaveBeenCalled()
})

it('surfaces Kerjan read failures so the palette can report the source', async () => {
  vi.mocked(kerjanStatus).mockResolvedValue(connected)
  useAppStore.setState({
    kerjanSelectedWorkspaceCode: 'OMX',
    listKerjanIssues: vi.fn().mockRejectedValue(new Error('not a member'))
  })
  await expect(kerjanRequests()[0].run()).rejects.toThrow('not a member')
})

it('finds a workspace linked to the same Kerjan ticket on the same host', () => {
  const attachment = {
    provider: 'kerjan' as const,
    type: 'issue' as const,
    number: 0,
    url: kerjanTaskIssue.url,
    kerjanIdentifier: 'OMX-40',
    taskSourceContext: kerjanTaskSource
  }
  const workspace = makeWorktree('linked', 'Kerjan workspace', { linkedItems: [attachment] })
  expect(findCmdJTaskWorkspace(kerjanTaskResult, [workspace])).toBe(workspace)
  const remote = makeWorktree('remote', 'Other host', {
    linkedItems: [
      { ...attachment, taskSourceContext: { ...kerjanTaskSource, hostId: 'runtime:other' } }
    ]
  })
  expect(findCmdJTaskWorkspace(kerjanTaskResult, [remote])).toBeUndefined()
})

it('opens the composer with a Kerjan link and source, or the Tasks detail', async () => {
  const openModal = vi.fn()
  const openTaskPage = vi.fn()
  useAppStore.setState({ openModal, openTaskPage, closeModal: vi.fn() })
  openCmdJTask(kerjanTaskResult, true)
  await Promise.resolve()
  expect(openModal).toHaveBeenCalledWith('new-workspace-composer', {
    linkedWorkItem: {
      provider: 'kerjan',
      type: 'issue',
      number: 0,
      title: 'OMX-40 Fix login redirect',
      url: kerjanTaskIssue.url,
      kerjanIdentifier: 'OMX-40'
    },
    prefilledName: expect.stringMatching(/^OMX-40/i),
    initialRepoId: null,
    taskSourceContext: kerjanTaskSource,
    telemetrySource: 'command_palette'
  })

  openCmdJTask(kerjanTaskResult)
  expect(openTaskPage).toHaveBeenCalledWith(
    {
      taskSource: 'kerjan',
      openKerjanIssue: kerjanTaskIssue,
      openKerjanSourceContext: kerjanTaskSource
    },
    { recordTasksInteraction: false }
  )
})
