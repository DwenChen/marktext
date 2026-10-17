import { expect, test } from '@playwright/test'
import { launchWithMarkdown, expectNoRendererErrors } from './helpers'

test.skip(process.platform === 'darwin', 'macOS uses the native application menu')

const preferences = {
  language: 'zh-CN', titleBarStyle: 'custom', sideBarVisibility: true,
  openedFilesInSidebar: true, spellcheckerEnabled: false, autoSave: false
}

test('sidebar header uses the title row and aligns the hamburger with the icon rail', async() => {
  const { app, page } = await launchWithMarkdown('layout', { preferences, suppressErrorDialog: true })
  try {
    const geometry = await page.evaluate(() => {
      const bounds = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON()
      return {
        menus: bounds('.right-column .sidebar-menus'),
        files: bounds('.opened-files > .title'),
        hamburger: bounds('.frameless-titlebar-menu svg'),
        folder: bounds('.left-column li svg')
      }
    })
    expect(geometry.menus.y).toBe(0)
    expect(geometry.files.y).toBe(geometry.menus.height)
    expect(geometry.hamburger.width).toBe(geometry.folder.width)
    expect(geometry.hamburger.x + geometry.hamburger.width / 2).toBe(geometry.folder.x + geometry.folder.width / 2)
    await page.screenshot({ path: 'test-results/sidebar-menu-layout.png' })
    await page.locator('.left-column li').first().click()
    await expect(page.locator('.compact-menus button')).toHaveCount(4)
    await page.locator('.left-column li').first().click()
    await expect(page.locator('.right-column .sidebar-menus')).toBeVisible()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('application menus have compact label padding and preserve checkbox commands', async() => {
  const { app, page } = await launchWithMarkdown('menu', { preferences, suppressErrorDialog: true })
  try {
    const trigger = page.locator('.frameless-titlebar-menu')
    await trigger.click()
    await page.getByRole('menuitem', { name: '文件', exact: true }).hover()
    const autoSave = page.getByRole('menuitemcheckbox', { name: '自动保存', exact: true })
    await expect(autoSave).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('.menu-check')).toHaveCount(0)
    const padding = await page.locator('.application-menu .menu-item').evaluateAll(elements => elements.map(element => {
      const label = element.querySelector('.menu-label')!
      return label.getBoundingClientRect().left - element.getBoundingClientRect().left
    }))
    for (const value of padding) expect(value).toBeCloseTo(10, 1)
    await page.screenshot({ path: 'test-results/application-file-menu.png' })
    await autoSave.click()
    await expect(page.locator('.application-menu')).toHaveCount(0)
    await trigger.click()
    await page.getByRole('menuitem', { name: '文件', exact: true }).hover()
    await expect(autoSave).toHaveAttribute('aria-checked', 'true')
    await expect(autoSave.locator('.menu-check')).toHaveCount(1)
    const before = await page.locator('.tabs-container li').count()
    await page.getByRole('menuitem', { name: '新建标签页', exact: false }).click()
    await expect(page.locator('.tabs-container li')).toHaveCount(before + 1)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('window menu reflects toggles and zoom without an empty check column', async() => {
  const { app, page } = await launchWithMarkdown('window', { preferences, suppressErrorDialog: true })
  try {
    const trigger = page.locator('.frameless-titlebar-menu')
    const openWindow = async() => {
      await trigger.click()
      await page.getByRole('menuitem', { name: '窗口', exact: true }).hover()
    }
    await openWindow()
    await expect(page.locator('.menu-check')).toHaveCount(0)
    await page.screenshot({ path: 'test-results/application-window-menu.png' })
    await page.getByRole('menuitemcheckbox', { name: '窗口置顶', exact: true }).click()
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop())).toBe(true)
    await openWindow()
    await expect(page.getByRole('menuitemcheckbox', { name: '窗口置顶', exact: true })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menuitem', { name: '放大', exact: true }).click()
    await openWindow()
    await expect(page.getByRole('menuitem', { name: /重置缩放.*113%/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.application-menu')).toHaveCount(0)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('popup keyboard navigation, dismissal and native Copy preserve editor selection', async() => {
  const { app, page } = await launchWithMarkdown('selected text', { preferences, suppressErrorDialog: true })
  try {
    const trigger = page.locator('.frameless-titlebar-menu')
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: '文件', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('menuitem', { name: '新建标签页', exact: false })).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await page.locator('.mu-paragraph-content').first().click()
    await page.evaluate(() => {
      const span = document.querySelector('.mu-paragraph-content')!
      const range = document.createRange()
      range.selectNodeContents(span)
      document.getSelection()!.removeAllRanges()
      document.getSelection()!.addRange(range)
    })
    await trigger.click()
    await page.getByRole('menuitem', { name: '编辑', exact: true }).hover()
    await page.getByRole('menuitem', { name: '复制 Ctrl+C', exact: true }).click()
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('selected text')
    await trigger.click()
    await page.locator('.mu-paragraph-content').first().click()
    await expect(page.locator('.application-menu')).toHaveCount(0)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(640, 480))
    await trigger.click()
    await page.getByRole('menuitem', { name: '文件', exact: true }).hover()
    const fits = await page.locator('.menu-panel').evaluateAll(elements => elements.every(element => {
      const rect = element.getBoundingClientRect()
      return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
    }))
    expect(fits).toBe(true)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('renderer commands reject replaced snapshots and currently disabled menu items', async() => {
  const { app, page } = await launchWithMarkdown('commands', { preferences, suppressErrorDialog: true })
  try {
    const first = await page.evaluate(() => window.electron.ipcRenderer.invoke('mt::menu::get-application'))
    const oldCommand = first.find(item => item.label === '文件')?.submenu?.find(item => item.label === '新建标签页')?.id
    expect(oldCommand).toBeDefined()
    await page.evaluate(() => window.electron.ipcRenderer.invoke('mt::menu::get-application'))
    expect(await page.evaluate(command => window.electron.ipcRenderer.invoke('mt::menu::execute-application', command), oldCommand!)).toBe(false)
    const current = await page.evaluate(() => window.electron.ipcRenderer.invoke('mt::menu::get-application'))
    const zoomCommand = current.find(item => item.label === '窗口')?.submenu?.find(item => item.label === '放大')?.id
    expect(zoomCommand).toBeDefined()
    await app.evaluate(({ Menu }) => { Menu.getApplicationMenu()!.getMenuItemById('zoomInMenuItem')!.enabled = false })
    expect(await page.evaluate(command => window.electron.ipcRenderer.invoke('mt::menu::execute-application', command), zoomCommand!)).toBe(false)
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor())).toBe(1)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
