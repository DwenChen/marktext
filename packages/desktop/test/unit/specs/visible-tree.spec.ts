import { describe, expect, it } from 'vitest'
import { flattenVisibleTree, visibleRowRange } from '@/components/sideBar/visibleTree'
import type { TreeFolderNode, TreeFileNode } from '@/components/sideBar/types'

const file = (pathname: string): TreeFileNode => ({
  pathname, name: pathname, isFile: true, isDirectory: false, isMarkdown: true
})
const folder = (pathname: string, files: TreeFileNode[] = []): TreeFolderNode => ({
  pathname, name: pathname, isFile: false, isDirectory: true, isMarkdown: false, files, folders: [], isCollapsed: true
})

describe('visible file tree rows', () => {
  it('visits only expanded folders and inserts the create input at the correct depth', () => {
    const root = folder('/root', [file('/root/root.md')])
    const child = folder('/root/sub', [file('/root/sub/note.md')])
    root.folders.push(child)
    expect(flattenVisibleTree(root).map(r => r.kind)).toEqual(['folder', 'file'])
    child.isCollapsed = false
    expect(flattenVisibleTree(root, child.pathname).map(r => [r.kind, r.depth])).toEqual([
      ['folder', 0], ['input', 1], ['file', 1], ['file', 0]
    ])
  })

  it('bounds mounted rows regardless of directory size and clamps the range after collapsing', () => {
    const range = visibleRowRange(100000, 900000, 600)
    expect(range.end - range.start).toBe(36)
    expect(range.start).toBe(29992)
    expect(visibleRowRange(3, 900000, 600)).toEqual({ start: 0, end: 3 })
    expect(visibleRowRange(0, 0, 600)).toEqual({ start: 0, end: 0 })
  })
})
