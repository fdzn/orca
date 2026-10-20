import { beforeEach, expect, it, vi } from 'vitest'
import type { WorkspaceAttachment } from '../../../../shared/worktree/types'
import { readWorkspaceReferenceDetails } from './workspace-reference-detail-read'
import { getWorkspaceReferenceRequest } from './workspace-reference-details'
import { referenceRepo, referenceWorkspace } from './workspace-reference-fixtures.test-support'
import { kerjanTaskIssue } from '../cmd-j/task-search.test-fixture'

const mocks = vi.hoisted(() => ({ fetchKerjanIssue: vi.fn() }))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      kerjanIssueCache: {},
      settings: null,
      fetchKerjanIssue: mocks.fetchKerjanIssue
    })
  }
}))

const item: WorkspaceAttachment = {
  provider: 'kerjan',
  type: 'issue',
  number: 0,
  kerjanIdentifier: 'OMX-40',
  url: kerjanTaskIssue.url
}

beforeEach(() => vi.clearAllMocks())

it('reads Kerjan ticket title and derived state for hover details', async () => {
  mocks.fetchKerjanIssue.mockResolvedValue({ ...kerjanTaskIssue, comments: [], history: [] })
  const detail = await readWorkspaceReferenceDetails(
    getWorkspaceReferenceRequest(item, referenceWorkspace, referenceRepo)
  )
  expect(mocks.fetchKerjanIssue).toHaveBeenCalledWith('OMX-40', {
    sourceContext: expect.objectContaining({ provider: 'kerjan' })
  })
  expect(detail).toEqual({
    title: 'Fix login redirect',
    url: kerjanTaskIssue.url,
    stateName: 'In Progress',
    stateType: 'started'
  })
})

it('ignores a ticket from another site', async () => {
  mocks.fetchKerjanIssue.mockResolvedValue({
    ...kerjanTaskIssue,
    url: 'https://other.example/ticket/OMX-40'
  })
  expect(
    await readWorkspaceReferenceDetails(
      getWorkspaceReferenceRequest(item, referenceWorkspace, referenceRepo)
    )
  ).toBeNull()
})
