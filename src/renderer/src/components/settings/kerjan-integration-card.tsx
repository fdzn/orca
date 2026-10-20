import { useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Unlink } from 'lucide-react'
import { KerjanConnectDialog } from '@/components/kerjan-connect-dialog'
import { KerjanIcon } from '@/components/icons/KerjanIcon'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import {
  getProviderRuntimeContextKey,
  hasRemoteProviderRuntime
} from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { useIntegrationSubordinateRowClass } from './integration-card-presentation'
import { getProviderAccountScope } from './provider-account-scope'
import { ProviderHostScopeControl } from './ProviderHostScopeControl'
import { KERJAN_INTEGRATION_SECTION_ID } from './task-provider-integration-section-ids'
import { UnsealedCredentialNotice } from './UnsealedCredentialNotice'
import { translate } from '@/i18n/i18n'

type TestResult = { state: 'ok' } | { state: 'error'; error: string; siteUrl: string | null }

function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host
  } catch {
    return siteUrl
  }
}

export function KerjanIntegrationCard(): React.JSX.Element {
  const kerjanStatus = useAppStore((s) => s.kerjanStatus)
  const kerjanStatusChecked = useAppStore((s) => s.kerjanStatusChecked)
  const kerjanStatusContextKey = useAppStore((s) => s.kerjanStatusContextKey)
  const checkKerjanConnection = useAppStore((s) => s.checkKerjanConnection)
  const disconnectKerjan = useAppStore((s) => s.disconnectKerjan)
  const testKerjanConnection = useAppStore((s) => s.testKerjanConnection)
  const settings = useAppStore((s) => s.settings)
  const mountedRef = useMountedRef()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)

  const contextMatches = kerjanStatusContextKey === getProviderRuntimeContextKey(settings)
  const checking = !contextMatches || !kerjanStatusChecked
  const connected = contextMatches && kerjanStatus.connected
  const siteUrl = connected ? kerjanStatus.siteUrl : null
  const viewer = connected ? kerjanStatus.viewer : null
  const credentialError = connected ? kerjanStatus.credentialError : undefined
  // Why: main drops a token Kerjan rejects (401), so a failed test that leaves us
  // disconnected means the token expired or was revoked.
  const tokenRejected = !checking && !connected && testResult?.state === 'error'
  const needsReconnect = Boolean(credentialError) || tokenRejected
  const reconnectBaseUrl = siteUrl ?? (testResult?.state === 'error' ? testResult.siteUrl : null)
  const accountScope = getProviderAccountScope(settings)
  const subordinateRowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const accountScopeRowClass = useIntegrationSubordinateRowClass('text-xs')
  const credentialCopy = hasRemoteProviderRuntime(settings)
    ? translate(
        'auto.components.settings.kerjan.integration.card.credentialCopyRemote',
        'Connect with your Kerjan site URL and a personal token. The token is sent to the selected remote runtime and stored there with runtime-supported encryption.'
      )
    : translate(
        'auto.components.settings.kerjan.integration.card.credentialCopyLocal',
        'Connect with your Kerjan site URL and a personal token. The token is stored locally and encrypted when local runtime storage supports it.'
      )

  // Why: explicit user-triggered verification is the only settings path that decrypts the token.
  const handleTest = async (): Promise<void> => {
    const testedSiteUrl = siteUrl
    setTesting(true)
    setTestResult(null)
    const result = await testKerjanConnection()
    if (!mountedRef.current) {
      return
    }
    setTestResult(
      result.ok ? { state: 'ok' } : { state: 'error', error: result.error, siteUrl: testedSiteUrl }
    )
    setTesting(false)
  }

  const handleDisconnect = async (): Promise<void> => {
    setDisconnecting(true)
    setDisconnectError(null)
    try {
      await disconnectKerjan()
      if (mountedRef.current) {
        setTestResult(null)
      }
    } catch (error) {
      // Why: main rethrows when a credential file cannot be deleted; say so instead of looking connected.
      if (mountedRef.current) {
        setDisconnectError(
          error instanceof Error && error.message
            ? error.message
            : translate(
                'auto.components.settings.kerjan.integration.card.disconnectFailed',
                'Could not remove the saved Kerjan token.'
              )
        )
      }
    } finally {
      if (mountedRef.current) {
        setDisconnecting(false)
      }
    }
  }

  const connectLabel = needsReconnect
    ? translate('auto.components.settings.kerjan.integration.card.reconnect', 'Reconnect')
    : connected
      ? translate('auto.components.settings.kerjan.integration.card.replaceToken', 'Replace token')
      : translate('auto.components.settings.kerjan.integration.card.connect', 'Connect Kerjan')

  return (
    <IntegrationCardShell
      settingsSectionId={KERJAN_INTEGRATION_SECTION_ID}
      icon={<KerjanIcon className="size-5" />}
      name="Kerjan"
      description={
        connected && siteUrl
          ? translate(
              'auto.components.settings.kerjan.integration.card.connectedTo',
              'Connected to {{site}}',
              { site: siteHost(siteUrl) }
            )
          : checking
            ? translate(
                'auto.components.settings.kerjan.integration.card.checking',
                'Checking Kerjan access before showing setup actions.'
              )
            : translate(
                'auto.components.settings.kerjan.integration.card.description',
                'Browse Kerjan tickets, update Tasks, and start work from them.'
              )
      }
      checking={checking}
      statusTone={connected && !needsReconnect ? 'connected' : 'attention'}
      statusLabel={
        needsReconnect
          ? translate(
              'auto.components.settings.kerjan.integration.card.statusReconnect',
              'Reconnect needed'
            )
          : connected
            ? translate(
                'auto.components.settings.kerjan.integration.card.statusConnected',
                'Connected'
              )
            : translate(
                'auto.components.settings.kerjan.integration.card.statusNotConnected',
                'Not connected'
              )
      }
      actions={
        !checking ? (
          <Button
            variant={connected && !needsReconnect ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connectLabel}
          </Button>
        ) : null
      }
    >
      <IntegrationCardDetails>
        <UnsealedCredentialNotice
          protection={connected ? (kerjanStatus.credentialProtection ?? null) : null}
          credentialName={translate(
            'auto.components.settings.kerjan.integration.card.tokenName',
            'Your Kerjan personal token'
          )}
        />
        <ProviderHostScopeControl
          labelPrefix={translate(
            'auto.components.settings.kerjan.integration.card.accountScopePrefix',
            'Account scope'
          )}
          scope={accountScope}
          className={accountScopeRowClass}
        />
        {connected ? (
          <div className="space-y-2">
            <div className={subordinateRowClass}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {viewer?.name ??
                    translate(
                      'auto.components.settings.kerjan.integration.card.unknownMember',
                      'Kerjan member'
                    )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[viewer?.email, siteUrl].filter(Boolean).join(' · ')}
                </p>
              </div>
              {testResult?.state === 'ok' ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-status-success">
                  <CheckCircle2 className="size-3.5" />
                  {translate(
                    'auto.components.settings.kerjan.integration.card.verified',
                    'Verified'
                  )}
                </span>
              ) : null}
              {testResult?.state === 'error' ? (
                <span className="flex min-w-0 max-w-[220px] shrink items-center gap-1 truncate text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span className="truncate" title={testResult.error}>
                    {testResult.error}
                  </span>
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleTest()}
                disabled={testing || disconnecting}
              >
                {testing ? (
                  <>
                    <LoaderCircle className="size-3.5 mr-1.5 animate-spin" />
                    {translate(
                      'auto.components.settings.kerjan.integration.card.testing',
                      'Testing...'
                    )}
                  </>
                ) : (
                  translate(
                    'auto.components.settings.kerjan.integration.card.testConnection',
                    'Test connection'
                  )
                )}
              </Button>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                aria-label={translate(
                  'auto.components.settings.kerjan.integration.card.disconnect',
                  'Disconnect Kerjan'
                )}
                className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
              >
                {disconnecting ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Unlink className="size-3.5" />
                )}
              </button>
            </div>
            {credentialError ? (
              <p role="alert" className="text-xs text-destructive">
                {translate(
                  'auto.components.settings.kerjan.integration.card.credentialError',
                  'Orca could not read the saved token ({{error}}). Reconnect to save a new one.',
                  { error: credentialError }
                )}
              </p>
            ) : null}
            <p className="text-2xs text-muted-foreground/70">
              {translate(
                'auto.components.settings.kerjan.integration.card.expiryNoteRemoved',
                'Personal tokens expire after 90 days. When Kerjan rejects the token, Orca removes it; connect again with a new one.'
              )}
            </p>
          </div>
        ) : tokenRejected ? (
          <div role="alert" className="space-y-1 text-xs">
            <p className="text-foreground">
              {translate(
                'auto.components.settings.kerjan.integration.card.tokenRejected',
                'Kerjan rejected the saved token, so Orca removed it. Tokens expire after 90 days; create a new one in Kerjan and reconnect.'
              )}
            </p>
            {testResult?.state === 'error' ? (
              <p className="text-destructive">{testResult.error}</p>
            ) : null}
          </div>
        ) : !checking ? (
          <>
            <p className="text-xs text-muted-foreground">{credentialCopy}</p>
            <Button variant="ghost" size="sm" onClick={() => void checkKerjanConnection()}>
              {translate('auto.components.settings.kerjan.integration.card.recheck', 'Re-check')}
            </Button>
          </>
        ) : null}
        {disconnectError ? (
          <p role="alert" className="text-xs text-destructive">
            {disconnectError}
          </p>
        ) : null}
      </IntegrationCardDetails>

      <KerjanConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialBaseUrl={reconnectBaseUrl}
        onConnected={() => setTestResult(null)}
        elevated
      />
    </IntegrationCardShell>
  )
}
