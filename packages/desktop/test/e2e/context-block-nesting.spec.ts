import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { expectNoRendererErrors, getMarkdownContent, launchWithMarkdown } from './helpers'

async function clickMenuAction(app: ElectronApplication, label: string, menu = '编辑') {
  await app.evaluate(({ Menu, BrowserWindow }, { label, menu }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const item = Menu.getApplicationMenu()?.items.find(item => item.label === menu)?.submenu?.items.find(item => item.label === label)
    if (!item) throw new Error(`Menu action missing: ${label}`)
    item.click(undefined, win, win.webContents)
  }, { label, menu })
}

async function captureMenu(app: ElectronApplication) {
  await app.evaluate(({ Menu }) => {
    const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
    Menu.prototype.popup = function() { state.popupMenu = this }
  })
}

async function openMenu(page: Page, app: ElectronApplication, selector: string, enabled: boolean) {
  await page.locator(selector).first().click({ button: 'right', position: { x: 30, y: 8 } })
  await expect.poll(() => app.evaluate(() => {
    const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
    const item = state.popupMenu?.getMenuItemById('context-nest-block')
    return item ? { label: item.label, enabled: item.enabled } : null
  })).toEqual({ label: '在此层级嵌套块格式', enabled })
}

const blocks = [
  ['table', 'table'],
  ['code-block', '.mu-code-block'],
  ['block-quote', 'blockquote'],
  ['math-block', '.mu-math-block'],
  ['order-list', 'ol'],
  ['bullet-list', 'ul']
] as const

for (const [type, selector] of blocks) {
  test(`native context menu nests ${type} in the current list item and preserves saved structure`, async() => {
    const { app, page, filePath } = await launchWithMarkdown('- parent text\n- sibling\n\nafter', {
      suppressErrorDialog: true,
      preferences: { language: 'zh-CN', spellcheckerEnabled: false, autoSave: false }
    })
    try {
      await captureMenu(app)
      await openMenu(page, app, '.mu-paragraph-content', true)
      await app.evaluate(({ BrowserWindow }, type) => {
        const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
        const win = BrowserWindow.getAllWindows()[0]
        state.popupMenu?.getMenuItemById(`context-nest-block-${type}`)?.click(undefined, win, win.webContents)
      }, type)
      const nested = page.locator('.editor-component > .mu-container > ul > li').first().locator(selector)
      await expect(nested).toHaveCount(1)
      await expect(page.locator('.editor-component > .mu-container > ul > li')).toHaveCount(2)
      await expect(page.locator('.mu-paragraph-content').first()).toHaveText('parent text')
      await clickMenuAction(app, '撤销')
      await expect(nested).toHaveCount(0)
      await clickMenuAction(app, '重做')
      await expect(nested).toHaveCount(1)
      await page.keyboard.type('nested')
      await clickMenuAction(app, '保存', '文件')
      await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain('nested')
      const saved = fs.readFileSync(filePath, 'utf8')
      expect(saved).toContain('parent text')
      expect(saved).toContain('sibling')
      expect(saved).toContain('after')
      await getMarkdownContent(page, app)
      await expect(nested).toHaveCount(1)
      await expect(nested).toContainText('nested')
      await nested.locator('.mu-content').last().click({ button: 'right' })
      await expect.poll(() => app.evaluate((_, type) => {
        const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
        return state.popupMenu?.getMenuItemById(`context-block-${type}`)?.checked
      }, type)).toBe(true)
      await app.evaluate(({ BrowserWindow }, type) => {
        const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
        const win = BrowserWindow.getAllWindows()[0]
        state.popupMenu?.getMenuItemById(`context-block-${type}`)?.click(undefined, win, win.webContents)
      }, type)
      await expect(nested).toHaveCount(0)
      await expect(page.locator('.editor-component > .mu-container > ul > li')).toHaveCount(2)
      await expect(page.locator('.mu-paragraph-content').first()).toHaveText('parent text')
      await clickMenuAction(app, '撤销')
      await expect(nested).toHaveCount(1)
      await expectNoRendererErrors(app)
      if (type === 'bullet-list') {
        await page.locator('.mu-paragraph-content').first().click({ button: 'right' })
        await page.screenshot({ path: 'test-results/context-block-nesting.png' })
      }
    } finally {
      await app.close()
    }
  })
}

test('nests a quote inside a quote and disables nesting at root, inside code and for selected text', async() => {
  const { app, page } = await launchWithMarkdown('root\n\n> quoted\n\n- ```\n  code\n  ```', {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', spellcheckerEnabled: false, autoSave: false }
  })
  try {
    await captureMenu(app)
    await openMenu(page, app, '.mu-paragraph-content', false)
    await openMenu(page, app, '.mu-codeblock-content', false)
    await openMenu(page, app, 'blockquote .mu-paragraph-content', true)
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      const win = BrowserWindow.getAllWindows()[0]
      state.popupMenu?.getMenuItemById('context-nest-block-block-quote')?.click(undefined, win, win.webContents)
    })
    await expect(page.locator('blockquote blockquote')).toHaveCount(1)
    await page.keyboard.type('inner quote')
    await expect(page.locator('blockquote blockquote')).toHaveText('inner quote')
    await page.locator('blockquote .mu-paragraph-content').first().evaluate(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = document.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await page.locator('blockquote .mu-paragraph-content').first().click({ button: 'right' })
    await expect.poll(() => app.evaluate(() => {
      const state = globalThis as typeof globalThis & { popupMenu?: Electron.Menu }
      return state.popupMenu?.getMenuItemById('context-nest-block')?.enabled
    })).toBe(false)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
