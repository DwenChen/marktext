<template>
  <el-dialog
    v-model="showExportSettingsDialog"
    class="print-settings-dialog export-settings-dialog"
    :title="
      exportType === 'print'
        ? t('exportSettings.compact.print')
        : t('exportSettings.compact.title', { format: formatName })
    "
    width="520px"
    :close-on-click-modal="false"
  >
    <p class="export-summary">
      {{ t('exportSettings.compact.hints.' + exportType) }}
    </p>

    <div v-if="exportType === 'styledHtml'" class="html-options">
      <text-box
        :description="t('exportSettings.page.pageTitle')"
        :input="htmlTitle"
        :emit-time="0"
        :on-change="(value) => onSelectChange('htmlTitle', value)"
      />
    </div>
    <div v-if="exportType === 'png'" class="image-options export-field">
      <label for="image-export-width">{{ t('exportSettings.image.width') }} (px)</label>
      <el-input-number
        id="image-export-width"
        v-model="imageWidth"
        :min="320"
        :max="2400"
        :step="100"
        controls-position="right"
      />
    </div>
    <div v-if="exportType === 'pdf'" class="paper-options export-grid">
      <cur-select
        class="page-size-select"
        :description="t('exportSettings.page.pageSize')"
        :value="pageSize"
        :options="pageSizeList"
        :on-change="(value) => onSelectChange('pageSize', value)"
      />
      <bool
        class="orientation-setting"
        :description="t('exportSettings.page.landscapeOrientation')"
        :bool="isLandscape"
        :on-change="(value) => onSelectChange('isLandscape', value)"
      />
      <div v-if="pageSize === 'custom'" class="custom-paper export-grid full-width">
        <div class="export-field">
          <label for="paper-width">{{ t('exportSettings.compact.width') }} (mm)</label
          ><el-input-number
            id="paper-width"
            v-model="pageSizeWidth"
            :min="100"
            controls-position="right"
          />
        </div>
        <div class="export-field">
          <label for="paper-height">{{ t('exportSettings.compact.height') }} (mm)</label
          ><el-input-number
            id="paper-height"
            v-model="pageSizeHeight"
            :min="100"
            controls-position="right"
          />
        </div>
      </div>
    </div>
    <section v-if="isPrintable" class="margin-options">
      <h4>{{ t('exportSettings.page.pageMargin') }}</h4>
      <div class="margin-grid">
        <div class="export-field">
          <label for="margin-top">{{ t('exportSettings.compact.top') }}</label
          ><el-input-number
            id="margin-top"
            v-model="pageMarginTop"
            :min="0"
            :max="100"
            controls-position="right"
          />
        </div>
        <div class="export-field">
          <label for="margin-bottom">{{ t('exportSettings.compact.bottom') }}</label
          ><el-input-number
            id="margin-bottom"
            v-model="pageMarginBottom"
            :min="0"
            :max="100"
            controls-position="right"
          />
        </div>
        <div class="export-field">
          <label for="margin-left">{{ t('exportSettings.compact.left') }}</label
          ><el-input-number
            id="margin-left"
            v-model="pageMarginLeft"
            :min="0"
            :max="100"
            controls-position="right"
          />
        </div>
        <div class="export-field">
          <label for="margin-right">{{ t('exportSettings.compact.right') }}</label
          ><el-input-number
            id="margin-right"
            v-model="pageMarginRight"
            :min="0"
            :max="100"
            controls-position="right"
          />
        </div>
      </div>
    </section>

    <section v-if="features.hasBodyToc" class="body-toc-options">
      <bool
        :description="t('exportSettings.bodyToc.show')"
        :detailed-description="t('exportSettings.bodyToc.description')"
        :bool="showBodyToc"
        :on-change="(value) => onSelectChange('showBodyToc', value)"
      />
    </section>
    <button
      v-if="hasAdvancedOptions"
      class="advanced-toggle"
      :aria-expanded="showAdvanced"
      aria-controls="export-advanced"
      @click="showAdvanced = !showAdvanced"
    >
      <span aria-hidden="true">{{ showAdvanced ? '▾' : '▸' }}</span>
      {{ t('exportSettings.compact.more') }}
    </button>
    <div v-if="showAdvanced" id="export-advanced" class="export-advanced">
      <section v-if="features.hasHeadings || features.hasFrontMatter" class="content-options">
        <bool
          v-if="features.hasHeadings"
          :description="t('exportSettings.autoNumberingHeadings')"
          :bool="autoNumberingHeadings"
          :on-change="(value) => onSelectChange('autoNumberingHeadings', value)"
        />
        <bool
          v-if="features.hasFrontMatter"
          :description="t('exportSettings.showFrontMatter')"
          :bool="showFrontMatter"
          :on-change="(value) => onSelectChange('showFrontMatter', value)"
        />
      </section>
      <section v-if="features.hasToc && showBodyToc" class="toc-options">
        <h4>{{ t('exportSettings.toc.label') }}</h4>
        <text-box
          :description="t('exportSettings.toc.title')"
          :input="tocTitle"
          :emit-time="0"
          :on-change="(value) => onSelectChange('tocTitle', value)"
        />
        <bool
          :description="t('exportSettings.toc.includeTopHeading')"
          :bool="tocIncludeTopHeading"
          :on-change="(value) => onSelectChange('tocIncludeTopHeading', value)"
        />
      </section>
      <section v-if="isPrintable" class="font-options">
        <bool
          :description="t('exportSettings.style.overwriteThemeFont')"
          :bool="fontSettingsOverwrite"
          :on-change="(value) => onSelectChange('fontSettingsOverwrite', value)"
        />
        <div v-if="fontSettingsOverwrite">
          <font-text-box
            :description="t('exportSettings.style.fontFamily')"
            :value="fontFamily"
            :on-change="(value) => onSelectChange('fontFamily', value)"
          />
          <range
            :description="t('exportSettings.style.fontSize')"
            :value="fontSize"
            :min="8"
            :max="32"
            unit="px"
            :step="1"
            :on-change="(value) => onSelectChange('fontSize', value)"
          />
          <range
            :description="t('exportSettings.style.lineHeight')"
            :value="lineHeight"
            :min="1"
            :max="2"
            :step="0.1"
            :on-change="(value) => onSelectChange('lineHeight', value)"
          />
        </div>
      </section>
      <section v-if="isPrintable" class="header-footer-options">
        <h4>{{ t('exportSettings.headerFooter.label') }}</h4>
        <div class="export-grid">
          <cur-select
            :description="t('exportSettings.headerFooter.headerType')"
            :value="headerType"
            :options="headerFooterTypes"
            :on-change="(value) => onSelectChange('headerType', value)"
          />
          <cur-select
            :description="t('exportSettings.headerFooter.footerType')"
            :value="footerType"
            :options="headerFooterTypes"
            :on-change="(value) => onSelectChange('footerType', value)"
          />
        </div>
        <div v-if="headerType" class="header-fields" :class="{ 'three-fields': headerType === 2 }">
          <text-box
            v-if="headerType === 2"
            :description="t('exportSettings.headerFooter.leftHeaderText')"
            :input="headerTextLeft"
            :emit-time="0"
            :on-change="(value) => onSelectChange('headerTextLeft', value)"
          />
          <text-box
            :description="t('exportSettings.headerFooter.mainHeaderText')"
            :input="headerTextCenter"
            :emit-time="0"
            :on-change="(value) => onSelectChange('headerTextCenter', value)"
          />
          <text-box
            v-if="headerType === 2"
            :description="t('exportSettings.headerFooter.rightHeaderText')"
            :input="headerTextRight"
            :emit-time="0"
            :on-change="(value) => onSelectChange('headerTextRight', value)"
          />
        </div>
        <div v-if="footerType" class="footer-fields" :class="{ 'three-fields': footerType === 2 }">
          <text-box
            v-if="footerType === 2"
            :description="t('exportSettings.headerFooter.leftFooterText')"
            :input="footerTextLeft"
            :emit-time="0"
            :on-change="(value) => onSelectChange('footerTextLeft', value)"
          />
          <text-box
            :description="t('exportSettings.headerFooter.mainFooterText')"
            :input="footerTextCenter"
            :emit-time="0"
            :on-change="(value) => onSelectChange('footerTextCenter', value)"
          />
          <text-box
            v-if="footerType === 2"
            :description="t('exportSettings.headerFooter.rightFooterText')"
            :input="footerTextRight"
            :emit-time="0"
            :on-change="(value) => onSelectChange('footerTextRight', value)"
          />
        </div>
        <div v-if="headerType || footerType" class="header-footer-style">
          <bool
            :description="t('exportSettings.headerFooter.customizeStyle')"
            :bool="headerFooterCustomize"
            :on-change="(value) => onSelectChange('headerFooterCustomize', value)"
          />
          <template v-if="headerFooterCustomize">
            <bool
              :description="t('exportSettings.headerFooter.allowStyled')"
              :bool="headerFooterStyled"
              :on-change="(value) => onSelectChange('headerFooterStyled', value)"
            />
            <range
              :description="t('exportSettings.headerFooter.fontSize')"
              :value="headerFooterFontSize"
              :min="8"
              :max="20"
              unit="px"
              :step="1"
              :on-change="(value) => onSelectChange('headerFooterFontSize', value)"
            />
          </template>
        </div>
      </section>
    </div>
    <template #footer>
      <div class="export-actions">
        <button class="button-secondary" @click="showExportSettingsDialog = false">
          {{ t('exportSettings.compact.cancel') }}
        </button>
        <button class="button-primary" @click="handleClicked">
          {{ t(exportType === 'print' ? 'exportSettings.compact.print' : 'exportSettings.export') }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, type Ref } from 'vue'
