import type { TaskProvider } from '../../../src/shared/task-providers'

// Why: Kerjan is desktop-only in this fork; hide it so mobile never shows a tab it cannot load.
export function mobileSupportedTaskProviders(providers: readonly TaskProvider[]): TaskProvider[] {
  return providers.filter((provider) => provider !== 'kerjan')
}
