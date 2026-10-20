import { applyKerjanClientFilters } from '../../shared/kerjan-issue-query'
import { normalizeKerjanTicketKey } from '../../shared/kerjan-ticket-url'
import type {
  KerjanIssue,
  KerjanIssueDetail,
  KerjanIssueListFilters,
  KerjanMember,
  KerjanProduct,
  KerjanSprint,
  KerjanWorkspace
} from '../../shared/kerjan-types'
import { KerjanApiError, kerjanRequest } from './authenticated-request'
import { clearOnAuthError, getClient, type KerjanClient } from './client'
import {
  mapKerjanMembers,
  mapKerjanProducts,
  mapKerjanSprints,
  mapKerjanWorkspaces
} from './kerjan-lookup-mapping'
import {
  mapKerjanTicketDetail,
  mapKerjanTickets,
  type KerjanMappingContext
} from './kerjan-ticket-mapping'

/** Runs one read against the saved connection, dropping a token Kerjan rejected. */
export async function withKerjanClient<T>(run: (client: KerjanClient) => Promise<T>): Promise<T> {
  const client = getClient()
  try {
    return await run(client)
  } catch (error) {
    clearOnAuthError(error)
    throw error
  }
}

export function requireKerjanWorkspaceCode(value: string): string {
  const code = value.trim().toUpperCase()
  if (!/^[A-Z]{2,10}$/.test(code)) {
    throw new KerjanApiError('Kerjan workspace code must be 2-10 letters.')
  }
  return code
}

/** Single-ticket routes are scoped by the workspace the key's prefix names. */
export function requireKerjanTicketKey(value: string): { key: string; workspaceCode: string } {
  const key = normalizeKerjanTicketKey(value)
  if (!key) {
    throw new KerjanApiError(`"${value}" is not a Kerjan ticket key (e.g. OMX-40).`)
  }
  return { key, workspaceCode: key.slice(0, key.lastIndexOf('-')) }
}

export function listWorkspaces(): Promise<KerjanWorkspace[]> {
  return withKerjanClient(async (client) =>
    mapKerjanWorkspaces(await kerjanRequest(client, '/workspaces'))
  )
}

export function listSprints(workspaceCode: string): Promise<KerjanSprint[]> {
  const code = requireKerjanWorkspaceCode(workspaceCode)
  return withKerjanClient(async (client) =>
    mapKerjanSprints(await kerjanRequest(client, '/sprints', { workspaceCode: code }))
  )
}

export function listProducts(workspaceCode: string): Promise<KerjanProduct[]> {
  const code = requireKerjanWorkspaceCode(workspaceCode)
  return withKerjanClient(async (client) =>
    mapKerjanProducts(await kerjanRequest(client, '/products', { workspaceCode: code }))
  )
}

export function listMembers(workspaceCode?: string): Promise<KerjanMember[]> {
  const code = workspaceCode ? requireKerjanWorkspaceCode(workspaceCode) : null
  return withKerjanClient(async (client) =>
    mapKerjanMembers(await kerjanRequest(client, '/members', { workspaceCode: code }))
  )
}

async function settledLookup<T>(read: Promise<T[]>): Promise<T[]> {
  // Why tolerate: names are decoration; a lookup failure must not hide the tickets themselves.
  try {
    return await read
  } catch (error) {
    clearOnAuthError(error)
    return []
  }
}

export async function loadKerjanMappingContext(
  client: KerjanClient,
  workspaceCode: string,
  options: { products?: boolean } = {}
): Promise<KerjanMappingContext> {
  const scoped = { workspaceCode }
  const [members, sprints, products] = await Promise.all([
    settledLookup(kerjanRequest(client, '/members', scoped).then(mapKerjanMembers)),
    settledLookup(kerjanRequest(client, '/sprints', scoped).then(mapKerjanSprints)),
    options.products
      ? settledLookup(kerjanRequest(client, '/products', scoped).then(mapKerjanProducts))
      : Promise.resolve([])
  ])
  return {
    baseUrl: client.baseUrl,
    workspaceCode,
    members: new Map(members.map((member) => [member.id, member])),
    sprints: new Map(sprints.map((sprint) => [sprint.id, sprint])),
    products: new Map(products.map((product) => [product.id, product]))
  }
}

export function listIssues(
  workspaceCode: string,
  filters: KerjanIssueListFilters = {}
): Promise<KerjanIssue[]> {
  const code = requireKerjanWorkspaceCode(workspaceCode)
  return withKerjanClient(async (client) => {
    const [tickets, context] = await Promise.all([
      kerjanRequest(client, '/tickets', {
        workspaceCode: code,
        query: {
          kind: filters.kind,
          status: filters.status,
          task_type: filters.taskType,
          assignee_id: filters.assigneeId,
          sprint_id: filters.sprintId,
          epic_id: filters.epicId,
          product_id: filters.productId,
          backlog: filters.backlog
        }
      }),
      loadKerjanMappingContext(client, code)
    ])
    return applyKerjanClientFilters(mapKerjanTickets(tickets, context), filters)
  })
}

export function searchIssues(
  workspaceCode: string,
  query: string,
  filters: Omit<KerjanIssueListFilters, 'query'> = {}
): Promise<KerjanIssue[]> {
  return listIssues(workspaceCode, { ...filters, query })
}

export function getIssue(key: string): Promise<KerjanIssueDetail | null> {
  const ticket = requireKerjanTicketKey(key)
  return withKerjanClient(async (client) => {
    const [detail, context] = await Promise.all([
      kerjanRequest(client, `/tickets/${encodeURIComponent(ticket.key)}`, {
        workspaceCode: ticket.workspaceCode
      }).catch((error: unknown) => {
        if (error instanceof KerjanApiError && error.status === 404) {
          return null
        }
        throw error
      }),
      loadKerjanMappingContext(client, ticket.workspaceCode, { products: true })
    ])
    return detail === null ? null : mapKerjanTicketDetail(detail, context)
  })
}
