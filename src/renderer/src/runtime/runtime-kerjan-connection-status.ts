import type { KerjanConnectionStatus, KerjanMember } from '../../../shared/kerjan-types'
import type { SecretAtRestProtection } from '../../../shared/secret-at-rest-protection'

// Coverage record: tsc fails when the shared union gains or loses an arm.
const SECRET_AT_REST_PROTECTIONS = { sealed: true, plaintext: true } as const satisfies Readonly<
  Record<SecretAtRestProtection, true>
>

// Every key must be listed, so a newly added status field cannot be dropped silently.
type EveryKey<T> = { [K in keyof Required<T>]: T[K] }

export const DISCONNECTED_KERJAN_STATUS: KerjanConnectionStatus = {
  connected: false,
  siteUrl: null,
  viewer: null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSecretAtRestProtection(value: unknown): value is SecretAtRestProtection {
  return typeof value === 'string' && Object.hasOwn(SECRET_AT_REST_PROTECTIONS, value)
}

export function parseKerjanMember(value: unknown): KerjanMember | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null
  }
  const member: EveryKey<KerjanMember> = {
    id: value.id,
    name: value.name,
    email: typeof value.email === 'string' ? value.email : null,
    active: typeof value.active === 'boolean' ? value.active : undefined
  }
  return member
}

// Why: the web client's fallback answers undefined, and another host version may send odd fields.
export function parseKerjanConnectionStatus(value: unknown): KerjanConnectionStatus {
  if (!isRecord(value) || typeof value.connected !== 'boolean') {
    return DISCONNECTED_KERJAN_STATUS
  }
  const status: EveryKey<KerjanConnectionStatus> = {
    connected: value.connected,
    siteUrl: typeof value.siteUrl === 'string' ? value.siteUrl : null,
    viewer: parseKerjanMember(value.viewer),
    credentialError: typeof value.credentialError === 'string' ? value.credentialError : undefined,
    credentialProtection:
      value.credentialProtection === null || isSecretAtRestProtection(value.credentialProtection)
        ? value.credentialProtection
        : undefined
  }
  return status
}
