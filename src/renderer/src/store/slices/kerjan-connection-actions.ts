import { shallow } from 'zustand/shallow'
import type { KerjanConnectionStatus } from '../../../../shared/kerjan-types'
import { defaultScopeSource } from '@/lib/default-creation-host'
import { translate } from '@/i18n/i18n'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import {
  kerjanConnect,
  kerjanDisconnect,
  kerjanStatus,
  kerjanTestConnection
} from '@/runtime/runtime-kerjan-client'
import { DISCONNECTED_KERJAN_STATUS } from '@/runtime/runtime-kerjan-connection-status'
import type { AppState } from '../types'
import type { KerjanSlice, KerjanSliceGet, KerjanSliceSet } from './kerjan-slice-contract'
import {
  beginKerjanConnectionChange,
  currentKerjanConnectionGeneration,
  EMPTY_KERJAN_READ_CACHES,
  isCurrentKerjanRuntimeContext
} from './kerjan-read-coordination'

type KerjanConnectionActions = Pick<
  KerjanSlice,
  | 'checkKerjanConnection'
  | 'connectKerjan'
  | 'testKerjanConnection'
  | 'disconnectKerjan'
  | 'setKerjanSelectedWorkspaceCode'
>

let kerjanStatusReadGeneration = 0

function hasKerjanStatusChanged(
  previous: KerjanConnectionStatus,
  next: KerjanConnectionStatus
): boolean {
  return (
    previous.connected !== next.connected ||
    previous.siteUrl !== next.siteUrl ||
    previous.credentialError !== next.credentialError ||
    previous.credentialProtection !== next.credentialProtection ||
    !shallow(previous.viewer, next.viewer)
  )
}

function kerjanStatusUpdate(
  state: AppState,
  contextKey: string,
  status: KerjanConnectionStatus
): Partial<KerjanSlice> {
  // Why drop caches on a new site/account: cached reads belong to the previous connection.
  // A runtime switch needs no drop because cache keys carry the runtime context.
  const connectionChanged =
    state.kerjanStatusContextKey === contextKey &&
    (state.kerjanStatus.siteUrl !== status.siteUrl ||
      state.kerjanStatus.viewer?.id !== status.viewer?.id)
  return {
    kerjanStatus: status,
    kerjanStatusChecked: true,
    kerjanStatusContextKey: contextKey,
    ...(connectionChanged ? EMPTY_KERJAN_READ_CACHES : {}),
    ...(connectionChanged && !status.connected ? { kerjanSelectedWorkspaceCode: null } : {})
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function createKerjanConnectionActions(
  set: KerjanSliceSet,
  get: KerjanSliceGet
): KerjanConnectionActions {
  // Re-reads status after a connection change; skipped once the runtime or request moved on.
  const refreshStatusAfter = async (generation: number, contextKey: string): Promise<void> => {
    const status = await kerjanStatus(defaultScopeSource(get().settings))
    if (
      generation === currentKerjanConnectionGeneration() &&
      isCurrentKerjanRuntimeContext(contextKey, get().settings)
    ) {
      set((state) => kerjanStatusUpdate(state, contextKey, status))
    }
  }

  return {
    checkKerjanConnection: async () => {
      const contextKey = getProviderRuntimeContextKey(get().settings)
      const readGeneration = ++kerjanStatusReadGeneration
      const connectionGeneration = currentKerjanConnectionGeneration()
      if (get().kerjanStatusContextKey !== contextKey) {
        set({ kerjanStatusChecked: false })
      }
      let status: KerjanConnectionStatus
      try {
        status = await kerjanStatus(defaultScopeSource(get().settings))
      } catch {
        status = DISCONNECTED_KERJAN_STATUS
      }
      if (
        readGeneration !== kerjanStatusReadGeneration ||
        connectionGeneration !== currentKerjanConnectionGeneration() ||
        !isCurrentKerjanRuntimeContext(contextKey, get().settings)
      ) {
        return
      }
      if (
        get().kerjanStatusContextKey !== contextKey ||
        hasKerjanStatusChanged(get().kerjanStatus, status)
      ) {
        set((state) => kerjanStatusUpdate(state, contextKey, status))
      } else if (!get().kerjanStatusChecked) {
        set({ kerjanStatusChecked: true })
      }
    },

    connectKerjan: async (args) => {
      const generation = beginKerjanConnectionChange()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      try {
        const result = await kerjanConnect(defaultScopeSource(get().settings), args)
        if (!result.ok) {
          return result
        }
        if (
          generation !== currentKerjanConnectionGeneration() ||
          !isCurrentKerjanRuntimeContext(contextKey, get().settings)
        ) {
          return {
            ok: false,
            error: translate(
              'auto.store.slices.kerjan.connectSuperseded',
              'Kerjan connection was superseded by a newer request.'
            )
          }
        }
        set((state) => ({
          ...kerjanStatusUpdate(state, contextKey, {
            ...DISCONNECTED_KERJAN_STATUS,
            connected: true,
            viewer: result.viewer
          }),
          ...EMPTY_KERJAN_READ_CACHES
        }))
        // Why: the connect reply carries the viewer only; status adds the site and protection.
        void refreshStatusAfter(generation, contextKey).catch(() => {})
        return result
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'Connection failed') }
      }
    },

    testKerjanConnection: async () => {
      const generation = beginKerjanConnectionChange()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      try {
        const result = await kerjanTestConnection(defaultScopeSource(get().settings))
        // Why refresh either way: a rejected token is dropped by main, so status flips to reconnect.
        await refreshStatusAfter(generation, contextKey)
        return result
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'Test failed') }
      }
    },

    disconnectKerjan: async () => {
      const generation = beginKerjanConnectionChange()
      const contextKey = getProviderRuntimeContextKey(get().settings)
      await kerjanDisconnect(defaultScopeSource(get().settings))
      if (
        generation !== currentKerjanConnectionGeneration() ||
        !isCurrentKerjanRuntimeContext(contextKey, get().settings)
      ) {
        return
      }
      set((state) => ({
        ...kerjanStatusUpdate(state, contextKey, DISCONNECTED_KERJAN_STATUS),
        ...EMPTY_KERJAN_READ_CACHES,
        kerjanSelectedWorkspaceCode: null
      }))
    },

    setKerjanSelectedWorkspaceCode: (workspaceCode) => {
      const code = workspaceCode?.trim().toUpperCase() || null
      if (get().kerjanSelectedWorkspaceCode !== code) {
        set({ kerjanSelectedWorkspaceCode: code })
      }
    }
  }
}
