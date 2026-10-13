import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // tests/e2e/.out can hold a copy of the repo (production builds): don't count its tests twice.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
