import { describe, expect, it } from 'vitest'
import {
  bindKerjanTicketSourceContext,
  buildKerjanTaskSourceContext,
  buildKerjanTicketLinkedWorkItem,
  getKerjanTicketWorkspaceSeed
} from './kerjan-ticket-workspace-source'
import { KERJAN_SOURCE, makeKerjanIssue } from '@/components/kerjan-ticket.test-fixture'

describe('Kerjan ticket workspace composer source', () => {
  it('links the ticket by key, keeping the key in the title', () => {
    expect(buildKerjanTicketLinkedWorkItem(makeKerjanIssue())).toEqual({
      type: 'issue',
      provider: 'kerjan',
      number: 0,
      title: 'OMX-40 Fix login redirect',
      url: 'https://kerjan.example/ticket/OMX-40',
      kerjanIdentifier: 'OMX-40'
    })
  })

  it('seeds the workspace name from the key and title', () => {
    const seed = getKerjanTicketWorkspaceSeed(makeKerjanIssue())
    expect(seed.toLowerCase()).toContain('omx-40')
    expect(seed.toLowerCase()).toContain('login')
  })

  it('builds an account-backed source with the site and workspace code', () => {
    expect(
      buildKerjanTaskSourceContext({
        projectId: 'p',
        hostId: 'local',
        siteUrl: 'https://kerjan.example',
        workspaceCode: 'OMX'
      })
    ).toMatchObject({
      provider: 'kerjan',
      hostId: 'local',
      accountLabel: 'kerjan.example',
      providerIdentity: {
        provider: 'kerjan',
        siteUrl: 'https://kerjan.example',
        workspaceCode: 'OMX'
      }
    })
  })

  it('pins the source to the ticket workspace and refuses non-Kerjan sources', () => {
    const bound = bindKerjanTicketSourceContext({ key: 'HV-7' }, KERJAN_SOURCE)
    expect(bound?.providerIdentity).toEqual({
      provider: 'kerjan',
      siteUrl: 'https://kerjan.example',
      workspaceCode: 'HV'
    })
    expect(bound?.hostId).toBe('local')
    expect(
      bindKerjanTicketSourceContext({ key: 'HV-7' }, { ...KERJAN_SOURCE, provider: 'jira' })
    ).toBeNull()
    expect(bindKerjanTicketSourceContext({ key: 'HV-7' }, null)).toBeNull()
  })
})
