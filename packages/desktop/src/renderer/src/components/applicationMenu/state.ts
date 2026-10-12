import { shallowRef } from 'vue'
import type { MenuTemplate } from '@shared/types/menu'

export const applicationMenu = shallowRef<{
  items: MenuTemplate
  anchor: HTMLElement
  keyboard: boolean
} | null>(null)

let request = 0

export const closeApplicationMenu = (restoreFocus = false): void => {
  request++
  if (restoreFocus && applicationMenu.value?.keyboard) applicationMenu.value.anchor.focus()
  applicationMenu.value = null
}

export const openApplicationMenu = async(event: MouseEvent): Promise<void> => {
  if (applicationMenu.value) {
    closeApplicationMenu()
    return
  }
  const anchor = event.currentTarget as HTMLElement
  const currentRequest = ++request
  const items = await window.electron.ipcRenderer.invoke('mt::menu::get-application')
  if (request === currentRequest && items.length && anchor.isConnected) {
    applicationMenu.value = { items, anchor, keyboard: event.detail === 0 }
  }
}
