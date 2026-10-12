<template>
  <div>
    <div
      v-if="showTitleBar"
      class="title-bar-editor-bg"
      :class="{ 'tabs-visible': showTabBar }"
    />
    <div
      v-if="showTitleBar"
      class="title-bar"
      :class="[
        { active: active },
        { 'tabs-visible': showTabBar },
        { frameless: titleBarStyle === 'custom' },
        { isOsx: isOsx }
      ]"
    >
      <div
        ref="titleElement"
        class="title"
        :style="{ fontSize: `${titleFontSize}px` }"
        :title="pathname || filename || 'MarkText'"
        @dblclick.stop="toggleMaxmizeOnMacOS"
      >
        <span v-if="!filename">MarkText</span>
        <span
          v-else
          class="title-content"
        >
          <span
            class="save-dot"
            :class="{ show: !isSaved }"
          />
          <span class="path">
            <bdi
              ref="titleText"
              dir="ltr"
            >
              <span
                v-for="(path, index) of paths"
                :key="index"
              >
                {{ path }}
                <el-icon
                  class="path-arrow"
                  :size="12"
                >
                  <ArrowRight />
                </el-icon>
              </span>
              <span
                class="filename"
                :class="{ isOsx: platform === 'darwin' }"
                @click="rename"
              >
                {{ filename }}
              </span>
            </bdi>
          </span>
        </span>
      </div>
      <div
        class="appearance-shortcut title-no-drag"
        :class="{ 'without-window-controls': titleBarStyle !== 'custom' || isFullScreen || isOsx }"
      >
        <appearance-switch />
      </div>
      <div :class="showCustomTitleBar ? 'left-toolbar title-no-drag' : 'right-toolbar'">
        <button
          v-if="showCustomTitleBar"
          class="frameless-titlebar-menu title-no-drag"
          type="button"
          aria-label="MarkText"
          aria-haspopup="menu"
          @mousedown.prevent
          @click.stop="handleMenuClick"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
      <div
        v-if="titleBarStyle === 'custom' && !isFullScreen && !isOsx"
        class="right-toolbar"
        :class="[{ 'title-no-drag': titleBarStyle === 'custom' }]"
      >
        <div
          class="frameless-titlebar-button frameless-titlebar-close"
          @click.stop="handleCloseClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path :d="windowIconClose" />
            </svg>
          </div>
        </div>
        <div
          class="frameless-titlebar-button frameless-titlebar-toggle"
          @click.stop="handleMaximizeClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path
                v-show="!isMaximized"
                :d="windowIconMaximize"
              />
              <path
                v-show="isMaximized"
                :d="windowIconRestore"
              />
            </svg>
          </div>
        </div>
        <div
          class="frameless-titlebar-button frameless-titlebar-minimize"
          @click.stop="handleMinimizeClick"
        >
          <div>
            <svg
              width="10"
              height="10"
            >
              <path :d="windowIconMinimize" />
            </svg>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="!showTitleBar"
      class="appearance-shortcut native-appearance title-no-drag"
    >
      <appearance-switch />
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePreferencesStore } from '@/store/preferences.js'
import { useLayoutStore } from '@/store/layout.js'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { minimizePath, restorePath, maximizePath, closePath } from '../../assets/window-controls.js'
import { isMac as isOsxPlatform } from '@/util'
import { shouldShowInAppTitleBar } from './visibility'
import { useEditorStore } from '@/store/editor'
import { ArrowRight } from '@element-plus/icons-vue'
import AppearanceSwitch from './appearanceSwitch.vue'
import { openApplicationMenu } from '../applicationMenu/state'

interface ProjectInfo {
  name?: string
  [key: string]: unknown
}

const props = defineProps<{
  project?: ProjectInfo | null
  filename?: string
  pathname?: string
  active?: boolean
  platform?: string
  isSaved?: boolean
}>()

const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const editorStore = useEditorStore()

const isOsx = isOsxPlatform
const windowIconMinimize = minimizePath
const windowIconRestore = restorePath
const windowIconMaximize = maximizePath
const windowIconClose = closePath

