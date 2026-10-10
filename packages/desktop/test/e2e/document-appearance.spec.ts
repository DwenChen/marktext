import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { clickMenuById, expectNoRendererErrors, launchWithMarkdown } from './helpers'

const DOC =
  '# Rendering styles\n\n## A heading\n\nText with **bold** and `code`.\n\n> A quotation.\n\n- First\n- Second\n\n```js\nconst answer = 42\n```\n'

test('document presets switch live, persist, and follow light/dark mode', async() => {
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true,
    preferences: {
      theme: 'graphite',
      documentStyle: 'github',
      codeBlockLineNumbers: true,
      language: 'en'
    }
  })
  try {
    const root = page.locator('.editor-middle')
    const heading = page.locator('.mu-container h1')
    await expect(root).toHaveAttribute('data-document-style', 'github')
    await expect(heading).toHaveCSS('font-weight', '600')
    await expect(heading).toHaveCSS('color', 'rgb(31, 35, 40)')
    await expect(heading).toHaveCSS('border-bottom-style', 'solid')
    expect(await heading.evaluate((el) => parseFloat(getComputedStyle(el).borderBottomWidth))).toBeGreaterThan(0)
    const gutter = page.locator('.mu-code-block .mu-line-numbers-rows')
    await expect(gutter).toBeAttached()
    await expect(gutter.locator('span')).toHaveCount(1)
    const gutterBounds = await gutter.boundingBox()
    const codeBounds = await page.locator('.mu-code-block .mu-code').boundingBox()
    if (!gutterBounds || !codeBounds) throw new Error('Code block not rendered')
    expect(codeBounds.x).toBeGreaterThanOrEqual(gutterBounds.x + gutterBounds.width - 1)

    const originalContent = await page.locator('.mu-container').textContent()
    for (const documentStyle of ['classic', 'book', 'default', 'github']) {
      await page.evaluate((style) => {
        window.electron.ipcRenderer.send('mt::set-user-preference', { documentStyle: style })
      }, documentStyle)
      await expect(root).toHaveAttribute('data-document-style', documentStyle)
      expect(await page.locator('.mu-container').textContent()).toBe(originalContent)
      if (documentStyle === 'book') {
        await expect(page.locator('.mu-container')).toHaveCSS('font-family', /Georgia/)
      }
      if (documentStyle === 'default') await expect(heading).toHaveCSS('border-bottom-width', '0px')
    }

    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    const preferences = JSON.parse(readFileSync(path.join(userData, 'preferences.json'), 'utf8'))
    expect(preferences.documentStyle).toBe('github')
    expect(preferences.theme).toBe('graphite')

    await clickMenuById(app, 'dark')
    await expect(heading).toHaveCSS('color', 'rgb(240, 246, 252)')
    await clickMenuById(app, 'light')
    await expect(heading).toHaveCSS('color', 'rgb(31, 35, 40)')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('the rendering style selector updates an open editor from preferences', async() => {
  const { app, page } = await launchWithMarkdown(DOC, { preferences: { language: 'en' } })
  try {
    const opened = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    const preferencesPage = await opened
    await preferencesPage
      .locator('.pref-sidebar .category .item')
      .filter({ hasText: 'Editor' })
      .click()
    await preferencesPage.locator('.document-style-select .el-select').click()
    await preferencesPage
      .locator('.el-select-dropdown__item')
      .filter({ hasText: /^GitHub$/ })
      .click()
    await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-style', 'github')
  } finally {
    await app.close()
  }
})

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
    const bufferId = await app.evaluate(({ BrowserWindow }) =>
      (BrowserWindow.getAllWindows()[0] as unknown as { restoreBufferId: string }).restoreBufferId
    )
    const widthFile = path.join(userData, 'editorStates', `${bufferId}_editor_buffer_store.json.sidebar-width.json`)
    await expect.poll(() => {
      try {
        return JSON.parse(readFileSync(widthFile, 'utf8'))
      } catch {
        return null
      }
    }).toBe(width)
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
