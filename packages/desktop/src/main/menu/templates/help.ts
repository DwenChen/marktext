import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { showUserGuide } from '../actions/help'
import { t } from '../../i18n'

export default function(): MenuItemConstructorOptions {
  return {
    id: 'helpMenu',
    label: t('menu.help.help'),
    role: 'help',
    submenu: [
      {
        id: 'userGuideMenuItem',
        label: t('menu.help.userGuide'),
        accelerator: 'F1',
        click(_menuItem, browserWindow) {
          showUserGuide(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        id: 'markdownReferenceMenuItem',
        label: t('menu.help.markdownReference'),
        click(_menuItem, browserWindow) {
          showUserGuide(browserWindow as BrowserWindow | undefined, 'markdown')
        }
      }
    ]
  }
}
