// Builds the macOS app and publishes it as a GitHub release on the fork, where the in-app updater looks.
import { execFileSync } from 'node:child_process'

const FORK_REPO = 'fdzn/orca'
const UPSTREAM_REPO = 'stablyai/orca'

const read = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

function forkHasRelease(tag) {
  try {
    read('gh', ['release', 'view', tag, '-R', FORK_REPO, '--json', 'tagName'])
    return true
  } catch {
    return false
  }
}

// Why: upstream stamps versions only at release time; tracking its latest stable tag keeps fork versions monotonic.
const tag = read('gh', [
  'release',
  'view',
  '-R',
  UPSTREAM_REPO,
  '--json',
  'tagName',
  '-q',
  '.tagName'
])
const version = tag.replace(/^v/, '')
if (forkHasRelease(tag)) {
  console.error(
    `[release:fork:mac] ${FORK_REPO} already has ${tag}. Merge upstream/main after the next upstream release, then rerun.`
  )
  process.exit(1)
}
console.log(`[release:fork:mac] building ${tag} for ${FORK_REPO}`)

const env = {
  ...process.env,
  GH_TOKEN: process.env.GH_TOKEN || read('gh', ['auth', 'token']),
  ORCA_BUILD_COMMIT: read('git', ['rev-parse', '--short=12', 'HEAD']),
  // Why: the builder config stamps this as the packaged version (no notarized release env needed).
  ORCA_LOCAL_BUILD_VERSION: version
}
const run = (args) => execFileSync('pnpm', args, { stdio: 'inherit', env })

run(['run', 'build:desktop'])
// Why: Command Line Tools cannot link universal Swift helpers, so the fork ships the host arch only.
for (const helper of ['computer', 'keyboard-layout', 'notification-status']) {
  execFileSync('node', [`config/scripts/build-${helper}-macos.mjs`, '--single-arch'], {
    stdio: 'inherit',
    env
  })
}
run(['run', 'ensure:electron-runtime'])
run([
  'exec',
  'electron-builder',
  '--config',
  'config/electron-builder.config.cjs',
  '--mac',
  `--${process.arch}`,
  '--publish',
  'always'
])

// Why: the builder publishes a draft; the updater only sees /releases/latest once it is public.
execFileSync('gh', ['release', 'edit', tag, '-R', FORK_REPO, '--draft=false', '--latest'], {
  stdio: 'inherit'
})
console.log(`[release:fork:mac] published https://github.com/${FORK_REPO}/releases/tag/${tag}`)
