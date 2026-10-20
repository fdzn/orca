import type { HandlerGroup } from './handler-group-manifest'

export const KERJAN_HANDLER_GROUP: HandlerGroup = {
  name: 'kerjan',
  keys: [
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
  ],
  load: async () => (await import('./handlers/kerjan.js')).KERJAN_HANDLERS
}
