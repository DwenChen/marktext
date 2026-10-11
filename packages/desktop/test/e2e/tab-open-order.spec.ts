import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { expectNoRendererErrors, launchElectron, waitForEditor } from './helpers'

const tabNames = '.tabs-container > li > span:first-child'

test('new documents append in request order and preserve dragged tab order', async() => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'marktext-open-order-'))
  const names = ['base.md', 'z-slow.md', 'a-fast.md', 'm-third.md', 'a-new.md']
  const paths = names.map((name) => path.join(directory, name))
  for (const [index, pathname] of paths.entries()) writeFileSync(pathname, `# Document ${index}\n`)
  const { app, page } = await launchElectron([paths[0]], {
    suppressErrorDialog: true,
    preferences: { tabBarVisibility: true, sideBarVisibility: true }
  })
  try {
    await waitForEditor(page)
    await expect(page.locator(tabNames)).toHaveText([names[0]])
    await app.evaluate(({ BrowserWindow, ipcMain }, paths) => {
      const fs = process.getBuiltinModule('fs/promises') as {
        readFile: (...args: unknown[]) => Promise<unknown>
      }
      const original = fs.readFile
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const state = globalThis as unknown as {
        tabOpenGate: { release: () => void; restore: () => void; fastRead: boolean }
      }
      state.tabOpenGate = {
        release,
        restore: () => {
          fs.readFile = original
        },
        fastRead: false
      }
      fs.readFile = async(...args) => {
        const content = await original(...args)
        if (args[0] === paths[1]) await gate
        if (args[0] === paths[2]) state.tabOpenGate.fastRead = true
        return content
      }
      const win = BrowserWindow.getAllWindows()[0]
      ipcMain.emit('app-open-file-by-id', win.id, paths[1])
      ipcMain.emit('app-open-files-by-id', win.id, paths.slice(2, 4))
    }, paths)
    await expect
      .poll(() =>
        app.evaluate(
          () =>
            (globalThis as unknown as { tabOpenGate: { fastRead: boolean } }).tabOpenGate.fastRead
        )
      )
      .toBe(true)
    await app.evaluate(() =>
      (globalThis as unknown as { tabOpenGate: { release: () => void } }).tabOpenGate.release()
    )
    await expect(page.locator(tabNames)).toHaveText(names.slice(0, 4))

    const first = await page.locator('.tabs-container > li').first().boundingBox()
    const last = await page.locator('.tabs-container > li').last().boundingBox()
    await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2)
    await page.mouse.down()
    await page.mouse.move(last!.x + last!.width - 2, last!.y + last!.height / 2, { steps: 10 })
    await page.mouse.up()
    const reordered = [names[1], names[2], names[3], names[0]]
    await expect(page.locator(tabNames)).toHaveText(reordered)
    await app.evaluate(
      ({ BrowserWindow, ipcMain }, pathname) =>
        ipcMain.emit('app-open-file-by-id', BrowserWindow.getAllWindows()[0].id, pathname),
      paths[4]
    )
    await expect(page.locator(tabNames)).toHaveText([...reordered, names[4]])
    await app.evaluate(
      ({ BrowserWindow, ipcMain }, pathname) =>
        ipcMain.emit('app-open-file-by-id', BrowserWindow.getAllWindows()[0].id, pathname),
      paths[1]
    )
    await expect(page.locator('.tabs-container > li.active > span:first-child')).toHaveText(
      names[1]
    )
    await expect(page.locator(tabNames)).toHaveText([...reordered, names[4]])
    await expectNoRendererErrors(app)
  } finally {
    await app
      .evaluate(() => {
        const gate = (
          globalThis as unknown as {
            tabOpenGate?: { release: () => void; restore: () => void }
          }
        ).tabOpenGate
        gate?.release()
        gate?.restore()
      })
      .catch(() => {})
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a failed file does not prevent later documents from appending', async() => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'marktext-open-failure-'))
  const base = path.join(directory, 'z-base.md')
  const next = path.join(directory, 'a-next.md')
  writeFileSync(base, '# Base\n')
  writeFileSync(next, '# Next\n')
  const { app, page } = await launchElectron([base], {
    suppressErrorDialog: true,
    preferences: { tabBarVisibility: true }
  })
  try {
    await waitForEditor(page)
    await app.evaluate(
      ({ BrowserWindow, ipcMain }, paths) =>
        ipcMain.emit('app-open-files-by-id', BrowserWindow.getAllWindows()[0].id, paths),
      [path.join(directory, 'missing.md'), next]
    )
    await expect(page.locator(tabNames)).toHaveText(['z-base.md', 'a-next.md'])
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
