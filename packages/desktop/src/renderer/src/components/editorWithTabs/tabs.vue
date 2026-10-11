<template>
  <div
    ref="tabBar"
    class="editor-tabs"
  >
    <div
      ref="tabContainer"
      class="scrollable-tabs"
    >
      <ul
        ref="tabDropContainer"
        class="tabs-container"
      >
        <li
          v-for="file of tabs"
          :key="file.id"
          :title="file.pathname"
          :class="{ active: selectedTabId === file.id, unsaved: !file.isSaved }"
          :data-id="file.id"
          @click.stop="selectFile(file)"
          @click.middle="closeTab(file.id)"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <span>{{ file.filename }}</span>
          <span class="unsaved-dot" />
          <el-icon
            class="close-icon"
            :size="12"
            @click.stop="removeFileInTab(file)"
          >
            <Close />
          </el-icon>
        </li>
      </ul>
    </div>
    <div
      class="new-file"
      @click.stop="newFile()"
    >
      <el-icon :size="16">
        <Plus />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { storeToRefs } from 'pinia'
import autoScroll from 'dom-autoscroller'
import dragula from 'dragula'
import { Plus, Close } from '@element-plus/icons-vue'
import { showContextMenu } from '../../contextMenu/tabs'
import bus from '../../bus'
import type { IFileState } from '@shared/types/files'

const editorStore = useEditorStore()
const layoutStore = useLayoutStore()

const { currentFile, tabs } = storeToRefs(editorStore)

interface AutoScroller {
  readonly down: boolean
  destroy: (forceCleanAnimation?: boolean) => void
}

// Pointer travel, in CSS pixels, that separates a click from a tab drag.
// Matches the platform drag thresholds (Blink 3px, Win32 SM_CXDRAG 4px) with a
// little slack for trackpad drift.
const DRAG_THRESHOLD_PX = 5

const tabBar = ref<HTMLElement | null>(null)
const tabContainer = ref<HTMLElement | null>(null)
const tabDropContainer = ref<HTMLElement | null>(null)
let autoScroller: AutoScroller | null = null
let drake: dragula.Drake | null = null
const pendingTabId = ref<string | null>(null)
const selectedTabId = computed(() => pendingTabId.value || currentFile.value?.id)
let switchFrame = 0
let visibilityFrame = 0
let tabResizeObserver: ResizeObserver | undefined

// Computed properties

// Methods incorporated from tabsMixins
const selectFile = (file: IFileState) => {
  cancelAnimationFrame(switchFrame)
  pendingTabId.value = file.id
  // Let the tab highlight paint before rebuilding a large document. Rapid
  // clicks replace the pending target, so intermediate documents never load.
  switchFrame = requestAnimationFrame(() => {
    switchFrame = requestAnimationFrame(() => {
      pendingTabId.value = null
      if (tabs.value.some((tab) => tab.id === file.id)) editorStore.UPDATE_CURRENT_FILE(file)
    })
  })
}

const removeFileInTab = (file: IFileState) => {
  const { isSaved } = file
  if (isSaved) {
    editorStore.FORCE_CLOSE_TAB(file)
  } else {
    editorStore.CLOSE_UNSAVED_TAB(file)
  }
}

// Original methods
const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}

// Keep the active tab visible when the selection changes by something other
// than a direct click on a visible tab (keyboard cycle, switch-by-index, open
// from the sidebar): the strip has `overflow: hidden` and only scrolls on the
// wheel, so an off-screen tab would otherwise stay hidden (#3958).
const scrollActiveTabIntoView = () => {
  const container = tabContainer.value
  if (!container) return
  const activeTab = container.querySelector<HTMLElement>('li.active')
  if (!activeTab) return

  const containerRect = container.getBoundingClientRect()
  const tabRect = activeTab.getBoundingClientRect()
  if (tabRect.left < containerRect.left) {
    container.scrollLeft -= containerRect.left - tabRect.left
  } else if (tabRect.right > containerRect.right) {
    container.scrollLeft += tabRect.right - containerRect.right
  }
}

const scheduleActiveTabVisibility = () => {
  cancelAnimationFrame(visibilityFrame)
  visibilityFrame = requestAnimationFrame(() => {
    visibilityFrame = 0
    const container = tabContainer.value
    const availableWidth = (tabBar.value?.clientWidth ?? 0) - 28
    if (!container || availableWidth <= 0) return
    // A long filename must fit even when a wide sidebar leaves a narrow strip.
    container.style.setProperty('--tab-max-width', `${Math.min(280, availableWidth)}px`)
    scrollActiveTabIntoView()
  })
}

