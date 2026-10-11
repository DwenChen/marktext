import type { TreeFileNode, TreeFolderNode } from './types'

export const TREE_ROW_HEIGHT = 30
const OVERSCAN_ROWS = 8

export type VisibleTreeRow =
  | { kind: 'folder'; key: string; depth: number; node: TreeFolderNode }
  | { kind: 'file'; key: string; depth: number; node: TreeFileNode }
  | { kind: 'input'; key: string; depth: number; pathname: string }

export function flattenVisibleTree(root: TreeFolderNode, createDirname?: string): VisibleTreeRow[] {
  const rows: VisibleTreeRow[] = []
  const visit = (folder: TreeFolderNode, depth: number): void => {
    for (const child of folder.folders) {
      rows.push({ kind: 'folder', key: child.id ?? child.pathname, node: child, depth })
      if (!child.isCollapsed) visit(child, depth + 1)
    }
    if (folder.pathname === createDirname) {
      rows.push({ kind: 'input', key: `input:${folder.pathname}`, pathname: folder.pathname, depth })
    }
    for (const file of folder.files) {
      rows.push({ kind: 'file', key: file.id ?? file.pathname, node: file, depth })
    }
  }
  visit(root, 0)
  return rows
}

export function visibleRowRange(count: number, scrollTop: number, viewportHeight: number) {
  const pageSize = Math.ceil(viewportHeight / TREE_ROW_HEIGHT)
  const first = Math.min(Math.floor(scrollTop / TREE_ROW_HEIGHT), Math.max(0, count - pageSize))
  return { start: Math.max(0, first - OVERSCAN_ROWS), end: Math.min(count, first + pageSize + OVERSCAN_ROWS) }
}
