import { applyKerjanClientFilters } from '../../../../shared/kerjan-issue-query'
import type { KerjanIssueListFilters } from '../../../../shared/kerjan-types'
import {
  kerjanGetIssue,
  kerjanListIssues,
  kerjanListMembers,
  kerjanListSprints,
  kerjanListWorkspaces
} from '@/runtime/runtime-kerjan-client'
import type { KerjanSlice, KerjanSliceGet, KerjanSliceSet } from './kerjan-slice-contract'
import {
  getKerjanReadScope,
  KERJAN_ISSUE_LIST_SLOT,
  KERJAN_ISSUE_SLOT,
  KERJAN_MEMBER_SLOT,
  KERJAN_SPRINT_SLOT,
  KERJAN_WORKSPACE_SLOT,
  normalizeKerjanWorkspaceCode,
  readThroughKerjanCache
} from './kerjan-read-coordination'

type KerjanReadActions = Pick<
  KerjanSlice,
  | 'listKerjanWorkspaces'
  | 'listKerjanSprints'
  | 'listKerjanMembers'
  | 'listKerjanIssues'
  | 'fetchKerjanIssue'
>

type KerjanServerFilters = Omit<KerjanIssueListFilters, 'query' | 'limit'>

// Fixed key order so equal filters share one cache key (JSON.stringify drops undefined).
function serverFilters(filters: KerjanIssueListFilters | undefined): KerjanServerFilters {
  return {
    kind: filters?.kind,
    status: filters?.status,
    taskType: filters?.taskType,
    assigneeId: filters?.assigneeId,
    sprintId: filters?.sprintId,
    epicId: filters?.epicId,
    productId: filters?.productId,
    backlog: filters?.backlog
  }
}

export function createKerjanReadActions(
  set: KerjanSliceSet,
  get: KerjanSliceGet
): KerjanReadActions {
  return {
    listKerjanWorkspaces: async (options) => {
      const scope = getKerjanReadScope(get().settings, options?.sourceContext)
      const workspaces = await readThroughKerjanCache(
        set,
        get,
        KERJAN_WORKSPACE_SLOT,
        scope,
        'workspaces',
        options?.force,
        () => kerjanListWorkspaces(scope.settings)
      )
      return workspaces ?? []
    },

    listKerjanSprints: async (workspaceCode, options) => {
      const code = normalizeKerjanWorkspaceCode(workspaceCode)
      const scope = getKerjanReadScope(get().settings, options?.sourceContext)
      const sprints = await readThroughKerjanCache(
        set,
        get,
        KERJAN_SPRINT_SLOT,
        scope,
        `sprints::${code}`,
        options?.force,
        () => kerjanListSprints(scope.settings, code)
      )
      return sprints ?? []
    },

    listKerjanMembers: async (workspaceCode, options) => {
      const code = workspaceCode ? normalizeKerjanWorkspaceCode(workspaceCode) : null
      const scope = getKerjanReadScope(get().settings, options?.sourceContext)
      const members = await readThroughKerjanCache(
        set,
        get,
        KERJAN_MEMBER_SLOT,
        scope,
        `members::${code ?? '*'}`,
        options?.force,
        () => kerjanListMembers(scope.settings, code)
      )
      return members ?? []
    },

    // Why query/limit stay client-side: Kerjan returns whole lists, so typing must not refetch.
    listKerjanIssues: async (workspaceCode, filters, options) => {
      const code = normalizeKerjanWorkspaceCode(workspaceCode)
      const scope = getKerjanReadScope(get().settings, options?.sourceContext)
      const server = serverFilters(filters)
      const issues = await readThroughKerjanCache(
        set,
        get,
        KERJAN_ISSUE_LIST_SLOT,
        scope,
        `issues::${code}::${JSON.stringify(server)}`,
        options?.force,
        () => kerjanListIssues(scope.settings, code, server)
      )
      return applyKerjanClientFilters(issues ?? [], filters)
    },

    fetchKerjanIssue: async (key, options) => {
      const ticketKey = key.trim().toUpperCase()
      const scope = getKerjanReadScope(get().settings, options?.sourceContext)
      return readThroughKerjanCache(
        set,
        get,
        KERJAN_ISSUE_SLOT,
        scope,
        `issue::${ticketKey}`,
        options?.force,
        () => kerjanGetIssue(scope.settings, ticketKey)
      )
    }
  }
}
