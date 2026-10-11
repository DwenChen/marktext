<template>
  <div
    ref="viewport"
    class="editor-with-tabs"
  >
    <tabs v-show="showTabBar" />
    <div
      ref="container"
      class="container"
      :style="viewportStyle"
    >
      <editor
        :markdown="markdown"
        :cursor="cursor"
        :text-direction="textDirection"
        :platform="platform"
        :viewport-height="editorViewportHeight"
      />
      <source-code
        v-if="sourceCode"
        :markdown="markdown"
        :muya-index-cursor="muyaIndexCursor"
        :text-direction="textDirection"
      />
    </div>
    <tab-notifications />
  </div>
</template>

<script setup lang="ts">
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import bus from '@/bus'

const viewport = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const viewportStyle = ref<Record<string, string>>()
const editorViewportHeight = ref(window.innerHeight)
let windowResizing = false
let sidebarResizing = false
let pendingWindowResize = false
let resizeTimer: ReturnType<typeof setTimeout> | undefined
let resizeFrame = 0
let resizeObserver: ResizeObserver | undefined

const updateViewport = (): void => {
  resizeFrame = 0
  const host = viewport.value
  const content = container.value
  if (!host || !content || windowResizing || sidebarResizing || pendingWindowResize) return
  viewportStyle.value = {
    width: `${host.clientWidth}px`,
    height: `${Math.max(0, host.clientHeight - content.offsetTop)}px`,
    flex: 'none'
  }
  editorViewportHeight.value = window.innerHeight
}
const scheduleResize = (): void => {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(updateViewport)
}
const handleWindowResize = (): void => {
  // Windows can deliver IPC after the first viewport change. Keep the cached
  // dimensions while resize events stream in, including on Linux without native
  // drag-boundary events. A short idle period also recovers cancelled drags.
  pendingWindowResize = true
  cancelAnimationFrame(resizeFrame)
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    pendingWindowResize = false
    scheduleResize()
  }, 150)
}
const handleSidebarResize = (resizing: unknown): void => {
  sidebarResizing = !!resizing
  if (!resizing) scheduleResize()
}
const offWindowResize = window.electron.ipcRenderer.on(
  'mt::window-resizing',
  (_event, resizing) => {
    windowResizing = resizing
    if (!resizing) {
      pendingWindowResize = false
      clearTimeout(resizeTimer)
      scheduleResize()
    }
  }
)
bus.on('sidebar-resize', handleSidebarResize)
onMounted(() => {
  // Keep pixel dimensions between frames as well: IPC may arrive after the
  // first native resize, and a fluid child would already have reflowed by then.
  updateViewport()
  resizeObserver = new ResizeObserver(scheduleResize)
  if (viewport.value) resizeObserver.observe(viewport.value)
  window.addEventListener('resize', handleWindowResize)
})
onBeforeUnmount(() => {
  bus.off('sidebar-resize', handleSidebarResize)
  offWindowResize()
  resizeObserver?.disconnect()
  cancelAnimationFrame(resizeFrame)
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', handleWindowResize)
})

const props = defineProps<{
  markdown: string
  // `cursor` originates as `IFileState.cursor` which is `unknown`
  // (see src/shared/types/files.ts); align here instead of forcing every
  // caller to widen.
  cursor: unknown
  muyaIndexCursor?: unknown
  sourceCode: boolean
  showTabBar: boolean
  textDirection: string
  platform: string
}>()
watch(() => props.showTabBar, scheduleResize, { flush: 'post' })
</script>

<style scoped>
.editor-with-tabs {
  position: relative;
  min-height: 0;
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;

  overflow: hidden;
  background: var(--editorBgColor);
  & > .container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    contain: layout;
  }
}
</style>
