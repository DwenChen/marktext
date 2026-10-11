import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getShowInFolder
} from './menuItems'
import { popupContextMenu, type ContextMenuItem } from '../popupMenu'
import { t } from '../../i18n'
import bus from '../../bus'

export const showContextMenu = (
  event: { clientX: number; clientY: number },
  hasPathCache: boolean,
  isProjectRoot = false
): void => {
  const contextItems: ContextMenuItem[] = [
    getNewFile(),
    getNewDirectory(),
    SEPARATOR,
    getCOPY(),
    getCUT(),
    getPASTE(),
    SEPARATOR,
    getRENAME(),
    getDELETE(),
    SEPARATOR,
    getShowInFolder()
  ]

  // PASTE entry (index 5) toggles based on the cached source path.
  contextItems[5].enabled = hasPathCache
  if (isProjectRoot) {
    contextItems[4].enabled = false
    contextItems[7].enabled = false
    contextItems[8].enabled = false
    contextItems.push(SEPARATOR, {
      label: t('sideBar.tree.closeFolder'),
      id: 'closeFolderMenuItem',
      click: () => bus.emit('SIDEBAR::close-project')
    })
  }

  const items: ContextMenuItem[] = contextItems.map((item) => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return {
      ...item,
      click: click ? () => click(null, null) : undefined
    }
  })

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
