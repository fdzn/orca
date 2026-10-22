import { ChevronDown, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { KerjanTicketStatus } from '../../../../../shared/kerjan-types'
import type { TaskPageKerjanListModel } from '../../use-task-page-kerjan-list'
import {
  DEFAULT_KERJAN_TASK_LIST_FILTERS,
  hasActiveKerjanTaskListFilters,
  KERJAN_ASSIGNEE_ME,
  type KerjanTaskListFilterState
} from '../../kerjan-task-list-filters'
import {
  getKerjanKindOptions,
  getKerjanStatusOptions,
  getKerjanTaskTypeOptions
} from '../../kerjan-ticket-labels'

const ALL = '__all__'

type FilterOption = { id: string; label: string }

function KerjanFilterSelect({
  label,
  allLabel,
  value,
  options,
  disabled,
  onChange
}: {
  label: string
  allLabel: string
  value: string | null
  options: readonly FilterOption[]
  disabled?: boolean
  onChange: (value: string | null) => void
}): React.JSX.Element {
  return (
    <Select
      value={value ?? ALL}
      disabled={disabled}
      onValueChange={(next) => onChange(next === ALL ? null : next)}
    >
      <SelectTrigger size="sm" className="w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function KerjanStatusFilter({
  value,
  onChange
}: {
  value: readonly KerjanTicketStatus[]
  onChange: (statuses: KerjanTicketStatus[]) => void
}): React.JSX.Element {
  const options = getKerjanStatusOptions()
  const summary =
    value.length === 0
      ? translate('auto.components.TaskPageKerjan.allStatuses', 'All statuses')
      : value.length === 1
        ? (options.find((option) => option.id === value[0])?.label ?? value[0])
        : translate('auto.components.TaskPageKerjan.statusCount', '{{value0}} statuses', {
            value0: value.length
          })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-36 justify-between"
          aria-label={translate('auto.components.TaskPageKerjan.status', 'Status')}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={value.includes(option.id)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked ? [...value, option.id] : value.filter((status) => status !== option.id)
              )
            }
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TaskPageKerjanFilters({
  list
}: {
  list: TaskPageKerjanListModel
}): React.JSX.Element {
  const { filters, setFilters, selectedWorkspace, workspaces, sprints, members } = list
  const patch = (update: Partial<KerjanTaskListFilterState>): void =>
    setFilters((current) => ({ ...current, ...update }))
  const assigneeOptions: FilterOption[] = [
    ...(list.viewerId
      ? [{ id: KERJAN_ASSIGNEE_ME, label: translate('auto.components.TaskPageKerjan.me', 'Me') }]
      : []),
    ...members
      .filter((member) => member.active !== false)
      .map((member) => ({ id: member.id, label: member.name }))
  ]
  return (
    <div className="rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedWorkspace?.code}
          disabled={workspaces.length === 0}
          onValueChange={(code) => {
            list.selectWorkspace(code)
            // Why: sprint and assignee ids belong to the previous workspace.
            patch({
              sprintId: null,
              assignee: filters.assignee === KERJAN_ASSIGNEE_ME ? KERJAN_ASSIGNEE_ME : null
            })
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-56"
            aria-label={translate('auto.components.TaskPageKerjan.workspace', 'Kerjan workspace')}
          >
            <SelectValue
              placeholder={translate(
                'auto.components.TaskPageKerjan.noWorkspace',
                'No Kerjan workspace'
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.code} value={workspace.code}>
                <span className="font-mono">{workspace.code}</span>
                <span className="truncate">{workspace.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWorkspace?.readOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">
                {translate('auto.components.TaskPageKerjan.readOnly', 'Read-only')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate(
                'auto.components.TaskPageKerjan.readOnlyTooltip',
                'Synced from Jira project {{value0}}; edits are blocked until cutover.',
                { value0: selectedWorkspace.jiraProject ?? '' }
              )}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <KerjanFilterSelect
          label={translate('auto.components.TaskPageKerjan.kind', 'Kind')}
          allLabel={translate('auto.components.TaskPageKerjan.allKinds', 'All kinds')}
          value={filters.kind}
          options={getKerjanKindOptions()}
          onChange={(kind) =>
            patch({ kind: getKerjanKindOptions().find((option) => option.id === kind)?.id ?? null })
          }
        />
        <KerjanStatusFilter value={filters.statuses} onChange={(statuses) => patch({ statuses })} />
        <KerjanFilterSelect
          label={translate('auto.components.TaskPageKerjan.taskType', 'Task type')}
          allLabel={translate('auto.components.TaskPageKerjan.allTaskTypes', 'All task types')}
          value={filters.taskType}
          options={getKerjanTaskTypeOptions()}
          disabled={filters.kind !== null && filters.kind !== 'task'}
          onChange={(taskType) =>
            patch({
              taskType:
                getKerjanTaskTypeOptions().find((option) => option.id === taskType)?.id ?? null
            })
          }
        />
        <KerjanFilterSelect
          label={translate('auto.components.TaskPageKerjan.sprint', 'Sprint')}
          allLabel={translate('auto.components.TaskPageKerjan.allSprints', 'All sprints')}
          value={filters.sprintId}
          options={sprints.map((sprint) => ({ id: sprint.id, label: sprint.name }))}
          disabled={sprints.length === 0}
          onChange={(sprintId) => patch({ sprintId })}
        />
        <KerjanFilterSelect
          label={translate('auto.components.TaskPageKerjan.assignee', 'Assignee')}
          allLabel={translate('auto.components.TaskPageKerjan.anyone', 'Anyone')}
          value={filters.assignee}
          options={assigneeOptions}
          onChange={(assignee) => patch({ assignee })}
        />
        <div className="min-w-48 flex-1">
          <Input
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder={translate(
              'auto.components.TaskPageKerjan.search',
              'Search key, title, or description'
            )}
            aria-label={translate('auto.components.TaskPageKerjan.searchLabel', 'Search tickets')}
            className="h-8"
          />
        </div>
        {hasActiveKerjanTaskListFilters(filters) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(DEFAULT_KERJAN_TASK_LIST_FILTERS)}
          >
            <X />
            {translate('auto.components.TaskPageKerjan.clearFilters', 'Clear')}
          </Button>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={list.refresh}
              disabled={list.issuesLoading}
              aria-label={translate('auto.components.TaskPageKerjan.refresh', 'Refresh tickets')}
            >
              {list.issuesLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.TaskPageKerjan.refresh', 'Refresh tickets')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
