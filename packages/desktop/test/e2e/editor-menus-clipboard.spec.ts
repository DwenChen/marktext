import { expect, test } from '@playwright/test'
import { clickMenuById, launchWithMarkdown, waitForEditor, expectNoRendererErrors } from './helpers'

test('sidebar menus preserve focus and editor context actions round-trip through IPC', async() => {
  const { app, page } = await launchWithMarkdown('prefix selected suffix\n\nlast', {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', sideBarVisibility: true, spellcheckerEnabled: false, autoSave: false }
  })
  try {
    await waitForEditor(page)
    await app.evaluate(({ Menu }) => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      Menu.prototype.popup = function() { state.popupMenu = this }
    })
    const menus = page.locator('.right-column .sidebar-menus button')
    await expect(menus).toHaveText(['段落', '格式', '视图'])
    const content = page.locator('.mu-paragraph-content').first()
    await content.click()
    await menus.first().click()
    const sidebarMenu = await app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.items.map(item => item.id)
    })
    expect(sidebarMenu).toContain('codeFencesMenuItem')
    expect(await page.evaluate(() => document.activeElement?.closest('.editor-component') !== null)).toBe(true)

    await page.evaluate(() => {
      const span = document.querySelector('.mu-paragraph-content') as HTMLElement
      const node = document.createTreeWalker(span, NodeFilter.SHOW_TEXT).nextNode() as Text
      document.getSelection()?.setBaseAndExtent(node, 7, node, 7)
    })
    await content.click({ button: 'right', position: { x: 45, y: 8 } })
    await expect.poll(() => app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.items[0].submenu?.items.map(item => item.id)
    })).toContain('context-block-code-block')
    const contextLabels = await app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.items.map(item => item.label)
    })
    expect(contextLabels).not.toContain('复制为富文本')
    expect(contextLabels).not.toContain('复制为 HTML')
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      const win = BrowserWindow.getAllWindows()[0]
      state.popupMenu?.getMenuItemById('context-block-code-block')?.click(undefined, win, win.webContents)
    })
    await expect(page.locator('.mu-code-block')).toHaveCount(1)
    await expect(content).toHaveText('prefix selected suffix')
    await page.keyboard.type('sample')
    const code = page.locator('.mu-codeblock-content').first()
    await expect(code).toHaveText('sample')
    await code.click({ button: 'right' })
    await expect.poll(() => app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.getMenuItemById('context-block-code-block')?.checked
    })).toBe(true)
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      const win = BrowserWindow.getAllWindows()[0]
      state.popupMenu?.getMenuItemById('context-block-code-block')?.click(undefined, win, win.webContents)
    })
    await expect(page.locator('.mu-code-block')).toHaveCount(0)
    const point = await page.evaluate(() => {
      const span = document.querySelector('.mu-paragraph-content') as HTMLElement
      const node = document.createTreeWalker(span, NodeFilter.SHOW_TEXT).nextNode() as Text
      const selection = document.getSelection()!
      selection.setBaseAndExtent(node, 15, node, 7)
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
    await page.mouse.click(point.x, point.y, { button: 'right' })
    await expect.poll(() => app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.items[0].label
    })).toBe('将选中文字转换为')
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      const win = BrowserWindow.getAllWindows()[0]
      state.popupMenu?.getMenuItemById('context-block-block-quote')?.click(undefined, win, win.webContents)
    })
    await expect(page.locator('.editor-component blockquote')).toHaveText('selected')
    await expect(page.locator('.mu-paragraph-content')).toHaveText(['prefix ', 'selected', ' suffix', 'sample', 'last'])
    await expectNoRendererErrors(app)
    await page.screenshot({ path: 'test-results/editor-menus-sidebar.png' })
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(win => win.destroy()))
    await app.close()
  }
})

