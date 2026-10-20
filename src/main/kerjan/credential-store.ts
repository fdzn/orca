import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeCredentialFileAtomic, writeEncryptedCredential } from '../integration-credential-file'
import { readCredentialFileProtection } from '../credential-file-protection'
import { createIntegrationStateFileCache } from '../integration-state-file-cache'
import { createIntegrationTokenFileCache } from '../integration-token-file-cache'
import { normalizeKerjanBaseUrl } from '../../shared/kerjan-ticket-url'
import type { KerjanMember } from '../../shared/kerjan-types'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'

// Why split: status reads render the connected site and member from plaintext
// metadata, so opening Settings never triggers an OS keychain prompt.
export type KerjanStoredConnection = {
  version: 1
  baseUrl: string
  member: KerjanMember
  updatedAt: string
}

// Single connection; the cache API is keyed, so it gets one fixed id.
const TOKEN_ID = 'default'

const connectionFileCache = createIntegrationStateFileCache({
  filePath: getConnectionPath,
  readFromDisk: readConnectionFromDisk
})
const tokenFileCache = createIntegrationTokenFileCache({
  service: 'Kerjan',
  filePath: getKerjanTokenPath
})

function getOrcaDir(): string {
  return join(homedir(), '.orca')
}

function getConnectionPath(): string {
  return join(getOrcaDir(), 'kerjan-connection.json')
}

export function getKerjanTokenPath(): string {
  return join(getOrcaDir(), 'kerjan-token.enc')
}

function ensureOrcaDir(): void {
  const dir = getOrcaDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// Why narrowed field by field: hand-edited JSON must not put a non-URL into a request target.
function readConnectionFromDisk(): KerjanStoredConnection | null {
  const path = getConnectionPath()
  if (!existsSync(path)) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const record: Record<string, unknown> = Object.fromEntries(Object.entries(parsed))
    const baseUrl = normalizeKerjanBaseUrl(asString(record.baseUrl) ?? '')
    const member =
      record.member && typeof record.member === 'object'
        ? Object.fromEntries(Object.entries(record.member))
        : null
    const memberId = asString(member?.id)
    if (!baseUrl || !member || !memberId) {
      return null
    }
    return {
      version: 1,
      baseUrl,
      member: {
        id: memberId,
        name: asString(member.name) ?? memberId,
        email: asString(member.email)
      },
      updatedAt: asString(record.updatedAt) ?? ''
    }
  } catch {
    return null
  }
}

/** Saved site + member, only while a token is also stored. Never decrypts. */
export function getStoredKerjanConnection(): KerjanStoredConnection | null {
  const connection = connectionFileCache.get()
  return connection && tokenFileCache.has(TOKEN_ID) ? connection : null
}

/** Decrypts the saved token; throws CredentialDecryptionError when the keychain refuses. */
export function readKerjanToken(): string | null {
  return tokenFileCache.read(TOKEN_ID)
}

export function getKerjanCredentialError(): string | undefined {
  return tokenFileCache.error(TOKEN_ID)
}

export function getKerjanTokenProtection(): SecretAtRestProtection | null {
  return readCredentialFileProtection(getKerjanTokenPath())
}

export function saveKerjanConnection(input: {
  baseUrl: string
  member: KerjanMember
  token: string
}): KerjanStoredConnection {
  ensureOrcaDir()
  // Token first: a torn write can only leave stale display metadata, never a new site with an old token.
  writeEncryptedCredential('Kerjan', getKerjanTokenPath(), input.token)
  tokenFileCache.forget(TOKEN_ID)
  const connection: KerjanStoredConnection = {
    version: 1,
    baseUrl: input.baseUrl,
    member: { id: input.member.id, name: input.member.name, email: input.member.email },
    updatedAt: new Date().toISOString()
  }
  writeCredentialFileAtomic(
    getConnectionPath(),
    Buffer.from(JSON.stringify(connection, null, 2), 'utf-8')
  )
  connectionFileCache.invalidate()
  return connection
}

// Why rethrow non-ENOENT: swallowing it would clear memory while the files survive the next launch.
export function clearKerjanConnection(): void {
  try {
    for (const path of [getKerjanTokenPath(), getConnectionPath()]) {
      try {
        unlinkSync(path)
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
          throw error
        }
      }
    }
  } finally {
    tokenFileCache.forget(TOKEN_ID)
    connectionFileCache.invalidate()
  }
}
