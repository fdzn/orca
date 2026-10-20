import { useAppStore } from '@/store'
import type { WorktreeNavHistoryViewEntry } from '@/store/slices/worktree-nav-history'
import type { TaskPageData } from '@/store/slices/ui/ui-slice-contract-core'

const NO_OPEN_TASK_DETAIL = {
  openGitHubWorkItem: undefined,
  openGitHubSourceContext: undefined,
  openGitHubInitialTab: undefined,
  openGitLabWorkItem: undefined,
  openGitLabSourceContext: undefined,
  openLinearIssue: undefined,
  openLinearSourceContext: undefined,
  openJiraIssue: undefined,
  openJiraSourceContext: undefined,
  openKerjanIssue: undefined,
  openKerjanSourceContext: undefined
} satisfies TaskPageData

// Why: page entries replay via setActiveView (not open*Page) so back/forward doesn't mutate previousViewBefore* or duplicate history (see navigateToIndex).
export function applyWorktreeNavViewEntry(entry: WorktreeNavHistoryViewEntry): void {
  if (entry === 'automations' || entry === 'artifacts' || entry === 'skills') {
    useAppStore.getState().setActiveView(entry)
    return
  }
  if (entry === 'tasks') {
    useAppStore.setState((state) => ({
      activeView: 'tasks',
      githubTaskDrawerWorkItem: null,
      taskPageData: { ...state.taskPageData, ...NO_OPEN_TASK_DETAIL }
    }))
    return
  }
  if (entry.source === 'github') {
    useAppStore.setState((state) => ({
      activeView: 'tasks',
      taskPageData: {
        ...state.taskPageData,
        ...NO_OPEN_TASK_DETAIL,
        taskSource: 'github',
        preselectedRepoId: entry.workItem.repoId,
        openGitHubWorkItem: entry.workItem,
        openGitHubSourceContext: entry.sourceContext,
        openGitHubInitialTab: entry.initialTab
      }
    }))
    return
  }
  const detail: TaskPageData =
    entry.source === 'gitlab'
      ? {
          taskSource: 'gitlab',
          preselectedRepoId: entry.workItem.repoId,
          openGitLabWorkItem: entry.workItem,
          openGitLabSourceContext: entry.sourceContext
        }
      : entry.source === 'jira'
        ? {
            taskSource: 'jira',
            openJiraIssue: entry.issue,
            openJiraSourceContext: entry.sourceContext
          }
        : entry.source === 'kerjan'
          ? {
              taskSource: 'kerjan',
              openKerjanIssue: entry.issue,
              openKerjanSourceContext: entry.sourceContext
            }
          : {
              taskSource: 'linear',
              openLinearIssue: entry.issue,
              openLinearSourceContext: entry.sourceContext
            }
  useAppStore.setState((state) => ({
    activeView: 'tasks',
    githubTaskDrawerWorkItem: null,
    taskPageData: { ...state.taskPageData, ...NO_OPEN_TASK_DETAIL, ...detail }
  }))
}
