import { useCallback, useMemo } from 'react'
import type { KerjanIssue } from '../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import type { TaskPageData } from '@/store/slices/ui/ui-slice-contract-core'
import type { AppState } from '@/store/types'

type KerjanDetailRoutingInput = {
  pageData: TaskPageData
  openTaskPage: AppState['openTaskPage']
  kerjanTaskSourceContext: TaskSourceContext | null
}

/** The open Kerjan ticket lives in taskPageData so Cmd-J and back/forward can address it. */
export function resolveKerjanDetailSourceContext(
  pageData: Pick<TaskPageData, 'openKerjanIssue' | 'openKerjanSourceContext'>,
  fallback: TaskSourceContext | null
): TaskSourceContext | null {
  return pageData.openKerjanIssue && pageData.openKerjanSourceContext?.provider === 'kerjan'
    ? pageData.openKerjanSourceContext
    : fallback
}

export function useTaskPageKerjanDetailRouting<T extends KerjanDetailRoutingInput>(model: T) {
  const { pageData, openTaskPage, kerjanTaskSourceContext } = model
  const selectedKerjanIssue = pageData.openKerjanIssue ?? null
  const kerjanDetailSourceContext = useMemo(
    () => resolveKerjanDetailSourceContext(pageData, kerjanTaskSourceContext),
    [kerjanTaskSourceContext, pageData]
  )
  const openKerjanDetailPage = useCallback(
    (issue: KerjanIssue) => {
      openTaskPage(
        {
          taskSource: 'kerjan',
          openKerjanIssue: issue,
          openKerjanSourceContext: kerjanTaskSourceContext
        },
        { recordTasksInteraction: false }
      )
    },
    [kerjanTaskSourceContext, openTaskPage]
  )
  return Object.assign(model, {
    selectedKerjanIssue,
    kerjanDetailSourceContext,
    openKerjanDetailPage
  })
}
