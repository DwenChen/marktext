<template>
  <div class="editor-with-tabs">
    <tabs v-show="showTabBar" />
    <div ref="container" class="container" :style="{ width: resizeWidth }">
      <editor
        :markdown="markdown"
        :cursor="cursor"
        :text-direction="textDirection"
        :platform="platform"
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
import { ref, onBeforeUnmount } from 'vue'
import bus from '@/bus'

const container = ref<HTMLElement | null>(null)
const resizeWidth = ref<string>()
const handleSidebarResize = (resizing: unknown): void => {
  // Keep Muya and CodeMirror's line layout stable throughout a drag. The
  // parent clips the temporary overflow; the final width reflows once on release.
  resizeWidth.value =
    resizing && container.value ? `${container.value.getBoundingClientRect().width}px` : undefined
}
bus.on('sidebar-resize', handleSidebarResize)
onBeforeUnmount(() => bus.off('sidebar-resize', handleSidebarResize))

defineProps<{
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
  }
}
</style>
