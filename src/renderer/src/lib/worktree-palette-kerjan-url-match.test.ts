import { describe, expect, it } from 'vitest'
import { makeWorktree } from '@/store/slices/worktrees-slice-test-fixtures'
import {
  getCmdJTaskUrlCreatePreview,
  matchWorktreePaletteTaskUrl,
  parseCmdJTaskSourceUrl
} from './worktree-palette-task-url-match'

const url = 'https://kerjan.example/ticket/omx-40'

function linkedTo(itemUrl: string) {
  return makeWorktree({
    id: 'wt',
    repoId: 'repo',
    linkedItems: [
      { provider: 'kerjan', type: 'issue', number: 0, kerjanIdentifier: 'OMX-40', url: itemUrl }
    ]
  })
}

describe('Kerjan ticket URLs in Cmd-J', () => {
  it('parses a /ticket/KEY route on any host after Jira', () => {
    expect(parseCmdJTaskSourceUrl(url)).toEqual({
      provider: 'kerjan',
      parsed: { ticketKey: 'OMX-40', origin: 'https://kerjan.example', basePath: '' }
    })
    expect(parseCmdJTaskSourceUrl('https://jira.example/browse/OMX-40')?.provider).toBe('jira')
    expect(parseCmdJTaskSourceUrl('https://kerjan.example/tickets/OMX-40')).toBeNull()
  })

  it('previews a create action for the ticket', () => {
    const intent = parseCmdJTaskSourceUrl('https://kerjan.example/app/ticket/OMX-40')
    expect(intent && getCmdJTaskUrlCreatePreview(intent)).toEqual({
      provider: 'kerjan',
      identifier: 'OMX-40',
      subtitle: 'kerjan.example/app',
      kindLabel: 'Kerjan ticket',
      createLabel: 'Create worktree from Kerjan ticket OMX-40'
    })
  })

  it('matches a workspace linked to the same ticket on the same site only', () => {
    const intent = parseCmdJTaskSourceUrl(url)
    if (!intent) {
      throw new Error('expected a Kerjan intent')
    }
    expect(
      matchWorktreePaletteTaskUrl({
        worktree: linkedTo('https://kerjan.example/ticket/OMX-40'),
        intent
      })?.supportingText
    ).toMatchObject({ labelKind: 'issue', text: 'OMX-40' })
    expect(
      matchWorktreePaletteTaskUrl({
        worktree: linkedTo('https://other.example/ticket/OMX-40'),
        intent
      })
    ).toBeNull()
  })
})
