// Runs between a release's build and its upload (`corepack pnpm run deploy`):
// the prerendered pages must carry the public settings the Worker runs with
// (wrangler.jsonc's vars), not a local .env's. Turnstile's test key once
// reached the live landing that way (nuxt.config.ts, 2026-10-13).
import { readFileSync } from 'node:fs'

const wrangler = readFileSync('wrangler.jsonc', 'utf8')
const want = wrangler.match(/"NUXT_PUBLIC_TURNSTILE_SITE_KEY":\s*"([^"]+)"/)?.[1]
const problems = []
for (const page of ['index.html', 'terms/index.html', 'privacy/index.html']) {
  const html = readFileSync(`.output/public/${page}`, 'utf8')
  const got = html.match(/turnstileSiteKey:"([^"]*)"/)?.[1]
  if (got !== want)
    problems.push(`${page}: Turnstile site key ${JSON.stringify(got)}, the Worker's is ${JSON.stringify(want)}`)
}
if (!want || problems.length) {
  console.error(`Not deploying: the prerendered pages don't match wrangler.jsonc's vars.\n${problems.join('\n') || 'wrangler.jsonc has no NUXT_PUBLIC_TURNSTILE_SITE_KEY.'}\nBuild with HIGHREEL_RELEASE=1 (corepack pnpm run deploy does).`)
  process.exit(1)
}
console.log('Release check: the prerendered pages carry the Worker\'s public settings.')
