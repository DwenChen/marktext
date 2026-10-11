import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { clickMenuById, expectNoRendererErrors, launchWithMarkdown } from './helpers'

const DOC =
  '# Rendering styles\n\n## A heading\n\nText with **bold** and `code`.\n\n> A quotation.\n\n- First\n- Second\n\n```js\nconst answer = 42\n```\n'

test('resizing a long document keeps the editor fitted and preserves its width on collapse', async() => {
  const markdown = DOC + '\nParagraph with a long line of text for layout.\n'.repeat(250)
  const { app, page } = await launchWithMarkdown(markdown, { suppressErrorDialog: true })
  try {
    const sidebar = page.locator('.side-bar')
    if (!(await sidebar.isVisible())) await clickMenuById(app, 'sideBarMenuItem')
    const drag = sidebar.locator('.drag-bar')
    const bounds = await drag.boundingBox()
    expect(bounds).not.toBeNull()
    const initialWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
    const availableWidth = await page.evaluate(() => Math.max(220, window.innerWidth - 320))
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 80)
    await page.mouse.down()
    await page.mouse.move(bounds!.x + bounds!.width / 2 + 150, bounds!.y + 80, { steps: 30 })
    await page.mouse.up()

    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(Math.min(initialWidth + 140, availableWidth))
    const width = await page.evaluate(() => Number(localStorage.getItem('side-bar-width')))
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    const bufferId = await app.evaluate(
      ({ BrowserWindow }) =>
        (BrowserWindow.getAllWindows()[0] as unknown as { restoreBufferId: string }).restoreBufferId
    )
    const widthFile = path.join(
      userData,
      'editorStates',
      `${bufferId}_editor_buffer_store.json.sidebar-width.json`
    )
    await expect
      .poll(() => {
        try {
          return JSON.parse(readFileSync(widthFile, 'utf8'))
        } catch {
          return null
        }
      })
      .toBe(width)
    const editorBounds = await page.locator('.editor-with-tabs').boundingBox()
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(editorBounds!.x + editorBounds!.width).toBeLessThanOrEqual(viewportWidth + 1)

    const filesIcon = sidebar.locator('.left-column > ul').first().locator('li').first()
    await filesIcon.click()
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeLessThan(50)
    await filesIcon.click()
    await expect
      .poll(() => sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().width)))
      .toBe(Math.round(width) + 1)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
