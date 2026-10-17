import type { Menu, MenuItem } from 'electron'
import type { HelpCommand } from '@shared/types/menu'

export const getMenuItemsRecursive = (menu: Menu): MenuItem[] =>
  menu.items.flatMap((item) => [item, ...(item.submenu ? getMenuItemsRecursive(item.submenu) : [])])

export const describeMenuCommands = (
  items: MenuItem[],
  parents: string[] = [],
  available = true
): HelpCommand[] =>
  items.flatMap((item) => {
    if (!item.visible || item.type === 'separator') return []
    const path = [...parents, item.label.replace(/&([^&])/g, '$1').replace(/&&/g, '&')]
    const enabled = available && item.enabled
    return item.submenu
      ? describeMenuCommands(item.submenu.items, path, enabled)
      : [{ path: path.join(' › '), accelerator: item.accelerator?.toString(), available: enabled }]
  })
