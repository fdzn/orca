import type { CacheEntry } from '../github/cache-model'
import { isFresh, withBoundedCacheEntry, WORK_ITEMS_CACHE_TTL } from '../github/cache-policy'
import type { AppState } from '../types'
import type { KerjanIssue, KerjanIssueDetail } from '../../../../shared/kerjan-types'
import { getKerjanWorkspaceCodeFromTicketKey } from '../../../../shared/kerjan-ticket-url'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import type { RowLessSource } from '@/lib/default-creation-host'
import { getJiraReadScope } from './jira-read-coordination'
import type { KerjanSlice, KerjanSliceGet, KerjanSliceSet } from './kerjan-slice-contract'

export type KerjanReadScope = {
  contextKey: string
  explicitSource: boolean
  settings: RowLessSource
}

type InflightKerjanRead<T> = {
  promise: Promise<T | null>
  contextKey: string
  generation: number
}

export type KerjanCacheSlot<T> = {
  read: (state: KerjanSlice) => Record<string, CacheEntry<T>>
  write: (cache: Record<string, CacheEntry<T>>) => Partial<KerjanSlice>
  inflight: Map<string, InflightKerjanRead<T>>
}

function cacheSlot<T>(
  read: KerjanCacheSlot<T>['read'],
  write: KerjanCacheSlot<T>['write']
): KerjanCacheSlot<T> {
  return { read, write, inflight: new Map() }
}

export const KERJAN_WORKSPACE_SLOT = cacheSlot(
  (state) => state.kerjanWorkspaceCache,
  (kerjanWorkspaceCache) => ({ kerjanWorkspaceCache })
)
export const KERJAN_SPRINT_SLOT = cacheSlot(
  (state) => state.kerjanSprintCache,
  (kerjanSprintCache) => ({ kerjanSprintCache })
)
export const KERJAN_MEMBER_SLOT = cacheSlot(
  (state) => state.kerjanMemberCache,
  (kerjanMemberCache) => ({ kerjanMemberCache })
)
export const KERJAN_ISSUE_LIST_SLOT = cacheSlot(
  (state) => state.kerjanIssueListCache,
  (kerjanIssueListCache) => ({ kerjanIssueListCache })
)
export const KERJAN_ISSUE_SLOT = cacheSlot<KerjanIssueDetail | null>(
  (state) => state.kerjanIssueCache,
  (kerjanIssueCache) => ({ kerjanIssueCache })
)

const KERJAN_CACHE_SLOTS = [
  KERJAN_WORKSPACE_SLOT,
  KERJAN_SPRINT_SLOT,
  KERJAN_MEMBER_SLOT,
  KERJAN_ISSUE_LIST_SLOT,
  KERJAN_ISSUE_SLOT
]

export const EMPTY_KERJAN_READ_CACHES = {
  kerjanWorkspaceCache: {},
  kerjanSprintCache: {},
  kerjanMemberCache: {},
  kerjanIssueListCache: {},
  kerjanIssueCache: {}
} satisfies Partial<KerjanSlice>

// Bumped by connect/disconnect/test so reads started against the old connection never land.
let kerjanConnectionGeneration = 0

export function beginKerjanConnectionChange(): number {
  kerjanConnectionGeneration += 1
  for (const slot of KERJAN_CACHE_SLOTS) {
    slot.inflight.clear()
  }
  return kerjanConnectionGeneration
}

export function currentKerjanConnectionGeneration(): number {
  return kerjanConnectionGeneration
}

export function isCurrentKerjanRuntimeContext(
  contextKey: string,
  settings: AppState['settings']
): boolean {
  return getProviderRuntimeContextKey(settings) === contextKey
}

/** Same scoping Jira uses: a task source gets its own host and cache prefix. */
export function getKerjanReadScope(
  settings: AppState['settings'],
  sourceContext?: TaskSourceContext | null
): KerjanReadScope {
  const { contextKey, explicitSource, settings: source } = getJiraReadScope(settings, sourceContext)
  return { contextKey, explicitSource, settings: source }
}

