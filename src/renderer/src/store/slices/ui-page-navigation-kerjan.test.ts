import { describe, expect, it, vi } from 'vitest'
import { createUIStore } from './ui-slice-test-harness'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import { KERJAN_SOURCE, makeKerjanIssue } from '@/components/kerjan-ticket.test-fixture'

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }))
vi.mock('sonner', () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }))

describe('Kerjan task detail navigation', () => {
  it('records a Kerjan detail entry and the Kerjan tasks interaction', () => {
    const store = createUIStore()
    const recordFeatureInteraction = vi.fn()
    store.setState({ recordFeatureInteraction })
    const issue = makeKerjanIssue()

    store
      .getState()
      .openTaskPage(
        { taskSource: 'kerjan', openKerjanIssue: issue, openKerjanSourceContext: KERJAN_SOURCE },
        { recordTasksInteraction: false }
      )

    expect(recordFeatureInteraction).toHaveBeenCalledWith('kerjan-tasks')
    expect(store.getState().worktreeNavHistory.at(-1)).toEqual({
      kind: 'task-detail',
      source: 'kerjan',
      issue,
      sourceContext: KERJAN_SOURCE
    })
  })

  it('keeps the same ticket from two hosts as separate history entries', () => {
    const store = createUIStore()
    const issue = makeKerjanIssue()
    const sources: TaskSourceContext[] = [
      KERJAN_SOURCE,
      { ...KERJAN_SOURCE, hostId: 'runtime:remote' }
    ]
    for (const sourceContext of sources) {
      store
        .getState()
        .recordViewVisit({ kind: 'task-detail', source: 'kerjan', issue, sourceContext })
    }
    store.getState().recordViewVisit({
      kind: 'task-detail',
      source: 'kerjan',
      issue,
      sourceContext: KERJAN_SOURCE
    })
    store.getState().recordViewVisit({
      kind: 'task-detail',
      source: 'kerjan',
      issue,
      sourceContext: KERJAN_SOURCE
    })

    expect(store.getState().worktreeNavHistory).toHaveLength(3)
  })
})
