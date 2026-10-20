import type {
  KerjanConnectArgs,
  KerjanIssueListFilters,
  KerjanIssueUpdate,
  KerjanTaskStatus
} from '../../shared/kerjan-types'
import { connect, disconnect, getStatus, testConnection } from '../kerjan/client'
import {
  getIssue,
  listIssues,
  listMembers,
  listProducts,
  listSprints,
  listWorkspaces,
  searchIssues
} from '../kerjan/issue-queries'
import { addComment, setAssignee, setStatus, updateIssue } from '../kerjan/issue-mutations'
import { _resetPreflightCache } from '../preflight/agent-detection'

export class RuntimeKerjanCommands {
  async kerjanConnect(args: KerjanConnectArgs): ReturnType<typeof connect> {
    const result = await connect(args)
    if (result.ok) {
      _resetPreflightCache()
    }
    return result
  }

  kerjanDisconnect(): { ok: true } {
    disconnect()
    _resetPreflightCache()
    return { ok: true }
  }

  kerjanStatus(): ReturnType<typeof getStatus> {
    return getStatus()
  }

  kerjanTestConnection(): ReturnType<typeof testConnection> {
    return testConnection()
  }

  kerjanListWorkspaces(): ReturnType<typeof listWorkspaces> {
    return listWorkspaces()
  }

  kerjanListSprints(workspaceCode: string): ReturnType<typeof listSprints> {
    return listSprints(workspaceCode)
  }

  kerjanListProducts(workspaceCode: string): ReturnType<typeof listProducts> {
    return listProducts(workspaceCode)
  }

  kerjanListMembers(workspaceCode?: string): ReturnType<typeof listMembers> {
    return listMembers(workspaceCode)
  }

  kerjanListIssues(
    workspaceCode: string,
    filters?: KerjanIssueListFilters
  ): ReturnType<typeof listIssues> {
    return listIssues(workspaceCode, filters)
  }

  kerjanSearchIssues(
    workspaceCode: string,
    query: string,
    filters?: Omit<KerjanIssueListFilters, 'query'>
  ): ReturnType<typeof searchIssues> {
    return searchIssues(workspaceCode, query, filters)
  }

  kerjanGetIssue(key: string): ReturnType<typeof getIssue> {
    return getIssue(key)
  }

  kerjanSetStatus(
    key: string,
    status: KerjanTaskStatus,
    comment?: string
  ): ReturnType<typeof setStatus> {
    return setStatus(key, status, comment)
  }

  kerjanAddComment(key: string, body: string): ReturnType<typeof addComment> {
    return addComment(key, body)
  }

  kerjanSetAssignee(key: string, assigneeId: string | null): ReturnType<typeof setAssignee> {
    return setAssignee(key, assigneeId)
  }

  kerjanUpdateIssue(key: string, updates: KerjanIssueUpdate): ReturnType<typeof updateIssue> {
    return updateIssue(key, updates)
  }
}
