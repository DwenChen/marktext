import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => ({ restoreBufferId: 'window-1' }) },
  ipcMain: { handle: vi.fn() }
}))

const { default: EditorBufferStore } = await import('main_renderer/editorBufferStore')
const dirs: string[] = []
const event = { sender: {} } as IpcMainInvokeEvent

const createStore = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-sidebar-width-'))
  dirs.push(dir)
  const store = new EditorBufferStore({ editorBufferStorePath: dir })
  return { store, filePath: store.getBufferStoreInfo('window-1').filePath, dir }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('sidebar width persistence', () => {
  it('restores a resized width without rewriting document content or history', async() => {
    const { store, filePath } = createStore()
    const snapshot = {
      tabs: [
        { isSaved: false, markdown: 'long document\n'.repeat(10000), history: { stack: ['edit'] } }
      ],
      layout: { sideBarWidth: 280, rightColumn: 'toc', showSideBar: true }
    }
    await store.writeBufferStoreFile(filePath, snapshot)
    const original = readFileSync(filePath, 'utf8')

    expect(await store.updateSidebarWidth(event, 410)).toBe(true)

    expect(readFileSync(filePath, 'utf8')).toBe(original)
    expect(store.readBufferStoreFile(filePath)).toEqual({
      ...snapshot,
      layout: { ...snapshot.layout, sideBarWidth: 410 }
    })
  })

  it('keeps the most recent width after consecutive asynchronous writes', async() => {
    const { store, filePath } = createStore()
    await store.writeBufferStoreFile(filePath, { tabs: [], layout: { sideBarWidth: 280 } })

    await Promise.all([store.updateSidebarWidth(event, 300), store.updateSidebarWidth(event, 450)])

    expect(store.readBufferStoreFile(filePath).layout).toEqual({ sideBarWidth: 450 })
  })

  it.each([NaN, Infinity, 219, '300', null])('rejects an invalid width %s', async(width) => {
    const { store, dir } = createStore()

    expect(await store.updateSidebarWidth(event, width)).toBe(false)
    expect(readdirSync(dir)).toEqual([])
  })

  it('restores an older snapshot when width metadata is missing or corrupt', async() => {
    const { store, filePath } = createStore()
    const snapshot = { tabs: [], layout: { sideBarWidth: 320 } }
    await store.writeBufferStoreFile(filePath, snapshot)

    expect(store.readBufferStoreFile(filePath)).toEqual(snapshot)
    writeFileSync(`${filePath}.sidebar-width.json`, 'broken')
    expect(store.readBufferStoreFile(filePath)).toEqual(snapshot)
  })

  it('removes width metadata when deleting a saved recovery buffer', async() => {
    const { store, filePath, dir } = createStore()
    await store.writeBufferStoreFile(filePath, { tabs: [{ isSaved: true }] })
    await store.updateSidebarWidth(event, 300)

    store.clearBufferStoresWithAllSaved()

    expect(readdirSync(dir)).toEqual([])
  })
})