const isFullScreen = ref(false)
const isMaximized = ref(false)
const titleElement = ref<HTMLElement | null>(null)
const titleText = ref<HTMLElement | null>(null)
const titleFontSize = ref(14)
let titleObserver: ResizeObserver | undefined
let titleFrame = 0

const fitTitle = () => {
  cancelAnimationFrame(titleFrame)
  titleFrame = requestAnimationFrame(() => {
    const element = titleElement.value
    const text = titleText.value
    if (!element || !text) return
    const style = getComputedStyle(element)
    const available =
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 24
    const naturalWidth = (text.getBoundingClientRect().width * 14) / titleFontSize.value
    titleFontSize.value = Math.max(
      10,
      Math.min(14, naturalWidth > 0 ? (14 * available) / naturalWidth : 14)
    )
  })
}

watch(
  () => [props.filename, props.pathname],
  () => nextTick(fitTitle)
)
onMounted(() => {
  titleObserver = new ResizeObserver(fitTitle)
  if (titleElement.value) titleObserver.observe(titleElement.value)
  fitTitle()
})
onBeforeUnmount(() => {
  titleObserver?.disconnect()
  cancelAnimationFrame(titleFrame)
})

onMounted(async () => {
  try {
    const [fs, max] = await Promise.all([
      window.electron.windowControl.isFullScreen(),
      window.electron.windowControl.isMaximized()
    ])
    isFullScreen.value = !!fs
    isMaximized.value = !!max
  } catch {
    // Window state is best-effort; keep the previous values if the query fails.
  }
})

const { titleBarStyle } = storeToRefs(preferencesStore)
const { showTabBar } = storeToRefs(layoutStore)

const paths = computed(() => {
  if (!props.pathname) return []
  const pathnameToken = props.pathname.split(/[\\/]/).filter((i) => i)
  return pathnameToken.slice(0, pathnameToken.length - 1).slice(-3)
})

const showCustomTitleBar = computed(() => {
  return titleBarStyle.value === 'custom' && !isOsx
})

const showTitleBar = computed(() => {
  return shouldShowInAppTitleBar(titleBarStyle.value, isOsx)
})

watch(
  () => [props.filename, props.project?.name],
  ([value]) => {
    // Set filename when hover on dock
    const hasOpenFolder = !!(props.project && props.project.name)
    const projectName = props.project?.name ?? ''
    let title: string
    if (value) {
      title = hasOpenFolder ? `${value} - ${projectName}` : `${value}`
    } else {
      title = hasOpenFolder ? projectName : ''
    }

    document.title = title
  },
  { immediate: true }
)

const handleCloseClick = () => {
  window.electron.windowControl.close()
}

const handleMaximizeClick = async () => {
  if (isFullScreen.value) {
    window.electron.windowControl.setFullScreen(false)
    return
  }
  if (isMaximized.value) window.electron.windowControl.unmaximize()
  else window.electron.windowControl.maximize()
}

const toggleMaxmizeOnMacOS = () => {
  if (isOsx) {
    handleMaximizeClick()
  }
}

const handleMinimizeClick = () => {
  window.electron.windowControl.minimize()
}

const handleMenuClick = (event: MouseEvent) => openApplicationMenu(event)

const rename = () => {
  if (props.platform === 'darwin') {
    editorStore.RESPONSE_FOR_RENAME()
  }
}

const onMaximize = () => {
  isMaximized.value = true
}
const onUnmaximize = () => {
  isMaximized.value = false
}
const onEnterFullScreen = () => {
  isFullScreen.value = true
}
const onLeaveFullScreen = () => {
  isFullScreen.value = false
}

const offMaximize = window.electron.ipcRenderer.on('mt::window-maximize', onMaximize)
const offUnmaximize = window.electron.ipcRenderer.on('mt::window-unmaximize', onUnmaximize)
const offEnterFullScreen = window.electron.ipcRenderer.on(
  'mt::window-enter-full-screen',
  onEnterFullScreen
)
const offLeaveFullScreen = window.electron.ipcRenderer.on(
  'mt::window-leave-full-screen',
  onLeaveFullScreen
)

