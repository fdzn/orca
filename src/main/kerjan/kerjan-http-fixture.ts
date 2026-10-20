import type * as Os from 'node:os'
import { vi, type Mock } from 'vitest'

export type KerjanRecordedRequest = {
  method: string
  path: string
  search: URLSearchParams
  headers: Headers
  body: unknown
}

export type KerjanRoute = (request: KerjanRecordedRequest) => Response | undefined

export function kerjanJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

/** A fetch double that records every Kerjan call and answers from `routes`; unmatched calls 404. */
export function createKerjanFetch(routes: Record<string, KerjanRoute | object>): {
  fetch: Mock
  requests: KerjanRecordedRequest[]
} {
  const requests: KerjanRecordedRequest[] = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const parsed = new URL(url)
    const request: KerjanRecordedRequest = {
      method: init?.method ?? 'GET',
      path: parsed.pathname,
      search: parsed.searchParams,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    }
    requests.push(request)
    const route = routes[`${request.method} ${request.path}`]
    if (typeof route === 'function') {
      return route(request) ?? kerjanJson({ message: 'not found' }, 404)
    }
    return route === undefined ? kerjanJson({ message: 'not found' }, 404) : kerjanJson(route)
  })
  return { fetch, requests }
}

/** Fresh module graph per test with a temp home, a fake keychain, and a fake HTTP port. */
export async function loadKerjanModules(tempHome: string, fetch: Mock) {
  vi.resetModules()
  vi.doMock('electron', () => ({
    net: { fetch },
    session: {
      defaultSession: {
        closeAllConnections: vi.fn(),
        resolveProxy: vi.fn().mockResolvedValue('DIRECT'),
        setProxy: vi.fn()
      }
    }
  }))
  vi.doMock('os', async () => {
    const actual = await vi.importActual<typeof Os>('os')
    return { ...actual, homedir: () => tempHome }
  })
  const { setMainHttpClient } = await import('../network/http-client')
  setMainHttpClient({ fetch: (url, init) => fetch(url, init), proxySession: () => null })
  const { setSecretStore } = await import('../../shared/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`sealed:${value}`),
    decryptString: (value) => value.toString('utf-8').replace(/^sealed:/, ''),
    describeProtectionGap: () => null
  })
  const [client, store, queries, mutations] = await Promise.all([
    import('./client'),
    import('./credential-store'),
    import('./issue-queries'),
    import('./issue-mutations')
  ])
  return { client, store, queries, mutations }
}
