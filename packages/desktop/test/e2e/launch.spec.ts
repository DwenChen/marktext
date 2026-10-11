import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron, waitForEditor } from './helpers'

test.describe('Check Launch MarkText', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron(undefined, {
      preferences: { language: 'en' }
    })
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('Creates a document from the empty start screen', async() => {
    await page.getByRole('button', { name: 'New File', exact: true }).click()
    await waitForEditor(page)
    await expect(page).toHaveTitle(/^Untitled-1(?: - .+)?$/)
  })
})
