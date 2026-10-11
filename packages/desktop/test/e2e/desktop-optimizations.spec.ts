import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  clickMenuById,
  enterSourceMode,
  expectNoRendererErrors,
  launchElectron,
  launchWithMarkdown,
  sendIpcToRenderer,
  waitForEditor
} from './helpers'

const headings = '# Root\n\n## Section\n\n### Detail\n\n#### Deep\n\n## Other\n'

test('title text adapts to the available width and updates on tab changes', async() => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'marktext-title-'))
  const filename = 'verilog-flow2_FPGA_编码规范_'.repeat(3) + '.md'
  const pathname = path.join(directory, filename)
  writeFileSync(pathname, '# Long filename\n', 'utf8')
  const { app, page } = await launchElectron([pathname], {
    preferences: { language: 'zh-CN' },
    suppressErrorDialog: true
  })
  try {
    await waitForEditor(page)
    const title = page.locator('.title-bar .title')
    await expect(title).toHaveAttribute('title', pathname)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(550, 700)
    )
    await expect
      .poll(() => title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
      .toBeLessThan(14)
    const bounds = await title.locator('.path').boundingBox()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(550 - 138 + 1)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1100, 700)
    )
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Short document')
    await expect(title.locator('.filename')).toHaveText('Untitled-1')
    await expect
      .poll(() => title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
      .toBe(14)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('title stays centered over the editor through sidebar and window changes', async() => {
  const { app, page } = await launchWithMarkdown('# Title layout\n', {
    suppressErrorDialog: true,
    preferences: { sideBarVisibility: true, tabBarVisibility: true }
  })
  const expectCentered = async() => {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const editor = document.querySelector('.editor-with-tabs')!.getBoundingClientRect()
          const title = document.querySelector('.title-bar .path')!.getBoundingClientRect()
          return Math.abs(title.left + title.width / 2 - editor.left - editor.width / 2)
        })
      )
      .toBeLessThan(1)
    const bounds = await page.locator('.title-bar .path').boundingBox()
    expect(bounds!.y).toBeLessThan(28)
    const menu = await page.locator('.frameless-titlebar-menu').boundingBox()
    expect(menu!.x).toBeLessThan(20)
  }
  try {
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setContentSize(1280, 800)
      window.focus()
    })
    await expect(page.locator('.side-bar')).toBeVisible()
    await expectCentered()
    const drag = await page.locator('.side-bar .drag-bar').boundingBox()
    const initialWidth = (await page.locator('.side-bar').boundingBox())!.width
    await page.mouse.move(drag!.x + drag!.width / 2, drag!.y + 80)
    await page.mouse.down()
    await page.mouse.move(drag!.x + drag!.width / 2 + 130, drag!.y + 80, { steps: 8 })
    await expect
      .poll(async() => (await page.locator('.side-bar').boundingBox())!.width)
      .toBeGreaterThan(initialWidth + 100)
    await expectCentered()
    await page.mouse.up()
    await expectCentered()

    const filesIcon = page.locator('.side-bar .left-column > ul').first().locator('li').first()
    await filesIcon.click()
    await expect
      .poll(async() => (await page.locator('.side-bar').boundingBox())!.width)
      .toBeLessThan(50)
    await expectCentered()
    await filesIcon.click()
    await expect
      .poll(async() => (await page.locator('.side-bar').boundingBox())!.width)
      .toBeGreaterThan(initialWidth + 100)
    await expectCentered()

    for (const width of [760, 1180]) {
      await app.evaluate(
        ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 800),
        width
      )
      await expectCentered()
    }
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator('.side-bar')).toBeHidden()
    await expectCentered()
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator('.side-bar')).toBeVisible()
    await expectCentered()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('outline level actions preserve manual expansion and per-tab state', async() => {
  const { app, page } = await launchWithMarkdown(headings, {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', sideBarVisibility: true, tabBarVisibility: true }
  })
  try {
    await clickMenuById(app, 'tocMenuItem')
    const labels = page.locator('.side-bar-toc .el-tree-node__label:visible')
    const select = page.locator('.toc-level')
    await expect(labels).toHaveCount(5)
    await select.selectOption('2')
    await expect(labels).toHaveCount(3)
    const section = page
      .locator('.side-bar-toc .el-tree-node__content')
      .filter({ hasText: /^Section$/ })
    await section.locator('.el-tree-node__expand-icon').click()
    await expect(labels).toHaveCount(4)
    await select.selectOption('1')
    await expect(labels).toHaveCount(1)
    const firstId = await page.locator('.tabs-container > li.active').getAttribute('data-id')
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '# Root\n\n## Second document\n')
    await expect(labels).toHaveCount(2)
    await page.locator(`.tabs-container > li[data-id="${firstId}"]`).click()
    await expect(select).toHaveValue('1')
    await expect(labels).toHaveCount(1)
    await select.selectOption('0')
    await expect(labels).toHaveCount(5)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('tables stay centered in all document themes and appearances', async() => {
  const { app, page } = await launchWithMarkdown(
    '# Table\n\n| A | B |\n| --- | --- |\n| C | D |\n',
    {
      suppressErrorDialog: true,
      preferences: { language: 'en' }
    }
  )
  try {
    for (const appearance of ['light', 'dark']) {
      for (const theme of ['github', 'academic', 'liber']) {
        await page.evaluate(
          (preferences) => window.electron.ipcRenderer.send('mt::set-user-preference', preferences),
          { appearance, theme }
        )
        await expect(page.locator('.editor-middle')).toHaveAttribute(
          'data-document-theme',
          theme
        )
        if (appearance === 'dark') await expect(page.locator('body')).toHaveClass(/dark/)
        else await expect(page.locator('body')).not.toHaveClass(/dark/)
        await expect
          .poll(() =>
            page.locator('.mu-table-inner').evaluate((table) => {
              const parent = table.parentElement!.getBoundingClientRect()
              const bounds = table.getBoundingClientRect()
              return Math.abs(bounds.left + bounds.width / 2 - parent.left - parent.width / 2)
            })
          )
          .toBeLessThan(2)
      }
    }
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('preferences show Chinese on first content paint and load without the editor', async() => {
  const { app, page } = await launchWithMarkdown('# Document\n', {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN' }
  })
  try {
    const opened = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    const settings = await opened
    const firstContent = await settings.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const read = () => {
            const container = document.querySelector('.pref-container')
            if (container?.textContent?.trim()) {
              observer.disconnect()
              resolve(container.textContent)
            }
          }
          const observer = new MutationObserver(read)
          observer.observe(document, { childList: true, subtree: true, characterData: true })
          read()
        })
    )
    expect(firstContent).toContain('通用')
    expect(firstContent).not.toContain('General')
    expect(
      await settings.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name)
      )
    ).not.toEqual(expect.arrayContaining([expect.stringMatching(/\/app-[^/]+\.js$/)]))
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('PNG export captures the complete document and releases its hidden window', async({
  browserName: _browserName
}, testInfo) => {
  test.setTimeout(60000)
  const markdown =
    '# Long image\n\n| A | B |\n| --- | --- |\n| C | D |\n\n$$E = mc^2$$\n\n' +
    Array.from(
      { length: 100 },
      (_, i) => `## Section ${i}\n\nParagraph ${i} with **bold** and code.\n\n`
    ).join('') +
    '# Final heading\n\nThe end of the long image.\n'
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN' }
  })
  const output = testInfo.outputPath('long-image.png')
  try {
    await page.evaluate(() => {
      window.electron.ipcRenderer.on('mt::show-notification', (_event, notification) => {
        const message = notification as { type?: string; message?: string }
        if (message.type === 'error') document.body.dataset.exportError = String(message.message)
      })
    })
    await app.evaluate(({ dialog }, filename) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath: filename })
    }, output)
    const windowsBefore = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
    )
    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'png')
    await page.locator('.print-settings-dialog .button-primary').click()
    await expect
      .poll(
        async() => {
          const error = await page.evaluate(() => document.body.dataset.exportError)
          if (error) throw new Error(error)
          return existsSync(output)
        },
        { timeout: 45000 }
      )
      .toBe(true)
    const png = readFileSync(output)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBeGreaterThan(10000)
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length))
      .toBe(windowsBefore)
    await expect(page.locator('.mu-container')).toContainText('Final heading')

    const narrowOutput = testInfo.outputPath('long-image-640.png')
    await app.evaluate(({ dialog }, filename) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath: filename })
    }, narrowOutput)
    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'png')
    await expect(page.locator('.print-settings-dialog .image-options')).toBeVisible()
    await page.locator('#image-export-width').fill('640')
    await page.locator('#image-export-width').press('Tab')
    await page.locator('.print-settings-dialog .button-primary').click()
    await expect.poll(() => existsSync(narrowOutput), { timeout: 15000 }).toBe(true)
    expect(readFileSync(narrowOutput).readUInt32BE(16)).toBe(640)

    const sourceOutput = testInfo.outputPath('source-image.png')
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const code = document.querySelector('.source-code .CodeMirror') as HTMLElement & {
        CodeMirror: { setValue: (text: string) => void }
      }
      code.CodeMirror.setValue('# Source export\n\nUpdated content in source mode.\n')
    })
    await app.evaluate(({ dialog, ipcMain }, filename) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath: filename })
      ipcMain.once('mt::response-export', (_event, payload) => {
        ;(global as unknown as { exportedContent: string }).exportedContent = payload.content
      })
    }, sourceOutput)
    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'png')
    await page.locator('.print-settings-dialog .button-primary').click()
    await expect.poll(() => existsSync(sourceOutput), { timeout: 15000 }).toBe(true)
    expect(
      await app.evaluate(() => (global as unknown as { exportedContent: string }).exportedContent)
    ).toContain('Updated content in source mode.')
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length))
      .toBe(windowsBefore)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
