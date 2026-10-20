import { describe, expect, it } from 'vitest'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { resolveKerjanDetailSourceContext } from './use-task-page-kerjan-detail-routing'
import { KERJAN_SOURCE, makeKerjanIssue } from './kerjan-ticket.test-fixture'

const fallback: TaskSourceContext = { ...KERJAN_SOURCE, hostId: 'runtime:fallback' }

describe('Kerjan task detail routing', () => {
  it('keeps the source a deep link opened the ticket with', () => {
    expect(
      resolveKerjanDetailSourceContext(
        { openKerjanIssue: makeKerjanIssue(), openKerjanSourceContext: KERJAN_SOURCE },
        fallback
      )
    ).toBe(KERJAN_SOURCE)
  })

  it('falls back to the Tasks page source without a Kerjan deep-link source', () => {
    expect(resolveKerjanDetailSourceContext({ openKerjanIssue: makeKerjanIssue() }, fallback)).toBe(
      fallback
    )
    expect(
      resolveKerjanDetailSourceContext(
        {
          openKerjanIssue: makeKerjanIssue(),
          openKerjanSourceContext: { ...KERJAN_SOURCE, provider: 'jira' }
        },
        fallback
      )
    ).toBe(fallback)
    expect(resolveKerjanDetailSourceContext({ openKerjanSourceContext: KERJAN_SOURCE }, null)).toBe(
      null
    )
  })
})
