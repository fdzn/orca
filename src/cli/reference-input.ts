import type { WorkspaceAttachment } from '../shared/worktree/types'
import type { RuntimeStatus } from '../shared/runtime-types'
import type { JiraIssue } from '../shared/jira-types'
import type { KerjanIssueDetail } from '../shared/kerjan-types'
import { KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY } from '../shared/runtime-capability-constants'
import {
  isResolvedJiraIssueMatch,
  JIRA_ISSUE_KEY_PATTERN,
  parseJiraIssueUrl
} from '../shared/jira-issue-url'
import { WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY } from '../shared/workspace-attachment-capabilities'
import {
  getWorkspaceReferenceIdentity,
  parseWorkspaceReferenceUrl
} from '../shared/workspace-reference-identity'
import type { RuntimeClient } from './runtime-client'
import type { HandlerContext } from './dispatch'
import { RuntimeClientError } from './runtime-client'
import { getOptionalStringFlag, getRepeatedStringFlag } from './flags'
import { resolveJiraTarget } from './jira-target'

type ReferenceInput = { key: string } | { item: WorkspaceAttachment }

export function parseReferenceUrls(urls: string[]): WorkspaceAttachment[] {
  try {
    const references = urls.map((url) => parseWorkspaceReferenceUrl(url))
    return [
      ...new Map(references.map((item) => [getWorkspaceReferenceIdentity(item), item])).values()
    ]
  } catch (error) {
    throw new RuntimeClientError(
      'invalid_argument',
      error instanceof Error ? error.message : 'Pass a full issue or review URL.'
    )
  }
}

export function parseReferenceInputs(values: string[]): ReferenceInput[] {
  return values.map((value) =>
    JIRA_ISSUE_KEY_PATTERN.test(value.trim())
      ? { key: value.trim().toUpperCase() }
      : { item: parseReferenceUrls([value])[0] }
  )
}

export async function resolveReferenceInputs(
  context: HandlerContext,
  inputs: ReferenceInput[]
): Promise<WorkspaceAttachment[]> {
  getOptionalStringFlag(context.flags, 'reference-site')
  const firstKey = inputs.find((input) => 'key' in input)
  const target =
    firstKey && 'key' in firstKey
      ? await resolveJiraTarget(context, firstKey.key, { siteFlag: 'reference-site' })
      : undefined
  const resolvedKeys = new Map<string, WorkspaceAttachment>()
  const references = new Map<string, WorkspaceAttachment>()
  for (const input of inputs) {
    let item: WorkspaceAttachment
    if ('item' in input) {
      item = await withKerjanTitle(context, input.item)
    } else {
      const cached = resolvedKeys.get(input.key)
      if (cached) {
        item = cached
      } else {
        if (!target) {
          throw new RuntimeClientError('invalid_argument', 'No Jira site selected for issue keys.')
        }
        const { result: issue } = await context.client.call<JiraIssue | null>(
          'jira.lookupIssueSummary',
          { key: input.key, siteId: target.siteId }
        )
        const parsed = parseJiraIssueUrl(issue?.url ?? '')
        if (
          !issue ||
          !parsed ||
          !isResolvedJiraIssueMatch(parsed, target.site, issue) ||
          parsed.issueKey !== input.key ||
          !issue.title.trim()
        ) {
          throw new RuntimeClientError(
            'jira_issue_unavailable',
            `Jira did not return issue ${input.key} with a title on the selected site.`
          )
        }
        item = { ...parseReferenceUrls([issue.url])[0], title: issue.title }
        resolvedKeys.set(input.key, item)
      }
    }
    const identity = getWorkspaceReferenceIdentity(item)
    references.set(identity, { ...references.get(identity), ...item })
  }
  return [...references.values()]
}

// Why best-effort: a Kerjan URL is a complete reference; the title only decorates it, so an
// unconnected site, another Kerjan, or an older host must not block linking.
async function withKerjanTitle(
  context: HandlerContext,
  item: WorkspaceAttachment
): Promise<WorkspaceAttachment> {
  if (item.provider !== 'kerjan' || item.title || !item.kerjanIdentifier) {
    return item
  }
  try {
    const { result: issue } = await context.client.call<KerjanIssueDetail | null>(
      'kerjan.getIssue',
      { key: item.kerjanIdentifier }
    )
    if (!issue?.url || !issue.title.trim()) {
      return item
    }
    const sameTicket =
      getWorkspaceReferenceIdentity(parseWorkspaceReferenceUrl(issue.url)) ===
      getWorkspaceReferenceIdentity(item)
    return sameTicket ? { ...item, title: issue.title } : item
  } catch {
    return item
  }
}

export async function assertReferenceWritesSupported(
  client: RuntimeClient,
  items: readonly WorkspaceAttachment[] = []
): Promise<void> {
  const status = await client.call<RuntimeStatus>('status.get')
  const capabilities = status.result.capabilities ?? []
  if (!capabilities.includes(WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY)) {
    throw new RuntimeClientError(
      'incompatible_runtime',
      'This Orca host cannot merge reference changes safely. Update Orca on the execution host.'
    )
  }
  // Why: older hosts drop Kerjan links during normalization, so the write would silently lose them.
  if (
    items.some((item) => item.provider === 'kerjan') &&
    !capabilities.includes(KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY)
  ) {
    throw new RuntimeClientError(
      'incompatible_runtime',
      'This Orca host cannot store Kerjan references yet. Update Orca on the execution host.'
    )
  }
}

export function getCreateReferenceInputs(
  flags: Map<string, string | boolean>
): ReferenceInput[] | undefined {
  if (!flags.has('reference')) {
    if (flags.has('reference-site')) {
      throw new RuntimeClientError('invalid_argument', '--reference-site requires --reference.')
    }
    return undefined
  }
  const legacy = ['issue', 'pr', 'linear-issue', 'gitlab-issue', 'gitlab-mr'].find((name) =>
    flags.has(name)
  )
  if (legacy) {
    throw new RuntimeClientError('invalid_argument', `Cannot combine --reference with --${legacy}.`)
  }
  const urls = getRepeatedStringFlag(flags, 'reference')
  if (urls.length === 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--reference requires a full issue or review URL, or a Jira issue key.'
    )
  }
  getOptionalStringFlag(flags, 'reference-site')
  return parseReferenceInputs(urls)
}
