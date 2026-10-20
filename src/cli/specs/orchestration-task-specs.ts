import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const ORCHESTRATION_TASK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['orchestration', 'task-create'],
    summary: 'Create an orchestration task',
    usage:
      'orca orchestration task-create (--spec <text> | --kerjan <key|url> [--spec <text>]) [--task-title <text>] [--display-name <text>] [--deps <json_array>] [--parent <task_id>] [--run <run_id>] [--from <handle>] [--retry-request <id>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'spec',
      'kerjan',
      'task-title',
      'display-name',
      'deps',
      'parent',
      'run',
      'from',
      'retry-request'
    ],
    identityFlagRoles: { from: 'caller' },
    notes: [
      '--kerjan reads the ticket on the execution host: the task title defaults to "KEY: title" and the spec appends its URL, kind, status, and description after any --spec text.'
    ]
  },
  {
    path: ['orchestration', 'task-list'],
    summary: 'List orchestration tasks',
    usage:
      'orca orchestration task-list [--status <status>] [--ready] [--brief] [--run <run_id>] [--from <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'status', 'ready', 'brief', 'run', 'from'],
    identityFlagRoles: { from: 'caller' },
    notes: ['--brief collapses whitespace and caps each spec at 160 characters.']
  },
  {
    path: ['orchestration', 'task-update'],
    summary: 'Update a task status',
    usage:
      'orca orchestration task-update --id <task_id> --status <status> [--result <text>] [--run <run_id>] [--from <handle>] [--retry-request <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'status', 'result', 'run', 'from', 'retry-request'],
    identityFlagRoles: { from: 'caller' },
    notes: [
      'Valid --status values: pending, ready, dispatched, completed, failed, blocked.',
      'To cancel a Task, stop or abandon its worker, then set --status failed --result cancelled; a later worker-start --retry-of reopens it.'
    ]
  }
]
