import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { expectNoRendererErrors, getMarkdownContent, launchWithMarkdown } from './helpers'

async function captureMenu(app: ElectronApplication) {
  await app.evaluate(({ Menu }) => {
    const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
    Menu.prototype.popup = function() { state.popupMenu = this }
  })
}

async function openMenu(app: ElectronApplication, page: Page, text: string, expected: string[]) {
  await page.locator('.mu-paragraph-content').filter({ hasText: text }).first().click({ button: 'right' })
  await expect.poll(() => app.evaluate(() => {
    const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
    return state.popupMenu?.items.filter(item => item.id?.startsWith('context-type-at-')).map(item => item.label)
  })).toEqual(expected)
}

async function typeAtLevel(app: ElectronApplication, direction: 'previous' | 'next') {
  await app.evaluate(({ BrowserWindow }, direction) => {
    const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
    const win = BrowserWindow.getAllWindows()[0]
    const item = state.popupMenu?.getMenuItemById(`context-type-at-${direction}-level`)
    if (!item) throw new Error(`Missing typing level: ${direction}`)
    item.click(undefined, win, win.webContents)
  }, direction)
}

async function clickMenuAction(app: ElectronApplication, label: string, menu = '编辑') {
  await app.evaluate(({ Menu, BrowserWindow }, { label, menu }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const item = Menu.getApplicationMenu()?.items.find(item => item.label === menu)?.submenu?.items.find(item => item.label === label)
    if (!item) throw new Error(`Missing menu action: ${label}`)
    item.click(undefined, win, win.webContents)
  }, { label, menu })
}

const preferences = { language: 'zh-CN', spellcheckerEnabled: false, autoSave: false }

test('continues a parent list from its nested item, preserving children, Enter, undo and save', async() => {
  const { app, page, filePath } = await launchWithMarkdown('- parent\n  - child\n  - other child\n- sibling\n\nafter', {
    suppressErrorDialog: true, preferences
  })
  try {
    await captureMenu(app)
    await openMenu(app, page, 'child', ['在上一层级键入'])
    await typeAtLevel(app, 'previous')
    const items = page.locator('.editor-component > .mu-container > ul > li')
    await expect(items).toHaveCount(3)
    await expect(items.first().locator('ul > li')).toHaveText(['child', 'other child'])
    await clickMenuAction(app, '撤销')
    await expect(items).toHaveCount(2)
    await clickMenuAction(app, '重做')
    await expect(items).toHaveCount(3)
    await page.keyboard.type('new parent')
    await expect(items.nth(1)).toHaveText('new parent')
    await page.keyboard.press('Enter')
    await page.keyboard.type('following parent')
    await expect(items).toHaveCount(4)
    await expect(items.nth(2)).toHaveText('following parent')
    await clickMenuAction(app, '保存', '文件')
    await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain('- new parent\n- following parent\n- sibling')
    await getMarkdownContent(page, app)
    await expect(items).toHaveCount(4)
    await expectNoRendererErrors(app)
    await page.screenshot({ path: 'test-results/context-typing-levels.png' })
  } finally {
    await app.close()
  }
})

test('enters an existing child task list and returns to the parent task list', async() => {
  const { app, page, filePath } = await launchWithMarkdown('- [x] parent\n  - [x] child\n- [x] sibling', {
    suppressErrorDialog: true, preferences
  })
  try {
    await captureMenu(app)
    await openMenu(app, page, 'parent', ['在上一层级键入', '在下一层级键入'])
    await typeAtLevel(app, 'next')
    await page.keyboard.type('new child')
    const root = page.locator('.editor-component > .mu-container > ul')
    await expect(root.locator(':scope > li')).toHaveCount(2)
    const children = root.locator(':scope > li').first().locator('ul > li')
    await expect(children).toHaveCount(2)
    await expect(children.nth(1)).toContainText('new child')
    await expect(children.nth(1).locator('input[type=checkbox]')).not.toBeChecked()
    await openMenu(app, page, 'new child', ['在上一层级键入'])
    await typeAtLevel(app, 'previous')
    await page.keyboard.type('new parent')
    await expect(root.locator(':scope > li')).toHaveCount(3)
    await expect(root.locator(':scope > li').nth(1).locator('input[type=checkbox]')).not.toBeChecked()
    await clickMenuAction(app, '保存', '文件')
    await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain('- [ ] new parent\n- [x] sibling')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('shows only existing levels, exits a quote to root and hides actions for a text selection', async() => {
  const { app, page } = await launchWithMarkdown('root\n\n> outer\n>\n> > inner\n>\n> tail\n\n- single', {
    suppressErrorDialog: true, preferences
  })
  try {
    await captureMenu(app)
    await openMenu(app, page, 'root', [])
    await openMenu(app, page, 'single', ['在上一层级键入'])
    await openMenu(app, page, 'outer', ['在上一层级键入', '在下一层级键入'])
    await typeAtLevel(app, 'next')
    await page.keyboard.type('new inner')
    await expect(page.locator('blockquote blockquote')).toContainText('new inner')
    await openMenu(app, page, 'new inner', ['在上一层级键入'])
    await typeAtLevel(app, 'previous')
    await page.keyboard.type('new outer')
    await expect(page.locator('blockquote > p .mu-paragraph-content').filter({ hasText: 'new outer' })).toHaveCount(1)
    await openMenu(app, page, 'new outer', ['在上一层级键入', '在下一层级键入'])
    await typeAtLevel(app, 'previous')
    await page.keyboard.type('new root')
    await openMenu(app, page, 'new root', [])
    const paragraph = page.locator('.mu-paragraph-content').filter({ hasText: 'outer' }).first()
    await paragraph.evaluate(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = document.getSelection()
      if (!selection) throw new Error('Missing selection')
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await paragraph.click({ button: 'right' })
    await expect.poll(() => app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.items.filter(item => item.id?.startsWith('context-type-at-')).length
    })).toBe(0)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