test('window menu reflects always-on-top, fullscreen and the current zoom', async() => {
  const { app, page } = await launchWithMarkdown('window state', { preferences: { autoSave: false } })
  try {
    await waitForEditor(page)
    await clickMenuById(app, 'alwaysOnTopMenuItem')
    expect(await app.evaluate(({ BrowserWindow, Menu }) => ({
      active: BrowserWindow.getAllWindows()[0].isAlwaysOnTop(),
      checked: Menu.getApplicationMenu()?.getMenuItemById('alwaysOnTopMenuItem')?.checked
    }))).toEqual({ active: true, checked: true })
    await clickMenuById(app, 'fullScreenMenuItem')
    await expect.poll(() => app.evaluate(({ Menu, BrowserWindow }) => ({
      checked: Menu.getApplicationMenu()?.getMenuItemById('fullScreenMenuItem')?.checked,
      active: BrowserWindow.getAllWindows()[0].isFullScreen()
    }))).toEqual({ checked: true, active: true })
    await clickMenuById(app, 'fullScreenMenuItem')
    await expect.poll(() => app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()?.getMenuItemById('fullScreenMenuItem')?.checked
    )).toBe(false)
    await clickMenuById(app, 'zoomInMenuItem')
    await expect.poll(() => app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()
    )).toBe(1.125)
    await app.evaluate(({ Menu }) => { Menu.prototype.popup = function() {} })
    await page.evaluate(() => window.electron.windowControl.popupApplicationMenu())
    await expect.poll(() => app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()?.getMenuItemById('resetZoomMenuItem')?.label
    )).toContain('113%')
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(win => win.destroy()))
    await app.close()
  }
})

test('one Ctrl+A copies the entire document and Copy Paragraph never inserts a duplicate', async() => {
  const { app, page } = await launchWithMarkdown('first\n\nsecond\n\nlast', {
    suppressErrorDialog: true, preferences: { autoSave: false, sideBarVisibility: true }
  })
  try {
    await waitForEditor(page)
    await page.locator('.mu-paragraph-content').nth(1).click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+c')
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('first\n\nsecond\n\nlast\n')
    await page.locator('.mu-paragraph-content').nth(1).click()
    await app.evaluate(({ BrowserWindow, Menu }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const edit = Menu.getApplicationMenu()?.items.find(item => item.label === 'Edit')
      const copy = edit?.submenu?.items.find(item => item.accelerator === 'Ctrl+Alt+D')
      if (!copy) throw new Error('Copy Paragraph menu item is missing')
      copy.click(undefined, win, win.webContents)
    })
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('second\n')
    await expect(page.locator('.mu-paragraph-content')).toHaveText(['first', 'second', 'last'])
    await page.locator('.right-column .sidebar-menus button').first().focus()
    await app.evaluate(({ BrowserWindow, Menu }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const edit = Menu.getApplicationMenu()?.items.find(item => item.label === 'Edit')
      const select = edit?.submenu?.items.find(item => item.accelerator === 'Ctrl+A')
      if (!select) throw new Error('Select All menu item is missing')
      select.click(undefined, win, win.webContents)
    })
    await expect.poll(() => page.evaluate(() =>
      document.activeElement?.classList.contains('editor-component')
    )).toBe(true)
    await page.keyboard.press('Control+c')
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('first\n\nsecond\n\nlast\n')
    await expectNoRendererErrors(app)
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(win => win.destroy()))
    await app.close()
  }
})

test('Restore All still confirms unsaved changes on window close', async() => {
  const { app, page } = await launchWithMarkdown('saved text', {
    suppressErrorDialog: true,
    preferences: { startUpAction: 'restoreAll', autoSave: false, language: 'en' }
  })
  try {
    await waitForEditor(page)
    await page.locator('.mu-paragraph-content').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' changed')
    await app.evaluate(({ BrowserWindow, dialog }) => {
      const state = globalThis as typeof globalThis & { closeDialog?: string }
      dialog.showMessageBox = (async(_win: unknown, options: { message: string }) => {
        state.closeDialog = options.message
        return { response: 2, checkboxChecked: false }
      }) as typeof dialog.showMessageBox
      BrowserWindow.getAllWindows()[0].close()
    })
    await expect.poll(() => app.evaluate(() => {
      const state = globalThis as typeof globalThis & { closeDialog?: string }
      return state.closeDialog
    })).toBeTruthy()
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(win => win.destroy()))
    await app.close()
  }
})
