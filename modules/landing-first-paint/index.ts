// The landing paints before any script runs (SPEC M2.11), and so do the terms
// and privacy pages (M2.12). They're prerendered (routeRules), so this
// rewrites their HTML once, at build time:
// - the stylesheets are inlined: no request between the HTML and the first paint;
// - the latin fonts it declares are preloaded, so the first paint already
//   has them (no swap, nothing moves);
// - no modulepreload or payload preload links: on a phone they competed with
//   the HTML, the fonts and the headline for the first second;
// - the app's script starts once the page's largest paint (the headline) is on
//   screen, or after `load` where browsers don't report it. Everything these
//   pages show is in the HTML; on the landing scripts only add the playing
//   phone, the sticky button and scroll effects. Links work before that.
// Other pages keep Nuxt's usual tags.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { firstPaint } from './html'

/** The pages rewritten: static, and readable without scripts. */
export const FIRST_PAINT_ROUTES = ['/', '/terms', '/privacy']

export default defineNuxtModule({
  meta: { name: 'landing-first-paint' },
  setup(_, nuxt) {
    if (nuxt.options.dev)
      return
    const client = join(nuxt.options.buildDir, 'dist/client')
    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('prerender:generate', (route) => {
        if (FIRST_PAINT_ROUTES.includes(route.route) && typeof route.contents === 'string')
          route.contents = firstPaint(route.contents, href => readFileSync(join(client, href), 'utf8'))
      })
    })
  },
})
