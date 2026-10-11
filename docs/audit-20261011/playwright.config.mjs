import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'electron-repro.spec.ts',
  workers: 1,
  timeout: 45000,
  outputDir: '../../packages/desktop/test-results/final-audit',
  reporter: 'list'
})
