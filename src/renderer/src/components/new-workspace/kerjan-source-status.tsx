import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { KerjanUrlSourceState } from './use-kerjan-url-source'

export function getKerjanSourceStatusMessage(source: KerjanUrlSourceState): string {
  if (source.loading) {
    return translate(
      'auto.components.new.workspace.SmartWorkspaceNameField.loadingKerjan',
      'Loading Kerjan ticket…'
    )
  }
  switch (source.errorKind) {
    case 'disconnected':
      return translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.kerjanDisconnected',
        'Connect Kerjan in Settings to link this ticket'
      )
    case 'site-not-connected':
      return translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.kerjanSiteNotConnected',
        'This Kerjan site is not the connected one'
      )
    case 'update-runtime':
      return translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.kerjanRuntimeUpdate',
        'Update the remote runtime to link Kerjan'
      )
    case 'read-failed':
      return translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.kerjanReadFailed',
        'Couldn’t load this Kerjan ticket'
      )
    case null:
      return translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.kerjanLoaded',
        'Kerjan ticket loaded'
      )
  }
}

/** Live status for a pasted Kerjan ticket URL; visible only while loading or failed. */
export function KerjanSourceStatus({
  id,
  source
}: {
  id: string
  source: KerjanUrlSourceState
}): React.JSX.Element {
  const quiet = !source.loading && !source.errorKind
  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className={
        quiet
          ? 'sr-only'
          : 'flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground'
      }
    >
      <span>{getKerjanSourceStatusMessage(source)}</span>
      {source.errorKind === 'read-failed' ? (
        <Button type="button" variant="link" size="xs" onClick={source.retry}>
          {translate('auto.components.new.workspace.SmartWorkspaceNameField.retryKerjan', 'Retry')}
        </Button>
      ) : null}
    </div>
  )
}
