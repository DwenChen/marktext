import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Stats } from 'fs'
import { DIRECTORY_EVENT_BATCH_DELAY, watchDirectory } from 'main_renderer/filesystem/directoryWatcher'

const { watchMock, handlers, closeMock } = vi.hoisted(() => ({
  watchMock: vi.fn(),
  handlers: new Map<string, (...args: unknown[]) => void>(),
  closeMock: vi.fn()
}))

vi.mock('chokidar', () => ({
  default: {
    watch: (...args: unknown[]) => {
      watchMock(...args)
      const watcher = {
        on: (event: string, callback: (...args: unknown[]) => void) => {
          handlers.set(event, callback)
          return watcher
        },
        close: closeMock
      }
      return watcher
    }
  }
}))

const stats = (isDirectory: boolean): Stats => ({
  isDirectory: () => isDirectory, birthtimeMs: 10, mtimeMs: 20
}) as Stats
const emit = (event: string, ...args: unknown[]): void => { handlers.get(event)?.(...args) }

describe('on-demand directory watching', () => {
  const send = vi.fn()
  const win = { isDestroyed: () => false, webContents: { send } }
  beforeEach(() => {
    vi.useFakeTimers()
    handlers.clear()
    watchMock.mockClear()
    closeMock.mockClear()
    send.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('limits the scan to immediate children and emits one metadata snapshot', async() => {
    const directory = watchDirectory(win as never, '/project', '/project', [], false, vi.fn())
    expect(watchMock.mock.calls[0][1]).toMatchObject({ depth: 0, alwaysStat: true })
    emit('addDir', '/project', stats(true))
    emit('addDir', '/project/sub', stats(true))
    for (let i = 0; i < 5000; i++) emit('add', `/project/${i}.md`, stats(false))
    expect(send).not.toHaveBeenCalled()
    emit('ready')
    expect(await directory.ready).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    const snapshot = send.mock.calls[0][1]
    expect(snapshot.entries).toHaveLength(5001)
    expect(snapshot.entries[1]).toEqual({
      pathname: '/project/0.md', name: '0.md', isFile: true, isDirectory: false,
      isMarkdown: true, birthTime: 10, mtimeMs: 20
    })
    directory.close()
  })

  it('batches bursts of filesystem changes and cancels queued events when closed', () => {
    const directory = watchDirectory(win as never, '/project', '/project', [], false, vi.fn())
    emit('ready')
    send.mockClear()
    for (let i = 0; i < 1000; i++) emit('add', `/project/${i}.md`, stats(false))
    vi.advanceTimersByTime(DIRECTORY_EVENT_BATCH_DELAY)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1].events).toHaveLength(1000)
    emit('unlink', '/project/0.md')
    directory.close()
    vi.runAllTimers()
    emit('add', '/project/late.md', stats(false))
    emit('ready')
    expect(send).toHaveBeenCalledTimes(1)
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('settles an unfinished load on close without publishing its snapshot', async() => {
    const directory = watchDirectory(win as never, '/project', '/project', [], false, vi.fn())
    emit('add', '/project/note.md', stats(false))
    directory.close()
    emit('ready')
    expect(await directory.ready).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
})
