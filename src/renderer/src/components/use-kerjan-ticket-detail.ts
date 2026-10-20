import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getKerjanWorkspaceCodeFromTicketKey } from '../../../shared/kerjan-ticket-url'
import type {
  KerjanIssue,
  KerjanIssueDetail,
  KerjanIssueUpdate,
  KerjanMember,
  KerjanMutationResult,
  KerjanTaskStatus,
  KerjanWorkspace
} from '../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../shared/task-source-context'

export type KerjanTicketField = 'status' | 'assignee' | 'title' | 'description' | 'comment'

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Full detail, lookups, and writes for the open Kerjan ticket; errors keep Kerjan's own text. */
export function useKerjanTicketDetail(
  issue: KerjanIssue | null,
  sourceContext: TaskSourceContext | null
) {
  const store = useAppStore(
    useShallow((s) => ({
      fetchKerjanIssue: s.fetchKerjanIssue,
      listKerjanMembers: s.listKerjanMembers,
      listKerjanWorkspaces: s.listKerjanWorkspaces,
      setKerjanIssueStatus: s.setKerjanIssueStatus,
      addKerjanIssueComment: s.addKerjanIssueComment,
      setKerjanIssueAssignee: s.setKerjanIssueAssignee,
      updateKerjanIssue: s.updateKerjanIssue
    }))
  )
  const key = issue?.key ?? null
  const workspaceCode = key ? getKerjanWorkspaceCodeFromTicketKey(key) : null
  const [detail, setDetail] = useState<KerjanIssueDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [members, setMembers] = useState<KerjanMember[]>([])
  const [workspace, setWorkspace] = useState<KerjanWorkspace | null>(null)
  const [pendingField, setPendingField] = useState<KerjanTicketField | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    setDetail(null)
    setMutationError(null)
    setPendingField(null)
    if (!key) {
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    store
      .fetchKerjanIssue(key, { sourceContext, force: true })
      .then((next) => {
        if (!cancelled) {
          setDetail(next)
          setLoadError(next ? null : `Kerjan ticket ${key} was not found.`)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(errorText(error, 'Failed to load the Kerjan ticket.'))
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [key, reloadNonce, sourceContext, store])

  useEffect(() => {
    if (!workspaceCode) {
      return
    }
    let cancelled = false
    // Why: lookups only fill the assignee picker and read-only hint; failures degrade quietly.
    store
      .listKerjanMembers(workspaceCode, { sourceContext })
      .then((next) => !cancelled && setMembers(next))
      .catch(() => !cancelled && setMembers([]))
    store
      .listKerjanWorkspaces({ sourceContext })
      .then(
        (next) =>
          !cancelled && setWorkspace(next.find((entry) => entry.code === workspaceCode) ?? null)
      )
      .catch(() => !cancelled && setWorkspace(null))
    return () => {
      cancelled = true
    }
  }, [sourceContext, store, workspaceCode])

  const mutate = useCallback(
    async (
      field: KerjanTicketField,
      run: () => Promise<KerjanMutationResult>
    ): Promise<boolean> => {
      setPendingField(field)
      setMutationError(null)
      const result = await run()
      setPendingField(null)
      if (!result.ok) {
        setMutationError(result.error)
        return false
      }
      setDetail(result.issue)
      return true
    },
    []
  )
  const options = { sourceContext }
  const setStatus = (status: KerjanTaskStatus): Promise<boolean> =>
    key
      ? mutate('status', () => store.setKerjanIssueStatus(key, status, undefined, options))
      : Promise.resolve(false)
  const setAssignee = (assigneeId: string | null): Promise<boolean> =>
    key
      ? mutate('assignee', () => store.setKerjanIssueAssignee(key, assigneeId, options))
      : Promise.resolve(false)
  const addComment = (body: string): Promise<boolean> =>
    key
      ? mutate('comment', () => store.addKerjanIssueComment(key, body, options))
      : Promise.resolve(false)
  const update = (field: 'title' | 'description', updates: KerjanIssueUpdate): Promise<boolean> =>
    key
      ? mutate(field, () => store.updateKerjanIssue(key, updates, options))
      : Promise.resolve(false)

  return {
    displayed: detail ?? issue,
    detail,
    loading,
    loadError,
    members,
    readOnly: workspace?.readOnly === true,
    jiraProject: workspace?.jiraProject ?? null,
    pendingField,
    mutationError,
    clearMutationError: () => setMutationError(null),
    reload: () => setReloadNonce((value) => value + 1),
    setStatus,
    setAssignee,
    addComment,
    update
  }
}

export type KerjanTicketDetailModel = ReturnType<typeof useKerjanTicketDetail>
