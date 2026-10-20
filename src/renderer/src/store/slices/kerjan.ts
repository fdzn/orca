import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import { DISCONNECTED_KERJAN_STATUS } from '@/runtime/runtime-kerjan-connection-status'
import { createKerjanConnectionActions } from './kerjan-connection-actions'
import { createKerjanIssueMutationActions } from './kerjan-issue-mutation-actions'
import { createKerjanReadActions } from './kerjan-read-actions'
import { EMPTY_KERJAN_READ_CACHES } from './kerjan-read-coordination'
import type { KerjanSlice } from './kerjan-slice-contract'

export type { KerjanSlice } from './kerjan-slice-contract'

export const createKerjanSlice: StateCreator<AppState, [], [], KerjanSlice> = (set, get) => ({
  kerjanStatus: DISCONNECTED_KERJAN_STATUS,
  kerjanStatusChecked: false,
  kerjanStatusContextKey: null,
  kerjanSelectedWorkspaceCode: null,
  ...EMPTY_KERJAN_READ_CACHES,
  ...createKerjanConnectionActions(set, get),
  ...createKerjanReadActions(set, get),
  ...createKerjanIssueMutationActions(set, get)
})
