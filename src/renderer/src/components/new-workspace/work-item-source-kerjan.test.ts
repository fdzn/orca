import { describe, expect, it } from 'vitest'
import { buildSmartWorkspaceSourceRows } from '../../../../shared/new-workspace/smart-workspace-source-results'
import { resolveSmartWorkspaceCommandValue } from '../../../../shared/new-workspace/smart-workspace-command-value'
import { KERJAN_SOURCE, makeKerjanIssue } from '../kerjan-ticket.test-fixture'
import { resolveWorkItemSourceRow } from './work-item-source-selection'

const issue = makeKerjanIssue()
const row = { kind: 'kerjan' as const, value: 'kerjan-OMX-40', issue }
const noContexts = { github: null, gitlab: null, linear: null, jira: null }

function rowsFor(kerjanIssue: typeof issue | null) {
  return buildSmartWorkspaceSourceRows({
    branches: [],
    githubItems: [],
    gitlabAvailable: false,
    gitlabItems: [],
    kerjanIntent: true,
    kerjanIssue,
    linearAvailable: false,
    linearIssues: [],
    mode: 'smart',
    resultLimit: 12,
    value: issue.url
  })
}

describe('Kerjan composer source', () => {
  it('shows only the resolved ticket for a pasted ticket URL', () => {
    expect(rowsFor(issue)).toEqual([row])
    expect(rowsFor(null)).toEqual([])
  })

  it('highlights the Kerjan row for a Kerjan intent', () => {
    expect(
      resolveSmartWorkspaceCommandValue({
        currentValue: 'use-name',
        rows: [{ kind: 'use-name', value: 'use-name' }, row],
        isQueryStale: false,
        sourceIntent: 'kerjan'
      })
    ).toBe('kerjan-OMX-40')
  })

  it('links the ticket with the context the URL lookup bound', () => {
    expect(resolveWorkItemSourceRow(row, { ...noContexts, kerjan: KERJAN_SOURCE })).toEqual({
      provider: 'kerjan',
      type: 'issue',
      number: 0,
      title: 'Fix login redirect',
      url: issue.url,
      kerjanIdentifier: 'OMX-40',
      identifier: 'OMX-40',
      taskSourceContext: KERJAN_SOURCE
    })
  })

  it('refuses a Kerjan row without a bound Kerjan context', () => {
    expect(resolveWorkItemSourceRow(row, noContexts)).toBeNull()
    expect(
      resolveWorkItemSourceRow(row, {
        ...noContexts,
        kerjan: { ...KERJAN_SOURCE, provider: 'jira' }
      })
    ).toBeNull()
  })
})
