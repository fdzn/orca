import { describe, expect, it } from 'vitest'
import { normalizeCommandPositionals, parseArgs, validateCommandAndFlags } from './args'
import { HANDLER_COMMAND_KEYS } from './dispatch'
import { COMMAND_SPECS } from './specs'

const KERJAN_COMMANDS = [
  'kerjan connection',
  'kerjan connection connect',
  'kerjan connection disconnect',
  'kerjan connection test',
  'kerjan workspaces',
  'kerjan sprints',
  'kerjan members',
  'kerjan list',
  'kerjan issue',
  'kerjan comment',
  'kerjan status',
  'kerjan assign'
]

function parse(argv: string[]) {
  const parsed = normalizeCommandPositionals(
    COMMAND_SPECS,
    parseArgs(argv, undefined, COMMAND_SPECS)
  )
  validateCommandAndFlags(COMMAND_SPECS, parsed)
  return parsed
}

describe('Kerjan command surface', () => {
  it('lets agents connect, read, comment, move, and assign Kerjan tickets', () => {
    const commands = new Set(COMMAND_SPECS.map((spec) => spec.path.join(' ')))
    for (const command of KERJAN_COMMANDS) {
      expect(commands.has(command), command).toBe(true)
      expect(HANDLER_COMMAND_KEYS.has(command), command).toBe(true)
    }
  })

  it('routes `connection status` to the connection read', () => {
    expect(parse(['kerjan', 'connection', 'status']).commandPath).toEqual(['kerjan', 'connection'])
  })

  it('maps ticket, status, and member positionals', () => {
    expect(parse(['kerjan', 'status', 'OMX-40', 'done']).flags).toEqual(
      new Map([
        ['key', 'OMX-40'],
        ['to', 'done']
      ])
    )
    expect(parse(['kerjan', 'assign', '--me', 'OMX-40']).flags).toEqual(
      new Map<string, string | boolean>([
        ['me', true],
        ['key', 'OMX-40']
      ])
    )
  })

  it('treats stdin switches as valueless so they never swallow a ticket', () => {
    expect(parse(['kerjan', 'comment', '--body-stdin', 'OMX-40']).flags.get('key')).toBe('OMX-40')
    expect(
      parse(['kerjan', 'connection', 'connect', '--token-stdin', '--url', 'https://k.example'])
        .flags
    ).toEqual(
      new Map<string, string | boolean>([
        ['token-stdin', true],
        ['url', 'https://k.example']
      ])
    )
  })

  it('accepts no token flag', () => {
    expect(() => parse(['kerjan', 'connection', 'connect', '--token', 'kjt_x'])).toThrow(
      'Unknown flag --token'
    )
  })
})
