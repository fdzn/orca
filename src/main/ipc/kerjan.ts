import { ipcMain } from 'electron'
import type { z } from 'zod'
import {
  KerjanAddComment,
  KerjanConnect,
  KerjanListIssues,
  KerjanOptionalWorkspaceScope,
  KerjanSearchIssues,
  KerjanSetAssignee,
  KerjanSetStatus,
  KerjanTicketKey,
  KerjanUpdateIssue,
  KerjanWorkspaceScope
} from '../../shared/rpc-contract/kerjan-params'
import { RuntimeKerjanCommands } from '../runtime/runtime-kerjan-commands'

function parseArgs<T extends z.ZodType>(schema: T, args: unknown): z.output<T> {
  const parsed = schema.safeParse(args)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid Kerjan request.')
  }
  return parsed.data
}

/** Registers every `kerjan:*` IPC handler; same commands the `kerjan.*` RPC methods run. */
export function registerKerjanHandlers(): void {
  // Why the runtime command class: connect/disconnect also reset the preflight cache there.
  const commands = new RuntimeKerjanCommands()

  ipcMain.handle('kerjan:connect', async (_event, args: unknown) => {
    const parsed = KerjanConnect.safeParse(args)
    if (!parsed.success) {
      return { ok: false, error: 'Kerjan URL and personal access token are required.' }
    }
    return commands.kerjanConnect(parsed.data)
  })
  ipcMain.handle('kerjan:disconnect', async () => {
    commands.kerjanDisconnect()
  })
  ipcMain.handle('kerjan:status', async () => commands.kerjanStatus())
  ipcMain.handle('kerjan:testConnection', async () => commands.kerjanTestConnection())
  ipcMain.handle('kerjan:listWorkspaces', async () => commands.kerjanListWorkspaces())
  ipcMain.handle('kerjan:listSprints', async (_event, args: unknown) =>
    commands.kerjanListSprints(parseArgs(KerjanWorkspaceScope, args).workspaceCode)
  )
  ipcMain.handle('kerjan:listProducts', async (_event, args: unknown) =>
    commands.kerjanListProducts(parseArgs(KerjanWorkspaceScope, args).workspaceCode)
  )
  ipcMain.handle('kerjan:listMembers', async (_event, args: unknown) =>
    commands.kerjanListMembers(parseArgs(KerjanOptionalWorkspaceScope, args)?.workspaceCode)
  )
  ipcMain.handle('kerjan:listIssues', async (_event, args: unknown) => {
    const params = parseArgs(KerjanListIssues, args)
    return commands.kerjanListIssues(params.workspaceCode, params.filters)
  })
  ipcMain.handle('kerjan:searchIssues', async (_event, args: unknown) => {
    const params = parseArgs(KerjanSearchIssues, args)
    return commands.kerjanSearchIssues(params.workspaceCode, params.query, params.filters)
  })
  ipcMain.handle('kerjan:getIssue', async (_event, args: unknown) =>
    commands.kerjanGetIssue(parseArgs(KerjanTicketKey, args).key)
  )
  ipcMain.handle('kerjan:setStatus', async (_event, args: unknown) => {
    const params = parseArgs(KerjanSetStatus, args)
    return commands.kerjanSetStatus(params.key, params.status, params.comment)
  })
  ipcMain.handle('kerjan:addComment', async (_event, args: unknown) => {
    const params = parseArgs(KerjanAddComment, args)
    return commands.kerjanAddComment(params.key, params.body)
  })
  ipcMain.handle('kerjan:setAssignee', async (_event, args: unknown) => {
    const params = parseArgs(KerjanSetAssignee, args)
    return commands.kerjanSetAssignee(params.key, params.assigneeId)
  })
  ipcMain.handle('kerjan:updateIssue', async (_event, args: unknown) => {
    const params = parseArgs(KerjanUpdateIssue, args)
    return commands.kerjanUpdateIssue(params.key, params.updates)
  })
}
