import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron, openProjectFolder, expectNoRendererErrors } from './helpers'

test.describe('large project directories', () => {
  let app: ElectronApplication
  let page: Page
  let root: string

  test.beforeAll(async() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-large-project-'))
    for (let i = 0; i < 2000; i++) {
      fs.writeFileSync(path.join(root, `note${String(i).padStart(4, '0')}.md`), '# Note\n')
    }
    fs.mkdirSync(path.join(root, 'sub', 'nested'), { recursive: true })
    fs.writeFileSync(path.join(root, 'sub', 'nested', 'deep.md'), '# Deep\n')
    for (let i = 0; i < 2000; i++) fs.writeFileSync(path.join(root, 'sub', `child${i}.md`), '# Child\n')
    const launched = await launchElectron([], { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
    if (root && path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('marktext-large-project-')) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('bounds rendered rows, reveals lazy ancestors and closes without closing the edited tab', async() => {
    test.setTimeout(60000)
    const started = Date.now()
    await openProjectFolder(app, page, root, path.join(root, 'note0000.md'))
    const mountedRows = () => page.locator('.tree-wrapper .side-bar-file, .tree-wrapper .folder-name').count()
    const initialRows = await mountedRows()
    console.info(`Large directory: root loaded in ${Date.now() - started} ms; ${initialRows} rows mounted for 2000 root files`)
    expect(initialRows).toBeLessThan(80)

    await page.locator('.side-bar-file[title$="note0000.md"]').click()
    await expect(page.locator('.editor-component')).toContainText('Note')
    await page.evaluate(() => {
      const tree = document.querySelector('.tree-wrapper') as HTMLElement
      tree.scrollTop = tree.scrollHeight
    })
    await expect(page.locator('.side-bar-file[title$="note1999.md"]')).toBeVisible()
    expect(await mountedRows()).toBeLessThan(80)

    await app.evaluate(({ BrowserWindow, ipcMain }, filePath) => {
      const win = BrowserWindow.getAllWindows()[0]
      ipcMain.emit('mt::open-file', { sender: win.webContents }, filePath, {})
    }, path.join(root, 'sub', 'nested', 'deep.md'))
    await expect(page.locator('.side-bar-file[title$="deep.md"]')).toBeVisible({ timeout: 20000 })
    expect(await mountedRows()).toBeLessThan(80)

    fs.writeFileSync(path.join(root, 'sub', 'nested', 'fresh.md'), '# Fresh\n')
    await expect(page.locator('.side-bar-file[title$="fresh.md"]')).toBeVisible()
    fs.renameSync(path.join(root, 'sub', 'nested', 'fresh.md'), path.join(root, 'sub', 'nested', 'renamed.md'))
    await expect(page.locator('.side-bar-file[title$="fresh.md"]')).toHaveCount(0)
    await expect(page.locator('.side-bar-file[title$="renamed.md"]')).toBeVisible()
    fs.unlinkSync(path.join(root, 'sub', 'nested', 'renamed.md'))
    await expect(page.locator('.side-bar-file[title$="renamed.md"]')).toHaveCount(0)

    await page.locator('.project-tree > .title .close-project').click()
    await expect(page.locator('.project-tree')).toHaveCount(0)
    await expect(page.locator('.open-project')).toBeVisible()
    await expect(page.locator('.editor-component')).toContainText('Deep')
    fs.writeFileSync(path.join(root, 'sub', 'nested', 'after-close.md'), '# Updated after close\n')
    await expect(page.locator('.project-tree')).toHaveCount(0)
    fs.writeFileSync(path.join(root, 'sub', 'nested', 'deep.md'), '# Deep changed\n')
    await expect(page.locator('.editor-component')).toContainText('Deep changed')
    await app.evaluate(({ BrowserWindow, ipcMain }, target) => {
      const win = BrowserWindow.getAllWindows()[0]
      ipcMain.emit('app-open-directory-by-id', win.id, target, true)
    }, root)
    await expect(page.locator('.side-bar-file[title$="after-close.md"]')).toBeVisible({ timeout: 20000 })
    expect(await mountedRows()).toBeLessThan(80)
    await expectNoRendererErrors(app)
  })
})
