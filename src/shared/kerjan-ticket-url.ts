export type ParsedKerjanTicketUrl = {
  ticketKey: string
  origin: string
  /** Path prefix Kerjan is served under ('' at the host root). */
  basePath: string
}

export const KERJAN_TICKET_KEY_PATTERN = /^[A-Za-z]{2,10}-\d+$/

export function normalizeKerjanTicketKey(value: unknown): string | null {
  const key = typeof value === 'string' ? value.trim() : ''
  return KERJAN_TICKET_KEY_PATTERN.test(key) ? key.toUpperCase() : null
}

/** Workspace code a ticket key belongs to (its prefix), sent as `X-Workspace-ID`. */
export function getKerjanWorkspaceCodeFromTicketKey(key: string): string | null {
  const normalized = normalizeKerjanTicketKey(key)
  return normalized ? normalized.slice(0, normalized.lastIndexOf('-')) : null
}

/** Canonical site URL: http(s), no credentials/query/hash, no trailing slash. */
export function normalizeKerjanBaseUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    return null
  }
  return `${url.origin}${normalizeBasePath(url.pathname)}`
}

export function buildKerjanTicketUrl(baseUrl: string, key: string): string | null {
  const base = normalizeKerjanBaseUrl(baseUrl)
  const ticketKey = normalizeKerjanTicketKey(key)
  return base && ticketKey ? `${base}/ticket/${ticketKey}` : null
}

export function parseKerjanTicketUrl(value: string): ParsedKerjanTicketUrl | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    return null
  }
  const match = url.pathname.replace(/\/+$/, '').match(/^(.*)\/ticket\/([^/]+)$/)
  const ticketKey = match ? normalizeKerjanTicketKey(match[2]) : null
  if (!match || !ticketKey) {
    return null
  }
  return {
    ticketKey,
    origin: url.origin.toLowerCase(),
    basePath: normalizeBasePath(match[1])
  }
}

function normalizeBasePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/g, '')
  return trimmed === '/' ? '' : trimmed
}
