// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KerjanConnectDialog } from './kerjan-connect-dialog'

const mocks = vi.hoisted(() => {
  const settings: { activeRuntimeEnvironmentId: string | null } = {
    activeRuntimeEnvironmentId: null
  }
  return { connectKerjan: vi.fn(), openUrl: vi.fn(), settings }
})

vi.mock('@/store', () => ({
  useAppStore: (
    selector: (state: {
      connectKerjan: typeof mocks.connectKerjan
      settings: typeof mocks.settings
    }) => unknown
  ) => selector({ connectKerjan: mocks.connectKerjan, settings: mocks.settings })
}))

const VIEWER = {
  id: 'member-1',
  name: 'Ayu Lestari',
  email: 'ayu@example.test'
}

beforeEach(() => {
  mocks.connectKerjan.mockReset().mockResolvedValue({ ok: true, viewer: VIEWER })
  mocks.openUrl.mockReset()
  mocks.settings.activeRuntimeEnvironmentId = null
  vi.stubGlobal('api', { shell: { openUrl: mocks.openUrl } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function fill(baseUrl: string, token: string): void {
  fireEvent.change(screen.getByLabelText('Kerjan site URL'), { target: { value: baseUrl } })
  fireEvent.change(screen.getByLabelText('Personal token'), { target: { value: token } })
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
  })
}

describe('KerjanConnectDialog', () => {
  it('explains how to create a personal token', () => {
    render(<KerjanConnectDialog open onOpenChange={vi.fn()} />)

    expect(screen.getByText('In Kerjan, open Account, then Your tokens.')).toBeTruthy()
    expect(screen.getByText(/authenticator app/)).toBeTruthy()
    expect(screen.getByText(/starts with kjt_/)).toBeTruthy()
    expect(screen.getByText(/expires after 90 days/)).toBeTruthy()
    expect(screen.getByLabelText('Personal token').getAttribute('type')).toBe('password')
  })

  it('rejects a URL the shared normalizer refuses without calling Kerjan', async () => {
    render(<KerjanConnectDialog open onOpenChange={vi.fn()} />)
    fill('kerjan.example.test', 'kjt_secret')

    await submit()

    expect(mocks.connectKerjan).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Kerjan site URL').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/starts with http:\/\/ or https:\/\//)).toBeTruthy()
  })

  it('sends the normalized URL and trimmed token, then closes', async () => {
    const onOpenChange = vi.fn()
    const onConnected = vi.fn()
    render(<KerjanConnectDialog open onOpenChange={onOpenChange} onConnected={onConnected} />)
    fill(' https://kerjan.example.test/app/ ', '  kjt_secret  ')

    await submit()

    expect(mocks.connectKerjan).toHaveBeenCalledWith({
      baseUrl: 'https://kerjan.example.test/app',
      token: 'kjt_secret'
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConnected).toHaveBeenCalledOnce()
  })

  it('shows the Kerjan error verbatim and stays open', async () => {
    mocks.connectKerjan.mockResolvedValue({
      ok: false,
      error: 'Personal token has expired (SPEC #7)'
    })
    const onOpenChange = vi.fn()
    render(<KerjanConnectDialog open onOpenChange={onOpenChange} />)
    fill('https://kerjan.example.test', 'kjt_old')

    await submit()

    expect(screen.getByRole('alert').textContent).toBe('Personal token has expired (SPEC #7)')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('prefills the site on reconnect, links to it, and clears the token on reopen', () => {
    const view = render(
      <KerjanConnectDialog
        open
        onOpenChange={vi.fn()}
        initialBaseUrl="https://kerjan.example.test"
      />
    )
    expect(screen.getByLabelText('Kerjan site URL')).toHaveProperty(
      'value',
      'https://kerjan.example.test'
    )
    fireEvent.change(screen.getByLabelText('Personal token'), { target: { value: 'kjt_typed' } })

    fireEvent.click(screen.getByRole('button', { name: 'Open Kerjan' }))
    expect(mocks.openUrl).toHaveBeenCalledWith('https://kerjan.example.test')

    view.rerender(
      <KerjanConnectDialog
        open={false}
        onOpenChange={vi.fn()}
        initialBaseUrl="https://kerjan.example.test"
      />
    )
    view.rerender(
      <KerjanConnectDialog
        open
        onOpenChange={vi.fn()}
        initialBaseUrl="https://kerjan.example.test"
      />
    )
    expect(screen.getByLabelText('Personal token')).toHaveProperty('value', '')
  })

  it('names the remote runtime as the token owner when one is active', () => {
    mocks.settings.activeRuntimeEnvironmentId = 'runtime-1'
    render(<KerjanConnectDialog open onOpenChange={vi.fn()} />)

    expect(screen.getByText(/sent to the selected remote runtime/)).toBeTruthy()
  })
})
