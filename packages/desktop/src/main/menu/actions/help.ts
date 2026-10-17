import { type BrowserWindow } from 'electron'

export const showUserGuide = (
  win: BrowserWindow | null | undefined,
  page: 'guide' | 'markdown' = 'guide'
): void => {
  if (win && !win.isDestroyed()) win.webContents.send('mt::help-dialog', page)
}

export const showAboutDialog = (win: BrowserWindow | null | undefined): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::about-dialog')
  }
}
