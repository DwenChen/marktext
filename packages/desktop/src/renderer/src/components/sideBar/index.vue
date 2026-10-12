<template>
  <div
    v-show="showSideBar"
    ref="sideBar"
    class="side-bar"
    :class="{ compact: !rightColumn }"
    :style="[!rightColumn ? { 'min-width': '45px' } : {}, { width: `${finalSideBarWidth}px` }]"
  >
    <div class="left-column">
      <sidebar-menus
        v-if="!rightColumn"
        class="compact-menus"
        compact
      />
      <ul>
        <li
          v-for="(c, index) of sideBarIcons"
          :key="index"
          :class="{ active: c.id === rightColumn }"
          @click="handleLeftIconClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
      <ul class="bottom">
        <li
          v-for="(c, index) of sideBarBottomIcons"
          :key="index"
          @click="handleLeftBottomClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
    </div>
    <div
      v-show="rightColumn"
      class="right-column"
    >
      <sidebar-menus />
      <div class="sidebar-content">
        <tree
          v-if="rightColumn === 'files'"
          :project-tree="projectTree"
          :opened-files="openedFiles"
          :tabs="tabs"
        />
        <side-bar-search v-else-if="rightColumn === 'search'" />
        <toc v-else-if="rightColumn === 'toc'" />
      </div>
    </div>
    <div
      v-show="rightColumn"
      ref="dragBar"
      class="drag-bar"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="t('preferences.editor.resizeSidebar')"
      :aria-valuenow="finalSideBarWidth"
      :aria-valuemin="220"
      @pointerdown="startResize"
      @lostpointercapture="stopResize"
      @keydown="resizeWithKeyboard"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLayoutStore } from '@/store/layout'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'

import { sideBarIcons, sideBarBottomIcons } from './help'
import Tree from './tree.vue'
import SideBarSearch from './search.vue'
import Toc from './toc.vue'
import SidebarMenus from './menus.vue'
import { storeToRefs } from 'pinia'
import type { TabDescriptor } from './types'
import bus from '@/bus'

const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const { t } = useI18n()

const sideBar = ref<HTMLDivElement | null>(null)
const dragBar = ref<HTMLDivElement | null>(null)

const openedFiles = ref<TabDescriptor[]>([])

const { rightColumn, showSideBar, sideBarWidth } = storeToRefs(layoutStore)
const sideBarViewWidth = ref(sideBarWidth.value)

const { projectTree } = storeToRefs(projectStore)
const { tabs } = storeToRefs(editorStore)

const finalSideBarWidth = computed<number>(() => {
  if (!showSideBar.value) return 0
  if (rightColumn.value === '') return 45
  return sideBarViewWidth.value < 220 ? 220 : sideBarViewWidth.value
})

let pointerId: number | null = null
let startX = 0
let startWidth = 0
let pendingWidth = sideBarWidth.value
let resizeFrame: number | null = null

const clampWidth = (width: number): number =>
  Math.min(Math.max(220, width), Math.max(220, window.innerWidth - 320))

watch(sideBarWidth, (width) => {
  if (pointerId == null) sideBarViewWidth.value = width
})

const moveResize = (event: PointerEvent): void => {
  if (event.pointerId !== pointerId) return
  pendingWidth = clampWidth(startWidth + event.clientX - startX)
  if (resizeFrame != null) return
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null
    sideBarViewWidth.value = pendingWidth
  })
}

const stopResize = (): void => {
  if (pointerId == null) return
  const id = pointerId
  pointerId = null
  if (resizeFrame != null) cancelAnimationFrame(resizeFrame)
  resizeFrame = null
  window.removeEventListener('pointermove', moveResize)
  window.removeEventListener('pointerup', finishResize)
  window.removeEventListener('pointercancel', stopResize)
  window.removeEventListener('blur', stopResize)
  if (dragBar.value?.hasPointerCapture(id)) dragBar.value.releasePointerCapture(id)
  sideBarViewWidth.value = pendingWidth
  if (pendingWidth !== sideBarWidth.value) layoutStore.CHANGE_SIDE_BAR_WIDTH(pendingWidth)
  bus.emit('sidebar-resize', false)
}

