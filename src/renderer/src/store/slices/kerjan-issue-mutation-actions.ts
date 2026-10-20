import type { KerjanMutationResult } from '../../../../shared/kerjan-types'
import {
  kerjanAddComment,
  kerjanSetAssignee,
  kerjanSetStatus,
  kerjanUpdateIssue
} from '@/runtime/runtime-kerjan-client'
import type {
  KerjanMutationOptions,
  KerjanSlice,
  KerjanSliceGet,
  KerjanSliceSet
} from './kerjan-slice-contract'
import {
  applyKerjanIssueDetail,
  canWriteKerjanResult,
  currentKerjanConnectionGeneration,
  getKerjanReadScope,
  type KerjanReadScope
} from './kerjan-read-coordination'

type KerjanIssueMutationActions = Pick<
  KerjanSlice,
  'setKerjanIssueStatus' | 'addKerjanIssueComment' | 'setKerjanIssueAssignee' | 'updateKerjanIssue'
>

export function createKerjanIssueMutationActions(
  set: KerjanSliceSet,
  get: KerjanSliceGet
): KerjanIssueMutationActions {
  // Every Kerjan mutation answers with the full detail, so caches refresh without a re-read.
  const mutate = async (
    options: KerjanMutationOptions | undefined,
    run: (scope: KerjanReadScope) => Promise<KerjanMutationResult>
  ): Promise<KerjanMutationResult> => {
    const scope = getKerjanReadScope(get().settings, options?.sourceContext)
    const generation = currentKerjanConnectionGeneration()
    let result: KerjanMutationResult
    try {
      result = await run(scope)
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error && error.message ? error.message : 'Kerjan update failed.'
      }
    }
    if (result.ok && canWriteKerjanResult(scope, generation, get().settings)) {
      const issue = result.issue
      set((state) => applyKerjanIssueDetail(state, scope, issue))
    }
    return result
  }

  return {
    setKerjanIssueStatus: (key, status, comment, options) =>
      mutate(options, (scope) => kerjanSetStatus(scope.settings, key, status, comment)),
    addKerjanIssueComment: (key, body, options) =>
      mutate(options, (scope) => kerjanAddComment(scope.settings, key, body)),
    setKerjanIssueAssignee: (key, assigneeId, options) =>
      mutate(options, (scope) => kerjanSetAssignee(scope.settings, key, assigneeId)),
    updateKerjanIssue: (key, updates, options) =>
      mutate(options, (scope) => kerjanUpdateIssue(scope.settings, key, updates))
  }
}
