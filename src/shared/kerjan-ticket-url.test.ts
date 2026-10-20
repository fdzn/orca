import { describe, expect, it } from 'vitest'
import {
  buildKerjanTicketUrl,
  getKerjanWorkspaceCodeFromTicketKey,
  normalizeKerjanBaseUrl,
  normalizeKerjanTicketKey,
  parseKerjanTicketUrl
} from './kerjan-ticket-url'

describe('normalizeKerjanTicketKey', () => {
  it.each([
    ['omx-40', 'OMX-40'],
    [' OMX-40 ', 'OMX-40'],
    ['AB-1', 'AB-1'],
    ['ABCDEFGHIJ-7', 'ABCDEFGHIJ-7']
  ])('accepts %s', (input, expected) => {
    expect(normalizeKerjanTicketKey(input)).toBe(expected)
  })

  it.each(['A-1', 'ABCDEFGHIJK-1', 'OMX1-2', 'OMX-', 'OMX_40', '', 42, null])(
    'rejects %s',
    (input) => {
      expect(normalizeKerjanTicketKey(input)).toBeNull()
    }
  )
})

describe('getKerjanWorkspaceCodeFromTicketKey', () => {
  it('returns the upper-cased key prefix', () => {
    expect(getKerjanWorkspaceCodeFromTicketKey('omx-40')).toBe('OMX')
    expect(getKerjanWorkspaceCodeFromTicketKey('not a key')).toBeNull()
  })
})

describe('normalizeKerjanBaseUrl', () => {
  it.each([
    ['https://kerjan.example.com/', 'https://kerjan.example.com'],
    ['https://kerjan.example.com', 'https://kerjan.example.com'],
    ['http://localhost:8080/kerjan//', 'http://localhost:8080/kerjan'],
    [' https://Kerjan.Example.com/app ', 'https://kerjan.example.com/app']
  ])('normalizes %s', (input, expected) => {
    expect(normalizeKerjanBaseUrl(input)).toBe(expected)
  })

  it.each([
    'kerjan.example.com',
    'ftp://kerjan.example.com',
    'https://user:pass@kerjan.example.com',
    'https://kerjan.example.com/?x=1',
    'https://kerjan.example.com/#top'
  ])('rejects %s', (input) => {
    expect(normalizeKerjanBaseUrl(input)).toBeNull()
  })
})

describe('buildKerjanTicketUrl', () => {
  it('joins the base URL and upper-cased key', () => {
    expect(buildKerjanTicketUrl('https://kerjan.example.com/', 'omx-40')).toBe(
      'https://kerjan.example.com/ticket/OMX-40'
    )
    expect(buildKerjanTicketUrl('https://host/app', 'OMX-40')).toBe(
      'https://host/app/ticket/OMX-40'
    )
  })

  it('returns null for invalid input', () => {
    expect(buildKerjanTicketUrl('not a url', 'OMX-40')).toBeNull()
    expect(buildKerjanTicketUrl('https://host', 'bad')).toBeNull()
  })
})

describe('parseKerjanTicketUrl', () => {
  it.each([
    [
      'https://kerjan.example.com/ticket/omx-40?tab=comments#c1',
      {
        ticketKey: 'OMX-40',
        origin: 'https://kerjan.example.com',
        basePath: ''
      }
    ],
    [
      'http://localhost:8080/app/ticket/OMX-40/',
      {
        ticketKey: 'OMX-40',
        origin: 'http://localhost:8080',
        basePath: '/app'
      }
    ]
  ])('parses %s', (input, expected) => {
    expect(parseKerjanTicketUrl(input)).toEqual(expected)
  })

  it.each([
    'https://kerjan.example.com/browse/OMX-40',
    'https://kerjan.example.com/ticket/OMX',
    'https://kerjan.example.com/ticket/OMX-40/history',
    'https://user@kerjan.example.com/ticket/OMX-40',
    'ssh://kerjan.example.com/ticket/OMX-40',
    'OMX-40'
  ])('rejects %s', (input) => {
    expect(parseKerjanTicketUrl(input)).toBeNull()
  })
})
