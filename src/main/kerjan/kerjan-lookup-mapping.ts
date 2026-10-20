import type {
  KerjanMember,
  KerjanProduct,
  KerjanSprint,
  KerjanWorkspace
} from '../../shared/kerjan-types'
import { KerjanApiError } from './authenticated-request'

export type KerjanRecord = Record<string, unknown>

export function asKerjanRecord(value: unknown): KerjanRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

export function asKerjanRecords(value: unknown, what: string): KerjanRecord[] {
  if (!Array.isArray(value)) {
    throw new KerjanApiError(`Kerjan returned an unexpected ${what} response.`)
  }
  return value.flatMap((entry) => {
    const record = asKerjanRecord(entry)
    return record ? [record] : []
  })
}

/** Kerjan ids may be numeric or string; both normalize to a trimmed string. */
export function kerjanId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function kerjanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return values.find((candidate) => candidate === value) ?? null
}

export function mapKerjanMember(raw: KerjanRecord): KerjanMember | null {
  const id = kerjanId(raw.id)
  if (!id) {
    return null
  }
  return {
    id,
    name: kerjanText(raw.name) ?? kerjanText(raw.email) ?? id,
    email: kerjanText(raw.email),
    ...(typeof raw.active === 'boolean' ? { active: raw.active } : {})
  }
}

export function mapKerjanMembers(value: unknown): KerjanMember[] {
  return asKerjanRecords(value, 'members').flatMap((raw) => mapKerjanMember(raw) ?? [])
}

export function mapKerjanWorkspaces(value: unknown): KerjanWorkspace[] {
  return asKerjanRecords(value, 'workspaces').flatMap((raw) => {
    const id = kerjanId(raw.id)
    const code = kerjanText(raw.code)?.trim().toUpperCase()
    if (!id || !code) {
      return []
    }
    const jiraProject = kerjanText(raw.jira_project)
    return [
      {
        id,
        code,
        name: kerjanText(raw.name) ?? code,
        kind: kerjanText(raw.kind),
        jiraProject,
        readOnly: jiraProject !== null
      }
    ]
  })
}

export function mapKerjanSprints(value: unknown): KerjanSprint[] {
  return asKerjanRecords(value, 'sprints').flatMap((raw) => {
    const id = kerjanId(raw.id)
    if (!id) {
      return []
    }
    return [
      {
        id,
        name: kerjanText(raw.name) ?? id,
        state: kerjanText(raw.state),
        category: kerjanText(raw.category),
        goal: kerjanText(raw.goal),
        startDate: kerjanText(raw.start_date),
        endDate: kerjanText(raw.end_date)
      }
    ]
  })
}

export function mapKerjanProducts(value: unknown): KerjanProduct[] {
  return asKerjanRecords(value, 'products').flatMap((raw) => {
    const id = kerjanId(raw.id)
    return id ? [{ id, name: kerjanText(raw.name) ?? id }] : []
  })
}
