import type { KerjanConnectionStatus, KerjanIssueDetail } from '../shared/kerjan-types'
import {
  normalizeKerjanBaseUrl,
  normalizeKerjanTicketKey,
  parseKerjanTicketUrl
} from '../shared/kerjan-ticket-url'
import { RuntimeClientError, type RuntimeClient, type RuntimeRpcSuccess } from './runtime-client'

// Why: matches KERJAN_NOT_CONNECTED_MESSAGE, which the host flattens into a runtime_error.
const KERJAN_NOT_CONNECTED = 'Not connected to Kerjan.'
const KERJAN_CONNECT_HINT =
  'Connect in Orca Settings or with orca kerjan connection connect --url <base> --token-stdin.'

export function kerjanNotConnectedError(): RuntimeClientError {
  return new RuntimeClientError(
    'kerjan_not_connected',
    `${KERJAN_NOT_CONNECTED} ${KERJAN_CONNECT_HINT}`
  )
}

/** Calls a `kerjan.*` method, naming version gaps and a missing connection plainly. */
export async function callKerjan<T>(
  client: RuntimeClient,
  method: string,
  params?: unknown
): Promise<RuntimeRpcSuccess<T>> {
  try {
    return params === undefined
      ? await client.call<T>(method)
      : await client.call<T>(method, params)
  } catch (error) {
    if (error instanceof RuntimeClientError && error.code === 'method_not_found') {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This Orca host does not support Kerjan yet. Update Orca on the execution host.'
      )
    }
    if (error instanceof RuntimeClientError && error.message.includes(KERJAN_NOT_CONNECTED)) {
      throw kerjanNotConnectedError()
    }
    throw error
  }
}

export async function getConnectedKerjanStatus(
  client: RuntimeClient
): Promise<KerjanConnectionStatus & { siteUrl: string }> {
  const { result: status } = await callKerjan<KerjanConnectionStatus>(client, 'kerjan.status')
  if (status.credentialError) {
    throw new RuntimeClientError('kerjan_credentials_unavailable', status.credentialError)
  }
  const siteUrl = status.siteUrl ? normalizeKerjanBaseUrl(status.siteUrl) : null
  if (!status.connected || !siteUrl) {
    throw kerjanNotConnectedError()
  }
  return { ...status, siteUrl }
}

export async function getKerjanViewerId(client: RuntimeClient): Promise<string> {
  const { viewer } = await getConnectedKerjanStatus(client)
  if (!viewer) {
    throw new RuntimeClientError(
      'kerjan_viewer_unavailable',
      'The Kerjan connection has no signed-in member. Run orca kerjan connection test.'
    )
  }
  return viewer.id
}

/** Accepts `OMX-40` or a `<site>/ticket/OMX-40` URL on the connected site. */
export async function resolveKerjanTicketKey(
  client: RuntimeClient,
  input: string
): Promise<string> {
  const key = normalizeKerjanTicketKey(input)
  if (key) {
    return key
  }
  const parsed = parseKerjanTicketUrl(input)
  if (!parsed) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Expected a Kerjan ticket key (e.g. OMX-40) or a Kerjan ticket URL.'
    )
  }
  // Why: one saved site; a URL from another Kerjan must not silently read a same-key ticket here.
  const { siteUrl } = await getConnectedKerjanStatus(client)
  if (`${parsed.origin}${parsed.basePath}` !== siteUrl) {
    throw new RuntimeClientError(
      'invalid_argument',
      `That ticket URL is not on the connected Kerjan site (${siteUrl}).`
    )
  }
  return parsed.ticketKey
}

export async function readKerjanTicket(
  client: RuntimeClient,
  input: string
): Promise<RuntimeRpcSuccess<KerjanIssueDetail>> {
  const key = await resolveKerjanTicketKey(client, input)
  const response = await callKerjan<KerjanIssueDetail | null>(client, 'kerjan.getIssue', { key })
  const issue = response.result
  if (!issue || issue.key.toUpperCase() !== key) {
    throw new RuntimeClientError(
      'kerjan_ticket_unavailable',
      `Kerjan did not return ticket ${key}. Check the key and your access to its workspace.`
    )
  }
  return { ...response, result: issue }
}
