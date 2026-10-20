import type { KerjanConnectResult, KerjanConnectionStatus } from '../../shared/kerjan-types'
import { normalizeKerjanBaseUrl } from '../../shared/kerjan-ticket-url'
import { readPipedStdin } from '../command-body-input'
import type { CommandHandler } from '../dispatch'
import { getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { formatKerjanConnection } from '../kerjan-format'
import { callKerjan } from '../kerjan-target'
import { RuntimeClientError } from '../runtime-client'

// Why: argv leaks into shell history and process listings, so tokens arrive only via stdin or env.
async function readKerjanToken(flags: Map<string, string | boolean>): Promise<string> {
  const stdinFlag = flags.get('token-stdin')
  if (stdinFlag !== undefined && stdinFlag !== true) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--token-stdin takes no value. Pipe the token on stdin instead.'
    )
  }
  const token =
    stdinFlag === true ? await readPipedStdin('token') : (process.env.ORCA_KERJAN_TOKEN ?? '')
  if (!token.trim()) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Pipe a Kerjan personal access token with --token-stdin, or set ORCA_KERJAN_TOKEN.'
    )
  }
  return token.trim()
}

export const KERJAN_CONNECTION_HANDLERS: Record<string, CommandHandler> = {
  'kerjan connection': async (context) => {
    const response = await callKerjan<KerjanConnectionStatus>(context.client, 'kerjan.status')
    printResult(response, context.json, formatKerjanConnection)
  },
  'kerjan connection connect': async (context) => {
    const baseUrl = getRequiredStringFlag(context.flags, 'url').trim()
    if (!normalizeKerjanBaseUrl(baseUrl)) {
      throw new RuntimeClientError(
        'invalid_argument',
        '--url must be an http(s) Kerjan base URL without credentials, query, or fragment.'
      )
    }
    const token = await readKerjanToken(context.flags)
    const response = await callKerjan<KerjanConnectResult>(context.client, 'kerjan.connect', {
      baseUrl,
      token
    })
    if (!response.result.ok) {
      throw new RuntimeClientError('kerjan_connect_failed', response.result.error)
    }
    const { viewer } = response.result
    printResult(response, context.json, () => `Connected to ${baseUrl} as ${viewer.name}`)
  },
  'kerjan connection disconnect': async (context) => {
    const response = await callKerjan<{ ok: true }>(context.client, 'kerjan.disconnect')
    printResult(response, context.json, () => 'Disconnected from Kerjan.')
  },
  'kerjan connection test': async (context) => {
    const response = await callKerjan<KerjanConnectResult>(context.client, 'kerjan.testConnection')
    if (!response.result.ok) {
      throw new RuntimeClientError('kerjan_connection_failed', response.result.error)
    }
    const { viewer } = response.result
    printResult(response, context.json, () => `Kerjan connection OK: signed in as ${viewer.name}`)
  }
}
