<template>
  <el-dialog
    v-model="visible"
    class="user-guide-dialog"
    :title="
      isMarkdown
        ? tx('Markdown 参考', 'Markdown Reference')
        : tx('MarkText 使用帮助', 'MarkText User Guide')
    "
    width="min(1120px, 94vw)"
    top="5vh"
    :close-on-click-modal="false"
    destroy-on-close
    @opened="focusSearch"
  >
    <p class="guide-intro">
      {{
        isMarkdown
          ? tx(
            '离线语法参考 · 根据本软件的编辑、预览和导出实现编写',
            'Offline syntax reference · Based on this app’s editing, preview and export behavior'
          )
          : tx(
            '离线操作手册 · 搜索功能、语法、手势与快捷键',
            'Offline guide · Find features, syntax, gestures and shortcuts'
          )
      }}
    </p>
    <label class="guide-search">
      <span>{{
        isMarkdown ? tx('搜索语法', 'Search syntax') : tx('搜索帮助', 'Search help')
      }}</span>
      <input
        ref="searchInput"
        v-model="query"
        type="search"
        :placeholder="
          isMarkdown
            ? tx('例如：脚注、公式、表格、Front Matter', 'Try: footnote, math, table, Front Matter')
            : tx('例如：图片 拖动、列表、PDF、快捷键', 'Try: image drag, list, PDF, shortcut')
        "
        autocomplete="off"
      >
    </label>
    <div class="guide-layout">
      <nav
        class="guide-toc"
        :aria-label="tx('帮助目录', 'Help contents')"
      >
        <button
          v-for="section in sections"
          :key="section.id"
          :class="{ active: activeId === section.id }"
          :aria-current="activeId === section.id ? 'location' : undefined"
          @click="jump(section.id)"
        >
          {{ text(section.title) }}
        </button>
        <button
          v-if="showCommands"
          :class="{ active: activeId === 'commands' }"
          @click="jump('commands')"
        >
          {{ tx('当前菜单与快捷键', 'Current menus and shortcuts') }}
        </button>
      </nav>
      <main
        ref="contentElement"
        class="guide-content"
        tabindex="0"
        :aria-label="tx('帮助正文', 'Guide content')"
      >
        <p
          v-if="!sections.length && !showCommands"
          role="status"
          class="guide-empty"
        >
          {{
            tx(
              '未找到相关说明，请缩短关键词或清空搜索。',
              'No matching topics. Try fewer keywords or clear the search.'
            )
          }}
        </p>
        <section
          v-for="section in sections"
          :key="section.id"
          :data-guide-section="section.id"
        >
          <h2>{{ text(section.title) }}</h2>
          <ul>
            <li
              v-for="(item, index) in section.items"
              :key="index"
            >
              {{ text(item) }}
            </li>
          </ul>
          <pre v-if="section.example"><code>{{ section.example }}</code></pre>
        </section>
        <section
          v-if="showCommands"
          data-guide-section="commands"
        >
          <h2>{{ tx('当前菜单与快捷键', 'Current menus and shortcuts') }}</h2>
          <p>
            {{
              tx(
                '此表读取当前窗口实际菜单，包括自定义快捷键。未分配表示没有菜单快捷键；“当前不可用”取决于编辑模式和当前选区。标签切换等非菜单快捷键请在首选项中查看。',
                'This table reads the current window menu, including custom shortcuts. Unassigned means no menu shortcut. Availability depends on mode and selection. Check Preferences for non-menu bindings such as tab switching.'
              )
            }}
          </p>
          <p
            v-if="commandError"
            role="status"
          >
            {{ commandError }}
          </p>
          <table>
            <thead>
              <tr>
                <th>{{ tx('操作路径', 'Menu path') }}</th>
                <th>{{ tx('快捷键', 'Shortcut') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(command, index) in matchingCommands"
                :key="index"
              >
                <td>
                  {{ command.path
                  }}<small v-if="!command.available">
                    · {{ tx('当前不可用', 'Currently unavailable') }}</small>
                </td>
                <td>
                  <kbd v-if="command.accelerator">{{ command.accelerator }}</kbd><span v-else>{{ tx('未分配', 'Unassigned') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HelpCommand } from '@shared/types/menu'
import bus from '@/bus'
import { filterGuide, guideSections, guideText, type GuideText } from './content'
import { markdownSections } from './markdownReference'

const { locale } = useI18n()
const visible = ref(false)
const currentPage = ref<'guide' | 'markdown'>('guide')
const isMarkdown = computed(() => currentPage.value === 'markdown')
const query = ref('')
const activeId = ref('start')
const commands = ref<HelpCommand[]>([])
const commandError = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const contentElement = ref<HTMLElement | null>(null)
let unsubscribe: (() => void) | undefined
let request = 0
const text = (value: GuideText): string => guideText(value, locale.value)
const tx = (zh: string, en: string): string => text([zh, en])
const sections = computed(() =>
  filterGuide(query.value, locale.value, isMarkdown.value ? markdownSections : guideSections)
)
const matchingCommands = computed(() => {
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return commands.value.filter((command) =>
    terms.every((term) =>
      `${command.path} ${command.accelerator ?? ''}`.toLocaleLowerCase().includes(term)
    )
  )
})
const showCommands = computed(
  () => !isMarkdown.value && (!query.value.trim() || matchingCommands.value.length > 0)
)

const openGuide = async (page: 'guide' | 'markdown'): Promise<void> => {
  currentPage.value = page
  visible.value = true
  query.value = ''
  activeId.value = isMarkdown.value ? 'syntax-start' : 'start'
  commandError.value = ''
  bus.emit('editor-blur')
  const currentRequest = ++request
  await nextTick()
  if (contentElement.value) contentElement.value.scrollTop = 0
  if (page === 'markdown') return
  try {
    const items = await window.electron.ipcRenderer.invoke('mt::menu::get-help-commands')
    if (visible.value && request === currentRequest) commands.value = items
  } catch {
    if (visible.value && request === currentRequest) {
      commands.value = []
      commandError.value = tx(
        '快捷键清单暂不可用，请关闭帮助后重试。',
        'The shortcut list is unavailable. Close and reopen the guide to retry.'
      )
    }
  }
}
watch(visible, (value) => {
  if (!value) request++
})
const focusSearch = (): void => {
  searchInput.value?.focus()
}
const jump = (id: string): void => {
  activeId.value = id
  const section = contentElement.value?.querySelector<HTMLElement>(`[data-guide-section="${id}"]`)
  section?.scrollIntoView({ block: 'start' })
}
watch(query, async () => {
  activeId.value = sections.value[0]?.id ?? 'commands'
  await nextTick()
  if (contentElement.value) contentElement.value.scrollTop = 0
})
onMounted(() => {
  unsubscribe = window.electron.ipcRenderer.on('mt::help-dialog', (_event, page = 'guide') => {
    void openGuide(page)
  })
})
onBeforeUnmount(() => {
  unsubscribe?.()
  request++
})
</script>

<style>
.user-guide-dialog {
  --el-dialog-margin-top: 5vh;
  color: var(--floatFontColor);
}
.user-guide-dialog .el-dialog__body {
  padding-top: 4px;
}
.user-guide-dialog .guide-intro {
  margin: 0 0 14px;
  opacity: 0.75;
}
.user-guide-dialog .guide-search {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
.user-guide-dialog .guide-search span {
  flex-shrink: 0;
}
.user-guide-dialog .guide-search input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid var(--itemBgColor);
  border-radius: 6px;
  color: inherit;
  background: var(--editorBgColor);
  font: inherit;
}
.user-guide-dialog :is(input, button, main):focus-visible {
  outline: 2px solid var(--themeColor);
  outline-offset: 2px;
}
.user-guide-dialog .guide-layout {
  display: grid;
  grid-template-columns: 225px minmax(0, 1fr);
  height: 68vh;
  min-height: 240px;
}
.user-guide-dialog .guide-toc {
  overflow-y: auto;
  padding-right: 16px;
  border-right: 1px solid var(--itemBgColor);
}
.user-guide-dialog .guide-toc button {
  display: block;
  width: 100%;
  padding: 9px 10px;
  margin-bottom: 3px;
  border: 0;
  border-radius: 5px;
  text-align: left;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.user-guide-dialog .guide-toc button:is(:hover, .active) {
  background: var(--itemBgColor);
  color: var(--themeColor);
}
.user-guide-dialog .guide-content {
  min-width: 0;
  overflow-y: auto;
  padding: 0 20px 24px;
  overscroll-behavior: contain;
  line-height: 1.8;
}
.user-guide-dialog .guide-content section {
  margin-bottom: 30px;
  scroll-margin-top: 8px;
}
.user-guide-dialog .guide-content h2 {
  margin: 0 0 12px;
  font-size: 19px;
  line-height: 1.5;
  color: inherit;
}
.user-guide-dialog .guide-content ul {
  padding-left: 22px;
  margin: 0;
}
.user-guide-dialog .guide-content li {
  margin: 0 0 12px;
}
.user-guide-dialog .guide-content pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--itemBgColor);
  font-size: 13px;
}
.user-guide-dialog .guide-content table {
  border-collapse: collapse;
  width: 100%;
  text-align: left;
  font-size: 13px;
}
.user-guide-dialog .guide-content th,
.user-guide-dialog .guide-content td {
  padding: 9px 8px;
  border-bottom: 1px solid var(--itemBgColor);
  overflow-wrap: anywhere;
}
.user-guide-dialog .guide-content td:last-child {
  min-width: 125px;
}
.user-guide-dialog .guide-content small {
  opacity: 0.65;
}
.user-guide-dialog .guide-content kbd {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--itemBgColor);
  white-space: nowrap;
}
@media (max-width: 720px) {
  .user-guide-dialog .guide-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 110px minmax(0, 1fr);
  }
  .user-guide-dialog .guide-toc {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 0 8px;
    border-right: 0;
    border-bottom: 1px solid var(--itemBgColor);
  }
  .user-guide-dialog .guide-toc button {
    width: auto;
    margin: 0;
  }
  .user-guide-dialog .guide-content {
    padding: 14px 4px 24px;
  }
}
</style>
