import { toast } from 'sonner'

import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  activateAndRevealFolderWorkspace,
  activateAndRevealWorktree
} from '@/lib/worktree-activation'
import { findKerjanTicketWorkspaces } from '@/lib/kerjan-ticket-workspace-attachment'
import {
  bindKerjanTicketSourceContext,
  buildKerjanTicketLinkedWorkItem,
  getKerjanTicketWorkspaceSeed,
  type KerjanTicketLike
} from '@/lib/kerjan-ticket-workspace-source'
import { folderWorkspaceToWorktree } from '../../../shared/folder-workspace-worktree'
import { parseWorkspaceKey } from '../../../shared/workspace-scope'
import type { TaskSourceContext } from '../../../shared/task-source-context'

export function openKerjanTicketComposer(
  ticket: KerjanTicketLike,
  sourceContext: TaskSourceContext | null,
  telemetrySource: 'sidebar' | 'command_palette' = 'sidebar'
): boolean {
  const taskSourceContext = bindKerjanTicketSourceContext(ticket, sourceContext)
  if (!taskSourceContext) {
    // Why: the composer drops a Kerjan link without its source — refuse rather than create unlinked.
    toast.error(
      translate(
        'auto.lib.kerjanTicketWorkspaceOpen.sourceUnavailable',
        'Couldn’t link this Kerjan ticket. Reconnect Kerjan, then try again.'
      )
    )
    return false
  }
  useAppStore.getState().openModal('new-workspace-composer', {
    linkedWorkItem: buildKerjanTicketLinkedWorkItem(ticket),
    taskSourceContext,
    prefilledName: getKerjanTicketWorkspaceSeed(ticket),
    telemetrySource
  })
  return true
}

/** Opens the newest workspace already linked to the ticket, or starts a new one. */
export function openKerjanTicketWorkspaceOrStart(
  ticket: KerjanTicketLike,
  sourceContext: TaskSourceContext | null,
  startWorkspace: () => void
): 'opened' | 'started' | 'failed' {
  const state = useAppStore.getState()
  const [attached] = findKerjanTicketWorkspaces(
    [...state.allWorktrees(), ...state.folderWorkspaces.map(folderWorkspaceToWorktree)],
    ticket,
    sourceContext
  )
  if (!attached) {
    startWorkspace()
    return 'started'
  }
  const workspaceScope = parseWorkspaceKey(attached.id)
  const options = {
    navigationIntent: 'user-open' as const,
    ...(attached.hostId ? { executionHostId: attached.hostId } : {})
  }
  const activation =
    workspaceScope?.type === 'folder'
      ? activateAndRevealFolderWorkspace(workspaceScope.folderWorkspaceId, options)
      : activateAndRevealWorktree(attached.id, options)
  if (activation === false) {
    toast.error(
      translate(
        'auto.lib.kerjanTicketWorkspaceOpen.openFailed',
        'Unable to open the workspace linked to this Kerjan ticket.'
      )
    )
    return 'failed'
  }
  return 'opened'
}
