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
} from '../../../shared/kerjan-types'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import { KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY } from '../../../shared/runtime-capability-constants'
import { rowLessSourceTarget, type RowLessSource } from '@/lib/default-creation-host'
import {
  assertRuntimeEnvironmentCapability,
  callRuntimeRpc,
  runtimeEnvironmentSupportsCapability
} from './runtime-rpc-client'
import {
  DISCONNECTED_KERJAN_STATUS,
  parseKerjanConnectionStatus
} from './runtime-kerjan-connection-status'

export type RuntimeKerjanSettings = RowLessSource

export const KERJAN_RUNTIME_UPDATE_REQUIRED_MESSAGE = 'Update the remote Orca server to use Kerjan.'

export function getKerjanRuntimeTarget(source: RuntimeKerjanSettings): RuntimeClientTarget {
  return rowLessSourceTarget(source)
}

// Why the capability gate: an older remote has no `kerjan.*` methods and would fail opaquely.
async function callKerjan<T>(
  settings: RuntimeKerjanSettings,
  method: string,
  args: unknown,
  local: () => Promise<T>,
  timeoutMs = 30_000
): Promise<T> {
  const target = getKerjanRuntimeTarget(settings)
  if (target.kind !== 'environment') {
    return local()
  }
  await assertRuntimeEnvironmentCapability(
    target.environmentId,
    KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY,
    KERJAN_RUNTIME_UPDATE_REQUIRED_MESSAGE
  )
  return callRuntimeRpc<T>(target, `kerjan.${method}`, args, { timeoutMs })
}

/** An older remote without Kerjan reads as disconnected rather than failing the status check. */
export async function kerjanStatus(
  settings: RuntimeKerjanSettings
): Promise<KerjanConnectionStatus> {
  const target = getKerjanRuntimeTarget(settings)
  if (target.kind !== 'environment') {
    return parseKerjanConnectionStatus(await window.api.kerjan.status())
  }
  if (
    !(await runtimeEnvironmentSupportsCapability(
      target.environmentId,
      KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY,
      15_000
    ))
  ) {
    return DISCONNECTED_KERJAN_STATUS
  }
  return parseKerjanConnectionStatus(
    await callRuntimeRpc<unknown>(target, 'kerjan.status', undefined, { timeoutMs: 15_000 })
  )
}

export function kerjanConnect(
  settings: RuntimeKerjanSettings,
  args: KerjanConnectArgs
): Promise<KerjanConnectResult> {
  return callKerjan(settings, 'connect', args, () => window.api.kerjan.connect(args))
}

export async function kerjanDisconnect(settings: RuntimeKerjanSettings): Promise<void> {
  await callKerjan<unknown>(
    settings,
    'disconnect',
    undefined,
    () => window.api.kerjan.disconnect(),
    15_000
  )
}

export function kerjanTestConnection(
  settings: RuntimeKerjanSettings
): Promise<KerjanConnectResult> {
  return callKerjan(settings, 'testConnection', undefined, () => window.api.kerjan.testConnection())
}

export function kerjanListWorkspaces(settings: RuntimeKerjanSettings): Promise<KerjanWorkspace[]> {
  return callKerjan(settings, 'listWorkspaces', undefined, () => window.api.kerjan.listWorkspaces())
}

export function kerjanListSprints(
  settings: RuntimeKerjanSettings,
  workspaceCode: string
): Promise<KerjanSprint[]> {
  const args = { workspaceCode }
  return callKerjan(settings, 'listSprints', args, () => window.api.kerjan.listSprints(args))
}

export function kerjanListMembers(
  settings: RuntimeKerjanSettings,
  workspaceCode?: string | null
): Promise<KerjanMember[]> {
  const args = workspaceCode ? { workspaceCode } : undefined
  return callKerjan(settings, 'listMembers', args, () => window.api.kerjan.listMembers(args))
}

export function kerjanListIssues(
  settings: RuntimeKerjanSettings,
  workspaceCode: string,
  filters?: KerjanIssueListFilters
): Promise<KerjanIssue[]> {
  const args = { workspaceCode, ...(filters ? { filters } : {}) }
  return callKerjan(settings, 'listIssues', args, () => window.api.kerjan.listIssues(args))
}

export function kerjanGetIssue(
  settings: RuntimeKerjanSettings,
  key: string
): Promise<KerjanIssueDetail | null> {
  const args = { key }
  return callKerjan(settings, 'getIssue', args, () => window.api.kerjan.getIssue(args))
}

export function kerjanSetStatus(
  settings: RuntimeKerjanSettings,
  key: string,
  status: KerjanTaskStatus,
  comment?: string
): Promise<KerjanMutationResult> {
  const args = { key, status, ...(comment?.trim() ? { comment } : {}) }
  return callKerjan(settings, 'setStatus', args, () => window.api.kerjan.setStatus(args))
}

export function kerjanAddComment(
  settings: RuntimeKerjanSettings,
  key: string,
  body: string
): Promise<KerjanMutationResult> {
  const args = { key, body }
  return callKerjan(settings, 'addComment', args, () => window.api.kerjan.addComment(args))
}

export function kerjanSetAssignee(
  settings: RuntimeKerjanSettings,
  key: string,
  assigneeId: string | null
): Promise<KerjanMutationResult> {
  const args = { key, assigneeId }
  return callKerjan(settings, 'setAssignee', args, () => window.api.kerjan.setAssignee(args))
}

export function kerjanUpdateIssue(
  settings: RuntimeKerjanSettings,
  key: string,
  updates: KerjanIssueUpdate
): Promise<KerjanMutationResult> {
  const args = { key, updates }
  return callKerjan(settings, 'updateIssue', args, () => window.api.kerjan.updateIssue(args))
}
