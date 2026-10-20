import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const TICKET_NOTE = 'Tickets accept a key such as OMX-40 or a ticket URL on the connected site.'

export const KERJAN_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['kerjan', 'connection'],
    aliases: [['kerjan', 'connection', 'status']],
    summary: 'Show the saved Kerjan connection',
    usage: 'orca kerjan connection [status] [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Reads the saved connection without decrypting the token or calling Kerjan.',
      'Manage it with orca kerjan connection connect, test, or disconnect.'
    ]
  },
  {
    path: ['kerjan', 'connection', 'connect'],
    summary: 'Connect Orca to a Kerjan site',
    usage: 'orca kerjan connection connect --url <base> [--token-stdin] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'url', 'token-stdin'],
    notes: [
      'Pipe a personal access token (kjt_...) with --token-stdin, or set ORCA_KERJAN_TOKEN. Tokens are never accepted as arguments.',
      'Create the token in Kerjan with your authenticator code; it expires after 90 days.',
      'The token is saved on the execution host, encrypted where the OS keychain allows.'
    ],
    examples: [
      'orca kerjan connection connect --url https://kerjan.example.com --token-stdin < token.txt'
    ]
  },
  {
    path: ['kerjan', 'connection', 'disconnect'],
    destructive: true,
    summary: 'Forget the saved Kerjan connection and token',
    usage: 'orca kerjan connection disconnect [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['kerjan', 'connection', 'test'],
    summary: 'Verify the saved Kerjan token',
    usage: 'orca kerjan connection test [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['kerjan', 'workspaces'],
    summary: 'List Kerjan workspaces',
    usage: 'orca kerjan workspaces [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Workspaces still synced from Jira are read-only until cutover.']
  },
  {
    path: ['kerjan', 'sprints'],
    summary: 'List sprints in a Kerjan workspace',
    usage: 'orca kerjan sprints --workspace <code> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'workspace'],
    examples: ['orca kerjan sprints --workspace OMX --json']
  },
  {
    path: ['kerjan', 'members'],
    summary: 'List Kerjan members and their ids',
    usage: 'orca kerjan members [--workspace <code>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'workspace']
  },
  {
    path: ['kerjan', 'list'],
    summary: 'List tickets in a Kerjan workspace',
    usage:
      'orca kerjan list --workspace <code> [--status <status>] [--kind epic|story|task] [--type dev|qa|bug] [--sprint <id>] [--assignee <memberId>|--mine] [--query <text>] [--limit <n>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'workspace',
      'status',
      'kind',
      'type',
      'sprint',
      'assignee',
      'mine',
      'query',
      'limit'
    ],
    notes: [
      'Statuses: todo, in_progress, ready_for_qa, testing, done, canceled.',
      '--query matches key, title, and description in Orca; Kerjan has no server-side search.'
    ],
    examples: ['orca kerjan list --workspace OMX --mine --status in_progress --json']
  },
  {
    path: ['kerjan', 'issue'],
    summary: 'Read a Kerjan ticket with its comments',
    usage: 'orca kerjan issue <key|url> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key'],
    positionalArgs: ['key'],
    notes: [TICKET_NOTE],
    examples: ['orca kerjan issue OMX-40 --json']
  },
  {
    path: ['kerjan', 'comment'],
    summary: 'Comment on a Kerjan ticket',
    usage: 'orca kerjan comment <key|url> (--body <text> | --body-stdin) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key', 'body', 'body-stdin'],
    positionalArgs: ['key'],
    notes: [TICKET_NOTE, 'Comments are limited to 10000 characters.'],
    examples: ['orca kerjan comment OMX-40 --body "Fix is on staging"']
  },
  {
    path: ['kerjan', 'status'],
    summary: 'Move a Kerjan Task to todo, in_progress, or done',
    usage: 'orca kerjan status <key|url> <todo|in_progress|done> [--comment <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key', 'to', 'comment'],
    positionalArgs: ['key', 'to'],
    notes: [
      TICKET_NOTE,
      'Only Tasks take a status; Story and Epic status follows their Tasks. Done is final and needs an assignee.'
    ],
    examples: ['orca kerjan status OMX-40 in_progress --json']
  },
  {
    path: ['kerjan', 'assign'],
    summary: 'Assign or unassign a Kerjan ticket',
    usage: 'orca kerjan assign <key|url> (<memberId> | --me | --none) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'key', 'member', 'me', 'none'],
    positionalArgs: ['key', 'member'],
    notes: [TICKET_NOTE, 'Find member ids with orca kerjan members.'],
    examples: ['orca kerjan assign OMX-40 --me --json', 'orca kerjan assign OMX-40 --none']
  }
]
