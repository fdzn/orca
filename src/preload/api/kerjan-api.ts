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
  KerjanProduct,
  KerjanSprint,
  KerjanTaskStatus,
  KerjanWorkspace
} from '../../shared/kerjan-types'

/** Arg shapes match the `kerjan.*` RPC params so the web client can forward them unchanged. */
export type KerjanApi = {
  connect: (args: KerjanConnectArgs) => Promise<KerjanConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<KerjanConnectionStatus>
  testConnection: () => Promise<KerjanConnectResult>
  listWorkspaces: () => Promise<KerjanWorkspace[]>
  listSprints: (args: { workspaceCode: string }) => Promise<KerjanSprint[]>
  listProducts: (args: { workspaceCode: string }) => Promise<KerjanProduct[]>
  listMembers: (args?: { workspaceCode?: string }) => Promise<KerjanMember[]>
  listIssues: (args: {
    workspaceCode: string
    filters?: KerjanIssueListFilters
  }) => Promise<KerjanIssue[]>
  searchIssues: (args: {
    workspaceCode: string
    query: string
    filters?: Omit<KerjanIssueListFilters, 'query'>
  }) => Promise<KerjanIssue[]>
  getIssue: (args: { key: string }) => Promise<KerjanIssueDetail | null>
  setStatus: (args: {
    key: string
    status: KerjanTaskStatus
    comment?: string
  }) => Promise<KerjanMutationResult>
  addComment: (args: { key: string; body: string }) => Promise<KerjanMutationResult>
  setAssignee: (args: { key: string; assigneeId: string | null }) => Promise<KerjanMutationResult>
  updateIssue: (args: { key: string; updates: KerjanIssueUpdate }) => Promise<KerjanMutationResult>
}
