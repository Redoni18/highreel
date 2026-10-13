// The Worker's static files get their headers from `_headers`, which Nitro's
// Cloudflare preset writes from routeRules (SPEC M2.14 P0). Its rules overlap
// (`/_nuxt/**` and `/_nuxt/builds/**`) and Cloudflare joins overlapping values,
// so this reorders the file once it's written (headers.ts).
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { orderHeaders } from './headers'

export default defineNuxtModule({
  meta: { name: 'cloudflare-headers' },
  setup(_, nuxt) {
    if (nuxt.options.dev)
      return
    nuxt.hook('nitro:init', (nitro) => {
      // Registered after the preset's own `compiled` hook, which writes the file.
      nitro.hooks.hook('compiled', async () => {
        const file = join(nitro.options.output.publicDir, '_headers')
        if (existsSync(file))
          await writeFile(file, orderHeaders(await readFile(file, 'utf8')))
      })
    })
  },
})
