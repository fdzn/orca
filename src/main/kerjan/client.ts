import { normalizeKerjanBaseUrl } from '../../shared/kerjan-ticket-url'
import type {
  KerjanConnectArgs,
  KerjanConnectResult,
  KerjanConnectionStatus,
  KerjanMember
} from '../../shared/kerjan-types'
import { KerjanApiError, kerjanRequest, type KerjanCredentials } from './authenticated-request'
import {
  clearKerjanConnection,
  getKerjanCredentialError,
  getKerjanTokenProtection,
  getStoredKerjanConnection,
  readKerjanToken,
  saveKerjanConnection
} from './credential-store'
import { asKerjanRecord, mapKerjanMember } from './kerjan-lookup-mapping'

export type KerjanClient = KerjanCredentials & { member: KerjanMember }

export const KERJAN_NOT_CONNECTED_MESSAGE = 'Not connected to Kerjan.'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

async function fetchViewer(credentials: KerjanCredentials): Promise<KerjanMember> {
  const record = asKerjanRecord(await kerjanRequest(credentials, '/auth/me'))
  const member = record ? mapKerjanMember(record) : null
  if (!member) {
    throw new KerjanApiError('Kerjan did not return the signed-in member.')
  }
  return member
}

/** Never decrypts, so Settings and status polls cannot trigger a keychain prompt. */
export function getStatus(): KerjanConnectionStatus {
  const connection = getStoredKerjanConnection()
  const credentialError = connection ? getKerjanCredentialError() : undefined
  return {
    connected: connection !== null,
    siteUrl: connection?.baseUrl ?? null,
    viewer: connection?.member ?? null,
    ...(credentialError ? { credentialError } : {}),
    credentialProtection: connection ? getKerjanTokenProtection() : null
  }
}

/** Throws when disconnected or when the saved token cannot be decrypted. */
export function getClient(): KerjanClient {
  const connection = getStoredKerjanConnection()
  const token = connection ? readKerjanToken() : null
  if (!connection || !token) {
    throw new KerjanApiError(KERJAN_NOT_CONNECTED_MESSAGE)
  }
  return { baseUrl: connection.baseUrl, token, member: connection.member }
}

export async function connect(args: KerjanConnectArgs): Promise<KerjanConnectResult> {
  const baseUrl = normalizeKerjanBaseUrl(args.baseUrl)
  if (!baseUrl) {
    return { ok: false, error: 'Enter a valid Kerjan URL (http:// or https://).' }
  }
  const token = args.token.trim()
  if (!token) {
    return { ok: false, error: 'Personal access token is required.' }
  }
  try {
    const viewer = await fetchViewer({ baseUrl, token })
    saveKerjanConnection({ baseUrl, member: viewer, token })
    return { ok: true, viewer }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Connection failed.') }
  }
}

export function disconnect(): void {
  clearKerjanConnection()
}

export async function testConnection(): Promise<KerjanConnectResult> {
  let client: KerjanClient
  try {
    client = getClient()
  } catch (error) {
    return { ok: false, error: errorMessage(error, KERJAN_NOT_CONNECTED_MESSAGE) }
  }
  try {
    return { ok: true, viewer: await fetchViewer(client) }
  } catch (error) {
    clearOnAuthError(error)
    return { ok: false, error: errorMessage(error, 'Connection failed.') }
  }
}

// Why 401 only: 403 means "not a member of this workspace", not a dead token.
export function isAuthError(error: unknown): boolean {
  return error instanceof KerjanApiError && error.status === 401
}

/** Personal tokens expire after 90 days; drop a rejected one so status shows reconnect. */
export function clearOnAuthError(error: unknown): void {
  if (isAuthError(error)) {
    clearKerjanConnection()
  }
}
