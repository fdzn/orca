import { useMemo } from 'react'
import { ArrowRight, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { getJiraStatusTone } from '@/components/task-page-jira-status-tone'
import {
  buildKerjanTicketWorkspaceAttachmentIndex,
  findKerjanTicketWorkspaceAttachmentsInIndex
} from '@/lib/kerjan-ticket-workspace-attachment'
import { openKerjanTicketWorkspaceOrStart } from '@/lib/kerjan-ticket-workspace-open'
import { folderWorkspaceToWorktree } from '../../../../../shared/folder-workspace-worktree'
import type { KerjanIssue } from '../../../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../../../shared/task-source-context'
import { getKerjanTicketTypeLabel } from '../../kerjan-ticket-labels'

const GRID = 'grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem_7rem_9rem_8rem_auto] items-center gap-3'

function KerjanIssueRow({
  issue,
  selected,
  hasWorkspace,
  sourceContext,
  onOpenIssue,
  onStartWorkspace
}: {
  issue: KerjanIssue
  selected: boolean
  hasWorkspace: boolean
  sourceContext: TaskSourceContext | null
  onOpenIssue: (issue: KerjanIssue) => void
  onStartWorkspace: (issue: KerjanIssue) => void
}): React.JSX.Element {
  const actionLabel = hasWorkspace
    ? translate('auto.components.TaskPageKerjan.openWorkspace', 'Open workspace')
    : translate('auto.components.TaskPageKerjan.startWorkspace', 'Start workspace')
  return (
    <div
      role="row"
      data-current={selected ? 'true' : undefined}
      className={cn(
        GRID,
        'group cursor-pointer px-3 py-2 text-left transition hover:bg-accent',
        selected && 'bg-accent'
      )}
      tabIndex={0}
      onClick={() => onOpenIssue(issue)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) {
          event.preventDefault()
          onOpenIssue(issue)
        }
      }}
    >
      <span className="truncate font-mono text-xs text-muted-foreground">{issue.key}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">{issue.title}</span>
        {issue.parent ? (
          <span className="block truncate text-2xs text-muted-foreground">
            {issue.parent.key} · {issue.parent.title}
          </span>
        ) : null}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {getKerjanTicketTypeLabel(issue)}
      </span>
      <span className="flex min-w-0">
        <span
          className={cn(
            'inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-2xs font-medium',
            getJiraStatusTone(issue.status.categoryKey)
          )}
        >
          {issue.status.name}
        </span>
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {issue.assignee?.displayName ??
          translate('auto.components.TaskPageKerjan.unassigned', 'Unassigned')}
      </span>
      <span className="truncate text-xs text-muted-foreground">{issue.sprint ?? '–'}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={actionLabel}
            onClick={(event) => {
              event.stopPropagation()
              openKerjanTicketWorkspaceOrStart(issue, sourceContext, () => onStartWorkspace(issue))
            }}
          >
            {hasWorkspace ? <FolderOpen /> : <ArrowRight />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6}>
          {actionLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function TaskPageKerjanIssueList({
  issues,
  selectedKey,
  sourceContext,
  onOpenIssue,
  onStartWorkspace
}: {
  issues: readonly KerjanIssue[]
  selectedKey: string | null
  sourceContext: TaskSourceContext | null
  onOpenIssue: (issue: KerjanIssue) => void
  onStartWorkspace: (issue: KerjanIssue) => void
}): React.JSX.Element {
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const attachmentIndex = useMemo(
    () =>
      buildKerjanTicketWorkspaceAttachmentIndex([
        ...Object.values(worktreesByRepo).flat(),
        ...folderWorkspaces.map(folderWorkspaceToWorktree)
      ]),
    [folderWorkspaces, worktreesByRepo]
  )
  return (
    <div role="table" className="min-w-[52rem]">
      <div
        role="row"
        className={cn(
          GRID,
          'sticky top-0 z-10 border-b border-border/50 bg-background px-3 py-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground'
        )}
      >
        <span>{translate('auto.components.TaskPageKerjan.columnKey', 'Key')}</span>
        <span>{translate('auto.components.TaskPageKerjan.columnTitle', 'Title')}</span>
        <span>{translate('auto.components.TaskPageKerjan.columnType', 'Type')}</span>
        <span>{translate('auto.components.TaskPageKerjan.status', 'Status')}</span>
        <span>{translate('auto.components.TaskPageKerjan.assignee', 'Assignee')}</span>
        <span>{translate('auto.components.TaskPageKerjan.sprint', 'Sprint')}</span>
        <span className="size-6" aria-hidden />
      </div>
      <div className="divide-y divide-border/50">
        {issues.map((issue) => (
          <KerjanIssueRow
            key={issue.key}
            issue={issue}
            selected={issue.key === selectedKey}
            hasWorkspace={
              findKerjanTicketWorkspaceAttachmentsInIndex(attachmentIndex, issue, sourceContext)
                .length > 0
            }
            sourceContext={sourceContext}
            onOpenIssue={onOpenIssue}
            onStartWorkspace={onStartWorkspace}
          />
        ))}
      </div>
    </div>
  )
}
