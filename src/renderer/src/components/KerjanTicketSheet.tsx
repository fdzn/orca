import { useState } from 'react'
import { toast } from 'sonner'
import * as VisuallyHidden from 'radix-ui/visually-hidden'
import { ArrowRight, ExternalLink, LoaderCircle, RefreshCw, Send, X } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { hasBoundedCommentBodyText } from '@/lib/comment-body-submit-state'
import type { KerjanIssue } from '../../../shared/kerjan-types'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { useKerjanTicketDetail } from './use-kerjan-ticket-detail'
import {
  KerjanTicketAssigneeControl,
  KerjanTicketStatusControl
} from './kerjan-ticket-sheet-controls'
import { KerjanTicketSheetBody } from './kerjan-ticket-sheet-body'

function KerjanCommentComposer({
  disabled,
  submitting,
  onSubmit
}: {
  disabled: boolean
  submitting: boolean
  onSubmit: (body: string) => Promise<boolean>
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const canSubmit = hasBoundedCommentBodyText(draft) && !disabled && !submitting
  const submit = async (): Promise<void> => {
    if (canSubmit && (await onSubmit(draft.trim()))) {
      setDraft('')
    }
  }
  return (
    <div className="flex flex-none gap-2 border-t border-border/50 bg-background px-3 py-3">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          const mod = navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey
          if (event.key === 'Enter' && mod && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void submit()
          }
        }}
        placeholder={translate(
          'auto.components.KerjanTicketSheet.commentPlaceholder',
          'Add a Kerjan comment…'
        )}
        aria-label={translate('auto.components.KerjanTicketSheet.commentLabel', 'Comment')}
        maxLength={10000}
        rows={2}
        disabled={disabled || submitting}
      />
      <Button onClick={() => void submit()} disabled={!canSubmit} className="self-end">
        {submitting ? <LoaderCircle className="animate-spin" /> : <Send />}
        {translate('auto.components.KerjanTicketSheet.comment', 'Comment')}
      </Button>
    </div>
  )
}

export default function KerjanTicketSheet({
  issue,
  sourceContext,
  onUse,
  onClose
}: {
  issue: KerjanIssue | null
  sourceContext: TaskSourceContext | null
  onUse: (issue: KerjanIssue) => void
  onClose: () => void
}): React.JSX.Element {
  // Why: Epic/Story/Task links open in this same sheet; a new route issue drops the jump.
  const [jump, setJump] = useState<{ from: string; issue: KerjanIssue } | null>(null)
  const current = jump && jump.from === issue?.key ? jump.issue : issue
  const fetchKerjanIssue = useAppStore((s) => s.fetchKerjanIssue)
  const openTicket = (key: string): void => {
    const from = issue?.key
    if (!from) {
      return
    }
    void fetchKerjanIssue(key, { sourceContext })
      .then((next) => {
        if (!next) {
          throw new Error(
            translate(
              'auto.components.KerjanTicketSheet.notFound',
              'Kerjan ticket {{value0}} was not found.',
              {
                value0: key
              }
            )
          )
        }
        setJump({ from, issue: next })
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error
            ? error.message
            : translate(
                'auto.components.KerjanTicketSheet.loadFailed',
                'Failed to load the Kerjan ticket.'
              )
        )
      )
  }
  const detail = useKerjanTicketDetail(current, sourceContext)
  const viewerId = useAppStore((s) => s.kerjanStatus.viewer?.id ?? null)
  const displayed = detail.displayed
  const canWrite = !detail.readOnly && detail.pendingField === null
  return (
    <Sheet open={issue !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(92vw,780px)] sm:max-w-[780px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden.Root asChild>
          <SheetTitle>
            {displayed?.title ??
              translate('auto.components.KerjanTicketSheet.sheetTitle', 'Kerjan ticket')}
          </SheetTitle>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <SheetDescription>
            {translate(
              'auto.components.KerjanTicketSheet.sheetDescription',
              'Preview, update, and start work from the selected Kerjan ticket.'
            )}
          </SheetDescription>
        </VisuallyHidden.Root>
        {displayed ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex flex-none items-start gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                  <span className="font-mono">{displayed.key}</span>
                  <span>{displayed.project.name}</span>
                  {detail.loading ? <LoaderCircle className="size-3 animate-spin" /> : null}
                </div>
                <h2 className="mt-1 text-xl leading-tight font-semibold text-foreground">
                  {displayed.title}
                </h2>
              </div>
              <Button size="sm" onClick={() => onUse(displayed)}>
                {translate('auto.components.KerjanTicketSheet.startWorkspace', 'Start workspace')}
                <ArrowRight />
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void window.api.shell.openUrl(displayed.url)}
                    aria-label={translate(
                      'auto.components.KerjanTicketSheet.openInKerjan',
                      'Open in Kerjan'
                    )}
                  >
                    <ExternalLink />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {translate('auto.components.KerjanTicketSheet.openInKerjan', 'Open in Kerjan')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    aria-label={translate(
                      'auto.components.KerjanTicketSheet.close',
                      'Close Kerjan ticket preview'
                    )}
                  >
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {translate('auto.components.KerjanTicketSheet.closeShort', 'Close')}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-none flex-wrap items-center gap-3 border-b border-border/60 px-4 py-2">
              <KerjanTicketStatusControl
                issue={displayed}
                disabled={!canWrite || !detail.detail}
                pending={detail.pendingField === 'status'}
                onChange={(status) => void detail.setStatus(status)}
              />
              <KerjanTicketAssigneeControl
                issue={displayed}
                members={detail.members}
                viewerId={viewerId}
                disabled={!canWrite || !detail.detail}
                pending={detail.pendingField === 'assignee'}
                onChange={(assigneeId) => void detail.setAssignee(assigneeId)}
              />
            </div>

            {detail.readOnly ? (
              <div
                role="status"
                className="border-b border-border/50 bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
              >
                {translate(
                  'auto.components.KerjanTicketSheet.readOnly',
                  'This workspace is synced from Jira project {{value0}} and is read-only until cutover.',
                  { value0: detail.jiraProject ?? '' }
                )}
              </div>
            ) : null}
            {detail.loadError ? (
              <div
                role="alert"
                className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              >
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{detail.loadError}</span>
                <Button variant="outline" size="xs" onClick={detail.reload}>
                  <RefreshCw />
                  {translate('auto.components.KerjanTicketSheet.retry', 'Retry')}
                </Button>
              </div>
            ) : null}
            {detail.mutationError ? (
              <div
                role="alert"
                className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              >
                <span className="min-w-0 flex-1 whitespace-pre-wrap select-text">
                  {detail.mutationError}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={detail.clearMutationError}
                  aria-label={translate('auto.components.KerjanTicketSheet.dismiss', 'Dismiss')}
                >
                  <X />
                </Button>
              </div>
            ) : null}

            <KerjanTicketSheetBody
              key={`body:${displayed.key}`}
              detail={detail}
              canWrite={canWrite}
              onOpenTicket={openTicket}
            />

            <KerjanCommentComposer
              key={`composer:${displayed.key}`}
              disabled={detail.readOnly || !detail.detail}
              submitting={detail.pendingField === 'comment'}
              onSubmit={detail.addComment}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