export function canWriteKerjanResult(
  scope: KerjanReadScope,
  generation: number,
  settings: AppState['settings']
): boolean {
  return (
    generation === kerjanConnectionGeneration &&
    (scope.explicitSource || isCurrentKerjanRuntimeContext(scope.contextKey, settings))
  )
}

export function kerjanCacheKey(scope: KerjanReadScope, key: string): string {
  return `${scope.contextKey}::${key}`
}

export function normalizeKerjanWorkspaceCode(workspaceCode: string): string {
  return workspaceCode.trim().toUpperCase()
}

/** Cached, de-duplicated read; a failure re-checks status since main drops a rejected token. */
export function readThroughKerjanCache<T>(
  set: KerjanSliceSet,
  get: KerjanSliceGet,
  slot: KerjanCacheSlot<T>,
  scope: KerjanReadScope,
  key: string,
  force: boolean | undefined,
  load: () => Promise<T>
): Promise<T | null> {
  const cacheKey = kerjanCacheKey(scope, key)
  const cached = slot.read(get())[cacheKey]
  if (!force && isFresh(cached, WORK_ITEMS_CACHE_TTL)) {
    return Promise.resolve(cached.data)
  }
  const generation = kerjanConnectionGeneration
  const inflight = slot.inflight.get(cacheKey)
  if (
    !force &&
    inflight &&
    inflight.contextKey === scope.contextKey &&
    inflight.generation === generation
  ) {
    return inflight.promise
  }
  let entry: InflightKerjanRead<T>
  const promise = load()
    .then((data) => {
      if (
        slot.inflight.get(cacheKey) === entry &&
        canWriteKerjanResult(scope, generation, get().settings)
      ) {
        set((state) =>
          slot.write(
            withBoundedCacheEntry(slot.read(state), cacheKey, { data, fetchedAt: Date.now() })
          )
        )
      }
      return data
    })
    .catch((error: unknown) => {
      if (canWriteKerjanResult(scope, generation, get().settings) && !scope.explicitSource) {
        void get().checkKerjanConnection()
      }
      throw error
    })
    .finally(() => {
      if (slot.inflight.get(cacheKey) === entry) {
        slot.inflight.delete(cacheKey)
      }
    })
  entry = { promise, contextKey: scope.contextKey, generation }
  slot.inflight.set(cacheKey, entry)
  return promise
}

function toKerjanIssueSummary(detail: KerjanIssueDetail): KerjanIssue {
  const { comments: _comments, history: _history, stories: _stories, ...issue } = detail
  return issue
}

/**
 * Writes a mutation's fresh detail into the caches of its read context. Lists and sibling
 * details in the workspace go stale (fetchedAt 0): filters and derived Story status may change.
 */
export function applyKerjanIssueDetail(
  state: KerjanSlice,
  scope: KerjanReadScope,
  detail: KerjanIssueDetail
): Partial<KerjanSlice> {
  const workspaceCode = getKerjanWorkspaceCodeFromTicketKey(detail.key) ?? detail.project.key
  const listPrefix = kerjanCacheKey(scope, `issues::${workspaceCode}::`)
  const issuePrefix = kerjanCacheKey(scope, `issue::${workspaceCode}-`)
  const issueKey = kerjanCacheKey(scope, `issue::${detail.key}`)
  const summary = toKerjanIssueSummary(detail)
  const kerjanIssueListCache = { ...state.kerjanIssueListCache }
  for (const [key, entry] of Object.entries(kerjanIssueListCache)) {
    if (key.startsWith(listPrefix) && entry) {
      kerjanIssueListCache[key] = {
        ...entry,
        data: entry.data?.map((issue) => (issue.key === detail.key ? summary : issue)) ?? null,
        fetchedAt: 0
      }
    }
  }
  const kerjanIssueCache = { ...state.kerjanIssueCache }
  for (const [key, entry] of Object.entries(kerjanIssueCache)) {
    if (key.startsWith(issuePrefix) && entry) {
      kerjanIssueCache[key] = { ...entry, fetchedAt: 0 }
    }
  }
  return {
    kerjanIssueListCache,
    kerjanIssueCache: withBoundedCacheEntry(kerjanIssueCache, issueKey, {
      data: detail,
      fetchedAt: Date.now()
    })
  }
}
