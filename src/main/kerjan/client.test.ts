import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createKerjanFetch, kerjanJson, loadKerjanModules } from './kerjan-http-fixture'

const ME = { id: 7, name: 'Ada', email: 'ada@example.com', kind: 'human', active: true }

let tempHome = ''

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'orca-kerjan-client-'))
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe('kerjan client', () => {
  it('normalizes the base URL, verifies with /auth/me, and persists split credentials', async () => {
    const http = createKerjanFetch({ 'GET /app/api/v1/auth/me': ME })
    const { client, store } = await loadKerjanModules(tempHome, http.fetch)

    await expect(
      client.connect({ baseUrl: ' https://Kerjan.example.com/app/ ', token: ' kjt_secret ' })
    ).resolves.toEqual({
      ok: true,
      viewer: { id: '7', name: 'Ada', email: 'ada@example.com', active: true }
    })

    const [request] = http.requests
    expect(request.headers.get('authorization')).toBe('Bearer kjt_secret')
    expect(request.headers.get('accept')).toBe('application/json')
    expect(request.headers.has('x-workspace-id')).toBe(false)
    const metadataPath = join(tempHome, '.orca', 'kerjan-connection.json')
    expect(JSON.parse(readFileSync(metadataPath, 'utf-8'))).toMatchObject({
      baseUrl: 'https://kerjan.example.com/app',
      member: { id: '7', name: 'Ada', email: 'ada@example.com' }
    })
    expect(readFileSync(store.getKerjanTokenPath(), 'utf-8')).toBe('sealed:kjt_secret')
    if (process.platform !== 'win32') {
      expect(statSync(metadataPath).mode & 0o777).toBe(0o600)
      expect(statSync(store.getKerjanTokenPath()).mode & 0o777).toBe(0o600)
    }
    expect(client.getStatus()).toMatchObject({
      connected: true,
      siteUrl: 'https://kerjan.example.com/app',
      viewer: { id: '7', name: 'Ada' }
    })
  })

  it('rejects invalid URLs and empty tokens without calling Kerjan', async () => {
    const http = createKerjanFetch({})
    const { client } = await loadKerjanModules(tempHome, http.fetch)

    await expect(
      client.connect({ baseUrl: 'kerjan.example.com', token: 'kjt_x' })
    ).resolves.toMatchObject({ ok: false })
    await expect(
      client.connect({ baseUrl: 'https://kerjan.example.com', token: ' ' })
    ).resolves.toMatchObject({ ok: false, error: 'Personal access token is required.' })
    expect(http.fetch).not.toHaveBeenCalled()
    expect(client.getStatus().connected).toBe(false)
  })

  it('surfaces the Kerjan error message and saves nothing when /auth/me fails', async () => {
    const http = createKerjanFetch({
      'GET /api/v1/auth/me': () => kerjanJson({ message: 'token expired' }, 401)
    })
    const { client } = await loadKerjanModules(tempHome, http.fetch)

    await expect(
      client.connect({ baseUrl: 'https://kerjan.example.com', token: 'kjt_old' })
    ).resolves.toEqual({ ok: false, error: 'token expired' })
    expect(existsSync(join(tempHome, '.orca', 'kerjan-connection.json'))).toBe(false)
  })

  it('reads status without decrypting and reports an undecryptable token on use', async () => {
    const http = createKerjanFetch({ 'GET /api/v1/auth/me': ME })
    const { client, store } = await loadKerjanModules(tempHome, http.fetch)
    await client.connect({ baseUrl: 'https://kerjan.example.com', token: 'kjt_secret' })

    // Sealed ciphertext plus a keychain that refuses: status must still render from metadata.
    writeFileSync(store.getKerjanTokenPath(), Buffer.from([0x76, 0x31, 0x30, 0x00, 0xff]))
    const refused = await loadKerjanModules(tempHome, http.fetch)
    const { setSecretStore } = await import('../../shared/secret-store')
    setSecretStore({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value),
      decryptString: () => {
        throw new Error('keychain denied')
      },
      describeProtectionGap: () => null
    })
    expect(refused.client.getStatus()).toMatchObject({ connected: true })
    expect(refused.client.getStatus().credentialError).toBeUndefined()
    await expect(refused.client.testConnection()).resolves.toMatchObject({ ok: false })
    expect(refused.client.getStatus().credentialError).toContain('Kerjan')
    expect(existsSync(store.getKerjanTokenPath())).toBe(true)
  })

  it('tests the saved connection and drops a token Kerjan rejects with 401', async () => {
    let expired = false
    const http = createKerjanFetch({
      'GET /api/v1/auth/me': () =>
        expired ? kerjanJson({ message: 'unauthorized' }, 401) : kerjanJson(ME)
    })
    const { client } = await loadKerjanModules(tempHome, http.fetch)
    await client.connect({ baseUrl: 'https://kerjan.example.com', token: 'kjt_secret' })

    await expect(client.testConnection()).resolves.toMatchObject({ ok: true })
    expired = true
    await expect(client.testConnection()).resolves.toEqual({ ok: false, error: 'unauthorized' })
    expect(client.getStatus().connected).toBe(false)
  })

  it('disconnect removes both files and ignores a missing token', async () => {
    const http = createKerjanFetch({ 'GET /api/v1/auth/me': ME })
    const { client, store } = await loadKerjanModules(tempHome, http.fetch)
    await client.connect({ baseUrl: 'https://kerjan.example.com', token: 'kjt_secret' })

    client.disconnect()
    expect(existsSync(store.getKerjanTokenPath())).toBe(false)
    expect(existsSync(join(tempHome, '.orca', 'kerjan-connection.json'))).toBe(false)
    expect(client.getStatus()).toEqual({
      connected: false,
      siteUrl: null,
      viewer: null,
      credentialProtection: null
    })
    expect(() => client.disconnect()).not.toThrow()
  })

  it('ignores hand-edited metadata that is not a valid connection', async () => {
    const http = createKerjanFetch({ 'GET /api/v1/auth/me': ME })
    const { client } = await loadKerjanModules(tempHome, http.fetch)
    await client.connect({ baseUrl: 'https://kerjan.example.com', token: 'kjt_secret' })
    writeFileSync(
      join(tempHome, '.orca', 'kerjan-connection.json'),
      JSON.stringify({ baseUrl: 'ftp://evil', member: { id: 7 } })
    )

    const reloaded = await loadKerjanModules(tempHome, http.fetch)
    expect(reloaded.client.getStatus().connected).toBe(false)
    expect(() => reloaded.client.getClient()).toThrow('Not connected to Kerjan.')
  })
})
