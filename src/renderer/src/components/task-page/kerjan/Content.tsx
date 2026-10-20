import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { KerjanIcon } from '@/components/icons/KerjanIcon'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { KerjanConnectDialog } from '@/components/kerjan-connect-dialog'
import KerjanTicketSheet from '@/components/KerjanTicketSheet'
import { useAppStore } from '@/store'
import { openKerjanTicketComposer } from '@/lib/kerjan-ticket-workspace-open'
import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { useTaskPageKerjanList } from '../../use-task-page-kerjan-list'
import { hasActiveKerjanTaskListFilters } from '../../kerjan-task-list-filters'
import { TaskPageKerjanFilters } from './Filters'
import { TaskPageKerjanIssueList } from './IssueList'

function KerjanListMessage({
  title,
  detail,
  tone = 'muted'
}: {
  title: string
  detail?: string | null
  tone?: 'muted' | 'error'
}): React.JSX.Element {
  return (
    <div className="px-4 py-10 text-center" role={tone === 'error' ? 'alert' : undefined}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {detail ? (
        <p
          className={
            tone === 'error'
              ? 'mt-2 text-sm whitespace-pre-wrap text-destructive'
              : 'mt-2 text-sm text-muted-foreground'
          }
        >
          {detail}
        </p>
      ) : null}
    </div>
  )
}

export function TaskPageKerjanContent({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const {
    taskSource,
    hideTaskSource,
    kerjanTaskSourceContext,
    selectedKerjanIssue,
    kerjanDetailSourceContext,
    openKerjanDetailPage,
    closeTaskDetailPage,
    handleUseKerjanItem
  } = model
  const list = useTaskPageKerjanList({
    active: taskSource === 'kerjan',
    sourceContext: kerjanTaskSourceContext
  })
  const [connectOpen, setConnectOpen] = useState(false)
  const { kerjanStatus } = list
  const connectDialog = (
    <KerjanConnectDialog
      open={connectOpen}
      onOpenChange={setConnectOpen}
      initialBaseUrl={kerjanStatus.siteUrl}
      onConnected={list.refresh}
    />
  )

  if (!list.kerjanStatusChecked) {
    return (
      <div className="mt-4 flex items-center justify-center py-14">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!list.connected) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-md border border-border/50 bg-muted/50 px-6 py-14 text-center shadow-sm">
        <KerjanIcon className="mb-4 size-8 text-muted-foreground" />
        <p className="text-base font-medium text-foreground">
          {kerjanStatus.credentialError
            ? translate('auto.components.TaskPageKerjan.reconnectTitle', 'Reconnect Kerjan')
            : translate('auto.components.TaskPageKerjan.connectTitle', 'Connect your Kerjan site')}
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {kerjanStatus.credentialError ??
            translate(
              'auto.components.TaskPageKerjan.connectBody',
              'Browse, update, and start work from Kerjan tickets directly from here.'
            )}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => setConnectOpen(true)}>
            {translate('auto.components.TaskPageKerjan.connect', 'Connect Kerjan')}
          </Button>
          <Button variant="outline" onClick={() => hideTaskSource('kerjan', 'Kerjan')}>
            {translate('auto.components.TaskPageKerjan.hide', 'Hide Kerjan')}
          </Button>
        </div>
        {connectDialog}
      </div>
    )
  }

  const { displayedIssues, issuesLoading, issuesError, workspacesError } = list
  return (
    <div className="flex min-h-0 max-h-full flex-col">
      <TaskPageKerjanFilters list={list} />
      <div className="flex min-h-0 flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-background shadow-sm">
        <div className="flex min-h-10 flex-none items-center justify-between gap-3 border-b border-border/50 bg-muted/35 px-3 py-1">
          <div className="min-w-0 truncate text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            {list.selectedWorkspace
              ? translate('auto.components.TaskPageKerjan.heading', '{{value0}} tickets', {
                  value0: list.selectedWorkspace.name
                })
              : translate('auto.components.TaskPageKerjan.headingNoWorkspace', 'Kerjan tickets')}
          </div>
          <span className="shrink-0 text-2xs text-muted-foreground">
            {translate('auto.components.TaskPageKerjan.shown', '{{value0}} shown', {
              value0: displayedIssues.length
            })}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek">
          {workspacesError ? (
            <KerjanListMessage
              tone="error"
              title={translate(
                'auto.components.TaskPageKerjan.workspacesFailed',
                'Couldn’t load Kerjan workspaces'
              )}
              detail={workspacesError}
            />
          ) : !list.workspacesLoading && list.workspaces.length === 0 ? (
            <KerjanListMessage
              title={translate(
                'auto.components.TaskPageKerjan.noWorkspaces',
                'No Kerjan workspaces'
              )}
              detail={translate(
                'auto.components.TaskPageKerjan.noWorkspacesBody',
                'Ask a Kerjan admin to add you to a workspace, then refresh.'
              )}
            />
          ) : issuesError ? (
            <KerjanListMessage
              tone="error"
              title={translate(
                'auto.components.TaskPageKerjan.ticketsFailed',
                'Couldn’t load Kerjan tickets'
              )}
              detail={issuesError}
            />
          ) : issuesLoading && list.issues.length === 0 ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : displayedIssues.length === 0 ? (
            <KerjanListMessage
              title={translate('auto.components.TaskPageKerjan.empty', 'No Kerjan tickets found')}
              detail={
                hasActiveKerjanTaskListFilters(list.filters)
                  ? translate(
                      'auto.components.TaskPageKerjan.emptyFiltered',
                      'Try different filters or search terms.'
                    )
                  : translate(
                      'auto.components.TaskPageKerjan.emptyWorkspace',
                      'This workspace has no tickets yet.'
                    )
              }
            />
          ) : (
            <TaskPageKerjanIssueList
              issues={displayedIssues}
              selectedKey={selectedKerjanIssue?.key ?? null}
              sourceContext={kerjanTaskSourceContext}
              onOpenIssue={openKerjanDetailPage}
              onStartWorkspace={handleUseKerjanItem}
            />
          )}
        </div>
      </div>
      <KerjanTicketSheet
        issue={selectedKerjanIssue}
        sourceContext={kerjanDetailSourceContext}
        onUse={(issue) => {
          // Why: a deep-linked ticket may come from another host than the list's source.
          useAppStore.getState().recordFeatureInteraction('kerjan-tasks')
          openKerjanTicketComposer(issue, kerjanDetailSourceContext)
        }}
        onClose={closeTaskDetailPage}
      />
      {connectDialog}
    </div>
  )
}
