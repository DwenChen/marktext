import type { Menu, MenuItem } from 'electron'

export const getMenuItemsRecursive = (menu: Menu): MenuItem[] =>
  menu.items.flatMap((item) => [item, ...(item.submenu ? getMenuItemsRecursive(item.submenu) : [])])
