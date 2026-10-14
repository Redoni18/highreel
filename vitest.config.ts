import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  // Nuxt's alias for shared code, so server utils that import it can be tested.
  resolve: { alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    // tests/e2e/.out can hold a copy of the repo (production builds): don't count its tests twice.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
