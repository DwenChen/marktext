import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store/bufferedState', () => ({ debouncedSendBufferedState: vi.fn() }))
vi.mock('@/store/preferences', () => ({ usePreferencesStore: vi.fn() }))

import { useLayoutStore } from '@/store/layout'
import { debouncedSendBufferedState } from '@/store/bufferedState'

describe('layout width updates', () => {
  const invoke = vi.fn().mockResolvedValue(true)

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.assign(window, { electron: { ipcRenderer: { invoke } } })
    localStorage.clear()
  })

  it('persists only the width when resizing, without creating a full session snapshot', () => {
    const store = useLayoutStore()

    store.CHANGE_SIDE_BAR_WIDTH(360)

    expect(store.sideBarWidth).toBe(360)
    expect(localStorage.getItem('side-bar-width')).toBe('360')
    expect(invoke).toHaveBeenCalledExactlyOnceWith('mt::update-sidebar-width', 360)
    expect(debouncedSendBufferedState).not.toHaveBeenCalled()
  })

  it('does not write width metadata while restoring a saved layout', () => {
    const store = useLayoutStore()

    store.SET_SIDE_BAR_WIDTH(420, { scheduleBufferUpdate: false })

    expect(store.sideBarWidth).toBe(420)
    expect(invoke).not.toHaveBeenCalled()
    expect(debouncedSendBufferedState).not.toHaveBeenCalled()
  })
})
