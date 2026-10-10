import { expect, test } from '@playwright/test'
import { expectNoRendererErrors, launchWithMarkdown, sendIpcToRenderer } from './helpers'

test('sidebar dragging avoids document reflow and tab switching keeps history', async() => {
  const markdown = Array.from({ length: 1000 }, (_, i) =>
    i % 10 === 0 ? `## Heading ${i}\n\n` : `Paragraph ${i} with **bold** text.\n\n`
  ).join('')
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { sideBarVisibility: true, tabBarVisibility: true }
  })
  try {
    await expect(page.locator('.mu-container > *')).toHaveCount(1000)
    const firstTabId = await page.locator('.tabs-container > li.active').getAttribute('data-id')
    const sidebarBefore = await page
      .locator('.side-bar')
      .evaluate((el) => el.getBoundingClientRect().width)
    const separator = await page.locator('.drag-bar').boundingBox()
    expect(separator).not.toBeNull()
    if (!separator) return
    await page.mouse.move(separator.x + separator.width / 2, separator.y + 100)
    await page.mouse.down()
    await expect
      .poll(() => page.locator('.editor-with-tabs > .container').evaluate((el) => el.style.width))
      .not.toBe('')
    const widthBefore = await page
      .locator('.editor-with-tabs > .container')
      .evaluate((el) => el.getBoundingClientRect().width)
    await page.mouse.move(separator.x + 120, separator.y + 100, { steps: 15 })
    const widthDuring = await page
      .locator('.editor-with-tabs > .container')
      .evaluate((el) => el.getBoundingClientRect().width)
    const sidebarDuring = await page
      .locator('.side-bar')
      .evaluate((el) => el.getBoundingClientRect().width)
    expect(widthDuring).toBeCloseTo(widthBefore, 0)
    expect(sidebarDuring).toBeGreaterThan(sidebarBefore + 50)
    await page.mouse.up()
    await expect
      .poll(() =>
        page
          .locator('.editor-with-tabs > .container')
          .evaluate((el) => el.getBoundingClientRect().width)
      )
      .toBeLessThan(widthBefore - 50)

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'second document')
    await expect(page.locator('.mu-container')).toContainText('second document')
    await page.evaluate(() => {
      const root = document.querySelector('.mu-container') as HTMLElement & {
        __MUYA_BLOCK__: { muya: { replaceContent: (markdown: string) => void } }
      }
      root.__MUYA_BLOCK__.muya.replaceContent('edited second document')
    })
    const secondTabId = await page.locator('.tabs-container > li.active').getAttribute('data-id')
    for (let i = 0; i < 3; i++) {
      await page.locator(`.tabs-container > li[data-id="${firstTabId}"]`).click()
      await expect(page.locator('.mu-container > *')).toHaveCount(1000)
      await page.locator(`.tabs-container > li[data-id="${secondTabId}"]`).click()
      await expect(page.locator('.mu-container')).toContainText('edited second document')
    }
    await page.evaluate(() => {
      const root = document.querySelector('.mu-container') as HTMLElement & {
        __MUYA_BLOCK__: { muya: { undo: () => void } }
      }
      root.__MUYA_BLOCK__.muya.undo()
    })
    await expect(page.locator('.mu-container')).toContainText('second document')
    await expect(page.locator('.mu-container')).not.toContainText('edited second document')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
