import { useState } from 'react'
import { JiraConnectDialog } from '@/components/jira-connect-dialog'
import { KerjanConnectDialog } from '@/components/kerjan-connect-dialog'
import { Button } from '@/components/ui/button'
import { TaskSourceShowInTasksStep } from './TaskSourceShowInTasksStep'
import { TaskSourceStepRow } from './TaskSourceStepRow'
import { translate } from '@/i18n/i18n'

type ConnectStepProps = {
  visible: boolean
  canHide: boolean
  onToggleVisible: () => void
  connected: boolean
  checking: boolean
}

function getConnectStepState(props: ConnectStepProps): 'in-progress' | 'done' | 'pending' {
  if (props.checking) {
    return 'in-progress'
  }
  return props.connected ? 'done' : 'pending'
}

export function CodeHostSetupSteps(
  props: ConnectStepProps & {
    providerLabel: string
    unavailable?: boolean
    onOpenIntegrations: () => void
    onRetryConnection: () => void
  }
): React.JSX.Element {
  const connectionDescription = props.unavailable
    ? translate(
        'auto.components.settings.TasksPane.connectionCheckUnavailable',
        "Orca couldn't check this connection. Try again, or open Integrations for setup details."
      )
    : translate(
        'auto.components.settings.TasksPane.connectCodeHostDescription',
        'Install and authenticate the CLI under Integrations so Orca can load issues.'
      )

  return (
    <ol className="divide-y divide-border/50">
      <TaskSourceStepRow
        index={1}
        state={getConnectStepState(props)}
        title={translate(
          'auto.components.settings.TasksPane.connectProviderTitle',
          'Connect {{provider}}',
          { provider: props.providerLabel }
        )}
        description={connectionDescription}
        action={
          <Button
            type="button"
            size="sm"
            variant={props.connected ? 'outline' : 'default'}
            onClick={props.unavailable ? props.onRetryConnection : props.onOpenIntegrations}
          >
            {props.unavailable
              ? translate('auto.components.settings.TasksPane.retryConnection', 'Try again')
              : props.connected
                ? translate('auto.components.settings.TasksPane.openIntegrations', 'Integrations')
                : translate(
                    'auto.components.settings.TasksPane.connectInIntegrations',
                    'Set up in Integrations'
                  )}
          </Button>
        }
      />
      <TaskSourceShowInTasksStep
        index={2}
        providerLabel={props.providerLabel}
        visible={props.visible}
        canHide={props.canHide}
        onToggleVisible={props.onToggleVisible}
      />
    </ol>
  )
}

type DialogConnectSetupStepsProps = ConnectStepProps & {
  onConnected: () => void
  onOpenIntegrations: () => void
}

// Shared by trackers whose credentials are entered in an in-app connect dialog.
function DialogConnectSetupSteps(
  props: DialogConnectSetupStepsProps & {
    providerLabel: string
    title: string
    description: string
    connectLabel: string
    manageLabel: string
    renderDialog: (dialog: {
      open: boolean
      onOpenChange: (open: boolean) => void
      onConnected: () => void
    }) => React.ReactNode
  }
): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <ol className="divide-y divide-border/50">
        <TaskSourceStepRow
          index={1}
          state={getConnectStepState(props)}
          title={props.title}
          description={props.description}
          action={
            <Button
              type="button"
              size="sm"
              variant={props.connected ? 'outline' : 'default'}
              onClick={props.connected ? props.onOpenIntegrations : () => setDialogOpen(true)}
            >
              {props.connected ? props.manageLabel : props.connectLabel}
            </Button>
          }
        />
        <TaskSourceShowInTasksStep
          index={2}
          providerLabel={props.providerLabel}
          visible={props.visible}
          canHide={props.canHide}
          onToggleVisible={props.onToggleVisible}
        />
      </ol>
      {props.renderDialog({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        onConnected: props.onConnected
      })}
    </>
  )
}

export function JiraSetupSteps(props: DialogConnectSetupStepsProps): React.JSX.Element {
  return (
    <DialogConnectSetupSteps
      {...props}
      providerLabel={translate('auto.components.settings.TasksPane.6b23a34f6d', 'Jira')}
      title={translate('auto.components.settings.TasksPane.connectJiraTitle', 'Connect Jira')}
      description={translate(
        'auto.components.settings.TasksPane.connectJiraDescription',
        'Add a Jira Cloud site or self-hosted instance with an API token or PAT.'
      )}
      connectLabel={translate('auto.components.settings.TasksPane.addJira', 'Add Jira access')}
      manageLabel={translate('auto.components.settings.TasksPane.manageJira', 'Manage keys')}
      renderDialog={(dialog) => <JiraConnectDialog {...dialog} />}
    />
  )
}

export function KerjanSetupSteps(props: DialogConnectSetupStepsProps): React.JSX.Element {
  return (
    <DialogConnectSetupSteps
      {...props}
      providerLabel={translate('auto.components.settings.TasksPane.kerjanLabel', 'Kerjan')}
      title={translate('auto.components.settings.TasksPane.connectKerjanTitle', 'Connect Kerjan')}
      description={translate(
        'auto.components.settings.TasksPane.connectKerjanDescription',
        'Add your Kerjan site URL and a personal token from your Kerjan profile.'
      )}
      connectLabel={translate('auto.components.settings.TasksPane.addKerjan', 'Add Kerjan access')}
      manageLabel={translate('auto.components.settings.TasksPane.manageKerjan', 'Manage token')}
      renderDialog={(dialog) => <KerjanConnectDialog {...dialog} />}
    />
  )
}
