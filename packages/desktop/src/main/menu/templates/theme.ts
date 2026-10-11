import { type MenuItemConstructorOptions } from 'electron'
import { DOCUMENT_THEMES } from '../../../common/theme'
import * as actions from '../actions/theme'
import { t } from '../../i18n'
import type Preference from '../../preferences'
export default function(preferences: Preference): MenuItemConstructorOptions {
  const { theme, customThemes = [] } = preferences.getAll()
  return {
    label: t('menu.theme.theme'),
    id: 'themeMenu',
    submenu: [
      ...DOCUMENT_THEMES.map((id): MenuItemConstructorOptions => ({
        label: t(`preferences.theme.builtins.${id}`),
        id,
        type: 'radio',
        checked: theme === id,
        click: () => actions.selectTheme(id)
      })),
      ...customThemes.map(({ id, name }): MenuItemConstructorOptions => ({
        label: name,
        id,
        type: 'radio',
        checked: theme === id,
        click: () => actions.selectTheme(id)
      }))
    ]
  }
}
