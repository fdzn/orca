// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JiraSetupSteps, KerjanSetupSteps } from './TaskSourceSimpleSetup'

const mocks = vi.hoisted(() => ({
  dialogOpen: new Array<boolean>(),
  kerjanDialogOpen: new Array<boolean>()
}))

vi.mock('@/components/jira-connect-dialog', () => ({
  JiraConnectDialog: ({ open }: { open: boolean }) => {
    mocks.dialogOpen.push(open)
    return null
  }
}))

vi.mock('@/components/kerjan-connect-dialog', () => ({
  KerjanConnectDialog: ({ open, onConnected }: { open: boolean; onConnected?: () => void }) => {
    mocks.kerjanDialogOpen.push(open)
    return open ? (
      <button type="button" onClick={onConnected}>
        Simulate Kerjan connected
      </button>
    ) : null
  }
}))

afterEach(() => {
  cleanup()
  mocks.dialogOpen = []
  mocks.kerjanDialogOpen = []
})

describe('JiraSetupSteps', () => {
  it('routes connected credential management to Integrations', () => {
    const onOpenIntegrations = vi.fn()
    const rendered = render(
      <JiraSetupSteps
        connected
        checking={false}
        visible
        canHide
        onToggleVisible={vi.fn()}
        onConnected={vi.fn()}
        onOpenIntegrations={onOpenIntegrations}
      />
    )

    fireEvent.click(rendered.getByRole('button', { name: 'Manage keys' }))

    expect(onOpenIntegrations).toHaveBeenCalledOnce()
    expect(mocks.dialogOpen.at(-1)).toBe(false)
  })
})

describe('KerjanSetupSteps', () => {
  it('opens the Kerjan connect dialog when not connected and reports the connection', () => {
    const onConnected = vi.fn()
    const onOpenIntegrations = vi.fn()
    const rendered = render(
      <KerjanSetupSteps
        connected={false}
        checking={false}
        visible
        canHide
        onToggleVisible={vi.fn()}
        onConnected={onConnected}
        onOpenIntegrations={onOpenIntegrations}
      />
    )

    expect(rendered.getByText('Connect Kerjan')).toBeTruthy()
    fireEvent.click(rendered.getByRole('button', { name: 'Add Kerjan access' }))
    expect(mocks.kerjanDialogOpen.at(-1)).toBe(true)
    fireEvent.click(rendered.getByRole('button', { name: 'Simulate Kerjan connected' }))

    expect(onConnected).toHaveBeenCalledOnce()
    expect(onOpenIntegrations).not.toHaveBeenCalled()
    expect(mocks.dialogOpen).toEqual([])
  })

  it('routes connected token management to Integrations', () => {
    const onOpenIntegrations = vi.fn()
    const rendered = render(
      <KerjanSetupSteps
        connected
        checking={false}
        visible
        canHide
        onToggleVisible={vi.fn()}
        onConnected={vi.fn()}
        onOpenIntegrations={onOpenIntegrations}
      />
    )

    fireEvent.click(rendered.getByRole('button', { name: 'Manage token' }))

    expect(onOpenIntegrations).toHaveBeenCalledOnce()
    expect(mocks.kerjanDialogOpen.at(-1)).toBe(false)
  })
})