import bus from '../../bus'
import { loadExportSettings, saveExportSettings } from './persistence'
import { buildExportOptions } from './buildOptions'
import Bool from '@/prefComponents/common/bool/index.vue'
import CurSelect from '@/prefComponents/common/select/index.vue'
import FontTextBox from '@/prefComponents/common/fontTextBox/index.vue'
import Range from '@/prefComponents/common/range/index.vue'
import TextBox from '@/prefComponents/common/textBox/index.vue'
import { getPageSizeList, getHeaderFooterTypes } from './exportOptions'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { renderToStaticHTML } from '@muyajs/core'
import { findBodyToc } from '@/util/bodyToc'

const { t } = useI18n()
const editor = useEditorStore()
const preferences = usePreferencesStore()
const exportType = ref('')
const isPrintable = computed(() => exportType.value === 'pdf' || exportType.value === 'print')
const formatName = computed(() => t('exportSettings.compact.formats.' + exportType.value))
const showExportSettingsDialog = ref(false)
const showAdvanced = ref(false)
const features = ref({ hasHeadings: false, hasToc: false, hasBodyToc: false, hasFrontMatter: false })
const hasAdvancedOptions = computed(
  () => isPrintable.value || Object.values(features.value).some(Boolean)
)

const htmlTitle = ref('')
const imageWidth = ref(1200)
const pageSize = ref('A4')
const pageSizeWidth = ref(210)
const pageSizeHeight = ref(297)
const isLandscape = ref(false)
const pageMarginTop = ref(20)
const pageMarginRight = ref(15)
const pageMarginBottom = ref(20)
const pageMarginLeft = ref(15)
const fontSettingsOverwrite = ref(false)
const fontFamily = ref('Default')
const fontSize = ref(14)
const lineHeight = ref(1.5)
const autoNumberingHeadings = ref(false)
const showFrontMatter = ref(false)
const showBodyToc = ref(true)
const pageSizeList = ref(getPageSizeList())
const headerFooterTypes = ref(getHeaderFooterTypes())
const headerType = ref(0)
const headerTextLeft = ref('')
const headerTextCenter = ref('')
const headerTextRight = ref('')
const footerType = ref(0)
const footerTextLeft = ref('')
const footerTextCenter = ref('')
const footerTextRight = ref('')
const headerFooterCustomize = ref(false)
const headerFooterStyled = ref(true)
const headerFooterFontSize = ref(12)
const tocTitle = ref('')
const tocIncludeTopHeading = ref(true)

