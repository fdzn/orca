import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { assertRuntimeEnvironmentCapability } from '@/runtime/runtime-rpc-client'
import { buildKerjanTaskSourceContext } from '@/lib/kerjan-ticket-workspace-source'
import {
  getKerjanWorkspaceCodeFromTicketKey,
  parseKerjanTicketUrl,
  type ParsedKerjanTicketUrl
} from '../../../../shared/kerjan-ticket-url'
import type { KerjanIssue } from '../../../../shared/kerjan-types'
import { KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY } from '../../../../shared/runtime-capability-constants'
import {
  getTaskSourceCacheScope,
  type TaskSourceContext
} from '../../../../shared/task-source-context'
import { parseExecutionHostId } from '../../../../shared/execution-host'

const LOOKUP_DEBOUNCE_MS = 200
const UPDATE_RUNTIME_ERROR = 'update-runtime'

export type KerjanUrlSourceError =
  | 'disconnected'
  | 'site-not-connected'
  | 'read-failed'
  | typeof UPDATE_RUNTIME_ERROR

export type KerjanUrlSourceState = {
  intent: boolean
  loading: boolean
  issue: KerjanIssue | null
  boundSourceContext: TaskSourceContext | null
  errorKind: KerjanUrlSourceError | null
  retry: () => void
}

type KerjanUrlLookupState = Pick<
  KerjanUrlSourceState,
  'loading' | 'issue' | 'boundSourceContext' | 'errorKind'
> & { attemptKey: string | null }

function siteOf(parsed: Pick<ParsedKerjanTicketUrl, 'origin' | 'basePath'>): string {
  return `${parsed.origin}${parsed.basePath}`
}

/** True when the ticket Kerjan returned lives on the site the pasted URL names. */
export function isResolvedKerjanTicketMatch(
  parsed: ParsedKerjanTicketUrl,
  issue: Pick<KerjanIssue, 'key' | 'url'>
): boolean {
  const resolved = parseKerjanTicketUrl(issue.url)
  return Boolean(
    resolved && resolved.ticketKey === parsed.ticketKey && siteOf(resolved) === siteOf(parsed)
  )
}

/** Kerjan's account lives on the same host as the composer's Jira source (the workspace host). */
export function deriveKerjanUrlSourceContext(
  hostSource: TaskSourceContext | null,
  parsed: ParsedKerjanTicketUrl
): TaskSourceContext | null {
  return hostSource
    ? buildKerjanTaskSourceContext({
        projectId: hostSource.projectId,
        hostId: hostSource.hostId,
        projectHostSetupId: hostSource.projectHostSetupId,
        repoId: hostSource.repoId,
        siteUrl: siteOf(parsed),
        workspaceCode: getKerjanWorkspaceCodeFromTicketKey(parsed.ticketKey)
      })
    : null
}

/** Resolves a pasted `/ticket/KEY` URL to one Kerjan ticket on the composer's host. */
export function useKerjanUrlSource(args: {
  value: string
  enabled: boolean
  hostSourceContext: TaskSourceContext | null
}): KerjanUrlSourceState {
  const fetchKerjanIssue = useAppStore((state) => state.fetchKerjanIssue)
  const parsed = useMemo(
    () => (args.enabled ? parseKerjanTicketUrl(args.value) : null),
    [args.enabled, args.value]
  )
  const sourceContext = useMemo(
    () => (parsed ? deriveKerjanUrlSourceContext(args.hostSourceContext, parsed) : null),
    [args.hostSourceContext, parsed]
  )
  const [retryGeneration, setRetryGeneration] = useState(0)
  const requestKey =
    parsed && sourceContext
      ? `${siteOf(parsed)}/ticket/${parsed.ticketKey}::${getTaskSourceCacheScope(sourceContext)}`
      : null
  const attemptKey = requestKey ? `${requestKey}::${retryGeneration}` : null
  const generationRef = useRef(0)
  const [state, setState] = useState<KerjanUrlLookupState>({
    attemptKey: null,
    loading: false,
    issue: null,
    boundSourceContext: null,
    errorKind: null
  })

  useEffect(() => {
    const generation = (generationRef.current += 1)
    if (!parsed || !sourceContext || !attemptKey) {
      return
    }
    const settle = (result: Omit<KerjanUrlLookupState, 'attemptKey' | 'loading'>): void => {
      if (generationRef.current === generation) {
        setState({ ...result, attemptKey, loading: false })
      }
    }
    const fail = (errorKind: KerjanUrlSourceError): void =>
      settle({ issue: null, boundSourceContext: null, errorKind })
    const timer = setTimeout(() => {
      const run = async (): Promise<void> => {
        try {
          const host = parseExecutionHostId(sourceContext.hostId)
          if (host?.kind === 'runtime') {
            await assertRuntimeEnvironmentCapability(
              host.environmentId,
              KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY,
              UPDATE_RUNTIME_ERROR
            )
          }
          const issue = await fetchKerjanIssue(parsed.ticketKey, {
            sourceContext,
            force: retryGeneration > 0
          })
          if (!issue) {
            fail('read-failed')
            return
          }
          if (!isResolvedKerjanTicketMatch(parsed, issue)) {
            fail('site-not-connected')
            return
          }
          settle({ issue, boundSourceContext: sourceContext, errorKind: null })
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          fail(
            message.includes(UPDATE_RUNTIME_ERROR)
              ? UPDATE_RUNTIME_ERROR
              : /not connected/i.test(message)
                ? 'disconnected'
                : 'read-failed'
          )
        }
      }
      void run()
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      generationRef.current += 1
      clearTimeout(timer)
    }
  }, [attemptKey, fetchKerjanIssue, parsed, retryGeneration, sourceContext])

  const retry = useCallback((): void => setRetryGeneration((current) => current + 1), [])
  const visible =
    state.attemptKey === attemptKey
      ? state
      : {
          loading: attemptKey !== null,
          issue: null,
          boundSourceContext: null,
          errorKind: parsed && !sourceContext ? ('disconnected' as const) : null
        }
  return {
    intent: parsed !== null,
    loading: visible.loading,
    issue: visible.issue,
    boundSourceContext: visible.boundSourceContext,
    errorKind: visible.errorKind,
    retry
  }
}
