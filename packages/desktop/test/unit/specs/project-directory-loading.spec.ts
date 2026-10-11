import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import pathe from 'pathe'
import type { DirectoryEntry, ProjectTreeUpdate } from '@shared/types/files'

const { listeners, send, invoke, bufferUpdate, tabs } = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  send: vi.fn(), invoke: vi.fn(), bufferUpdate: vi.fn(), tabs: [{ pathname: '/project/note.md', markdown: 'unsaved' }]
}))
vi.hoisted(() => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value)
  } })
})
vi.mock('@/store/bufferedState', () => ({ debouncedSendBufferedState: bufferUpdate }))
vi.mock('@/services/notification', () => ({ default: { notify: vi.fn(), name: 'notify' } }))
vi.mock('@/store/editor', () => ({ useEditorStore: () => ({
  tabs, UPDATE_CURRENT_FILE: vi.fn(), SET_SAVE_STATUS_WHEN_REMOVE: vi.fn()
}) }))

Object.assign(window, {
  marktext: { env: { windowId: 1 } },
  path: pathe,
  fileUtils: { isSamePathSync: (a: string, b: string) => pathe.normalize(a) === pathe.normalize(b) },
  electron: { ipcRenderer: {
    on: (channel: string, callback: (...args: unknown[]) => void) => listeners.set(channel, callback),
    send, invoke
  } }
})
const { useProjectStore } = await import('@/store/project')

const entry = (pathname: string, isDirectory = false): DirectoryEntry => ({
  pathname, name: pathe.basename(pathname), isDirectory, isFile: !isDirectory, isMarkdown: !isDirectory
})
const update = (payload: ProjectTreeUpdate): void => { listeners.get('mt::update-object-tree')?.({}, payload) }

describe('project directory lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listeners.clear()
    vi.clearAllMocks()
    invoke.mockResolvedValue(true)
  })

  it('loads an immediate snapshot and requests a child only on expansion', async() => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.OPEN_PROJECT('/project')
    update({ type: 'directory', rootPath: '/project', pathname: '/project', entries: [entry('/project/sub', true), entry('/project/note.md')] })
    expect(invoke).not.toHaveBeenCalled()
    expect(store.projectTree?.childrenLoaded).toBe(true)
    const child = store.projectTree!.folders[0]
    expect(child.childrenLoaded).toBe(false)
    store.SET_FOLDER_COLLAPSED(child, false)
    await store.LOAD_DIRECTORY(child)
    expect(invoke).toHaveBeenCalledExactlyOnceWith('mt::load-project-directory', '/project', '/project/sub')
    update({ type: 'directory', rootPath: '/project', pathname: '/project/sub', entries: [entry('/project/sub/deep.md')] })
    expect(child.files[0].name).toBe('deep.md')
    await store.LOAD_DIRECTORY(child)
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('closes the root, clears pending inputs and persists an empty project while retaining tabs', () => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.OPEN_PROJECT('/project')
    store.renameCache = '/project/note.md'
    store.newFileNameCache = '/project/new.md'
    store.clipboard = { src: '/project/note.md', type: 'cut' }
    store.CLOSE_PROJECT()
    expect(send).toHaveBeenCalledWith('mt::close-project', '/project')
    expect(store.projectTree).toBeNull()
    expect(store.renameCache).toBeNull()
    expect(store.newFileNameCache).toBe('')
    expect(store.clipboard).toBeNull()
    expect(store.CREATE_BUFFERED_STATE()).toEqual({ rootDirectory: '' })
    expect(tabs).toEqual([{ pathname: '/project/note.md', markdown: 'unsaved' }])
    update({ type: 'directory', rootPath: '/project', pathname: '/project', entries: [entry('/project/late.md')] })
    expect(store.projectTree).toBeNull()
    expect(store.pendingTreeEvents).toHaveLength(0)
    store.OPEN_PROJECT('/other')
    update({ type: 'batch', rootPath: '/project', events: [{ type: 'add', change: { ...entry('/project/late.md') } }] })
    expect(store.projectTree?.files).toHaveLength(0)
  })

  it('loads the ancestors of an externally opened file for automatic reveal', async() => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.OPEN_PROJECT('/project')
    invoke.mockImplementation(async(_channel: string, rootPath: string, pathname: string) => {
      const entries = pathname === rootPath ? [entry('/project/sub', true)] : [entry('/project/sub/note.md')]
      update({ type: 'directory', rootPath, pathname, entries })
      return true
    })
    expect(await store.REVEAL_PATH_ASYNC('/project/sub/note.md')).toBe(true)
    expect(store.projectTree?.folders[0].isCollapsed).toBe(false)
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(await store.REVEAL_PATH_ASYNC('/outside/note.md')).toBe(false)
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('merges a large burst once and preserves folders that have already been expanded', () => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.OPEN_PROJECT('/project')
    update({ type: 'directory', rootPath: '/project', pathname: '/project', entries: [entry('/project/sub', true)] })
    const child = store.projectTree!.folders[0]
    child.isCollapsed = false
    update({ type: 'batch', rootPath: '/project', events: Array.from({ length: 5000 }, (_, i) => ({
      type: 'add', change: { ...entry(`/project/note${4999 - i}.md`) }
    })) })
    expect(store.projectTree?.files).toHaveLength(5000)
    expect(store.projectTree?.files[2].name).toBe('note2.md')
    expect(store.projectTree?.folders[0]).toBe(child)
    expect(child.isCollapsed).toBe(false)
  })
})
