import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'

vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))
vi.mock('main_renderer/contextMenu/editor/spellcheck', () => ({ default: vi.fn() }))

const { getBlockMenu, getNestBlockMenu } = await import('main_renderer/contextMenu/editor')

describe('editor block context menu', () => {
  it('groups six block types and checks only the complete active containers', () => {
    const menu = getBlockMenu({ hasSelection: false, activeBlocks: ['bullet-list', 'block-quote'], nestableBlocks: [], mathEnabled: true })
    const items = menu.submenu as MenuItemConstructorOptions[]
    expect(menu.label).toBe('contextMenu.insertBlockBelow')
    expect(items).toHaveLength(6)
    expect(items.filter(item => item.checked).map(item => item.id)).toEqual([
      'context-block-block-quote', 'context-block-bullet-list'
    ])
    expect(items.every(item => item.type === 'checkbox')).toBe(true)
  })

  it('offers conversion actions for a range without a misleading toggle state', () => {
    const menu = getBlockMenu({ hasSelection: true, activeBlocks: ['bullet-list'], nestableBlocks: [], mathEnabled: false })
    const items = menu.submenu as MenuItemConstructorOptions[]
    expect(menu.label).toBe('contextMenu.convertSelection')
    expect(items).toHaveLength(5)
    expect(items.every(item => item.type === 'normal' && !item.checked)).toBe(true)
    const send = vi.fn()
    items[0].click?.({} as never, { webContents: { send } } as never, {} as never)
    expect(send).toHaveBeenCalledWith('mt::cm-block', 'table')
  })

  it('offers the same block kinds for nesting and sends a distinct command without toggles', () => {
    const nestableBlocks = ['table', 'code-block', 'block-quote', 'math-block', 'order-list', 'bullet-list'] as const
    const menu = getNestBlockMenu({ hasSelection: false, activeBlocks: ['bullet-list'], nestableBlocks: [...nestableBlocks], mathEnabled: true })
    const items = menu.submenu as MenuItemConstructorOptions[]
    expect(menu.label).toBe('contextMenu.nestBlockAtLevel')
    expect(menu.enabled).toBe(true)
    expect(items.map(item => item.id)).toEqual(nestableBlocks.map(type => `context-nest-block-${type}`))
    expect(items.every(item => item.enabled && !item.checked && !item.type)).toBe(true)
    const send = vi.fn()
    items[5].click?.({} as never, { webContents: { send } } as never, {} as never)
    expect(send).toHaveBeenCalledWith('mt::cm-nest-block', 'bullet-list')
  })

  it.each([false, true])('disables nesting outside a container or with a range (selection=%s)', (hasSelection) => {
    const menu = getNestBlockMenu({ hasSelection, activeBlocks: [], nestableBlocks: [], mathEnabled: false })
    expect(menu.enabled).toBe(false)
    const items = menu.submenu as MenuItemConstructorOptions[]
    expect(items).toHaveLength(5)
    expect(items.every(item => item.enabled === false)).toBe(true)
    const send = vi.fn()
    items[0].click?.({} as never, { webContents: { send } } as never, {} as never)
    expect(send).not.toHaveBeenCalled()
  })
})
