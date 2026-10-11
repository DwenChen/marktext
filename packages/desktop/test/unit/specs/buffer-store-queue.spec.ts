import { describe, expect, it, vi } from 'vitest'

const { write } = vi.hoisted(() => ({ write: vi.fn() }))
vi.mock('electron', () => ({}))
vi.mock('write-file-atomic', () => ({ default: write }))
const { default: EditorBufferStore } = await import('main_renderer/editorBufferStore')
const persist = EditorBufferStore.prototype.writeBufferStoreFile

describe('recovery snapshot write queue', () => {
  it('serializes writes and coalesces obsolete snapshots before resolving close waiters', async() => {
    let release = () => {}
    write.mockReset().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    const first = persist('/queue/window-a', { version: 1 })
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    const second = persist('/queue/window-a', { version: 2 })
    const last = persist('/queue/window-a', { version: 3 })
    let completed = false
    last.then(() => {
      completed = true
    })
    expect(completed).toBe(false)
    release()
    await Promise.all([first, second, last])
    expect(write.mock.calls.map((call) => JSON.parse(call[1]))).toEqual([
      { version: 1 },
      { version: 3 }
    ])
    expect(completed).toBe(true)
  })

  it('allows another window to persist while the first is writing', async() => {
    let release = () => {}
    write.mockReset().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    const blocked = persist('/queue/window-b', { version: 1 })
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    await persist('/queue/window-c', { version: 2 })
    expect(write).toHaveBeenCalledTimes(2)
    release()
    await blocked
  })

  it('reports write failure and accepts a subsequent recovery snapshot', async() => {
    write.mockReset().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)
    await expect(persist('/queue/window-d', { version: 1 })).rejects.toThrow('disk full')
    await expect(persist('/queue/window-d', { version: 2 })).resolves.toBeUndefined()
    expect(write.mock.calls[1][1]).toBe('{"version":2}')
  })
})
