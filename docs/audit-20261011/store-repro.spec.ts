import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const ipc = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const send = vi.fn()
  Object.assign(window, {
    path: { sep: '/', dirname: () => '/tmp' },
    electron: {
      clipboard: { writeText: vi.fn() },
      ipcRenderer: { send, on: (channel: string, callback: (...args: unknown[]) => void) => handlers.set(channel, callback) }
    }
  })
  return { handlers, send }
})

vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/bufferedState', () => ({
  debouncedSendBufferedState: Object.assign(vi.fn(), { cancel: vi.fn() }),
  sendBufferedState: vi.fn(async() => true)
}))

import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import bus from '@/bus'

describe('final audit: save boundaries', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ipc.handlers.clear()
    ipc.send.mockClear()
  })
  afterEach(() => bus.all.clear())

  const seed = () => {
    const store = useEditorStore()
    store.tabs = [{
      id: 'audit-tab', filename: 'audit.md', pathname: '/tmp/audit.md',
      markdown: 'version A', isSaved: false, trimTrailingNewline: 0,
      encoding: { encoding: 'utf8', isBom: false }, lineEnding: 'lf',
      adjustLineEndingOnSave: false, lastSavedHistoryId: 0,
      history: { stack: [{ id: 1 }], index: 0, lastEditIndex: 0, lastInitIndex: -1 }
    }] as never
    store.tabIdToIndex = { 'audit-tab': 0 }
    store.currentFile = store.tabs[0]
    return store
  }

  it('keeps edits made after a save request dirty when its receipt arrives', () => {
    const store = seed()
    store.LISTEN_FOR_SET_PATHNAME()
    store.FILE_SAVE()
    const request = ipc.send.mock.calls.find(call => call[0] === 'mt::response-file-save')
    expect(request?.[4]).toBe('version A')
    store.LISTEN_FOR_CONTENT_CHANGE({ id: 'audit-tab', markdown: 'version B',
      history: { stack: [{ id: 2 }], index: 0, lastEditIndex: 0, lastInitIndex: -1 } })
    ipc.handlers.get('mt::tab-saved')?.({}, 'audit-tab', request?.[7])
    expect(store.currentFile?.isSaved).toBe(false)
    expect(store.currentFile?.lastSavedHistoryId).toBe(1)
  })

  it('flushes queued edits before collecting Save All payloads', () => {
    const store = seed()
    bus.on('flush-active-editor', () => {
      if (store.currentFile) store.currentFile.markdown = 'version B'
    })
    store.ASK_FOR_SAVE_ALL(false)
    const request = ipc.send.mock.calls.find(call => call[0] === 'mt::save-tabs')
    expect(request?.[1][0].markdown).toBe('version B')
  })

  it('flushes queued edits before collecting close confirmation payloads', async() => {
    const store = seed()
    usePreferencesStore().startUpAction = 'blank'
    bus.on('flush-active-editor', () => {
      if (store.currentFile) store.currentFile.markdown = 'version B'
    })
    store.LISTEN_FOR_CLOSE()
    ipc.handlers.get('mt::ask-for-close')?.({})
    await vi.waitFor(() => expect(ipc.send).toHaveBeenCalled())
    const request = ipc.send.mock.calls.find(call => call[0] === 'mt::close-window-confirm')
    expect(request?.[1][0].markdown).toBe('version B')
  })
})
