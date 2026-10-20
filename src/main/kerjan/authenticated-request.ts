import { ensureElectronProxyFromEnvironment } from '../network/proxy-settings'
import { getMainHttpClient } from '../network/http-client'
import { withSpan } from '../observability/tracer'
import { readFetchResponseJsonWithinLimit } from '../../shared/fetch-response-body'

export class KerjanApiError extends Error {
  constructor(
    message: string,
    public status: number | null = null
  ) {
    super(message)
    this.name = 'KerjanApiError'
  }
}

export type KerjanCredentials = {
  baseUrl: string
  token: string
}

export type KerjanRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  body?: unknown
  /** Scoped routes need the workspace code; Kerjan answers 400 without it. */
  workspaceCode?: string | null
  query?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
}

function buildUrl(baseUrl: string, path: string, query: KerjanRequestOptions['query']): string {
  const url = new URL(`${baseUrl}/api/v1${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

// Why verbatim: Kerjan's 422 messages cite the rule ("(SPEC #n)") the user must satisfy.
async function toKerjanApiError(response: Response): Promise<KerjanApiError> {
  let message: string | null = null
  try {
    const data: unknown = await readFetchResponseJsonWithinLimit(response, 64 * 1024)
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      message = data.message.trim() || null
    }
  } catch {
    // Non-JSON error bodies fall back to the status line.
  }
  return new KerjanApiError(
    message ?? (response.statusText || `Kerjan request failed (${response.status})`),
    response.status
  )
}

async function kerjanFetch(url: string, init: RequestInit): Promise<Response> {
  return withSpan(
    'kerjan.request',
    async (span) => {
      span.setAttribute('kerjan.siteUrl', new URL(url).origin)
      const httpClient = getMainHttpClient()
      const proxySession = httpClient.proxySession()
      await ensureElectronProxyFromEnvironment({
        ...(proxySession ? { proxySession } : {}),
        probeUrl: url
      }).catch((error: unknown) => {
        span.addEvent('kerjan.proxySetupFailed', {
          errorMessage: error instanceof Error ? error.message : String(error)
        })
      })
      return httpClient.fetch(url, init)
    },
    { kind: 'client' }
  )
}

/** Returns the parsed JSON body (null for 204); callers narrow it with the mappers. */
export async function kerjanRequest(
  credentials: KerjanCredentials,
  path: string,
  options: KerjanRequestOptions = {}
): Promise<unknown> {
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${credentials.token}`
  })
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.workspaceCode) {
    headers.set('X-Workspace-ID', options.workspaceCode)
  }
  const response = await kerjanFetch(buildUrl(credentials.baseUrl, path, options.query), {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {})
  })
  if (!response.ok) {
    throw await toKerjanApiError(response)
  }
  if (response.status === 204) {
    await response.body?.cancel()
    return null
  }
  return readFetchResponseJsonWithinLimit<unknown>(response)
}
