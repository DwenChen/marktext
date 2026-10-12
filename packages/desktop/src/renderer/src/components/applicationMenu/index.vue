<template>
  <Teleport to="body">
    <div
      v-if="applicationMenu"
      ref="root"
      class="application-menu"
      @mousedown.prevent
      @contextmenu.prevent
    >
      <div
        v-for="(panel, depth) in panels"
        :key="depth"
        class="menu-panel"
        role="menu"
        :style="{ left: `${panel.x}px`, top: `${panel.y}px` }"
      >
        <template
          v-for="(item, index) in panel.items"
          :key="item.id"
        >
          <div
            v-if="item.type === 'separator'"
            class="menu-separator"
            role="separator"
          />
          <button
            v-else
            type="button"
            class="menu-item"
            :class="{ active: panel.active === index }"
            :role="
              item.type === 'checkbox'
                ? 'menuitemcheckbox'
                : item.type === 'radio'
                  ? 'menuitemradio'
                  : 'menuitem'
            "
            :aria-checked="
              item.type === 'checkbox' || item.type === 'radio' ? !!item.checked : undefined
            "
            :aria-haspopup="item.submenu ? 'menu' : undefined"
            :aria-expanded="
              item.submenu ? panel.active === index && panels.length > depth + 1 : undefined
            "
            :disabled="item.enabled === false"
            @mouseenter="activate(depth, index, $event.currentTarget as HTMLElement)"
            @click="select(depth, index, $event.currentTarget as HTMLElement)"
          >
            <span class="menu-label">{{
              item.label?.replace(/&([^&])/g, '$1').replace(/&&/g, '&')
            }}</span>
            <span
              v-if="item.checked"
              class="menu-check"
              aria-hidden="true"
            >✓</span>
            <span
              v-if="item.accelerator"
              class="menu-shortcut"
            >{{ item.accelerator }}</span>
            <span
              v-if="item.submenu"
              class="menu-arrow"
              aria-hidden="true"
            >›</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MenuTemplate } from '@shared/types/menu'
import { applicationMenu, closeApplicationMenu } from './state'

interface Panel {
  items: MenuTemplate
  active: number
  x: number
  y: number
}

const root = ref<HTMLElement | null>(null)
const panels = ref<Panel[]>([])

const fitPanels = async (): Promise<void> => {
  await nextTick()
  root.value?.querySelectorAll<HTMLElement>('.menu-panel').forEach((element, depth) => {
    const panel = panels.value[depth]!
    const width = element.offsetWidth
    const height = element.offsetHeight
    const parent =
      depth > 0 ? root.value!.querySelectorAll<HTMLElement>('.menu-panel')[depth - 1] : null
    if (panel.x + width > window.innerWidth - 4 && parent)
      panel.x = parent.getBoundingClientRect().left - width + 2
    panel.x = Math.max(4, Math.min(panel.x, window.innerWidth - width - 4))
    panel.y = Math.max(4, Math.min(panel.y, window.innerHeight - height - 4))
  })
}

watch(applicationMenu, (menu) => {
  if (!menu) {
    panels.value = []
    return
  }
  const rect = menu.anchor.getBoundingClientRect()
  panels.value = [{ items: menu.items, active: -1, x: rect.left, y: rect.bottom }]
  if (menu.keyboard) move(1)
  void fitPanels()
})

const activate = (depth: number, index: number, element: HTMLElement): void => {
  const panel = panels.value[depth]!
  if (panel.active === index && panels.value.length > depth + 1) return
  panel.active = index
  panels.value.splice(depth + 1)
  const item = panel.items[index]!
  if (item.submenu && item.enabled !== false) {
    const rect = element.getBoundingClientRect()
    panels.value.push({ items: item.submenu, active: -1, x: rect.right, y: rect.top })
    void fitPanels()
  }
}

