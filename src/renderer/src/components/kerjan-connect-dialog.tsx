import { useId, useLayoutEffect, useState } from 'react'
import { LoaderCircle, Lock } from 'lucide-react'
import { normalizeKerjanBaseUrl } from '../../../shared/kerjan-ticket-url'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hasRemoteProviderRuntime } from '@/lib/provider-runtime-context'
import { preventOutsideDismissWhenDirty } from '@/lib/outside-dismiss-guard'
import { translate } from '@/i18n/i18n'
import { KerjanConnectCredentialGuide } from './kerjan-connect-credential-guide'

export type KerjanConnectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
  /** Prefills the site URL, e.g. when reconnecting after Kerjan rejected an expired token. */
  initialBaseUrl?: string | null
  /** Stack above another modal layer, e.g. the feature wall that embeds the Settings card. */
  elevated?: boolean
}

type ConnectState = 'idle' | 'connecting' | 'error'

/** Base URL + personal token connect flow, shared by Settings, Tasks setup, and the Tasks page. */
export function KerjanConnectDialog({
  open,
  onOpenChange,
  onConnected,
  initialBaseUrl,
  elevated = false
}: KerjanConnectDialogProps): React.JSX.Element {
  const connectKerjan = useAppStore((s) => s.connectKerjan)
  const remoteRuntime = useAppStore((s) => hasRemoteProviderRuntime(s.settings))
  const mountedRef = useMountedRef()
  const baseUrlId = useId()
  const tokenId = useId()
  const baseUrlErrorId = useId()
  const errorId = useId()

  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [baseUrlInvalid, setBaseUrlInvalid] = useState(false)
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectError, setConnectError] = useState<string | null>(null)

  // Reset before paint on every open so a typed token or old error never lingers across reopens.
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    setBaseUrl(initialBaseUrl ?? '')
    setToken('')
    setBaseUrlInvalid(false)
    setConnectState('idle')
    setConnectError(null)
  }, [open, initialBaseUrl])

  const connecting = connectState === 'connecting'
  const normalizedBaseUrl = normalizeKerjanBaseUrl(baseUrl)
  const canSubmit = Boolean(baseUrl.trim()) && Boolean(token.trim()) && !connecting
  const credentialStorageCopy = remoteRuntime
    ? translate(
        'auto.components.kerjan.connect.dialog.storageRemote',
        'Your token is sent to the selected remote runtime and stored there with runtime-supported encryption.'
      )
    : translate(
        'auto.components.kerjan.connect.dialog.storageLocal',
        'Your token is stored locally and encrypted when local runtime storage supports it.'
      )

  const clearErrorOnEdit = (): void => {
    if (connectState === 'error') {
      setConnectState('idle')
      setConnectError(null)
    }
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!connecting) {
      onOpenChange(nextOpen)
    }
  }

  // Why: a stray backdrop click must not discard a pasted token; Escape / Cancel / × stay explicit.
  const isDraftDirty = (): boolean => token !== '' || baseUrl !== (initialBaseUrl ?? '')
  const guardOutsideDismiss = preventOutsideDismissWhenDirty(isDraftDirty)

  const handleConnect = async (): Promise<void> => {
    const trimmedToken = token.trim()
    if (!baseUrl.trim() || !trimmedToken || connecting) {
      return
    }
    if (!normalizedBaseUrl) {
      setBaseUrlInvalid(true)
      return
    }
    setConnectState('connecting')
    setConnectError(null)
    try {
      const result = await connectKerjan({ baseUrl: normalizedBaseUrl, token: trimmedToken })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setToken('')
        setConnectState('idle')
        onOpenChange(false)
        onConnected?.()
        return
      }
      setConnectState('error')
      // Why verbatim: Kerjan's messages name the exact failure (expired token, SPEC rule).
      setConnectError(result.error)
    } catch (error) {
      if (mountedRef.current) {
        setConnectState('error')
        setConnectError(
          error instanceof Error && error.message
            ? error.message
            : translate('auto.components.kerjan.connect.dialog.connectFailed', 'Connection failed')
        )
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName={elevated ? 'z-[110]' : undefined}
        className={elevated ? 'z-[120] sm:max-w-md' : 'sm:max-w-md'}
        onPointerDownOutside={guardOutsideDismiss}
        onInteractOutside={guardOutsideDismiss}
      >
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.kerjan.connect.dialog.title', 'Connect Kerjan')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.kerjan.connect.dialog.description',
              'Use your Kerjan site URL and a personal token to browse tickets and update Tasks.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void handleConnect()
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor={baseUrlId}>
                {translate('auto.components.kerjan.connect.dialog.baseUrlLabel', 'Kerjan site URL')}
              </Label>
              <Input
                id={baseUrlId}
                autoFocus={!initialBaseUrl}
                type="url"
                placeholder={translate(
                  'auto.components.kerjan.connect.dialog.baseUrlPlaceholder',
                  'https://kerjan.example.com'
                )}
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value)
                  setBaseUrlInvalid(false)
                  clearErrorOnEdit()
                }}
                onBlur={() => setBaseUrlInvalid(Boolean(baseUrl.trim()) && !normalizedBaseUrl)}
                disabled={connecting}
                aria-invalid={baseUrlInvalid || undefined}
                aria-describedby={baseUrlInvalid ? baseUrlErrorId : undefined}
              />
              {baseUrlInvalid ? (
                <p id={baseUrlErrorId} className="text-xs text-destructive">
                  {translate(
                    'auto.components.kerjan.connect.dialog.baseUrlInvalid',
                    'Enter a URL that starts with http:// or https://, without a query or #.'
                  )}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={tokenId}>
                {translate('auto.components.kerjan.connect.dialog.tokenLabel', 'Personal token')}
              </Label>
              <Input
                id={tokenId}
                autoFocus={Boolean(initialBaseUrl)}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={translate(
                  'auto.components.kerjan.connect.dialog.tokenPlaceholder',
                  'kjt_…'
                )}
                value={token}
                onChange={(event) => {
                  setToken(event.target.value)
                  clearErrorOnEdit()
                }}
                disabled={connecting}
                aria-describedby={connectState === 'error' ? errorId : undefined}
              />
            </div>
            {connectState === 'error' && connectError ? (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {connectError}
              </p>
            ) : null}
            <KerjanConnectCredentialGuide siteUrl={normalizedBaseUrl} />
            <p className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
              <Lock className="size-3 shrink-0" />
              {credentialStorageCopy}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={connecting}
            >
              {translate('auto.components.kerjan.connect.dialog.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {connecting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {translate('auto.components.kerjan.connect.dialog.verifying', 'Verifying…')}
                </>
              ) : (
                translate('auto.components.kerjan.connect.dialog.connect', 'Connect')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
