import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { clickMenuById, expectNoRendererErrors, getMarkdownContent, launchWithMarkdown, sendIpcToRenderer, setSourceMarkdown } from './helpers'

const markdown = readFileSync(path.resolve(__dirname, '../../../../docs/github-alerts-showcase.md'), 'utf8')
const alertQuote = '.mu-container > blockquote:has(> p:first-child > .mu-paragraph-content > .mu-alert-marker)'

test('GitHub alerts retain their Markdown across themes, editing, and undo', async() => {
  test.setTimeout(60000)
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { appearance: 'light', language: 'en', sideBarVisibility: true }
  })
  try {
    if (process.env.MARKTEXT_E2E_APP_PATH) await setSourceMarkdown(page, app, markdown)
    await page.locator('.mu-paragraph-content').last().click()
    await expect(page.locator(alertQuote)).toHaveCount(6)
    const note = page.locator(alertQuote).first()
    const marker = note.locator('.mu-alert-marker')
    await expect(marker).toHaveCSS('color', 'rgb(9, 105, 218)')
    await expect(note).toHaveCSS('border-left-color', 'rgb(9, 105, 218)')
    await expect(note).toHaveCSS('border-left-style', 'solid')
    expect(await marker.evaluate(el => getComputedStyle(el, '::after').content)).toBe('"Note"')
    expect(await marker.evaluate(el => getComputedStyle(el, '::before').maskImage)).toContain('data:image/svg+xml')
    const folderButton = page.locator('.open-project .el-button')
    await expect(folderButton).toHaveCSS('height', '28px')

    for (const theme of ['academic', 'liber', 'github']) {
      await clickMenuById(app, theme)
      await expect(note).toHaveCSS('border-left-color', 'rgb(9, 105, 218)')
    }
    await page.locator('.appearance-switch').click()
    await page.locator('.appearance-menu .el-dropdown-menu__item').filter({ hasText: /^Dark$/ }).click()
    await expect(page.locator('body')).toHaveClass(/dark/)
    await expect(marker).toHaveCSS('color', 'rgb(68, 147, 248)')
    await expect(note).toHaveCSS('border-left-color', 'rgb(31, 111, 235)')
    await page.locator('.mu-container > h1').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/github-alerts-dark.png' })
    await page.locator('.appearance-switch').click()
    await page.locator('.appearance-menu .el-dropdown-menu__item').filter({ hasText: /^Light$/ }).click()

    expect(await getMarkdownContent(page, app)).toBe(markdown)
    await marker.click({ timeout: 5000 })
    await expect(marker).toHaveClass(/mu-alert-edit/)
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.keyboard.insertText('[!TIP]')
    await expect(note.locator('.mu-alert-marker')).toHaveAttribute('data-alert', 'TIP')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect(note.locator('.mu-alert-marker')).toHaveAttribute('data-alert', 'NOTE')

    await setSourceMarkdown(page, app, markdown.replace('[!NOTE]', '[!TIP]'))
    await expect(note.locator('.mu-alert-marker')).toHaveAttribute('data-alert', 'TIP')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect(note.locator('.mu-alert-marker')).toHaveAttribute('data-alert', 'NOTE')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'redo')
    await expect(note.locator('.mu-alert-marker')).toHaveAttribute('data-alert', 'TIP')
    await setSourceMarkdown(page, app, markdown)
    await page.locator('.mu-paragraph-content').last().click()
    await page.locator('.mu-container > h1').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'test-results/github-alerts-light.png' })
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

// eslint-disable-next-line no-empty-pattern -- Electron supplies the pages without a Playwright browser fixture.
test('Alert HTML and PDF exports match the document theme', async({}, testInfo) => {
  test.setTimeout(120000)
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { appearance: 'light', language: 'en' }
  })
  try {
    if (process.env.MARKTEXT_E2E_APP_PATH) await setSourceMarkdown(page, app, markdown)
    await page.locator('.mu-paragraph-content').last().click()
    for (const theme of ['github', 'academic', 'liber']) {
      await clickMenuById(app, theme)
      await page.locator('.mu-container > h1').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`github-alerts-${theme}-live.png`) })
      const live = await page.locator(alertQuote).evaluateAll(elements => elements.map(element => {
        const marker = element.querySelector('.mu-alert-marker')!
        const link = element.querySelector('.mu-link, a.mu-inline-rule')
        const style = getComputedStyle(element)
        return {
          border: style.borderLeftColor,
          width: style.borderLeftWidth,
          color: style.color,
          font: style.fontFamily,
          size: style.fontSize,
          lineHeight: style.lineHeight,
          padding: style.paddingLeft,
          margin: style.marginBottom,
          icon: getComputedStyle(marker, '::before').width,
          titleSize: getComputedStyle(marker, '::after').fontSize,
          link: link ? { color: getComputedStyle(link).color, decoration: getComputedStyle(link).textDecorationLine } : null,
          title: getComputedStyle(marker).color
        }
      }))
      for (const type of ['styledHtml', 'pdf']) {
        const output = testInfo.outputPath(`github-alerts-${theme}.${type === 'pdf' ? 'pdf' : 'html'}`)
        await app.evaluate(({ dialog }, filename) => {
          dialog.showSaveDialog = async() => ({ canceled: false, filePath: filename })
        }, output)
        await sendIpcToRenderer(app, 'mt::show-export-dialog', type)
        await page.locator('.export-settings-dialog .button-primary').click()
        await expect.poll(() => existsSync(output), { timeout: 30000 }).toBe(true)
        if (type === 'pdf') {
          expect(readFileSync(output).subarray(0, 5).toString()).toBe('%PDF-')
          continue
        }
        const window = app.waitForEvent('window')
        await app.evaluate(({ BrowserWindow }, filename) => {
          const preview = new BrowserWindow({ show: true, width: 1280, height: 1000, webPreferences: { backgroundThrottling: false } })
          void preview.loadFile(filename)
        }, output)
        const preview = await window
        await preview.waitForLoadState('load')
        await expect(preview.locator('.markdown-alert')).toHaveCount(6)
        const exported = await preview.locator('.markdown-alert').evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element)
          const link = element.querySelector('a')
          return {
            border: style.borderLeftColor,
            width: style.borderLeftWidth,
            color: style.color,
            font: style.fontFamily,
            size: style.fontSize,
            lineHeight: style.lineHeight,
            padding: style.paddingLeft,
            margin: style.marginBottom,
            icon: getComputedStyle(element.querySelector('svg')!).width,
            titleSize: getComputedStyle(element.querySelector('.markdown-alert-title')!).fontSize,
            link: link ? { color: getComputedStyle(link).color, decoration: getComputedStyle(link).textDecorationLine } : null,
            title: getComputedStyle(element.querySelector('.markdown-alert-title')!).color
          }
        }))
        expect(exported).toEqual(live)
        await expect(preview.locator('.markdown-alert-title svg')).toHaveCount(6)
        await preview.screenshot({ path: testInfo.outputPath(`github-alerts-${theme}-html.png`), fullPage: true })
        await preview.close()
      }
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})
