import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  clickMenuById,
  expectNoRendererErrors,
  launchWithMarkdown,
  launchElectron,
  enterSourceMode
} from './helpers'

const DOC =
  '# Document title\n\n## Subheading\n\nText with **bold**, a [link](https://example.com) and `code`.\n\n> A quotation.\n\n- First\n- Second\n\n```js\nconst answer = 42\n```\n'

test('appearance shortcut is available with a native title bar and no document open', async() => {
  const { app, page } = await launchElectron([], {
    suppressErrorDialog: true,
    preferences: { titleBarStyle: 'native', startUpAction: 'blank', language: 'en' }
  })
  try {
    await expect(page.locator('.native-appearance .appearance-switch')).toBeVisible()
    await page.locator('.appearance-switch').click()
    await page.locator('.appearance-menu .el-dropdown-menu__item').filter({ hasText: /^Dark$/ }).click()
    await expect(page.locator('body')).toHaveClass(/dark/)
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

test('old palettes migrate to GitHub; appearance follows system and stays independent', async() => {
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true,
    preferences: { theme: 'nord', documentStyle: 'book', followSystemTheme: false, language: 'en' }
  })
  try {
    await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-theme', 'github')
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    let prefs = JSON.parse(readFileSync(path.join(userData, 'preferences.json'), 'utf8'))
    expect(prefs.appearance).toBe('system')
    expect(prefs.documentStyle).toBeUndefined()
    expect(prefs.followSystemTheme).toBeUndefined()
    const columnWidth = await page
      .locator('.mu-container')
      .evaluate((el) => el.getBoundingClientRect().width)
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark'
    })
    await expect(page.locator('body')).toHaveClass(/dark/)
    await expect(page.locator('.mu-container h1')).toHaveCSS('color', 'rgb(240, 246, 252)')
    expect(
      await page.locator('.mu-container').evaluate((el) => el.getBoundingClientRect().width)
    ).toBe(columnWidth)
    await clickMenuById(app, 'academic')
    await expect(page.locator('body')).toHaveClass(/dark/)
    await expect(page.locator('.mu-container')).toHaveCSS('font-family', /Georgia/)
    await page.locator('.appearance-switch').click()
    await page
      .locator('.appearance-menu .el-dropdown-menu__item')
      .filter({ hasText: /^Light$/ })
      .click()
    await expect(page.locator('body')).not.toHaveClass(/dark/)
    await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-theme', 'academic')
    await enterSourceMode(page, app)
    await page.locator('.appearance-switch').click()
    await page
      .locator('.appearance-menu .el-dropdown-menu__item')
      .filter({ hasText: /^Dark$/ })
      .click()
    await expect(page.locator('.CodeMirror')).toHaveClass(/cm-s-railscasts/)
    prefs = JSON.parse(readFileSync(path.join(userData, 'preferences.json'), 'utf8'))
    expect(prefs.theme).toBe('academic')
    expect(prefs.appearance).toBe('dark')
    await page.locator('.appearance-switch').click()
    await page
      .locator('.appearance-menu .el-dropdown-menu__item')
      .filter({ hasText: /^Follow system$/ })
      .click()
    await expect(page.locator('.appearance-switch')).toHaveAttribute(
      'title',
      'Appearance: Follow system'
    )
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('all three document themes apply live without changing the text', async() => {
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true,
    preferences: { appearance: 'light', language: 'en', codeBlockLineNumbers: true }
  })
  try {
    const original = await page.locator('.mu-container').textContent()
    for (const id of ['academic', 'liber', 'github']) {
      await clickMenuById(app, id)
      await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-theme', id)
      const heading = page.locator('.mu-container h1')
      await expect(heading).toHaveCSS('font-size', id === 'github' ? '32px' : '28.8px')
      const border = await heading.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderBottomWidth)
      )
      if (id === 'github') expect(border).toBeGreaterThan(0)
      else expect(border).toBe(0)
      expect(await page.locator('.mu-container').textContent()).toBe(original)
    }
    const code = await page.locator('.mu-code-block .mu-code').boundingBox()
    const gutter = await page.locator('.mu-line-numbers-rows').boundingBox()
    expect(code!.x).toBeLessThanOrEqual(gutter!.x)
    const codePadding = await page
      .locator('.mu-code-block .mu-code')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
    expect(codePadding).toBeGreaterThan(gutter!.width)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('settings import CSS, scope it to documents, persist it and remove it', async() => {
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true,
    preferences: { appearance: 'light', language: 'en' }
  })
  try {
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    const file = path.join(userData, 'My theme.css')
    writeFileSync(
      file,
      ':root { --editorBgColor: red; } @media screen { .markdown-body { & h1 { color: rgb(120, 60, 180); font-size: 35px; } } }'
    )
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = (async() => ({
        canceled: false,
        filePaths: [filePath]
      })) as typeof dialog.showOpenDialog
    }, file)
    const opened = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    const prefs = await opened
    await prefs
      .locator('.pref-sidebar .category .item')
      .filter({ hasText: 'Document theme' })
      .click()
    await expect(prefs.locator('.theme-preview')).toHaveCount(3)
    await prefs.locator('.import-document-theme').click()
    await expect(page.locator('.mu-container h1')).toHaveCSS('color', 'rgb(120, 60, 180)')
    await expect(page.locator('.mu-container h1')).toHaveCSS('font-size', '35px')
    await expect(prefs.locator('.pref-container')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)'
    )
    const saved = JSON.parse(readFileSync(path.join(userData, 'preferences.json'), 'utf8'))
    expect(saved.customThemes).toHaveLength(1)
    expect(saved.theme).toBe(saved.customThemes[0].id)
    await prefs.reload()
    await prefs
      .locator('.pref-sidebar .category .item')
      .filter({ hasText: 'Document theme' })
      .click()
    await expect(prefs.locator('.custom-theme-list li')).toHaveCount(1)
    await prefs.locator('.custom-theme-list .el-button').click()
    await expect(page.locator('.editor-middle')).toHaveAttribute('data-document-theme', 'github')
    await expect(prefs.locator('.custom-theme-list li')).toHaveCount(0)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('export uses the active document theme and the hamburger menu omits Help', async() => {
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true,
    preferences: { theme: 'academic', appearance: 'dark', language: 'en' }
  })
  try {
    await app.evaluate(({ Menu, ipcMain, BrowserWindow }) => {
      const state = globalThis as typeof globalThis & {
        popupRoles?: string[]
        exported?: { content: string }
      }
      Menu.prototype.popup = function() {
        state.popupRoles = this.items.map((item) => item.role || '')
      }
      ipcMain.removeAllListeners('mt::response-export')
      ipcMain.on('mt::response-export', (_event, output) => {
        state.exported = output
      })
      BrowserWindow.getAllWindows()[0].webContents.send('mt::show-export-dialog', 'styledHtml')
    })
    // The main menu remains available for native menu bars.
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::menu::popup-application'))
    const roles = await app.evaluate(
      () => (globalThis as typeof globalThis & { popupRoles?: string[] }).popupRoles
    )
    expect(roles).not.toContain('help')
    await expect(page.locator('.el-dialog:visible')).toBeVisible()
    await expect(page.locator('.el-dialog:visible .el-tabs')).toHaveCount(0)
    await expect(page.locator('.current-document-theme')).toHaveCount(0)
    await page.locator('.el-dialog:visible .button-primary').click()
    await expect
      .poll(() =>
        app.evaluate(
          () =>
            (globalThis as typeof globalThis & { exported?: { content: string } }).exported?.content
        )
      )
      .toBeTruthy()
    const html = await app.evaluate(
      () => (globalThis as typeof globalThis & { exported?: { content: string } }).exported!.content
    )
    expect(html).toContain('Georgia')
    expect(html).toContain('1.8em')
    expect(html).toMatch(/color-scheme:\s*light/)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
