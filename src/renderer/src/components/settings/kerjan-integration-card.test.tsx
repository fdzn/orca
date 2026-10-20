// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KerjanConnectResult, KerjanConnectionStatus } from '../../../../shared/kerjan-types'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { KerjanIntegrationCard } from './kerjan-integration-card'

type StoreState = {
  kerjanStatus: KerjanConnectionStatus
  kerjanStatusChecked: boolean
  kerjanStatusContextKey: string | null
  checkKerjanConnection: () => Promise<void>
  disconnectKerjan: () => Promise<void>
  testKerjanConnection: () => Promise<KerjanConnectResult>
  settings: { activeRuntimeEnvironmentId: string | null }
  openSettingsPage: () => void
  openSettingsTarget: (target: unknown) => void
}

type DialogProps = { open: boolean; initialBaseUrl?: string | null }

const mocks = vi.hoisted(() => {
  const store: { current: StoreState | null } = { current: null }
  return { store, dialogProps: new Array<DialogProps>() }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => {
    if (!mocks.store.current) {
      throw new Error('Store state was not installed')
    }
    return selector(mocks.store.current)
  }
}))

vi.mock('@/components/kerjan-connect-dialog', () => ({
  KerjanConnectDialog: (props: { open: boolean; initialBaseUrl?: string | null }) => {
    mocks.dialogProps.push(props)
    return null
  }
}))

const SITE_URL = 'https://kerjan.example.test'
const VIEWER = {
  id: 'member-1',
  name: 'Ayu Lestari',
  email: 'ayu@example.test'
}

function connectedStatus(overrides: Partial<KerjanConnectionStatus> = {}): KerjanConnectionStatus {
  return { connected: true, siteUrl: SITE_URL, viewer: VIEWER, ...overrides }
}

function installStore(status: KerjanConnectionStatus): StoreState {
  const settings = { activeRuntimeEnvironmentId: null }
  const state: StoreState = {
    kerjanStatus: status,
    kerjanStatusChecked: true,
    kerjanStatusContextKey: getProviderRuntimeContextKey(settings),
    checkKerjanConnection: vi.fn(async () => {}),
    disconnectKerjan: vi.fn(async () => {}),
    testKerjanConnection: vi.fn(async (): Promise<KerjanConnectResult> => ({
      ok: true,
      viewer: VIEWER
    })),
    settings,
    openSettingsPage: vi.fn(),
    openSettingsTarget: vi.fn()
  }
  mocks.store.current = state
  return state
}

async function clickButton(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

beforeEach(() => {
  mocks.dialogProps = []
})

afterEach(() => {
  cleanup()
  mocks.store.current = null
})

describe('KerjanIntegrationCard', () => {
  it('shows the connected member, email, and site, and verifies on explicit test', async () => {
    const state = installStore(connectedStatus())
    const view = render(<KerjanIntegrationCard />)

    const card = view.container.querySelector('[data-settings-section="integrations-kerjan"]')
    expect(card?.textContent).toContain('Connected to kerjan.example.test')
    expect(card?.textContent).toContain('Ayu Lestari')
    expect(card?.textContent).toContain(`ayu@example.test · ${SITE_URL}`)
    expect(screen.getByRole('button', { name: 'Replace token' })).toBeTruthy()
    expect(state.testKerjanConnection).not.toHaveBeenCalled()

    await clickButton('Test connection')

    expect(state.testKerjanConnection).toHaveBeenCalledOnce()
    expect(card?.textContent).toContain('Verified')
  })

  it('keeps the connection and shows the error verbatim when a test fails for another reason', async () => {
    const state = installStore(connectedStatus())
    state.testKerjanConnection = vi.fn(async () => ({
      ok: false as const,
      error: 'Kerjan is unreachable (SPEC #4)'
    }))
    render(<KerjanIntegrationCard />)

    await clickButton('Test connection')

    expect(screen.getByText('Kerjan is unreachable (SPEC #4)')).toBeTruthy()
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it('asks to reconnect with the old site URL when Kerjan rejected the token', async () => {
    const state = installStore(connectedStatus())
    state.testKerjanConnection = vi.fn(async () => {
      // Main drops a 401 token, so the refreshed status arrives disconnected.
      state.kerjanStatus = { connected: false, siteUrl: null, viewer: null }
      return { ok: false as const, error: 'token expired' }
    })
    render(<KerjanIntegrationCard />)

    await clickButton('Test connection')

    expect(screen.getByText('Reconnect needed')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Kerjan rejected the saved token')
    expect(screen.getByText('token expired')).toBeTruthy()

    await clickButton('Reconnect')

    expect(mocks.dialogProps.at(-1)).toMatchObject({ open: true, initialBaseUrl: SITE_URL })
  })

  it('offers reconnect when the saved token cannot be decrypted', () => {
    installStore(connectedStatus({ credentialError: 'keychain locked' }))
    render(<KerjanIntegrationCard />)

    expect(screen.getByText('Reconnect needed')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('keychain locked')
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeTruthy()
  })

  it('disconnects and surfaces a failed credential removal', async () => {
    const state = installStore(connectedStatus())
    state.disconnectKerjan = vi.fn(async () => {
      throw new Error('EACCES: kerjan-token.enc')
    })
    render(<KerjanIntegrationCard />)

    await clickButton('Disconnect Kerjan')

    expect(state.disconnectKerjan).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert').textContent).toBe('EACCES: kerjan-token.enc')
  })

  it('offers Connect Kerjan with an empty site when nothing is stored', async () => {
    const state = installStore({
      connected: false,
      siteUrl: null,
      viewer: null
    })
    render(<KerjanIntegrationCard />)

    expect(screen.getByText('Not connected')).toBeTruthy()
    await clickButton('Re-check')
    expect(state.checkKerjanConnection).toHaveBeenCalledOnce()

    await clickButton('Connect Kerjan')
    expect(mocks.dialogProps.at(-1)).toMatchObject({ open: true, initialBaseUrl: null })
  })

  it('shows a spinner instead of actions while the status is for another runtime', () => {
    const state = installStore(connectedStatus())
    state.kerjanStatusContextKey = 'runtime:other#0'
    render(<KerjanIntegrationCard />)

    expect(screen.queryByRole('button', { name: 'Replace token' })).toBeNull()
    expect(screen.queryByText('Ayu Lestari')).toBeNull()
  })
})
