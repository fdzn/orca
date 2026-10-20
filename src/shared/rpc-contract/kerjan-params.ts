import { z } from 'zod'
import {
  KERJAN_TASK_STATUSES,
  KERJAN_TASK_TYPES,
  KERJAN_TICKET_KINDS,
  KERJAN_TICKET_STATUSES
} from '../kerjan-types'
import { OptionalPlainString, OptionalString, requiredString } from './rpc-param-primitives'

// Kerjan ids are integers; CLI callers may pass them as strings.
const KerjanIdParam = z
  .union([z.string().trim().regex(/^\d+$/, 'Kerjan ids are numeric'), z.number().int().min(0)])
  .transform(String)

export const KerjanConnect = z.object({
  baseUrl: requiredString('Kerjan URL is required'),
  token: requiredString('Personal access token is required')
})

export const KerjanWorkspaceScope = z.object({
  workspaceCode: requiredString('Workspace code is required')
})

export const KerjanOptionalWorkspaceScope = z
  .object({
    workspaceCode: OptionalString
  })
  .optional()

export const KerjanIssueListFiltersParam = z.object({
  kind: z.enum(KERJAN_TICKET_KINDS).optional(),
  status: z.enum(KERJAN_TICKET_STATUSES).optional(),
  taskType: z.enum(KERJAN_TASK_TYPES).optional(),
  assigneeId: KerjanIdParam.optional(),
  sprintId: KerjanIdParam.optional(),
  epicId: KerjanIdParam.optional(),
  productId: KerjanIdParam.optional(),
  backlog: z.boolean().optional(),
  query: OptionalPlainString,
  limit: z.number().int().min(1).max(1000).optional()
})

export const KerjanListIssues = z.object({
  workspaceCode: requiredString('Workspace code is required'),
  filters: KerjanIssueListFiltersParam.optional()
})

export const KerjanSearchIssues = z.object({
  workspaceCode: requiredString('Workspace code is required'),
  query: requiredString('Search text is required'),
  filters: KerjanIssueListFiltersParam.omit({ query: true }).optional()
})

export const KerjanTicketKey = z.object({
  key: requiredString('Ticket key is required')
})

export const KerjanSetStatus = z.object({
  key: requiredString('Ticket key is required'),
  status: z.enum(KERJAN_TASK_STATUSES),
  comment: OptionalPlainString
})

export const KerjanAddComment = z.object({
  key: requiredString('Ticket key is required'),
  body: requiredString('Comment body is required')
})

export const KerjanSetAssignee = z.object({
  key: requiredString('Ticket key is required'),
  assigneeId: z.union([KerjanIdParam, z.null()])
})

export const KerjanUpdateIssue = z.object({
  key: requiredString('Ticket key is required'),
  updates: z
    .object({
      title: OptionalString,
      description: OptionalPlainString
    })
    .refine((updates) => updates.title !== undefined || updates.description !== undefined, {
      message: 'Pass a title or description to update'
    })
})
