<template>
  <div class="pref-theme">
    <h4>{{ t('preferences.theme.title') }}</h4>
    <p class="notes">
      {{ t('preferences.theme.description') }}
    </p>
    <cur-select
      class="document-theme-select"
      :description="t('preferences.theme.select')"
      :value="theme"
      :options="options"
      :on-change="selectTheme"
    />
    <div class="theme-previews">
      <button
        v-for="id in DOCUMENT_THEMES"
        :key="id"
        class="theme-preview"
        :class="{ active: theme === id }"
        :aria-pressed="theme === id"
        @click="selectTheme(id)"
      >
        <span>{{ t(`preferences.theme.builtins.${id}`) }}</span>
        <div
          class="document-theme-preview"
          :style="previewStyle(id)"
        >
          <h3>{{ t('preferences.theme.previewHeading') }}</h3>
          <p>{{ t('preferences.theme.previewText') }}</p>
        </div>
      </button>
    </div>
    <separator />
    <h5>{{ t('preferences.theme.customTitle') }}</h5>
    <p class="notes">
      {{ t('preferences.theme.importNotes') }}
    </p>
    <el-button
      class="import-document-theme"
      :loading="importing"
      @click="importTheme"
    >
      {{ t('preferences.theme.importTheme') }}
    </el-button>
    <p
      v-if="error"
      class="theme-import-error"
      role="alert"
    >
      {{ error }}
    </p>
    <ul class="custom-theme-list">
      <li
        v-for="item in customThemes"
        :key="item.id"
      >
        <button
          :class="{ active: theme === item.id }"
          @click="selectTheme(item.id)"
        >
          {{ item.name }}
        </button>
        <el-button
          size="small"
          @click="removeTheme(item.id)"
        >
          {{ t('preferences.theme.remove') }}
        </el-button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import { DOCUMENT_THEMES } from '../../../../common/theme'
import CurSelect from '../common/select/index.vue'
import Separator from '../common/separator/index.vue'

const { t } = useI18n()
const store = usePreferencesStore()
const { theme, customThemes } = storeToRefs(store)
const importing = ref(false)
const error = ref('')
const options = computed(() => [
  ...DOCUMENT_THEMES.map((id) => ({ value: id, label: t(`preferences.theme.builtins.${id}`) })),
  ...customThemes.value.map(({ id, name }) => ({ value: id, label: name }))
])
const selectTheme = (value: unknown): void => store.SET_SINGLE_PREFERENCE({ type: 'theme', value })
const previewStyle = (id: string) => ({
  fontFamily: id === 'academic' ? 'Georgia, "Times New Roman", serif' : '"Segoe UI", sans-serif',
  lineHeight: id === 'github' ? '1.5' : '1.3'
})
const importTheme = async (): Promise<void> => {
  importing.value = true
  error.value = ''
  try {
    const result = await window.electron.ipcRenderer.invoke('mt::import-document-theme')
    if (result.error) error.value = t('preferences.theme.importError')
  } catch {
    error.value = t('preferences.theme.importError')
  } finally {
    importing.value = false
  }
}
const removeTheme = (id: string): void => {
  if (theme.value === id) selectTheme('github')
  store.SET_SINGLE_PREFERENCE({
    type: 'customThemes',
    value: customThemes.value.filter((item) => item.id !== id)
  })
}
</script>

<style scoped>
.theme-previews {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.theme-preview {
  text-align: left;
  padding: 14px;
  border: 1px solid var(--editorColor10);
  border-radius: 6px;
  color: var(--editorColor);
  background: var(--editorBgColor);
  cursor: pointer;
}
.theme-preview.active {
  border-color: var(--themeColor);
  box-shadow: 0 0 0 1px var(--themeColor);
}
.theme-preview > span {
  font-size: 12px;
  color: var(--editorColor60);
}
.document-theme-preview h3 {
  font-size: 18px;
  margin: 12px 0 8px;
}
.document-theme-preview p {
  font-size: 14px;
  margin: 0;
}
.custom-theme-list {
  padding: 0;
  list-style: none;
}
.custom-theme-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 12px 0;
}
.custom-theme-list li > button:first-child {
  cursor: pointer;
  color: var(--editorColor);
  background: transparent;
  border: 0;
  overflow-wrap: anywhere;
}
.custom-theme-list li > button.active {
  color: var(--themeColor);
}
.theme-import-error {
  color: var(--deleteColor);
  font-size: 13px;
}
</style>