const finishResize = (event: PointerEvent): void => {
  if (event.pointerId !== pointerId) return
  pendingWidth = clampWidth(startWidth + event.clientX - startX)
  stopResize()
}

const startResize = (event: PointerEvent): void => {
  if (event.button !== 0 || pointerId != null || !dragBar.value) return
  event.preventDefault()
  pointerId = event.pointerId
  startX = event.clientX
  startWidth = sideBarViewWidth.value
  pendingWidth = startWidth
  bus.emit('sidebar-resize', true)
  dragBar.value.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', moveResize)
  window.addEventListener('pointerup', finishResize)
  window.addEventListener('pointercancel', stopResize)
  window.addEventListener('blur', stopResize)
}

const resizeWithKeyboard = (event: KeyboardEvent): void => {
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
  event.preventDefault()
  const width =
    event.key === 'Home' ? 220 : sideBarWidth.value + (event.key === 'ArrowLeft' ? -10 : 10)
  layoutStore.CHANGE_SIDE_BAR_WIDTH(clampWidth(width))
}

onBeforeUnmount(stopResize)

const handleLeftIconClick = (name: string): void => {
  if (rightColumn.value === name) {
    // Capture the expanded width BEFORE collapsing: once rightColumn is '',
    // finalSideBarWidth evaluates to the 45px icon strip and would overwrite
    // the user's real width with the clamped 220px minimum (#2421).
    const widthToPersist = finalSideBarWidth.value
    layoutStore.SET_LAYOUT({ rightColumn: '' })
    layoutStore.CHANGE_SIDE_BAR_WIDTH(widthToPersist)
  } else {
    const needDispatch = rightColumn.value === ''
    layoutStore.SET_LAYOUT({ rightColumn: name })
    sideBarViewWidth.value = +sideBarWidth.value
    if (needDispatch) {
      layoutStore.CHANGE_SIDE_BAR_WIDTH(finalSideBarWidth.value)
    }
  }
}

const handleLeftBottomClick = (name: string): void => {
  if (name === 'settings') {
    projectStore.OPEN_SETTING_WINDOW()
  }
}
</script>

<style scoped>
.side-bar {
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  width: 280px;
  height: 100vh;
  min-width: 220px;
  position: relative;
  color: var(--sideBarColor);
  user-select: none;
  background: var(--sideBarBgColor);
  border-right: 1px solid var(--itemBgColor);
}

.side-bar .left-column svg {
  color: var(--iconColor);
}

.left-column {
  height: 100%;
  width: 45px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 28px;
  box-sizing: border-box;
}

.left-column > ul {
  opacity: 1;
}

.left-column ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.left-column ul > li {
  width: 45px;
  height: 45px;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  cursor: pointer;
}

.left-column > .compact-menus {
  position: absolute;
  top: 28px;
  left: 0;
  width: 45px;
  box-sizing: border-box;
}

.side-bar.compact .left-column > ul:first-of-type {
  margin-top: 94px;
}

.left-column ul > li > svg {
  width: 18px;
  height: 18px;
  color: var(--sideBarIconColor);
  opacity: 1;
  transition: transform 0.25s ease-in-out;
}

.left-column ul > li.active > svg {
  color: var(--themeColor);
}

.side-bar:hover .left-column ul li svg {
  opacity: 1;
}

.right-column {
  flex: 1;
  width: calc(100% - 50px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-top: 28px;
  box-sizing: border-box;
}

.sidebar-content {
  flex: 1;
  min-height: 0;
}

.drag-bar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
}

.drag-bar:hover {
  border-right: 2px solid var(--iconColor);
}

.drag-bar:focus-visible {
  outline: 1px solid var(--themeColor);
}
</style>
