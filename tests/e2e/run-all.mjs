// Runs every browser check in order and summarises. Needs the dev server
// (corepack pnpm dev) and Mailpit (corepack pnpm mail).
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { BASE, FIX, MAILPIT } from './lib.mjs'

const here = new URL('.', import.meta.url).pathname
try {
  await fetch(`${BASE}/login`)
}
catch {
  console.error(`Dev server not reachable at ${BASE}. Start it with: corepack pnpm dev`)
  process.exit(1)
}
try {
  await fetch(`${MAILPIT}/api/v1/info`)
}
catch {
  console.error(`Mailpit (the local test inbox) not reachable at ${MAILPIT}. Start it with: corepack pnpm mail`)
  process.exit(1)
}
if (!existsSync(`${FIX}/sample-10000.csv`))
  execFileSync('node', [`${here}fixtures.mjs`], { stdio: 'inherit' })

const checks = ['workspace', 'recap', 'scenes', 'misc', 'landing', 'auth', 'media', 'engagement', 'visit', 'xlsx', 'paper', 'session', 'home', 'business', 'templates', 'tabs', 'custom', 'editor', 'send', 'whatsapp', 'library', 'unsaved', 'bounces', 'legal', 'saveimages', 'wordmark', 'cleanup', 'admin', 'speed']
const only = process.argv.slice(2)
const failed = []
for (const name of checks.filter(c => !only.length || only.includes(c))) {
  console.log(`\n== ${name}`)
  const res = spawnSync('node', [`${here}${name}.mjs`], { stdio: 'inherit' })
  if (res.status !== 0)
    failed.push(name)
}
console.log(failed.length ? `\nFailed: ${failed.join(', ')}` : '\nAll browser checks passed')
process.exit(failed.length ? 1 : 0)
