<template>
  <footer class="status-bar">
    <el-tooltip
      v-if="wordCount"
      popper-class="word-count-tooltip"
      placement="top-end"
    >
      <template #content>
        <div class="title-section">
          {{
            selectionWordCount ? t('menu.counter.documentSelection') : t('menu.counter.document')
          }}
        </div>
        <div
          v-for="item in tooltipCounters"
          :key="item.key"
          class="title-item"
        >
          <span>{{ t(item.label) }}:</span>
          <span class="text">{{ formatCountPair(item.key) }}</span>
        </div>
      </template>
      <button
        class="word-count"
        type="button"
        :aria-label="`${t(activeCounter.label)}: ${formatCountPair(activeCounter.key)}`"
        @mousedown.prevent
        @click="cycleCounter"
      >
        {{ activeCounter.short }} {{ formatCountPair(activeCounter.key) }}
      </button>
    </el-tooltip>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileWordCount } from '@shared/types/files'

const props = defineProps<{
  wordCount?: FileWordCount | null
  selectionWordCount?: FileWordCount | null
}>()

const { t } = useI18n()
const counters = [
  { key: 'word', short: 'W', label: 'menu.counter.words' },
  { key: 'paragraph', short: 'P', label: 'menu.counter.paragraphs' },
  { key: 'character', short: 'C', label: 'menu.counter.characters' },
  { key: 'all', short: 'A', label: 'menu.counter.allCharacters' }
] as const
const tooltipCounters = [counters[0], counters[2], counters[1], counters[3]]
const counterIndex = ref(0)
const activeCounter = computed(() => counters[counterIndex.value]!)

const formatCountPair = (key: keyof FileWordCount): string => {
  const value = props.wordCount?.[key] ?? 0
  const selection = props.selectionWordCount?.[key]
  return selection == null ? `${value}` : `${value} / ${selection}`
}

const cycleCounter = (): void => {
  counterIndex.value = (counterIndex.value + 1) % counters.length
}
</script>

<style scoped>
.status-bar {
  display: flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px;
  background: var(--editorBgColor);
  border-top: 1px solid var(--editorColor10);
  user-select: none;
  -webkit-app-region: no-drag;
}

.word-count {
  padding: 2px 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--editorColor60);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.word-count:hover,
.word-count:focus-visible {
  color: var(--sideBarTitleColor);
  background: var(--sideBarBgColor);
}

.word-count:focus-visible {
  outline: 1px solid var(--themeColor);
}

.title-section {
  margin-bottom: 6px;
  font-weight: 600;
}

.title-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  line-height: 1.8;
}
</style>
