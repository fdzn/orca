import { useState } from 'react'
import { LoaderCircle, Pencil } from 'lucide-react'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import type { KerjanIssueDetail, KerjanTicketRef } from '../../../shared/kerjan-types'
import type { KerjanTicketDetailModel } from './use-kerjan-ticket-detail'
import { summarizeKerjanHistoryEntry } from './kerjan-task-list-filters'
import { getKerjanStatusLabels, getKerjanTicketTypeLabel } from './kerjan-ticket-labels'

const SECTION_LABEL = 'text-2xs font-semibold uppercase tracking-wider text-muted-foreground'

const TICKET_LINK = 'flex min-w-0 items-center gap-2 rounded-sm text-left text-xs hover:bg-muted/60'

function TicketRefLine({
  label,
  ticket,
  onOpen
}: {
  label: string
  ticket: KerjanTicketRef
  onOpen: (key: string) => void
}) {
  return (
    <button type="button" className={TICKET_LINK} onClick={() => onOpen(ticket.key)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 font-mono text-muted-foreground">{ticket.key}</span>
      <span className="truncate text-foreground">{ticket.title}</span>
    </button>
  )
}

function TicketEditor({
  displayed,
  detail,
  onDone
}: {
  displayed: KerjanIssueDetail | null
  detail: KerjanTicketDetailModel
  onDone: () => void
}): React.JSX.Element {
  const [title, setTitle] = useState(displayed?.title ?? '')
  const [description, setDescription] = useState(displayed?.description ?? '')
  const saving = detail.pendingField === 'title'
  const save = async (): Promise<void> => {
    const trimmedTitle = title.trim()
    const updates = {
      ...(trimmedTitle && trimmedTitle !== displayed?.title ? { title: trimmedTitle } : {}),
      ...(description !== (displayed?.description ?? '') ? { description } : {})
    }
    if (Object.keys(updates).length === 0 || (await detail.update('title', updates))) {
      onDone()
    }
  }
  return (
    <div className="grid gap-2">
      <label className={SECTION_LABEL} htmlFor="kerjan-ticket-title">
        {translate('auto.components.KerjanTicketSheet.title', 'Title')}
      </label>
      <Input
        id="kerjan-ticket-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={saving}
      />
      <label className={SECTION_LABEL} htmlFor="kerjan-ticket-description">
        {translate('auto.components.KerjanTicketSheet.description', 'Description')}
      </label>
      <Textarea
        id="kerjan-ticket-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={12}
        disabled={saving}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={saving}>
          {translate('auto.components.KerjanTicketSheet.cancel', 'Cancel')}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || !title.trim()}>
          {saving ? <LoaderCircle className="animate-spin" /> : null}
          {translate('auto.components.KerjanTicketSheet.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}

export function KerjanTicketSheetBody({
  detail,
  canWrite,
  onOpenTicket
}: {
  detail: KerjanTicketDetailModel
  canWrite: boolean
  onOpenTicket: (key: string) => void
}): React.JSX.Element | null {
  const [editing, setEditing] = useState(false)
  const displayed = detail.displayed
  if (!displayed) {
    return null
  }
  const full = detail.detail
  const statusLabels = getKerjanStatusLabels()
  const children = full?.stories.length
    ? full.stories.map((story) => ({ key: story.key, title: story.title, status: story.statusKey }))
    : displayed.tasks.map((task) => ({ key: task.key, title: task.title, status: task.statusKey }))
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
      <section className="grid gap-1.5 border-b border-border/40 px-4 py-3">
        <div className="text-xs text-muted-foreground">
          {getKerjanTicketTypeLabel(displayed)}
          {displayed.product ? ` · ${displayed.product.name}` : ''}
          {displayed.sprint ? ` · ${displayed.sprint}` : ''}
        </div>
        {displayed.epic ? (
          <TicketRefLine
            label={translate('auto.components.KerjanTicketSheet.epic', 'Epic')}
            ticket={displayed.epic}
            onOpen={onOpenTicket}
          />
        ) : null}
        {displayed.story ? (
          <TicketRefLine
            label={translate('auto.components.KerjanTicketSheet.story', 'Story')}
            ticket={displayed.story}
            onOpen={onOpenTicket}
          />
        ) : null}
      </section>

      <section className="border-b border-border/40 px-4 py-4">
        {editing ? (
          <TicketEditor displayed={full} detail={detail} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className={SECTION_LABEL}>
                {translate('auto.components.KerjanTicketSheet.description', 'Description')}
              </span>
              <Button
                variant="ghost"
                size="xs"
                disabled={!canWrite || !full}
                onClick={() => setEditing(true)}
              >
                <Pencil />
                {translate('auto.components.KerjanTicketSheet.edit', 'Edit')}
              </Button>
            </div>
            {displayed.description?.trim() ? (
              <CommentMarkdown
                content={displayed.description}
                variant="document"
                className="text-sm leading-relaxed"
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {translate(
                  'auto.components.KerjanTicketSheet.noDescription',
                  'No description provided.'
                )}
              </p>
            )}
          </>
        )}
      </section>

      {children.length > 0 ? (
        <section className="border-b border-border/40 px-4 py-4">
          <div className={SECTION_LABEL}>
            {full?.stories.length
              ? translate('auto.components.KerjanTicketSheet.stories', 'Stories')
              : translate('auto.components.KerjanTicketSheet.tasks', 'Tasks')}
          </div>
          <ul className="mt-2 grid gap-1">
            {children.map((child) => (
              <li key={child.key}>
                <button
                  type="button"
                  className={`${TICKET_LINK} w-full`}
                  onClick={() => onOpenTicket(child.key)}
                >
                  <span className="shrink-0 font-mono text-muted-foreground">{child.key}</span>
                  <span className="truncate text-foreground">{child.title}</span>
                  {child.status ? (
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {statusLabels[child.status]}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-b border-border/40 px-4 py-4">
        <div className={SECTION_LABEL}>
          {translate('auto.components.KerjanTicketSheet.comments', 'Comments')}
          {full ? ` · ${full.comments.length}` : ''}
        </div>
        {detail.loading && !full ? (
          <div className="flex justify-center py-6">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : full && full.comments.length > 0 ? (
          <div className="mt-2 flex flex-col gap-3">
            {full.comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-border/50 bg-muted/20">
                <div className="flex min-w-0 items-center gap-2 border-b border-border/40 px-3 py-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {comment.user?.displayName ??
                      translate('auto.components.KerjanTicketSheet.unknown', 'Unknown')}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatUiRelativeTimeFromDate(comment.createdAt)}
                  </span>
                </div>
                <CommentMarkdown
                  content={comment.body}
                  variant="compact"
                  className="px-3 py-2 text-sm leading-relaxed"
                />
              </div>
            ))}
          </div>
        ) : full ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {translate('auto.components.KerjanTicketSheet.noComments', 'No comments yet.')}
          </p>
        ) : null}
      </section>

      {full && full.history.length > 0 ? (
        <section className="px-4 py-4">
          <div className={SECTION_LABEL}>
            {translate('auto.components.KerjanTicketSheet.history', 'History')}
          </div>
          <ul className="mt-2 grid gap-1.5">
            {full.history.map((entry) => {
              const summary = summarizeKerjanHistoryEntry(entry)
              const change = [summary.from, summary.to].filter(Boolean).join(' → ')
              return (
                <li key={entry.id} className="flex min-w-0 gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0 text-foreground">
                    {entry.user?.displayName ??
                      translate('auto.components.KerjanTicketSheet.unknown', 'Unknown')}
                  </span>
                  <span className="min-w-0 truncate">
                    {[summary.field, change].filter(Boolean).join(': ') ||
                      translate('auto.components.KerjanTicketSheet.changed', 'changed the ticket')}
                  </span>
                  <span className="ml-auto shrink-0">
                    {formatUiRelativeTimeFromDate(entry.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
