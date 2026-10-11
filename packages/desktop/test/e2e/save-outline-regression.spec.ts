import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  launchWithMarkdown,
  enterSourceMode,
  exitSourceMode,
  setSourceMarkdown,
  sendIpcToRenderer,
  expectNoRendererErrors
} from './helpers'

test('a delayed disk save keeps subsequent source edits dirty through parser changes', async() => {
  const { app, page, filePath } = await launchWithMarkdown('[^f]: on disk', {
    suppressErrorDialog: true,
    preferences: { autoSave: false, footnote: false }
  })
  const releaseSave = () =>
    app.evaluate(() => {
      const control = (globalThis as typeof globalThis & { pausedSave?: { release(): void } })
        .pausedSave
      control?.release()
    })
  try {
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = (
        document.querySelector('.CodeMirror') as HTMLElement & {
          CodeMirror: { setValue(value: string): void }
        }
      ).CodeMirror
      cm.setValue('[^f]: version A')
      window.electron.ipcRenderer.on('mt::tab-saved', () => {
        document.body.dataset.saveReceipt = 'received'
      })
    })
    await app.evaluate(() => {
      const fs = process.getBuiltinModule('node:fs')
      const original = fs.fsync
      const pending: Array<() => void> = []
      fs.fsync = Object.assign(
        (fd: number, callback: (error: NodeJS.ErrnoException | null) => void) => {
          pending.push(() => original(fd, callback))
        },
        { __promisify__: original.__promisify__ }
      )
      Object.assign(globalThis, {
        pausedSave: {
          count: () => pending.length,
          release: () => {
            fs.fsync = original
            for (const resume of pending.splice(0)) resume()
          }
        }
      })
    })
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect
      .poll(() =>
        app.evaluate(
          () =>
            (
              globalThis as typeof globalThis & { pausedSave?: { count(): number } }
            ).pausedSave?.count() ?? 0
        )
      )
      .toBeGreaterThan(0)
    await page.evaluate(() => {
      const cm = (
        document.querySelector('.CodeMirror') as HTMLElement & {
          CodeMirror: { setValue(value: string): void }
        }
      ).CodeMirror
      cm.setValue('[^f]: version B')
    })
    await sendIpcToRenderer(app, 'mt::user-preference', { footnote: true })
    await releaseSave()
    await expect.poll(() => page.evaluate(() => document.body.dataset.saveReceipt)).toBe('received')
    const current = await page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, { currentFile: { markdown: string; isSaved: boolean } }> }
            }
          }
        }
      }
      const file = root.__vue_app__.config.globalProperties.$pinia._s.get('editor')!.currentFile
      return { markdown: file.markdown, isSaved: file.isSaved }
    })
    expect(current.markdown.trim()).toBe('[^f]: version B')
    expect(current.isSaved).toBe(false)
    expect(readFileSync(filePath, 'utf8').trim()).toBe('[^f]: version A')
    await expectNoRendererErrors(app)
  } finally {
    await releaseSave()
    await app.close()
  }
})