const select = (depth: number, index: number, element: HTMLElement): void => {
  const item = panels.value[depth]!.items[index]!
  if (item.enabled === false) return
  if (item.submenu) {
    activate(depth, index, element)
    return
  }
  closeApplicationMenu(true)
  if (item.id) void window.electron.ipcRenderer.invoke('mt::menu::execute-application', item.id)
}

const move = (direction: number): void => {
  const panel = panels.value[panels.value.length - 1]!
  const enabled = panel.items
    .map((item, index) => (item.type !== 'separator' && item.enabled !== false ? index : -1))
    .filter((index) => index >= 0)
  if (!enabled.length) return
  const current = enabled.indexOf(panel.active)
  panel.active = enabled[(current + direction + enabled.length) % enabled.length]!
  void nextTick(() => {
    const panelElement = root.value?.querySelectorAll('.menu-panel')[panels.value.length - 1]
    const element = panelElement?.querySelector<HTMLElement>('button.active')
    element?.scrollIntoView({ block: 'nearest' })
    if (applicationMenu.value?.keyboard) element?.focus({ preventScroll: true })
  })
}

const keydown = (event: KeyboardEvent): void => {
  if (!applicationMenu.value) return
  if (
    ![
      'ArrowDown',
      'ArrowUp',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'Enter',
      ' ',
      'Escape',
      'Tab'
    ].includes(event.key)
  ) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      closeApplicationMenu()
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  const depth = panels.value.length - 1
  const panel = panels.value[depth]!
  if (event.key === 'Escape' || event.key === 'Tab') closeApplicationMenu(true)
  else if (event.key === 'ArrowLeft') {
    if (depth > 0) panels.value.pop()
  } else if (event.key === 'ArrowDown') move(1)
  else if (event.key === 'ArrowUp') move(panel.active < 0 ? 0 : -1)
  else if (event.key === 'Home' || event.key === 'End') {
    panel.active = -1
    move(event.key === 'Home' ? 1 : 0)
  } else if (panel.active >= 0) {
    const panelElement = root.value?.querySelectorAll('.menu-panel')[depth]
    const element = panelElement?.querySelector<HTMLElement>('button.active')
    if (!element) return
    if (event.key === 'ArrowRight') {
      if (panel.items[panel.active]?.submenu) {
        activate(depth, panel.active, element)
        move(1)
      }
    } else select(depth, panel.active, element)
  }
}

const dismiss = (): void => closeApplicationMenu()
const outside = (event: PointerEvent): void => {
  if (
    !root.value?.contains(event.target as Node) &&
    !applicationMenu.value?.anchor.contains(event.target as Node)
  )
    dismiss()
}

onMounted(() => {
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('keydown', keydown, true)
  window.addEventListener('blur', dismiss)
  window.addEventListener('resize', dismiss)
})
onBeforeUnmount(() => {
  dismiss()
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('keydown', keydown, true)
  window.removeEventListener('blur', dismiss)
  window.removeEventListener('resize', dismiss)
})
</script>

<style scoped>
.application-menu {
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: none;
  -webkit-app-region: no-drag;
}
.menu-panel {
  position: absolute;
  width: max-content;
  min-width: 120px;
  max-width: calc(100vw - 8px);
  max-height: calc(100vh - 8px);
  overflow: auto;
  padding: 5px;
  box-sizing: border-box;
  border: 1px solid var(--floatBorderColor);
  border-radius: 8px;
  background: var(--floatBgColor);
  color: var(--editorColor);
  box-shadow: var(--floatShadow);
  pointer-events: auto;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 30px;
  padding: 5px 10px;
  border: 0;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
.menu-item.active:not(:disabled) {
  background: var(--floatHoverColor);
}
.menu-item:disabled {
  opacity: 0.4;
  cursor: default;
}
.menu-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-shortcut {
  color: var(--editorColor50);
  font-size: 12px;
}
.menu-check {
  color: var(--themeColor);
}
.menu-arrow {
  font-size: 18px;
  line-height: 16px;
}
.menu-separator {
  height: 1px;
  margin: 5px 0;
  background: var(--floatBorderColor);
}
</style>