// #2287 — persist the chosen export options across sessions. Every option ref
// is registered here; changes are saved to localStorage and restored on mount.
const persistableSettings: Record<string, Ref<unknown>> = {
  imageWidth,
  htmlTitle,
  pageSize,
  pageSizeWidth,
  pageSizeHeight,
  isLandscape,
  pageMarginTop,
  pageMarginRight,
  pageMarginBottom,
  pageMarginLeft,
  fontSettingsOverwrite,
  fontFamily,
  fontSize,
  lineHeight,
  autoNumberingHeadings,
  showFrontMatter,
  showBodyToc,
  headerType,
  headerTextLeft,
  headerTextCenter,
  headerTextRight,
  footerType,
  footerTextLeft,
  footerTextCenter,
  footerTextRight,
  headerFooterCustomize,
  headerFooterStyled,
  headerFooterFontSize,
  tocTitle,
  tocIncludeTopHeading
}

const restoreExportSettings = () => {
  const saved = loadExportSettings()
  for (const [key, settingRef] of Object.entries(persistableSettings)) {
    if (key in saved && typeof saved[key] === typeof settingRef.value) settingRef.value = saved[key]
  }
}

watch(Object.values(persistableSettings), () => {
  saveExportSettings(
    Object.fromEntries(
      Object.entries(persistableSettings).map(([key, settingRef]) => [key, settingRef.value])
    )
  )
})