test('keeps undo outlines, source exports, saves and search lifetimes consistent', async() => {
  const { app, page, filePath } = await launchWithMarkdown('# Before\n\n[TOC]\n\nbody', {
    suppressErrorDialog: true,
    preferences: { autoSave: false, language: 'en' }
  })
  const snapshot = () =>
    page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
      }
      const store = root.__vue_app__.config.globalProperties.$pinia._s.get('editor') as {
        currentFile: { markdown: string; isSaved: boolean }
        listToc: unknown[]
      }
      return {
        markdown: store.currentFile.markdown,
        isSaved: store.currentFile.isSaved,
        toc: JSON.parse(JSON.stringify(store.listToc)),
        headings: Array.from(document.querySelectorAll('.editor-component h1')).map(
          (el) => el.textContent
        )
      }
    })
  try {
    await setSourceMarkdown(page, app, '# After\n\n[TOC]\n\nbody')

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect(page.locator('.editor-component h1')).toContainText('Before')
    const afterUndo = await snapshot()
    expect(afterUndo.toc).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: 'Before' })])
    )

    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = (
        document.querySelector('.CodeMirror') as HTMLElement & {
          CodeMirror: { setValue(value: string): void }
        }
      ).CodeMirror
      cm.setValue('# Saved in source\n\n[TOC]\n\nbody')
    })

    await app.evaluate(({ ipcMain, BrowserWindow }) => {
      ipcMain.removeAllListeners('mt::response-export')
      ipcMain.on('mt::response-export', (_event, output) => {
        Object.assign(globalThis, { auditExport: output })
      })
      BrowserWindow.getAllWindows()[0].webContents.send('mt::show-export-dialog', 'styledHtml')
    })
    await page.locator('.el-dialog:visible .button-primary').click()
    await expect
      .poll(() =>
        app.evaluate(
          () =>
            (globalThis as typeof globalThis & { auditExport?: { content: string } }).auditExport
              ?.content
        )
      )
      .toBeTruthy()
    const html = await app.evaluate(
      () =>
        (globalThis as typeof globalThis & { auditExport?: { content: string } }).auditExport
          ?.content || ''
    )
    const exportOutline = await page.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, 'text/html')
      return {
        headingIds: Array.from(document.querySelectorAll('h1[id]')).map((el) => el.id),
        anchors: Array.from(document.querySelectorAll('a[href^="#"]')).map((el) =>
          el.getAttribute('href')
        )
      }
    }, html)
    expect(exportOutline.headingIds).toContain('saved-in-source')
    expect(exportOutline.anchors).toContain('#saved-in-source')
    expect(exportOutline.anchors).not.toContain('#before')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(async() => (await snapshot()).isSaved).toBe(true)

    await exitSourceMode(page, app)
    await expect(page.locator('.editor-component h1')).toContainText('Saved in source')
    const afterSourceExit = await snapshot()
    expect(afterSourceExit.isSaved).toBe(true)
    expect(readFileSync(filePath, 'utf8').trim()).toBe(afterSourceExit.markdown.trim())
    const listenerCountBeforeSearch = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.listenerCount('destroyed')
    )
    for (let i = 0; i < 12; i++) {
      await page.evaluate(
        ({ directory, index }) =>
          new Promise<void>((resolve, reject) => {
            const searchId = `audit-${index}`
            let offDone = () => {}
            let offError = () => {}
            const cleanup = () => {
              offDone()
              offError()
            }
            offDone = window.ripgrep.onDone((payload) => {
              if ((payload as { searchId: string }).searchId !== searchId) return
              cleanup()
              resolve()
            })
            offError = window.ripgrep.onError((payload) => {
              cleanup()
              reject(new Error(JSON.stringify(payload)))
            })
            window.ripgrep
              .start({
                searchId,
                mode: 'files',
                directories: [directory],
                pattern: '',
                options: {}
              })
              .catch(reject)
          }),
        { directory: resolve(filePath, '..'), index: i }
      )
    }
    const listenerCountAfterSearch = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.listenerCount('destroyed')
    )
    await expectNoRendererErrors(app)
    expect(listenerCountAfterSearch).toBeLessThanOrEqual(listenerCountBeforeSearch + 1)
  } finally {
    await app.close()
  }
})

test('source caret movement avoids full reads and large documents keep a bounded viewport', async() => {
  const markdown = '# Start\n\n' + Array.from({ length: 2000 }, (_, i) => `Line ${i}`).join('\n')
  const { app, page } = await launchWithMarkdown(markdown, { preferences: { autoSave: false } })
  try {
    await enterSourceMode(page, app)
    const result = await page.evaluate(() => {
      const cm = (
        document.querySelector('.CodeMirror') as HTMLElement & {
          CodeMirror: {
            getValue(): string
            setCursor(position: { line: number; ch: number }): void
            getOption(name: string): unknown
            lineCount(): number
          }
        }
      ).CodeMirror
      const original = cm.getValue.bind(cm)
      let fullReads = 0
      cm.getValue = () => {
        fullReads++
        return original()
      }
      for (let i = 0; i < 20; i++) cm.setCursor({ line: i, ch: 0 })
      cm.setCursor({ line: 1900, ch: 0 })
      cm.getValue = original
      return {
        fullReads,
        lines: cm.lineCount(),
        viewportMargin: cm.getOption('viewportMargin'),
        rendered: document.querySelectorAll('.CodeMirror-code > div').length
      }
    })
    expect(result.fullReads).toBe(0)
    expect(result.lines).toBeGreaterThan(2000)
    expect(result.viewportMargin).toBe(10)
    expect(result.rendered).toBeLessThan(200)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
