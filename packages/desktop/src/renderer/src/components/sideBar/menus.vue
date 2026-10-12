<template>
  <nav
    class="sidebar-menus"
    :class="{ compact }"
  >
    <button
      v-for="menu in menus"
      :key="menu.id"
      type="button"
      aria-haspopup="menu"
      :title="t(menu.label)"
      @mousedown.prevent
      @click="openMenu($event, menu.id)"
    >
      {{ t(menu.label) }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SidebarMenuSection } from '@shared/types/menu'

defineProps<{ compact?: boolean }>()
const { t } = useI18n()
const menus: Array<{ id: SidebarMenuSection; label: string }> = [
  { id: 'paragraphMenuEntry', label: 'menu.paragraph.title' },
  { id: 'formatMenuItem', label: 'menu.format.format' },
  { id: 'viewMenu', label: 'menu.view.view' }
]
const openMenu = (event: MouseEvent, section: SidebarMenuSection): void => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  window.electron.ipcRenderer.send('mt::menu::popup-section', section, {
    x: Math.round(rect.left), y: Math.round(rect.bottom)
  })
}
</script>

<style scoped>
.sidebar-menus {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  height: var(--titleBarHeight);
  box-sizing: border-box;
  padding: 2px 4px;
  border-bottom: 1px solid var(--itemBgColor);
  -webkit-app-region: no-drag;
}
.sidebar-menus button {
  flex: 1;
  min-width: 0;
  padding: 5px 2px;
  border: 0;
  border-radius: 4px;
  color: var(--sideBarColor);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.sidebar-menus button:hover,
.sidebar-menus button:focus-visible {
  background: var(--itemBgColor);
  outline: 1px solid var(--themeColor);
}
.compact {
  flex-direction: column;
  height: auto;
}
</style>
