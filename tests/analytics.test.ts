// Cloudflare Web Analytics runs on our own public pages only (owner,
// 2026-10-13): never on a Highreel (/r) or an unsubscribe page, where we act
// for the business and their customers' visits aren't ours to count.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = new URL('../', import.meta.url).pathname

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    return statSync(join(root, path)).isDirectory() ? files(path) : [path]
  })
}
const source = (dir: string) => files(dir).filter(f => /\.(?:vue|ts)$/.test(f))
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('Cloudflare Web Analytics', () => {
  const callers = source('app').filter(f => /usePublicAnalytics\(\)/.test(read(f)) && !f.endsWith('usePublicAnalytics.ts'))

  test('only the public pages load it: the landing, examples, sign-in, terms and privacy', () => {
    expect(callers.sort()).toEqual([
      'app/components/legal/LegalPage.vue',
      'app/pages/example/[key].vue',
      'app/pages/index.vue',
      'app/pages/login.vue',
    ])
    // LegalPage is the terms and privacy pages' frame, and nothing else's.
    expect(source('app').filter(f => /<LegalPage\b/.test(read(f))).sort()).toEqual(['app/pages/privacy.vue', 'app/pages/terms.vue'])
  })

  test('nothing a Highreel, an unsubscribe page or the workspace is made of loads it', () => {
    const private_ = [...source('app/pages/r'), ...source('app/pages/unsubscribe'), ...source('app/pages/app'), ...source('app/components/recap'), ...source('app/components/workspace'), 'app/pages/confirm.vue', 'app/layouts/default.vue']
    for (const file of private_)
      expect(read(file), file).not.toMatch(/usePublicAnalytics|cloudflareinsights/)
  })

  test('the beacon is added in one place only', () => {
    const mentions = [...source('app'), ...source('server'), ...source('shared')].filter(f => read(f).includes('cloudflareinsights'))
    expect(mentions).toEqual(['app/composables/usePublicAnalytics.ts'])
  })
})