onBeforeUnmount(() => {
  offMaximize()
  offUnmaximize()
  offEnterFullScreen()
  offLeaveFullScreen()
})
</script>

<style scoped>
.title-bar-editor-bg {
  height: var(--titleBarHeight);
  background: var(--editorBgColor);
  position: relative;
  left: 0;
  top: 0;
  right: 0;
}
.title-bar {
  -webkit-app-region: drag;
  user-select: none;
  background: transparent;
  height: var(--titleBarHeight);
  box-sizing: border-box;
  color: var(--editorColor50);
  /* The editor column owns the center, including during live sidebar resizing. */
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: 2;
  transition: color 0.4s ease-in-out;
  cursor: default;
}
.active {
  color: var(--editorColor);
}
img {
  height: 90%;
  margin-top: 1px;
  vertical-align: top;
}
.title {
  padding: 0 min(186px, 50%);
  height: 100%;
  line-height: var(--titleBarHeight);
  font-size: 14px;
  text-align: center;
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 1px;
    width: 100%;
    z-index: 1;
    -webkit-app-region: no-drag;
  }
}
div.title > span {
  display: flex;
  align-items: baseline;
  justify-content: center;
  height: 100%;
  min-width: 0;
}

/* Balance the save indicator so the path itself stays on the editor's center. */
.title-content::after {
  content: '';
  flex: 0 0 12px;
}

/* Workaround for GH#339: the RTL context clips an over-long path from the left
   so the filename stays visible. The save dot is a sibling rather than a child
   so that clipping can never swallow it. */
div.title > span > .path {
  direction: rtl;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* The RTL context above only exists to clip long paths from the left. Isolating
   each segment keeps an RTL folder name from dragging its separator — or the
   segments around it — out of order. */
div.title > span > .path > bdi > span {
  unicode-bidi: isolate;
}

div.title > span > .path > bdi {
  display: inline-block;
}

.title-bar .title .filename.isOsx:hover {
  color: var(--themeColor);
}

.save-dot {
  flex: none;
  margin-right: 4px;
  width: 8px;
  height: 8px;
  display: inline-block;
  border-radius: 50%;
  background: var(--highlightThemeColor);
  opacity: 0.7;
  visibility: hidden;
}
.save-dot.show {
  visibility: visible;
}
.title:hover {
  color: var(--sideBarTitleColor);
}

.left-toolbar {
  height: var(--titleBarHeight);
  position: fixed;
  top: 0;
  left: 0;
  width: 45px;
  display: flex;
  flex-direction: row;
}
.right-toolbar {
  height: 100%;
  position: absolute;
  top: 0;
  right: 0;
  width: 138px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  & .item {
    margin-right: 10px;
  }
}

.title-no-drag {
  -webkit-app-region: no-drag;
}
.appearance-shortcut {
  position: absolute;
  top: 0;
  right: 146px;
  height: var(--titleBarHeight);
  display: flex;
  align-items: center;
  z-index: 3;
}
.appearance-shortcut.without-window-controls {
  right: 8px;
}
.appearance-shortcut.native-appearance {
  top: 6px;
  right: 10px;
  z-index: 5;
}
/* frameless window controls */
.frameless-titlebar-button {
  position: relative;
  display: block;
  width: 46px;
  height: var(--titleBarHeight);
}
.frameless-titlebar-button > div {
  position: absolute;
  display: inline-flex;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
}
.frameless-titlebar-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 45px;
  height: var(--titleBarHeight);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--sideBarColor);
  cursor: pointer;
}
.frameless-titlebar-menu svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
}
.frameless-titlebar-menu:hover,
.frameless-titlebar-menu:focus-visible {
  background: var(--itemBgColor);
}
.frameless-titlebar-menu:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: -2px;
}
.frameless-titlebar-close:hover {
  background-color: rgb(228, 79, 79);
}
.frameless-titlebar-minimize:hover,
.frameless-titlebar-toggle:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
.frameless-titlebar-button svg {
  fill: #000000;
}
.frameless-titlebar-close:hover svg {
  fill: #ffffff;
}

</style>
