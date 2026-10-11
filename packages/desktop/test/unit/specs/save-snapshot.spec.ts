import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const ipc = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const send = vi.fn()
  Object.assign(window, {
    path: { sep: '/', dirname: () => '/tmp' },
    electron: {
      clipboard: { writeText: vi.fn() },
      ipcRenderer: {
        send,
        on: (channel: string, callback: (...args: unknown[]) => void) =>
          handlers.set(channel, callback)
      }
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
import { sendBufferedState } from '@/store/bufferedState'

describe('save snapshot boundaries', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ipc.handlers.clear()
    ipc.send.mockClear()
    vi.mocked(sendBufferedState).mockReset().mockResolvedValue(true)
  })
  afterEach(() => bus.all.clear())

  const seed = () => {
    const store = useEditorStore()
    store.tabs = [
      {
        id: 'audit-tab',
        filename: 'audit.md',
        pathname: '/tmp/audit.md',
        markdown: 'version A',
        isSaved: false,
        trimTrailingNewline: 0,
        notifications: [],
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        lastSavedHistoryId: 0,
        history: { stack: [{ id: 1 }], index: 0, lastEditIndex: 0, lastInitIndex: -1 }
      }
    ] as never
    store.tabIdToIndex = { 'audit-tab': 0 }
    store.currentFile = store.tabs[0]
    return store
  }

  it('keeps edits made after a save request dirty when its receipt arrives', () => {
    const store = seed()
    store.LISTEN_FOR_SET_PATHNAME()
    store.FILE_SAVE()
    const request = ipc.send.mock.calls.find((call) => call[0] === 'mt::response-file-save')
    expect(request?.[4]).toBe('version A')
    store.LISTEN_FOR_CONTENT_CHANGE({
      id: 'audit-tab',
      markdown: 'version B',
      history: { stack: [{ id: 2 }], index: 0, lastEditIndex: 0, lastInitIndex: -1 }
    })
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
    const request = ipc.send.mock.calls.find((call) => call[0] === 'mt::save-tabs')
    expect(request?.[1][0].markdown).toBe('version B')
  })

  it('keeps newer edits dirty after saving an untitled file', () => {
    const store = seed()
    store.LISTEN_FOR_SET_PATHNAME()
    store.FILE_SAVE()
    const snapshot = ipc.send.mock.calls[0][7]
    bus.on('flush-active-editor', () => {
      store.currentFile!.markdown = 'version B'
    })
    ipc.handlers.get('mt::set-pathname')?.(
      {},
      { id: 'audit-tab', filename: 'new.md', pathname: '/tmp/new.md', snapshot }
    )
    expect(store.currentFile?.pathname).toBe('/tmp/new.md')
    expect(store.currentFile?.isSaved).toBe(false)
  })

  it('requires a new save for changed file encoding or line ending options', () => {
    const store = seed()
    store.applySaveReceipt(store.currentFile!, store.createSaveSnapshot(store.currentFile!))
    expect(store.currentFile?.isSaved).toBe(true)
    store.SET_LINE_ENDING('crlf')
    expect(store.currentFile?.isSaved).toBe(false)
    store.LISTEN_FOR_CONTENT_CHANGE({ id: 'audit-tab', markdown: 'version A' })
    expect(store.currentFile?.isSaved).toBe(false)
  })

  it('ignores an older receipt and keeps saved content clean across modes', () => {
    const store = seed()
    store.LISTEN_FOR_SET_PATHNAME()
    const first = store.createSaveSnapshot(store.currentFile!)
    store.currentFile!.markdown = 'version B'
    const second = store.createSaveSnapshot(store.currentFile!)
    ipc.handlers.get('mt::tab-saved')?.({}, 'audit-tab', second)
    ipc.handlers.get('mt::tab-saved')?.({}, 'audit-tab', first)
    store.LISTEN_FOR_CONTENT_CHANGE({
      id: 'audit-tab',
      markdown: 'version B\n\n',
      history: { stack: [{ id: 99 }], index: 0, lastEditIndex: 0, lastInitIndex: -1 }
    })
    expect(store.currentFile?.isSaved).toBe(true)
    store.LISTEN_FOR_CONTENT_CHANGE({ id: 'audit-tab', markdown: 'version C' })
    expect(store.currentFile?.isSaved).toBe(false)
    store.LISTEN_FOR_CONTENT_CHANGE({ id: 'audit-tab', markdown: 'version B' })
    expect(store.currentFile?.isSaved).toBe(true)
  })

  it('keeps failed saves dirty and does not close a changed tab on a delayed save', () => {
    const store = seed()
    store.LISTEN_FOR_SET_PATHNAME()
    store.LISTEN_FOR_SAVE_CLOSE()
    const snapshot = store.createSaveSnapshot(store.currentFile!)
    ipc.handlers.get('mt::tab-save-failure')?.({}, 'audit-tab', 'disk full', snapshot)
    expect(store.currentFile?.isSaved).toBe(false)
    ipc.handlers.get('mt::force-close-tabs-by-id')?.({}, ['audit-tab'], true)
    expect(store.tabs).toHaveLength(1)
  })

  it('flushes before deciding whether a tab can close and sends its save snapshot', () => {
    const store = seed()
    store.currentFile!.isSaved = true
    bus.on('flush-active-editor', () => {
      store.currentFile!.markdown = 'last input'
      store.currentFile!.isSaved = false
    })
    store.CLOSE_TAB()
    expect(store.tabs).toHaveLength(1)
    const request = ipc.send.mock.calls.find((call) => call[0] === 'mt::save-and-close-tabs')
    expect(request?.[1][0]).toMatchObject({ markdown: 'last input', snapshot: { requestId: 1 } })
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
    const request = ipc.send.mock.calls.find((call) => call[0] === 'mt::close-window-confirm')
    expect(request?.[1][0].markdown).toBe('version B')
  })

  it('persists another snapshot if editing continues while close waits for disk', async() => {
    const store = seed()
    usePreferencesStore().startUpAction = 'restoreAll'
    let release: (value: boolean) => void = () => {}
    vi.mocked(sendBufferedState).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    store.LISTEN_FOR_CLOSE()
    ipc.handlers.get('mt::ask-for-close')?.({})
    await vi.waitFor(() => expect(sendBufferedState).toHaveBeenCalledTimes(1))
    store.currentFile!.markdown = 'version B'
    release(true)
    await vi.waitFor(() => expect(ipc.send).toHaveBeenCalledWith('mt::close-window'))
    expect(sendBufferedState).toHaveBeenCalledTimes(2)
  })

  it('asks about unsaved content if Restore All recovery persistence fails', async() => {
    const store = seed()
    usePreferencesStore().startUpAction = 'restoreAll'
    vi.mocked(sendBufferedState).mockResolvedValueOnce(false)
    store.LISTEN_FOR_CLOSE()
    ipc.handlers.get('mt::ask-for-close')?.({})
    await vi.waitFor(() => expect(ipc.send).toHaveBeenCalled())
    expect(ipc.send.mock.calls[0][0]).toBe('mt::close-window-confirm')
  })

  it('persists option changes made while close waits for disk', async() => {
    const store = seed()
    usePreferencesStore().startUpAction = 'restoreAll'
    let release: (value: boolean) => void = () => {}
    vi.mocked(sendBufferedState).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    store.LISTEN_FOR_CLOSE()
    ipc.handlers.get('mt::ask-for-close')?.({})
    await vi.waitFor(() => expect(sendBufferedState).toHaveBeenCalledTimes(1))
    store.SET_LINE_ENDING('crlf')
    release(true)
    await vi.waitFor(() => expect(ipc.send).toHaveBeenCalledWith('mt::close-window'))
    expect(sendBufferedState).toHaveBeenCalledTimes(2)
  })
})
