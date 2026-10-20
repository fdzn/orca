import type { WorkspaceAttachment } from '../../../shared/worktree/types'
import {
  WORKTREE_LINKED_ITEMS_RUNTIME_CAPABILITY,
  WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY
} from '../../../shared/workspace-attachment-capabilities'
import { assertRuntimeEnvironmentCapability } from './runtime-rpc-client'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import { KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY } from '../../../shared/runtime-capability-constants'
import { translate } from '@/i18n/i18n'

export async function assertWorkspaceAttachmentWriteCapability(
  target: RuntimeClientTarget,
  updates: { linkedItems?: WorkspaceAttachment[]; linkedItemsBase?: WorkspaceAttachment[] }
): Promise<void> {
  if (target.kind !== 'environment') {
    return
  }
  await assertKerjanLinkCapability(target, ...(updates.linkedItems ?? []))
  if (updates.linkedItemsBase !== undefined) {
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      WORKTREE_LINKED_ITEMS_DELTA_RUNTIME_CAPABILITY,
      translate(
        'workspace.attachments.updateRuntimeSafely',
        'Update the remote runtime to safely change workspace links'
      )
    )
  }
  if (updates.linkedItems !== undefined) {
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      WORKTREE_LINKED_ITEMS_RUNTIME_CAPABILITY,
      translate(
        'workspace.attachments.updateRuntime',
        'Update the remote runtime to change workspace links'
      )
    )
  }
}

/** Older hosts silently drop Kerjan links, so refuse to send them without the capability. */
export async function assertKerjanLinkCapability(
  target: RuntimeClientTarget,
  ...sources: ({ provider?: string } | null | undefined)[]
): Promise<void> {
  if (target.kind !== 'environment' || !sources.some((source) => source?.provider === 'kerjan')) {
    return
  }
  await assertRuntimeEnvironmentCapability(
    target.environmentId,
    KERJAN_TASK_PROVIDER_RUNTIME_CAPABILITY,
    'Update the remote runtime to link Kerjan'
  )
}
