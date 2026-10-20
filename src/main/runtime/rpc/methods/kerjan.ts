import { defineMethod } from '../core'
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
} from '../../../../shared/rpc-contract/kerjan-params'

export const KERJAN_METHODS = [
  defineMethod({
    name: 'kerjan.connect',
    permission: 'accounts-admin',
    params: KerjanConnect,
    handler: async (params, { runtime }) =>
      runtime.kerjanConnect({ baseUrl: params.baseUrl.trim(), token: params.token.trim() })
  }),
  defineMethod({
    name: 'kerjan.disconnect',
    permission: 'accounts-admin',
    params: null,
    handler: async (_params, { runtime }) => runtime.kerjanDisconnect()
  }),
  defineMethod({
    name: 'kerjan.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.kerjanStatus()
  }),
  defineMethod({
    name: 'kerjan.testConnection',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.kerjanTestConnection()
  }),
  defineMethod({
    name: 'kerjan.listWorkspaces',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.kerjanListWorkspaces()
  }),
  defineMethod({
    name: 'kerjan.listSprints',
    permission: 'workspace',
    params: KerjanWorkspaceScope,
    handler: async (params, { runtime }) => runtime.kerjanListSprints(params.workspaceCode)
  }),
  defineMethod({
    name: 'kerjan.listProducts',
    permission: 'workspace',
    params: KerjanWorkspaceScope,
    handler: async (params, { runtime }) => runtime.kerjanListProducts(params.workspaceCode)
  }),
  defineMethod({
    name: 'kerjan.listMembers',
    permission: 'workspace',
    params: KerjanOptionalWorkspaceScope,
    handler: async (params, { runtime }) => runtime.kerjanListMembers(params?.workspaceCode)
  }),
  defineMethod({
    name: 'kerjan.listIssues',
    permission: 'workspace',
    params: KerjanListIssues,
    handler: async (params, { runtime }) =>
      runtime.kerjanListIssues(params.workspaceCode, params.filters)
  }),
  defineMethod({
    name: 'kerjan.searchIssues',
    permission: 'workspace',
    params: KerjanSearchIssues,
    handler: async (params, { runtime }) =>
      runtime.kerjanSearchIssues(params.workspaceCode, params.query, params.filters)
  }),
  defineMethod({
    name: 'kerjan.getIssue',
    permission: 'workspace',
    params: KerjanTicketKey,
    handler: async (params, { runtime }) => runtime.kerjanGetIssue(params.key)
  }),
  defineMethod({
    name: 'kerjan.setStatus',
    permission: 'workspace',
    params: KerjanSetStatus,
    handler: async (params, { runtime }) =>
      runtime.kerjanSetStatus(params.key, params.status, params.comment)
  }),
  defineMethod({
    name: 'kerjan.addComment',
    permission: 'workspace',
    params: KerjanAddComment,
    handler: async (params, { runtime }) => runtime.kerjanAddComment(params.key, params.body)
  }),
  defineMethod({
    name: 'kerjan.setAssignee',
    permission: 'workspace',
    params: KerjanSetAssignee,
    handler: async (params, { runtime }) => runtime.kerjanSetAssignee(params.key, params.assigneeId)
  }),
  defineMethod({
    name: 'kerjan.updateIssue',
    permission: 'workspace',
    params: KerjanUpdateIssue,
    handler: async (params, { runtime }) => runtime.kerjanUpdateIssue(params.key, params.updates)
  })
]
