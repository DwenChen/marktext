import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { launchWithMarkdown, expectNoRendererErrors } from './helpers'

const DOC = '# Document\n\n## Details\n\n| Left | Right |\n| :--- | ---: |\n| A | B |\n'

test('tables center by default, update through settings and export with the same alignment', async() => {
  const { app, page } = await launchWithMarkdown(DOC, { suppressErrorDialog: true, preferences: { language: 'en', appearance: 'light' } })
  try {
    const table = page.locator('.mu-table-inner')
    const figure = page.locator('.mu-table')
    await expect(table).toBeVisible()
    const centerError = async() => {
      const a = (await table.boundingBox())!
      const b = (await figure.boundingBox())!
      return Math.abs(a.x + a.width / 2 - b.x - b.width / 2)
    }
    await expect.poll(centerError).toBeLessThan(2)
    const originalAlignment = await table.locator('td').evaluateAll(els => els.map(el => getComputedStyle(el).textAlign))
    const opened = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    const prefs = await opened
    await prefs.locator('.pref-sidebar .category .item').filter({ hasText: /^Editor$/ }).click()
    const toggle = prefs.locator('.center-tables-setting .el-switch')
    await expect(toggle).toHaveClass(/is-checked/)
    await toggle.click()
    await expect.poll(async() => Math.abs((await table.boundingBox())!.x - (await figure.boundingBox())!.x)).toBeLessThan(2)
    expect(await table.locator('td').evaluateAll(els => els.map(el => getComputedStyle(el).textAlign))).toEqual(originalAlignment)
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    expect(JSON.parse(readFileSync(path.join(userData, 'preferences.json'), 'utf8')).centerTables).toBe(false)
    await app.evaluate(({ ipcMain, BrowserWindow }, editorUrl) => {
      ipcMain.removeAllListeners('mt::response-export')
      ipcMain.on('mt::response-export', (_event, output) => { (globalThis as typeof globalThis & { tableExport?: { content: string } }).tableExport = output })
      BrowserWindow.getAllWindows().find(win => win.webContents.getURL() === editorUrl)!.webContents.send('mt::show-export-dialog', 'styledHtml')
    }, page.url())
    await page.locator('.el-dialog:visible .button-primary').click()
    await expect.poll(() => app.evaluate(() => (globalThis as typeof globalThis & { tableExport?: { content: string } }).tableExport?.content)).toBeTruthy()
    const html = await app.evaluate(() => (globalThis as typeof globalThis & { tableExport?: { content: string } }).tableExport?.content || '')
    expect(html).toMatch(/margin-inline:\s*0\s*!important/)
    expect(html).not.toMatch(/margin-inline:\s*auto\s*!important/)
    await toggle.click()
    await expect.poll(centerError).toBeLessThan(2)
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

test('export dialogs show only applicable controls and collapse advanced settings', async() => {
  const { app, page } = await launchWithMarkdown(DOC, { suppressErrorDialog: true, preferences: { language: 'en', appearance: 'dark' } })
  try {
    for (const format of ['pdf', 'styledHtml', 'png', 'print']) {
      await app.evaluate(({ BrowserWindow }, format) => BrowserWindow.getAllWindows()[0].webContents.send('mt::show-export-dialog', format), format)
      const dialog = page.locator('.el-dialog:visible')
      await expect(dialog).toBeVisible()
      const textColor = await dialog.locator('.el-dialog__body').evaluate(el => getComputedStyle(el).color)
      await expect(dialog.locator('.el-dialog__title')).toHaveCSS('color', textColor)
      await page.screenshot({ path: path.resolve('test-results/export-' + format + '-basic.png') })
      await expect(dialog.locator('.el-tabs')).toHaveCount(0)
      await expect(dialog.locator('.export-advanced')).toHaveCount(0)
      await expect(dialog.locator('.paper-options')).toHaveCount(format === 'pdf' ? 1 : 0)
      await expect(dialog.locator('.margin-options')).toHaveCount(['pdf', 'print'].includes(format) ? 1 : 0)
      await expect(dialog.locator('.image-options')).toHaveCount(format === 'png' ? 1 : 0)
      await expect(dialog.locator('.html-options')).toHaveCount(format === 'styledHtml' ? 1 : 0)
      await dialog.locator('.advanced-toggle').click()
      await expect(dialog.locator('.toc-options')).toHaveCount(0)
      await expect(dialog.locator('.header-footer-options')).toHaveCount(['pdf', 'print'].includes(format) ? 1 : 0)
      const box = (await dialog.boundingBox())!
      const viewport = page.viewportSize() || await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      await page.screenshot({ path: path.resolve('test-results/export-' + format + '.png') })
      await dialog.locator('.button-secondary').click()
      await expect(dialog).not.toBeVisible()
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

test('HTML, PDF and PNG export to real files with document-specific advanced controls', async() => {
  const markdown = '---\ntitle: Export test\n---\n\n[TOC]\n\n> Quotation example.\n\n' + DOC.replace('## Details', 'Details\n-------')
  const { app, page } = await launchWithMarkdown(markdown, { suppressErrorDialog: true, preferences: { language: 'en', appearance: 'light', theme: 'academic' } })
  try {
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    for (const format of ['styledHtml', 'pdf', 'png']) {
      const target = path.join(userData, 'export-test.' + (format === 'styledHtml' ? 'html' : format))
      await app.evaluate(({ dialog, BrowserWindow }, { format, target }) => {
        dialog.showSaveDialog = (async() => ({ canceled: false, filePath: target })) as typeof dialog.showSaveDialog
        BrowserWindow.getAllWindows()[0].webContents.send('mt::show-export-dialog', format)
      }, { format, target })
      const popup = page.locator('.el-dialog:visible')
      await popup.locator('.advanced-toggle').click()
      await expect(popup.locator('.toc-options')).toBeVisible()
      await expect(popup.locator('.content-options')).toContainText('Show front matter')
      await expect(popup.locator('.content-options')).toContainText('Auto numbering headings')
      await popup.locator('.button-primary').click()
      await expect.poll(() => existsSync(target) && readFileSync(target).length > 0, { timeout: 30000 }).toBeTruthy()
      const data = readFileSync(target)
      if (format === 'styledHtml') {
        expect(data.toString()).toContain('toc-container')
        expect(data.toString()).toMatch(/margin-inline:\s*auto\s*!important/)
        const quoteBorder = await page.evaluate(html => {
          const iframe = document.createElement('iframe')
          iframe.hidden = true
          document.body.appendChild(iframe)
          const doc = iframe.contentDocument!
          doc.open()
          doc.write(html)
          doc.close()
          const quote = doc.querySelector('blockquote')!
          const style = doc.defaultView!.getComputedStyle(quote)
          const result = { width: parseFloat(style.borderLeftWidth), style: style.borderLeftStyle }
          iframe.remove()
          return result
        }, data.toString())
        expect(quoteBorder.width).toBeGreaterThan(0)
        expect(quoteBorder.style).toBe('solid')
      } else if (format === 'pdf') {
        expect(data.subarray(0, 5).toString()).toBe('%PDF-')
      } else {
        expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
        expect(data.readUInt32BE(16)).toBe(1200)
      }
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})
