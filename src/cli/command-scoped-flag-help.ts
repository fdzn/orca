// Why: the shared --focus line describes terminal create's terminal session.
const FILE_OPEN_FOCUS_HELP =
  "--focus                Bring the user to the file (switches Orca's window to its worktree)"

/** Per-command flag help, kept out of the shared help chain it would crowd. */
const COMMAND_SCOPED_FLAG_HELP: Record<string, Record<string, string>> = {
  'reference add': {
    url: '--url <url-or-jira-key> Full review/issue URL or Jira key; use positionals or repeated --url',
    'reference-site': '--reference-site <id> Jira site for bare keys; see orca jira connection'
  },
  'reference remove': {
    url: '--url <url>            Full review or issue URL; pass all URLs positionally or all as repeated --url',
    key: '--key <key>            Opaque key from reference list; repeat for several'
  },
  'reference find': {
    query: '--query <url-or-key>   Full URL or native issue key such as STA-1234',
    repo: '--repo <selector>      Filter by workspace repository membership',
    'include-archived': '--include-archived     Include archived workspaces',
    limit: '--limit <n>            Maximum matching workspaces (default 50)'
  },
  'kerjan connection connect': {
    url: '--url <base>           Kerjan site URL, e.g. https://kerjan.example.com',
    'token-stdin': '--token-stdin          Read the personal access token from stdin'
  },
  'kerjan list': {
    workspace: '--workspace <code>     Kerjan workspace code; see orca kerjan workspaces',
    status: '--status <status>      todo|in_progress|ready_for_qa|testing|done|canceled',
    kind: '--kind <kind>          epic|story|task',
    type: '--type <type>          Task type: dev|qa|bug',
    sprint: '--sprint <id>          Sprint id from orca kerjan sprints',
    assignee: '--assignee <memberId>  Member id from orca kerjan members',
    mine: '--mine                 Only tickets assigned to the connected member',
    query: '--query <text>         Match key, title, or description',
    limit: '--limit <n>            Maximum tickets (at most 1000)'
  },
  'kerjan sprints': {
    workspace: '--workspace <code>     Kerjan workspace code; see orca kerjan workspaces'
  },
  'kerjan members': {
    workspace: '--workspace <code>     Limit to members of one Kerjan workspace'
  },
  'kerjan issue': {
    key: '--key <key|url>        Kerjan ticket key or URL; also accepted positionally'
  },
  'kerjan comment': {
    key: '--key <key|url>        Kerjan ticket key or URL; also accepted positionally',
    body: '--body <text>          Comment markdown',
    'body-stdin': '--body-stdin           Read the comment from stdin'
  },
  'kerjan status': {
    key: '--key <key|url>        Kerjan ticket key or URL; also accepted positionally',
    to: '--to <status>          todo|in_progress|done; also accepted positionally',
    comment: '--comment <text>       Kerjan comment posted with the status change'
  },
  'kerjan assign': {
    key: '--key <key|url>        Kerjan ticket key or URL; also accepted positionally',
    member: '--member <id>          Member id; also accepted positionally',
    me: '--me                   Assign the connected member',
    none: '--none                 Clear the assignee'
  },
  'worktree create': {
    reference:
      '--reference <url-or-jira-key> Attach an issue/review URL or Jira key; repeat for several',
    'reference-site': '--reference-site <id> Jira site for bare keys; see orca jira connection',
    pr: '--pr <number>          Linked GitHub pull request number',
    'gitlab-issue': '--gitlab-issue <number|url> Linked GitLab issue in the source project',
    'gitlab-mr': '--gitlab-mr <number|url> Linked GitLab merge request in the source project'
  },
  'orchestration task-create': {
    kerjan:
      '--kerjan <key|url>     Build the task from a Kerjan ticket; --spec becomes optional extra context'
  },
  'skills get': {
    full: '--full                 Print the full guide with bundled references',
    reference: '--reference <name>     Print one bundled reference by name',
    references: '--references           List the bundled reference names for a topic'
  },
  'environment update': {
    force: '--force                Restart over running terminals instead of deferring the update'
  },
  'environment recover': {
    'accept-changed-state':
      '--accept-changed-state Restore the prelaunch snapshot over state a rejected build changed',
    yes: '--yes                  Confirm discarding what the rejected build changed'
  },
  'environment stop': {
    yes: '--yes                  Confirm stopping the server and unlinking it from this machine'
  },
  'file open': {
    line: '--line <n>             Cursor line (1-based)',
    column: '--column <n>           Cursor column (1-based; requires --line)',
    focus: FILE_OPEN_FOCUS_HELP
  },
  'file diff': {
    focus: FILE_OPEN_FOCUS_HELP
  },
  'file open-changed': {
    focus: FILE_OPEN_FOCUS_HELP
  },
  'skills install': {
    agent: '--agent <names>        Comma-separated install targets; default is detected agents'
  },
  'worktree set': {
    unread: '--unread               Mark the workspace unread in the sidebar',
    read: '--read                 Mark the workspace read, clearing the unread dot'
  },
  search: {
    query: '--query <text>         Search text; also accepted as the positional argument',
    scope: '--scope <corpus>       conversation (user and assistant turns) or all (default)',
    fresh: '--fresh                Wait up to 5s for the host to reconcile its index first',
    limit: '--limit <n>            Hits per page (default 20, maximum 100)',
    cursor: '--cursor <cursor>      Opaque cursor printed by the previous page of this search',
    agent: '--agent <id>           Restrict to one agent; repeat for several',
    path: '--path <path>          Restrict to an execution-host path; repeat for several',
    since: '--since <iso>          Only sessions updated at or after this ISO 8601 timestamp',
    sort: '--sort <order>         relevance (default) or newest',
    debug: '--debug                Include the planner route the host used',
    'index-status': '--index-status         Report the index instead of searching'
  }
}

export function formatCommandScopedFlagHelp(command: string, flag: string): string | undefined {
  return COMMAND_SCOPED_FLAG_HELP[command]?.[flag]
}
