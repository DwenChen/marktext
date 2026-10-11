import { expect, test } from '@playwright/test'
import path from 'node:path'
import { launchWithMarkdown, clickMenuById, expectNoRendererErrors } from './helpers'

const DOC = '# 文档标题\n\n> 适用：RTL 与 Testbench 编写。\n> 本文为独立编码规范。\n\n> 外层引用\n>\n> > 内层引用\n'

test('Chinese export labels avoid duplicate colons and switch states remain distinct in both appearances', async() => {
  const { app, page } = await launchWithMarkdown(DOC, { suppressErrorDialog: true, preferences: { language: 'zh-CN', appearance: 'light' } })
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('mt::show-export-dialog', 'styledHtml'))
    const dialog = page.locator('.el-dialog:visible')
    await expect(dialog.locator('.html-options .description span').first()).toHaveText('页面标题')
    await page.screenshot({ path: path.resolve('test-results/clean-export-label.png'), animations: 'disabled' })
    await dialog.locator('.button-secondary').click()
    const opened = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    const prefs = await opened
    const control = prefs.locator('.pref-switch-item').first()
    const toggle = control.locator('.el-switch')
    const thumb = control.locator('.el-switch__action')
    const track = control.locator('.el-switch__core')
    await expect(toggle).not.toHaveClass(/is-checked/)
    for (const appearance of ['light', 'dark']) {
      await page.evaluate(appearance => window.electron.ipcRenderer.send('mt::set-user-preference', { appearance }), appearance)
      if (appearance === 'dark') await expect(prefs.locator('body')).toHaveClass(/dark/)
      else await expect(prefs.locator('body')).not.toHaveClass(/dark/)
      const offThumb = await thumb.evaluate(el => getComputedStyle(el).backgroundColor)
      const offTrack = await track.evaluate(el => getComputedStyle(el).backgroundColor)
      expect(offThumb).not.toBe(offTrack)
      expect(offTrack).not.toBe('rgb(255, 255, 255)')
      const before = (await thumb.boundingBox())!
      await control.screenshot({ path: path.resolve('test-results/switch-' + appearance + '-off.png'), animations: 'disabled' })
      await toggle.click()
      await expect(toggle).toHaveClass(/is-checked/)
      await expect.poll(async() => (await thumb.boundingBox())!.x).toBeGreaterThan(before.x + 10)
      const onTrack = await track.evaluate(el => getComputedStyle(el).backgroundColor)
      expect(onTrack).not.toBe(offTrack)
      await control.screenshot({ path: path.resolve('test-results/switch-' + appearance + '-on.png'), animations: 'disabled' })
      await toggle.click()
      await expect(toggle).not.toHaveClass(/is-checked/)
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

test('document themes own quote markers and nested quotes retain their separate levels', async() => {
  const { app, page } = await launchWithMarkdown(DOC, { suppressErrorDialog: true, preferences: { language: 'en', appearance: 'light' } })
  try {
    const quotes = page.locator('.mu-container blockquote')
    await expect(quotes).toHaveCount(3)
    const originalText = await quotes.first().textContent()
    for (const appearance of ['light', 'dark']) {
      await page.evaluate(appearance => window.electron.ipcRenderer.send('mt::set-user-preference', { appearance }), appearance)
      if (appearance === 'dark') await expect(page.locator('body')).toHaveClass(/dark/)
      for (const theme of ['github', 'liber', 'academic']) {
        await clickMenuById(app, theme)
        await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-theme', theme)
        const markers = await quotes.evaluateAll(els => els.map(el => ({
          legacyContent: getComputedStyle(el, '::before').content,
          border: parseFloat(getComputedStyle(el).borderLeftWidth)
        })))
        for (const marker of markers) {
          expect(marker.legacyContent).toBe('none')
          expect(marker.border).toBeGreaterThan(0)
        }
        expect(await quotes.first().textContent()).toBe(originalText)
        await page.screenshot({ path: path.resolve('test-results/quote-' + theme + '-' + appearance + '.png'), animations: 'disabled' })
      }
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

test('table grid uses one border layer while rectangle selection stays visible', async() => {
  const markdown = DOC + '\n| 元素 | 规则 | 示例 |\n| --- | --- | --- |\n| 端口 | `i` / `o` / `io` + 域标签 + 小写功能（下划线分段） | `iEep_wr_en`、`oEep_busy`、`oSpi_csn` |\n| 本地信号 | 全小写 + 下划线 | `counter_val`、`wr_en` |\n| 参数 | 全大写 + 下划线 | `WIDTH`、`MAX_COUNT` |\n| 后缀 | `n` =低有效、`_p` =脉冲、`_r` =寄存、`_nxt` =下一拍 | `iRstn`、`oDone_p`、`counter_r`、`state_nxt` |\n| 例化 | `u_` 前缀 | `u_fifo`、`u_uart` |\n'
  const { app, page } = await launchWithMarkdown(markdown, { suppressErrorDialog: true, preferences: { language: 'en', appearance: 'light', theme: 'academic' } })
  try {
    const table = page.locator('.mu-table-inner')
    await expect(table).toBeVisible()
    const originalText = await table.textContent()
    for (const appearance of ['light', 'dark']) {
      await page.evaluate(appearance => window.electron.ipcRenderer.send('mt::set-user-preference', { appearance }), appearance)
      if (appearance === 'dark') await expect(page.locator('body')).toHaveClass(/dark/)
      for (const theme of ['academic', 'github', 'liber']) {
        await clickMenuById(app, theme)
        await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-theme', theme)
        const borders = await table.locator('td').evaluateAll(els => els.map(el => {
          const style = getComputedStyle(el)
          const overlay = getComputedStyle(el, '::before')
          return { widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth], colors: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor], overlay: [overlay.borderTopColor, overlay.borderRightColor, overlay.borderBottomColor, overlay.borderLeftColor] }
        }))
        for (const border of borders) {
          expect(border.widths.every(width => parseFloat(width) > 0)).toBe(true)
          expect(new Set(border.colors).size).toBe(1)
          expect(border.colors).toEqual(borders[0].colors)
          expect(border.overlay.every(color => color === 'rgba(0, 0, 0, 0)')).toBe(true)
        }
        expect(await table.textContent()).toBe(originalText)
        await table.screenshot({ path: path.resolve('test-results/table-' + theme + '-' + appearance + '.png'), animations: 'disabled' })
      }
    }
    const from = table.locator('tr').nth(1).locator('.mu-table-cell-content').first()
    const to = table.locator('tr').nth(2).locator('.mu-table-cell-content').nth(1)
    const a = (await from.boundingBox())!, b = (await to.boundingBox())!
    await page.mouse.move(a.x + 4, a.y + 5)
    await page.mouse.down()
    await page.mouse.move(b.x + 5, b.y + 5, { steps: 10 })
    await page.mouse.up()
    await expect(table.locator('.mu-table-cell-selected')).toHaveCount(4)
    const outline = await table.locator('.mu-table-cell-border-top').first().evaluate(el => getComputedStyle(el, '::before').borderTopColor)
    expect(outline).not.toBe('rgba(0, 0, 0, 0)')
    await table.screenshot({ path: path.resolve('test-results/table-selection.png'), animations: 'disabled' })
    await page.locator('.mu-container h1').click()
    await expect(table.locator('.mu-table-cell-selected')).toHaveCount(0)
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})