const handleTabScroll = (event: WheelEvent) => {
  // Use mouse wheel value first but prioritize X value more (e.g. touchpad input).
  let delta = event.deltaY
  if (event.deltaX !== 0) {
    delta = event.deltaX
  }

  const tabsEl = tabContainer.value
  if (!tabsEl) return
  const newLeft = Math.max(0, Math.min(tabsEl.scrollLeft + delta, tabsEl.scrollWidth))
  tabsEl.scrollLeft = newLeft
}

const closeTab = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab) {
    editorStore.CLOSE_TAB(tab)
  }
}

const closeOthers = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab) {
    editorStore.CLOSE_OTHER_TABS(tab)
  }
}

const closeSaved = () => {
  editorStore.CLOSE_SAVED_TABS()
}

const closeAll = () => {
  editorStore.CLOSE_ALL_TABS()
}

const changeMaxWidth = (width: unknown) => {
  layoutStore.CHANGE_SIDE_BAR_WIDTH(width as number)
}

const rename = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) {
    editorStore.RENAME_FILE(tab)
  }
}

const copyPath = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) {
    window.electron.clipboard.writeText(tab.pathname)
  }
}

const showInFolder = (tabId: unknown) => {
  const tab = tabs.value.find((f) => f.id === tabId)
  if (tab && tab.pathname) {
    window.electron.shell.showItemInFolder(tab.pathname)
  }
}

const handleContextMenu = (event: MouseEvent, tab: IFileState) => {
  if (tab.id) {
    showContextMenu(event, tab)
  }
}

watch(
  () => currentFile.value?.id,
  () => {
    cancelAnimationFrame(switchFrame)
    pendingTabId.value = null
    nextTick(scheduleActiveTabVisibility)
  }
)

