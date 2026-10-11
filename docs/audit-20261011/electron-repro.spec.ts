import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  launchWithMarkdown, enterSourceMode, exitSourceMode, setSourceMarkdown,
  sendIpcToRenderer, expectNoRendererErrors
} from '../../packages/desktop/test/e2e/helpers'

test('capture outline and source-mode save behavior in Electron', async() => {
  const { app, page, filePath } = await launchWithMarkdown('# Before\n\n[TOC]\n\nbody', {
    suppressErrorDialog: true, preferences: { autoSave: false, language: 'en' }
  })
  const snapshot = () => page.evaluate(() => {
    const root = document.querySelector('#app') as Element & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get('editor') as {
      currentFile: { markdown: string; isSaved: boolean }; listToc: unknown[]
    }
    return { markdown: store.currentFile.markdown, isSaved: store.currentFile.isSaved,
      toc: JSON.parse(JSON.stringify(store.listToc)),
      headings: Array.from(document.querySelectorAll('.editor-component h1')).map(el => el.textContent) }
  })
  try {
    await setSourceMarkdown(page, app, '# After\n\n[TOC]\n\nbody')
    const beforeUndo = await snapshot()
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect(page.locator('.editor-component h1')).toContainText('Before')
    const afterUndo = await snapshot()

    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = (document.querySelector('.CodeMirror') as HTMLElement & {
        CodeMirror: { setValue(value: string): void }
      }).CodeMirror
      cm.setValue('# Saved in source\n\n[TOC]\n\nbody')
    })
    const inSource = await snapshot()
    await app.evaluate(({ ipcMain, BrowserWindow }) => {
      ipcMain.removeAllListeners('mt::response-export')
      ipcMain.on('mt::response-export', (_event, output) => {
        Object.assign(globalThis, { auditExport: output })
      })
      BrowserWindow.getAllWindows()[0].webContents.send('mt::show-export-dialog', 'styledHtml')
    })
    await page.locator('.el-dialog:visible .button-primary').click()
    await expect.poll(() => app.evaluate(() =>
      (globalThis as typeof globalThis & { auditExport?: { content: string } }).auditExport?.content
    )).toBeTruthy()
    const html = await app.evaluate(() =>
      (globalThis as typeof globalThis & { auditExport?: { content: string } }).auditExport?.content || ''
    )
    const exportOutline = await page.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, 'text/html')
      return {
        headingIds: Array.from(document.querySelectorAll('h1[id]')).map(el => el.id),
        anchors: Array.from(document.querySelectorAll('a[href^="#"]')).map(el => el.getAttribute('href'))
      }
    }, html)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(async() => (await snapshot()).isSaved).toBe(true)
    const savedInSource = await snapshot()
    await exitSourceMode(page, app)
    await expect(page.locator('.editor-component h1')).toContainText('Saved in source')
    const afterSourceExit = await snapshot()
    const listenerCountBeforeSearch = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.listenerCount('destroyed')
    )
    for (let i = 0; i < 12; i++) {
      await page.evaluate(({ directory, index }) => new Promise<void>((resolve, reject) => {
        const searchId = `audit-${index}`
        let offDone = () => {}
        let offError = () => {}
        const cleanup = () => { offDone(); offError() }
        offDone = window.ripgrep.onDone((payload) => {
          if ((payload as { searchId: string }).searchId !== searchId) return
          cleanup()
          resolve()
        })
        offError = window.ripgrep.onError((payload) => {
          cleanup()
          reject(new Error(JSON.stringify(payload)))
        })
        window.ripgrep.start({ searchId, mode: 'files', directories: [directory], pattern: '', options: {} }).catch(reject)
      }), { directory: resolve(filePath, '..'), index: i })
    }
    const listenerCountAfterSearch = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.listenerCount('destroyed')
    )
    await expectNoRendererErrors(app)
    writeFileSync(resolve('docs/audit-20261011/electron-results.json'), JSON.stringify({
      beforeUndo, afterUndo, inSource, exportOutline, savedInSource, afterSourceExit,
      savedDiskMarkdown: readFileSync(filePath, 'utf8'), listenerCountBeforeSearch, listenerCountAfterSearch
    }, null, 2) + '\n')
  } finally {
    await app.close()
  }
})
