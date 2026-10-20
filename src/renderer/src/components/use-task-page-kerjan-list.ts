import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import type {
  KerjanIssue,
  KerjanMember,
  KerjanSprint,
  KerjanWorkspace
} from '../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { applyKerjanClientFilters } from '../../../shared/kerjan-issue-query'
import {
  buildKerjanIssueListFilters,
  DEFAULT_KERJAN_TASK_LIST_FILTERS,
  resolveKerjanWorkspaceSelection,
  type KerjanTaskListFilterState
} from './kerjan-task-list-filters'

type KerjanLoad<T> = { data: T; loading: boolean; error: string | null }

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Workspaces, lookups, and the filtered ticket list behind the Tasks page Kerjan tab. */
export function useTaskPageKerjanList(args: {
  active: boolean
  sourceContext: TaskSourceContext | null
}) {
  const { active, sourceContext } = args
  const {
    kerjanStatus,
    kerjanStatusChecked,
    kerjanSelectedWorkspaceCode,
    setKerjanSelectedWorkspaceCode,
    checkKerjanConnection,
    listKerjanWorkspaces,
    listKerjanSprints,
    listKerjanMembers,
    listKerjanIssues
  } = useAppStore(
    useShallow((s) => ({
      kerjanStatus: s.kerjanStatus,
      kerjanStatusChecked: s.kerjanStatusChecked,
      kerjanSelectedWorkspaceCode: s.kerjanSelectedWorkspaceCode,
      setKerjanSelectedWorkspaceCode: s.setKerjanSelectedWorkspaceCode,
      checkKerjanConnection: s.checkKerjanConnection,
      listKerjanWorkspaces: s.listKerjanWorkspaces,
      listKerjanSprints: s.listKerjanSprints,
      listKerjanMembers: s.listKerjanMembers,
      listKerjanIssues: s.listKerjanIssues
    }))
  )
  const connected = kerjanStatus.connected
  const viewerId = kerjanStatus.viewer?.id ?? null
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [filters, setFilters] = useState<KerjanTaskListFilterState>(
    DEFAULT_KERJAN_TASK_LIST_FILTERS
  )
  const [workspaces, setWorkspaces] = useState<KerjanLoad<KerjanWorkspace[]>>({
    data: [],
    loading: false,
    error: null
  })
  const [sprints, setSprints] = useState<KerjanSprint[]>([])
  const [members, setMembers] = useState<KerjanMember[]>([])
  const [issues, setIssues] = useState<KerjanLoad<KerjanIssue[]>>({
    data: [],
    loading: false,
    error: null
  })

  useEffect(() => {
    if (active && !kerjanStatusChecked) {
      void checkKerjanConnection()
    }
  }, [active, checkKerjanConnection, kerjanStatusChecked])

  // Why: only the refresh that bumped the nonce bypasses the cache; later reads stay cached.
  const workspaceRefreshRef = useRef(0)
  const issueRefreshRef = useRef(0)
  useEffect(() => {
    if (!active || !connected) {
      return
    }
    let cancelled = false
    const force = workspaceRefreshRef.current !== refreshNonce
    workspaceRefreshRef.current = refreshNonce
    setWorkspaces((current) => ({ ...current, loading: true, error: null }))
    listKerjanWorkspaces({ sourceContext, force })
      .then((data) => !cancelled && setWorkspaces({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (!cancelled) {
          setWorkspaces({
            data: [],
            loading: false,
            error: errorText(error, 'Failed to load Kerjan workspaces.')
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [active, connected, listKerjanWorkspaces, refreshNonce, sourceContext])

  const selectedWorkspace = resolveKerjanWorkspaceSelection(
    workspaces.data,
    kerjanSelectedWorkspaceCode
  )
  const workspaceCode = selectedWorkspace?.code ?? null
  useEffect(() => {
    if (workspaceCode && workspaceCode !== kerjanSelectedWorkspaceCode) {
      setKerjanSelectedWorkspaceCode(workspaceCode)
    }
  }, [kerjanSelectedWorkspaceCode, setKerjanSelectedWorkspaceCode, workspaceCode])

  useEffect(() => {
    if (!active || !connected || !workspaceCode) {
      return
    }
    let cancelled = false
    // Why: lookups only label rows and fill pickers, so a failure degrades to raw ids.
    void listKerjanSprints(workspaceCode, { sourceContext })
      .then((data) => !cancelled && setSprints(data))
      .catch(() => !cancelled && setSprints([]))
    void listKerjanMembers(workspaceCode, { sourceContext })
      .then((data) => !cancelled && setMembers(data))
      .catch(() => !cancelled && setMembers([]))
    return () => {
      cancelled = true
    }
  }, [active, connected, listKerjanMembers, listKerjanSprints, sourceContext, workspaceCode])

  const { kind, status, taskType, sprintId, assignee } = filters
  // Why: text search is client-side, so typing must not rebuild these and refetch.
  const serverFilters = useMemo(
    () =>
      buildKerjanIssueListFilters(
        { kind, status, taskType, sprintId, assignee, query: '' },
        viewerId
      ),
    [assignee, kind, sprintId, status, taskType, viewerId]
  )
  useEffect(() => {
    if (!active || !connected || !workspaceCode || !serverFilters) {
      return
    }
    let cancelled = false
    const force = issueRefreshRef.current !== refreshNonce
    issueRefreshRef.current = refreshNonce
    setIssues((current) => ({ ...current, loading: true, error: null }))
    listKerjanIssues(workspaceCode, serverFilters, { sourceContext, force })
      .then((data) => !cancelled && setIssues({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (!cancelled) {
          setIssues({
            data: [],
            loading: false,
            error: errorText(error, 'Failed to load Kerjan tickets.')
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    active,
    connected,
    listKerjanIssues,
    refreshNonce,
    serverFilters,
    sourceContext,
    workspaceCode
  ])

  const displayedIssues = useMemo(
    () => applyKerjanClientFilters(issues.data, { query: filters.query }),
    [filters.query, issues.data]
  )
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  )

  return {
    kerjanStatus,
    kerjanStatusChecked,
    connected,
    viewerId,
    workspaces: workspaces.data,
    workspacesLoading: workspaces.loading,
    workspacesError: workspaces.error,
    selectedWorkspace,
    selectWorkspace: setKerjanSelectedWorkspaceCode,
    sprints,
    members,
    memberNames,
    filters,
    setFilters,
    issues: issues.data,
    displayedIssues,
    issuesLoading: issues.loading,
    issuesError: issues.error,
    refresh: () => setRefreshNonce((value) => value + 1)
  }
}

export type TaskPageKerjanListModel = ReturnType<typeof useTaskPageKerjanList>