onMounted(() => {
  bus.on('TABS::close-this', closeTab)
  bus.on('TABS::close-others', closeOthers)
  bus.on('TABS::close-saved', closeSaved)
  bus.on('TABS::close-all', closeAll)
  bus.on('TABS::rename', rename)
  bus.on('TABS::copy-path', copyPath)
  bus.on('TABS::show-in-folder', showInFolder)
  bus.on('EDITOR_TABS::change-max-width', changeMaxWidth)

  const tabsEl = tabContainer.value
  if (!tabsEl || !tabDropContainer.value) return

  // Allow to scroll through the tabs by mouse wheel or touchpad.
  tabsEl.addEventListener('wheel', handleTabScroll)
  // Track the lightweight tab strip independently of the document's cached
  // viewport, including sidebar drags and showing the previously hidden bar.
  tabResizeObserver = new ResizeObserver(scheduleActiveTabVisibility)
  if (tabBar.value) tabResizeObserver.observe(tabBar.value)
  scheduleActiveTabVisibility()

  // Allow tab drag and drop to reorder tabs.
  drake = dragula([tabDropContainer.value], {
    direction: 'horizontal',
    revertOnSpill: true,
    mirrorContainer: tabDropContainer.value,
    ignoreInputTextSelection: false,
    // dragula's own default is 0, i.e. a single pixel of pointer drift between
    // press and release turns a click into a drag. The drag then swallows the
    // `click` entirely — its mirror element takes the mouseup and is removed
    // before the browser can retarget — so `selectFile` never runs and the tab
    // refuses to activate (#4895). Require a deliberate movement instead.
    slideFactorX: DRAG_THRESHOLD_PX,
    slideFactorY: DRAG_THRESHOLD_PX
  }).on('drop', (el, _target, _source, sibling) => {
    // Current tab that was dropped and need to be reordered.
    const droppedId = el?.getAttribute('data-id')
    // This should be the next tab (tab | ... | el | sibling | tab | ...) but may be
    // the mirror image or null (tab | ... | el | sibling or null) if last tab.
    const nextTabId = sibling ? sibling.getAttribute('data-id') : null
    const isLastTab = !sibling || sibling.classList.contains('gu-mirror')
    if (!droppedId || (sibling && !nextTabId)) {
      console.error('Tab reorder error: invalid tab IDs')
      return
    }

    editorStore.EXCHANGE_TABS_BY_ID({
      fromId: droppedId,
      toId: isLastTab ? null : nextTabId
    })
  })

  // Scroll when dragging a tab to the beginning or end of the tab container.
  autoScroller = autoScroll([tabsEl], {
    margin: 20,
    maxSpeed: 6,
    scrollWhenOutside: false,
    autoScroll: () => {
      return autoScroller!.down && drake?.dragging
    }
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(switchFrame)
  cancelAnimationFrame(visibilityFrame)
  tabResizeObserver?.disconnect()
  const tabsEl = tabContainer.value
  if (tabsEl) {
    tabsEl.removeEventListener('wheel', handleTabScroll)
  }

  if (autoScroller) {
    // Force destroy
    autoScroller.destroy(true)
  }
  if (drake) {
    drake.destroy()
  }

  // Remove event listeners
  bus.off('TABS::close-this', closeTab)
  bus.off('TABS::close-others', closeOthers)
  bus.off('TABS::close-saved', closeSaved)
  bus.off('TABS::close-all', closeAll)
  bus.off('TABS::rename', rename)
  bus.off('TABS::copy-path', copyPath)
  bus.off('TABS::show-in-folder', showInFolder)
  bus.off('EDITOR_TABS::change-max-width', changeMaxWidth)
})
</script>

<style scoped>
.close-icon {
  cursor: pointer;
  transition: opacity 0.15s ease-in-out;
}

.close-icon:hover {
  color: var(--focusColor);
}

.editor-tabs {
  position: relative;
  display: flex;
  flex-direction: row;
  height: 28px;
  /* The frozen document can exceed the live viewport during a resize. Reserve
     the controls' row instead of letting flexbox squeeze it to zero. */
  flex: 0 0 28px;
  min-width: 0;
  user-select: none;
  box-shadow: 0px 0px 9px 2px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  &:hover > .new-file {
    opacity: 1 !important;
  }
}
.scrollable-tabs {
  flex: 0 1 auto;
  min-width: 0;
  height: 28px;
  overflow: hidden;
}
.tabs-container {
  min-width: min-content;
  list-style: none;
  margin: 0;
  padding: 0;
  height: 28px;
  position: relative;
  display: flex;
  flex-direction: row;
  overflow-y: hidden;
  z-index: 2;
  &::-webkit-scrollbar:horizontal {
    display: none;
  }
  & > li {
    transition:
      color 120ms ease,
      background-color 120ms ease;
    flex-shrink: 0;
    position: relative;
    padding: 0 8px;
    color: var(--editorColor50);
    font-size: 12px;
    line-height: 28px;
    height: 28px;
    box-sizing: border-box;
    max-width: var(--tab-max-width, 280px);
    display: flex;
    align-items: center;
    &::after {
      content: '';
      position: absolute;
      inset: auto 0 0;
      height: 2px;
      background: var(--themeColor);
      transform: scaleX(0);
      opacity: 0;
      transition:
        transform 120ms ease-out,
        opacity 120ms ease-out;
    }
    &[aria-grabbed='true'] {
      color: var(--editorColor30) !important;
    }
    & > .close-icon {
      opacity: 0;
      flex: 0 0 12px;
    }
    &:focus {
      outline: none;
    }
    &:hover {
      background: var(--floatBgColor) !important;
    }
    &:hover > .close-icon {
      opacity: 1;
    }
    &:hover > .unsaved-dot {
      display: none;
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 3px;
    }
    & > .unsaved-dot {
      display: none;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--themeColor);
      flex-shrink: 0;
      position: absolute;
      right: 11px;
    }
  }
  & > li.unsaved:not(.active) {
    & > .close-icon {
      opacity: 0;
    }
    & > .unsaved-dot {
      display: block;
    }
    &:hover > .close-icon {
      opacity: 1;
    }
    &:hover > .unsaved-dot {
      display: none;
    }
  }
  & > li.active {
    background: var(--itemBgColor);
    z-index: 3;
    &:after {
      transform: scaleX(1);
      opacity: 1;
    }
    & > .close-icon {
      opacity: 1;
    }
    & > .unsaved-dot {
      display: none;
    }
  }
}
.editor-tabs > .new-file {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-right: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-around;
  cursor: pointer;
  color: var(--editorColor50);
  opacity: 0;
  &.always-visible {
    opacity: 1;
  }
}

.editor-tabs > .new-file:hover {
  transition: color 120ms ease;
  & > svg {
    fill: var(--focusColor);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tabs-container > li,
  .tabs-container > li::after,
  .close-icon {
    transition: none;
  }
}

/* dragula effects */
.gu-mirror {
  position: fixed !important;
  margin: 0 !important;
  z-index: 9999 !important;
  opacity: 0.8;
  cursor: grabbing;
}
.gu-hide {
  display: none !important;
}
.gu-unselectable {
  user-select: none !important;
}
.gu-transit {
  opacity: 0.2;
}
</style>
