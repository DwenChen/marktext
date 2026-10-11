import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['docs/audit-20261011/store-repro.spec.ts'],
    maxWorkers: 1,
    execArgv: ['--no-experimental-webstorage']
  },
  resolve: {
    alias: {
      '@': resolve('packages/desktop/src/renderer/src'),
      common: resolve('packages/desktop/src/common'),
      '@shared': resolve('packages/desktop/src/shared')
    }
  }
})
