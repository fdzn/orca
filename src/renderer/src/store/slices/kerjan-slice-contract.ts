import type { StateCreator } from 'zustand'
import type { CacheEntry } from '../github/cache-model'
import type { AppState } from '../types'
import type {
  KerjanConnectArgs,
  KerjanConnectResult,
  KerjanConnectionStatus,
  KerjanIssue,
  KerjanIssueDetail,
  KerjanIssueListFilters,
  KerjanIssueUpdate,
  KerjanMember,
  KerjanMutationResult,
  KerjanSprint,
  KerjanTaskStatus,
  KerjanWorkspace
} from '../../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../../shared/task-source-context'

export type KerjanReadOptions = {
  sourceContext?: TaskSourceContext | null
  force?: boolean
}

export type KerjanMutationOptions = {
  sourceContext?: TaskSourceContext | null
}

export type KerjanSlice = {
  kerjanStatus: KerjanConnectionStatus
  kerjanStatusChecked: boolean
  kerjanStatusContextKey: string | null
  /** The Kerjan workspace (≈ Jira project) the Tasks list reads; renderer-session only. */
  kerjanSelectedWorkspaceCode: string | null
  /** Every cache is keyed `<read context key>::<read>`, so runtimes and task sources never mix. */
  kerjanWorkspaceCache: Record<string, CacheEntry<KerjanWorkspace[]>>
  kerjanSprintCache: Record<string, CacheEntry<KerjanSprint[]>>
  kerjanMemberCache: Record<string, CacheEntry<KerjanMember[]>>
  /** Server-filtered lists; text query and limit are applied on read. */
  kerjanIssueListCache: Record<string, CacheEntry<KerjanIssue[]>>
  kerjanIssueCache: Record<string, CacheEntry<KerjanIssueDetail | null>>

  checkKerjanConnection: () => Promise<void>
  connectKerjan: (args: KerjanConnectArgs) => Promise<KerjanConnectResult>
  testKerjanConnection: () => Promise<KerjanConnectResult>
  disconnectKerjan: () => Promise<void>
  setKerjanSelectedWorkspaceCode: (workspaceCode: string | null) => void

  listKerjanWorkspaces: (options?: KerjanReadOptions) => Promise<KerjanWorkspace[]>
  listKerjanSprints: (workspaceCode: string, options?: KerjanReadOptions) => Promise<KerjanSprint[]>
  listKerjanMembers: (
    workspaceCode?: string | null,
    options?: KerjanReadOptions
  ) => Promise<KerjanMember[]>
  listKerjanIssues: (
    workspaceCode: string,
    filters?: KerjanIssueListFilters,
    options?: KerjanReadOptions
  ) => Promise<KerjanIssue[]>
  fetchKerjanIssue: (key: string, options?: KerjanReadOptions) => Promise<KerjanIssueDetail | null>

  setKerjanIssueStatus: (
    key: string,
    status: KerjanTaskStatus,
    comment?: string,
    options?: KerjanMutationOptions
  ) => Promise<KerjanMutationResult>
  addKerjanIssueComment: (
    key: string,
    body: string,
    options?: KerjanMutationOptions
  ) => Promise<KerjanMutationResult>
  setKerjanIssueAssignee: (
    key: string,
    assigneeId: string | null,
    options?: KerjanMutationOptions
  ) => Promise<KerjanMutationResult>
  updateKerjanIssue: (
    key: string,
    updates: KerjanIssueUpdate,
    options?: KerjanMutationOptions
  ) => Promise<KerjanMutationResult>
}

type KerjanStateCreator = StateCreator<AppState, [], [], KerjanSlice>

export type KerjanSliceSet = Parameters<KerjanStateCreator>[0]
export type KerjanSliceGet = Parameters<KerjanStateCreator>[1]
