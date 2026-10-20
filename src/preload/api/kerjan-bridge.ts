import { ipcRenderer } from 'electron'
import type {
  KerjanConnectArgs,
  KerjanIssueListFilters,
  KerjanIssueUpdate,
  KerjanTaskStatus
} from '../../shared/kerjan-types'
import type { PreloadApi } from '../api-types'

export const kerjanApi = {
  connect: (args: KerjanConnectArgs) => ipcRenderer.invoke('kerjan:connect', args),

  disconnect: (): Promise<void> => ipcRenderer.invoke('kerjan:disconnect'),

  status: () => ipcRenderer.invoke('kerjan:status'),

  testConnection: () => ipcRenderer.invoke('kerjan:testConnection'),

  listWorkspaces: () => ipcRenderer.invoke('kerjan:listWorkspaces'),

  listSprints: (args: { workspaceCode: string }) => ipcRenderer.invoke('kerjan:listSprints', args),

  listProducts: (args: { workspaceCode: string }) =>
    ipcRenderer.invoke('kerjan:listProducts', args),

  listMembers: (args?: { workspaceCode?: string }) =>
    ipcRenderer.invoke('kerjan:listMembers', args),

  listIssues: (args: { workspaceCode: string; filters?: KerjanIssueListFilters }) =>
    ipcRenderer.invoke('kerjan:listIssues', args),

  searchIssues: (args: {
    workspaceCode: string
    query: string
    filters?: Omit<KerjanIssueListFilters, 'query'>
  }) => ipcRenderer.invoke('kerjan:searchIssues', args),

  getIssue: (args: { key: string }) => ipcRenderer.invoke('kerjan:getIssue', args),

  setStatus: (args: { key: string; status: KerjanTaskStatus; comment?: string }) =>
    ipcRenderer.invoke('kerjan:setStatus', args),

  addComment: (args: { key: string; body: string }) =>
    ipcRenderer.invoke('kerjan:addComment', args),

  setAssignee: (args: { key: string; assigneeId: string | null }) =>
    ipcRenderer.invoke('kerjan:setAssignee', args),

  updateIssue: (args: { key: string; updates: KerjanIssueUpdate }) =>
    ipcRenderer.invoke('kerjan:updateIssue', args)
} satisfies PreloadApi['kerjan']
