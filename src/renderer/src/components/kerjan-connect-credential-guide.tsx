import { translate } from '@/i18n/i18n'

/** How to mint a Kerjan personal token; `siteUrl` is the normalized base URL once it is valid. */
export function KerjanConnectCredentialGuide({
  siteUrl
}: {
  siteUrl: string | null
}): React.JSX.Element {
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        {translate(
          'auto.components.kerjan.connect.credential.guide.title',
          'Create a personal token'
        )}
      </p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>
          {siteUrl ? (
            <>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => window.api.shell.openUrl(siteUrl)}
              >
                {translate(
                  'auto.components.kerjan.connect.credential.guide.openSite',
                  'Open Kerjan'
                )}
              </button>{' '}
              {translate(
                'auto.components.kerjan.connect.credential.guide.profileStepAfterLink',
                'and go to Account, then Your tokens.'
              )}
            </>
          ) : (
            translate(
              'auto.components.kerjan.connect.credential.guide.profileStep',
              'In Kerjan, open Account, then Your tokens.'
            )
          )}
        </li>
        <li>
          {translate(
            'auto.components.kerjan.connect.credential.guide.createStep',
            'Create a personal token. Kerjan asks for the code from your authenticator app.'
          )}
        </li>
        <li>
          {translate(
            'auto.components.kerjan.connect.credential.guide.pasteStep',
            'Copy the token (it starts with kjt_) and paste it here. It expires after 90 days.'
          )}
        </li>
      </ol>
    </div>
  )
}
