// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KerjanConnectionStatus, KerjanWorkspace } from '../../../shared/kerjan-types'
import { KERJAN_SOURCE, makeKerjanIssue } from './kerjan-ticket.test-fixture'
import { useTaskPageKerjanList } from './use-task-page-kerjan-list'
import { KERJAN_ASSIGNEE_ME } from './kerjan-task-list-filters'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return { state }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (value: Record<string, unknown>) => unknown): unknown =>
    selector(mocks.state)
}))

const workspace = (code: string, readOnly = false): KerjanWorkspace => ({
  id: code,
  code,
  name: `${code} workspace`,
  kind: null,
  jiraProject: readOnly ? 'JIRA' : null,
  readOnly
})

const connected: KerjanConnectionStatus = {
  connected: true,
  siteUrl: 'https://kerjan.example',
  viewer: { id: 'u1', name: 'Ada', email: null }
}

function setStore(overrides: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = {
    kerjanStatus: connected,
    kerjanStatusChecked: true,
    kerjanSelectedWorkspaceCode: null,
    setKerjanSelectedWorkspaceCode: vi.fn((code: string | null) => {
      store.kerjanSelectedWorkspaceCode = code
    }),
    checkKerjanConnection: vi.fn(async () => {}),
    listKerjanWorkspaces: vi.fn(async () => [workspace('OMX'), workspace('HV', true)]),
    listKerjanSprints: vi.fn(async () => []),
    listKerjanMembers: vi.fn(async () => []),
    listKerjanIssues: vi.fn(async () => [
      makeKerjanIssue(),
      makeKerjanIssue({ key: 'OMX-41', title: 'Billing export', description: 'CSV' })
    ]),
    ...overrides
  }
  mocks.state = store
  return store
}

describe('useTaskPageKerjanList', () => {
  beforeEach(() => {
    setStore()
  })

  it('reads the first workspace, remembers it, and filters text client-side', async () => {
    const store = mocks.state
    const { result } = renderHook(() =>
      useTaskPageKerjanList({ active: true, sourceContext: KERJAN_SOURCE })
    )
    await waitFor(() => expect(result.current.issues).toHaveLength(2))
    expect(result.current.selectedWorkspace?.code).toBe('OMX')
    expect(store.setKerjanSelectedWorkspaceCode).toHaveBeenCalledWith('OMX')
    expect(store.listKerjanIssues).toHaveBeenCalledWith(
      'OMX',
      {},
      { sourceContext: KERJAN_SOURCE, force: false }
    )

    const listIssues = store.listKerjanIssues
    if (!vi.isMockFunction(listIssues)) {
      throw new Error('listKerjanIssues must be a mock')
    }
    const calls = listIssues.mock.calls.length
    act(() => result.current.setFilters((current) => ({ ...current, query: 'csv' })))
    expect(result.current.displayedIssues.map((issue) => issue.key)).toEqual(['OMX-41'])
    expect(listIssues.mock.calls).toHaveLength(calls)
  })

  it('sends "me" as the viewer id and forces only the refresh read', async () => {
    const store = mocks.state
    const { result } = renderHook(() =>
      useTaskPageKerjanList({ active: true, sourceContext: KERJAN_SOURCE })
    )
    await waitFor(() => expect(result.current.issues).toHaveLength(2))
    act(() =>
      result.current.setFilters((current) => ({ ...current, assignee: KERJAN_ASSIGNEE_ME }))
    )
    await waitFor(() =>
      expect(store.listKerjanIssues).toHaveBeenLastCalledWith(
        'OMX',
        { assigneeId: 'u1' },
        { sourceContext: KERJAN_SOURCE, force: false }
      )
    )
    act(() => result.current.refresh())
    await waitFor(() =>
      expect(store.listKerjanIssues).toHaveBeenLastCalledWith(
        'OMX',
        { assigneeId: 'u1' },
        { sourceContext: KERJAN_SOURCE, force: true }
      )
    )
  })

  it('keeps Kerjan error text verbatim', async () => {
    setStore({
      listKerjanIssues: vi.fn(async () => {
        throw new Error('Workspace OMX is synced from Jira (SPEC #12)')
      })
    })
    const { result } = renderHook(() =>
      useTaskPageKerjanList({ active: true, sourceContext: KERJAN_SOURCE })
    )
    await waitFor(() =>
      expect(result.current.issuesError).toBe('Workspace OMX is synced from Jira (SPEC #12)')
    )
  })

  it('stays idle while disconnected and checks the connection once active', async () => {
    const store = setStore({
      kerjanStatus: { connected: false, siteUrl: null, viewer: null },
      kerjanStatusChecked: false
    })
    renderHook(() => useTaskPageKerjanList({ active: true, sourceContext: KERJAN_SOURCE }))
    await waitFor(() => expect(store.checkKerjanConnection).toHaveBeenCalled())
    expect(store.listKerjanWorkspaces).not.toHaveBeenCalled()
  })
})
