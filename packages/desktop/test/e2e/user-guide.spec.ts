import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { expectNoRendererErrors, getMarkdownContent, launchWithMarkdown } from './helpers'

async function openGuide(app: ElectronApplication) {
  await app.evaluate(({ Menu, BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const item = Menu.getApplicationMenu()?.getMenuItemById('userGuideMenuItem')
    if (!item || !win) throw new Error('Missing help menu')
    item.click(undefined, win, win.webContents)
  })
}

test('offline Chinese help searches operations and reads current shortcuts without modifying the document', async() => {
  const initial = '# 本地文档\n\n这里是原始内容。'
  const { app, page } = await launchWithMarkdown(initial, {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', spellcheckerEnabled: false, autoSave: false }
  })
  try {
    await expect(page.getByRole('button', { name: '帮助', exact: true })).toBeVisible()
    await openGuide(app)
    const dialog = page.getByRole('dialog', { name: 'MarkText 使用帮助' })
    await expect(dialog).toBeVisible()
    const search = dialog.getByRole('searchbox')
    await expect(search).toBeFocused()
    await search.fill('图片 拖动')
    await expect(dialog.locator('[data-guide-section="image-drag"]')).toBeVisible()
    await expect(dialog.locator('[data-guide-section="image-drag"]')).toContainText(
      '左右手柄用于缩放'
    )
    await search.fill('Ctrl+S')
    await expect(dialog.locator('tbody tr').filter({ hasText: '文件 › 保存' })).toContainText(
      'Ctrl+S'
    )
    await search.fill('完全不存在的帮助词条xyz')
    await expect(dialog.getByRole('status')).toContainText('未找到相关说明')
    await search.fill('')
    await dialog.getByRole('button', { name: '表格与行列操作', exact: true }).click()
    await expect
      .poll(() => dialog.locator('.guide-content').evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0)
    await page.screenshot({ path: 'test-results/user-guide-chinese.png' })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    expect((await getMarkdownContent(page, app)).trim()).toBe(initial)
    expect(
      await page.evaluate(() =>
        window.electron.ipcRenderer.invoke('mt::keybinding-save-user-keybindings', [
          ['file.save', 'Ctrl+Alt+S']
        ])
      )
    ).toBe(true)
    await openGuide(app)
    await dialog.getByRole('searchbox').fill('Ctrl+Alt+S')
    await expect(dialog.locator('tbody tr').filter({ hasText: '文件 › 保存' })).toContainText(
      'Ctrl+Alt+S'
    )
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('Help is reachable in the full menu with the sidebar hidden and English help remains readable', async() => {
  const { app, page } = await launchWithMarkdown('unchanged document', {
    suppressErrorDialog: true,
    preferences: { language: 'en', titleBarStyle: 'custom', spellcheckerEnabled: false }
  })
  try {
    await app.evaluate(({ Menu, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const item = Menu.getApplicationMenu()?.getMenuItemById('sideBarMenuItem')
      if (!win || !item) throw new Error('Missing sidebar menu')
      if (item.checked) item.click(undefined, win, win.webContents)
    })
    await expect(page.locator('.side-bar')).not.toBeVisible()
    await page.locator('.frameless-titlebar-menu').click()
    await page.getByRole('menuitem', { name: 'Help', exact: true }).click()
    await page.getByRole('menuitem', { name: /User Guide/ }).click()
    const dialog = page.getByRole('dialog', { name: 'MarkText User Guide' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('searchbox').fill('image drag')
    await expect(dialog.locator('[data-guide-section="image-drag"]')).toContainText(
      'side handles resize'
    )
    const accelerator = await app.evaluate(
      ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('userGuideMenuItem')?.accelerator
    )
    expect(accelerator).toBe('F1')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await page.context().setOffline(true)
    await page.locator('.frameless-titlebar-menu').click()
    await page.getByRole('menuitem', { name: 'Help', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Markdown Reference', exact: true }).click()
    const reference = page.getByRole('dialog', { name: 'Markdown Reference', exact: true })
    await expect(reference).toBeVisible()
    await reference.getByRole('searchbox').fill('footnotes')
    await expect(reference.locator('[data-guide-section="footnotes"]')).toContainText(
      'disabled by default'
    )
    await page.keyboard.press('Escape')
    await expect(reference).not.toBeVisible()
    expect((await getMarkdownContent(page, app)).trim()).toBe('unchanged document')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('Help contains only two entries and Markdown Reference works offline without changing the document', async() => {
  const initial = '# 原始文档\n\n保持文档原样。'
  const { app, page } = await launchWithMarkdown(initial, {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', spellcheckerEnabled: false, autoSave: false }
  })
  try {
    const menu = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        ?.getMenuItemById('helpMenu')
        ?.submenu?.items.map((item) => ({
          id: item.id,
          label: item.label,
          type: item.type
        }))
    )
    expect(menu).toEqual([
      { id: 'userGuideMenuItem', label: '使用帮助', type: 'normal' },
      { id: 'markdownReferenceMenuItem', label: 'Markdown 参考', type: 'normal' }
    ])
    await page.context().setOffline(true)
    const networkRequests: string[] = []
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) networkRequests.push(request.url())
    })
    await app.evaluate(({ Menu, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const item = Menu.getApplicationMenu()?.getMenuItemById('markdownReferenceMenuItem')
      if (!item || !win) throw new Error('Missing Markdown reference menu')
      item.click(undefined, win, win.webContents)
    })
    const dialog = page.getByRole('dialog', { name: 'Markdown 参考', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.guide-toc button')).toHaveCount(19)
    await expect(dialog.locator('[data-guide-section="syntax-start"]')).toContainText('默认关闭')
    const search = dialog.getByRole('searchbox')
    await expect(search).toBeFocused()
    await search.fill('脚注')
    await expect(dialog.locator('[data-guide-section="footnotes"] pre')).toContainText('[^note]:')
    await expect(dialog.locator('[data-guide-section="footnotes"]')).toContainText('默认关闭')
    await search.fill('tex_math_gfm')
    await expect(dialog.locator('[data-guide-section="math-other"] pre')).toContainText('```math')
    await search.fill('PlantUML')
    await expect(dialog.locator('[data-guide-section="diagrams-data-server"]')).toContainText(
      '本地服务器'
    )
    await expect(dialog.locator('img, iframe, script')).toHaveCount(0)
    await expect(dialog.locator('[data-guide-section="commands"]')).toHaveCount(0)
    await search.fill('没有这种语法xyz')
    await expect(dialog.getByRole('status')).toContainText('未找到相关说明')
    await search.fill('')
    await dialog.getByRole('button', { name: 'GFM 表格', exact: true }).click()
    await expect
      .poll(() => dialog.locator('.guide-content').evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0)
    await page.screenshot({ path: 'test-results/markdown-reference-offline.png' })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await openGuide(app)
    const guide = page.getByRole('dialog', { name: 'MarkText 使用帮助' })
    await expect(guide).toBeVisible()
    await expect(guide.locator('[data-guide-section="start"]')).toBeVisible()
    await expect(guide.locator('[data-guide-section="syntax-start"]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    expect((await getMarkdownContent(page, app)).trim()).toBe(initial)
    expect(networkRequests).toEqual([])
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