onMounted(() => {
  restoreExportSettings()
  bus.on('showExportDialog', showDialog)
  bus.on('language-changed', updateTranslations)
})

onBeforeUnmount(() => {
  bus.off('showExportDialog', showDialog)
  bus.off('language-changed', updateTranslations)
})

const updateTranslations = () => {
  pageSizeList.value = getPageSizeList()
  headerFooterTypes.value = getHeaderFooterTypes()
}

const showDialog = (type: unknown) => {
  const format = String(type ?? '')
  if (!['styledHtml', 'pdf', 'png', 'print'].includes(format)) return
  editor.flushActiveEditor()
  const markdown = editor.currentFile?.markdown || ''
  const document = new DOMParser().parseFromString(renderToStaticHTML(markdown, preferences), 'text/html')
  const bodyToc = findBodyToc(document.body)
  features.value = {
    hasHeadings: document.querySelector('h2,h3,h4,h5,h6') !== null,
    hasToc: bodyToc.markers.length > 0,
    hasBodyToc: bodyToc.nodes.length > 0,
    hasFrontMatter:
      /^(---|\+\+\+|;;;)\r?\n[\s\S]+?\r?\n\1\s*(?:\n|$)/.test(markdown) ||
      /^\{[\s\S]*?\n\}/.test(markdown)
  }
  exportType.value = format
  showAdvanced.value = false
  showExportSettingsDialog.value = true
  bus.emit('editor-blur')
}

const handleClicked = () => {
  const settings = Object.fromEntries(
    Object.entries(persistableSettings).map(([key, setting]) => [key, setting.value])
  )
  const options = buildExportOptions(exportType.value, settings, features.value)
  showExportSettingsDialog.value = false
  bus.emit('export', options)
}

const onSelectChange = (key: string, value: unknown) => {
  const setting = persistableSettings[key]
  if (setting) setting.value = value
}
</script>

<style>
.export-settings-dialog {
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 48px);
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  user-select: none;
  & .el-dialog__title {
    color: var(--editorColor);
    font-size: 16px;
    font-weight: 500;
  }
  & .el-input__wrapper {
    background: var(--inputBgColor);
  }
  & .el-dialog__header {
    padding-bottom: 8px;
  }
  & .el-dialog__body {
    overflow-y: auto;
    padding: 4px 8px 12px;
    color: var(--editorColor);
  }
  & .el-dialog__footer {
    flex-shrink: 0;
    padding-top: 12px;
    border-top: 1px solid var(--editorColor10);
  }
  & .export-summary {
    margin: 0 0 18px;
    color: var(--editorColor50);
    font-size: 13px;
    line-height: 1.6;
  }
  & h4 {
    font-size: 13px;
    font-weight: 600;
    margin: 16px 0 10px;
  }
  & .export-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: center;
  }
  & .full-width {
    grid-column: 1 / -1;
  }
  & .margin-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  & .export-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
  }
  & .export-field .el-input-number {
    width: 100%;
  }
  & .image-options {
    max-width: 220px;
  }
  & .pref-select-item,
  & .pref-text-box-item {
    margin: 8px 0;
  }
  & .pref-select-item .description,
  & .pref-text-box-item .description {
    font-size: 13px;
    margin-bottom: 8px;
  }
  & .pref-text-box-item .el-input {
    width: 100%;
  }
  & .orientation-setting {
    gap: 10px;
    margin-top: 24px;
  }
  & .advanced-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 20px 0 0;
    padding: 4px 0;
    background: transparent;
    border: 0;
    color: var(--editorColor50);
    cursor: pointer;
    font-size: 13px;
  }
  & .advanced-toggle:hover {
    color: var(--themeColor);
  }
  & .advanced-toggle:focus-visible {
    outline: 2px solid var(--themeColor);
    outline-offset: 4px;
  }
  & .export-advanced {
    border-top: 1px solid var(--editorColor10);
    margin-top: 12px;
    padding-top: 4px;
  }
  & .export-advanced > section + section {
    border-top: 1px solid var(--editorColor10);
    margin-top: 16px;
    padding-top: 4px;
  }
  & .three-fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  & .export-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  & .export-actions button {
    font-size: 14px;
  }
  & .el-input-number input {
    border: none !important;
  }
}
@media (max-width: 440px) {
  .export-settings-dialog .margin-grid,
  .export-settings-dialog .three-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .export-settings-dialog .paper-options {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  .export-settings-dialog .orientation-setting {
    margin-top: 8px;
  }
}
</style>
