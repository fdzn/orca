import { useState } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getJiraStatusTone } from '@/components/task-page-jira-status-tone'
import {
  KERJAN_TASK_STATUSES,
  type KerjanIssue,
  type KerjanMember,
  type KerjanTaskStatus
} from '../../../shared/kerjan-types'
import { canSetKerjanTicketStatus } from './kerjan-task-list-filters'
import { getKerjanStatusLabels, getKerjanTaskStatusOptions } from './kerjan-ticket-labels'

function isTaskStatus(value: string): value is KerjanTaskStatus {
  return KERJAN_TASK_STATUSES.some((status) => status === value)
}

function StatusPill({ issue }: { issue: KerjanIssue }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium',
        getJiraStatusTone(issue.status.categoryKey)
      )}
    >
      {getKerjanStatusLabels()[issue.statusKey]}
    </span>
  )
}

/** Tasks take a status write; Story/Epic show their derived status read-only. */
export function KerjanTicketStatusControl({
  issue,
  disabled,
  pending,
  onChange
}: {
  issue: KerjanIssue
  disabled: boolean
  pending: boolean
  onChange: (status: KerjanTaskStatus) => void
}): React.JSX.Element {
  if (!canSetKerjanTicketStatus(issue)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatusPill issue={issue} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {translate(
            'auto.components.KerjanTicketSheet.statusDerived',
            'Status is derived from this ticket’s Tasks.'
          )}
        </TooltipContent>
      </Tooltip>
    )
  }
  const options = getKerjanTaskStatusOptions()
  const settable = isTaskStatus(issue.statusKey)
  return (
    <div className="flex items-center gap-1.5">
      {settable ? null : <StatusPill issue={issue} />}
      <Select
        value={settable ? issue.statusKey : undefined}
        disabled={disabled || pending}
        onValueChange={(value) => {
          if (isTaskStatus(value) && value !== issue.statusKey) {
            onChange(value)
          }
        }}
      >
        <SelectTrigger
          size="sm"
          className="w-36"
          aria-label={translate('auto.components.KerjanTicketSheet.status', 'Status')}
        >
          <SelectValue
            placeholder={translate('auto.components.KerjanTicketSheet.moveTo', 'Move to…')}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending ? <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  )
}

export function KerjanTicketAssigneeControl({
  issue,
  members,
  viewerId,
  disabled,
  pending,
  onChange
}: {
  issue: KerjanIssue
  members: readonly KerjanMember[]
  viewerId: string | null
  disabled: boolean
  pending: boolean
  onChange: (assigneeId: string | null) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const choose = (assigneeId: string | null): void => {
    setOpen(false)
    if (assigneeId !== issue.assigneeId) {
      onChange(assigneeId)
    }
  }
  const viewer = viewerId ? members.find((member) => member.id === viewerId) : undefined
  const activeMembers = members.filter((member) => member.active !== false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || pending}
          aria-label={translate('auto.components.KerjanTicketSheet.assignee', 'Assignee')}
        >
          <span className="truncate">
            {issue.assignee?.displayName ??
              translate('auto.components.KerjanTicketSheet.unassigned', 'Unassigned')}
          </span>
          {pending ? <LoaderCircle className="animate-spin" /> : <ChevronDown />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <Command>
          <CommandInput
            placeholder={translate(
              'auto.components.KerjanTicketSheet.searchMembers',
              'Search members…'
            )}
          />
          <CommandList>
            <CommandEmpty>
              {translate('auto.components.KerjanTicketSheet.noMembers', 'No members found.')}
            </CommandEmpty>
            <CommandGroup>
              {viewer ? (
                <CommandItem value={`me ${viewer.name}`} onSelect={() => choose(viewer.id)}>
                  {translate('auto.components.KerjanTicketSheet.assignToMe', 'Assign to me')}
                </CommandItem>
              ) : null}
              <CommandItem value="unassigned" onSelect={() => choose(null)}>
                {translate('auto.components.KerjanTicketSheet.unassigned', 'Unassigned')}
                {issue.assigneeId === null ? <Check className="ml-auto" /> : null}
              </CommandItem>
              {activeMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.name} ${member.email ?? ''} ${member.id}`}
                  onSelect={() => choose(member.id)}
                >
                  <span className="truncate">{member.name}</span>
                  {member.id === issue.assigneeId ? <Check className="ml-auto" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
