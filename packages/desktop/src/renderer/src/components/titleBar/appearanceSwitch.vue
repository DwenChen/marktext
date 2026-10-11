<template>
  <el-dropdown
    trigger="click"
    placement="bottom-end"
    @command="selectAppearance"
  >
    <button
      class="appearance-switch"
      type="button"
      aria-haspopup="menu"
      :title="currentLabel"
      :aria-label="currentLabel"
      @click.stop
    >
      <el-icon :size="18">
        <component :is="currentIcon" />
      </el-icon>
    </button>
    <template #dropdown>
      <el-dropdown-menu class="appearance-menu">
        <el-dropdown-item
          v-for="item in options"
          :key="item.value"
          :command="item.value"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <el-icon
            v-if="appearance === item.value"
            class="appearance-check"
          >
            <Check />
          </el-icon>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Sunny, Moon, Monitor, Check } from '@element-plus/icons-vue'
import { usePreferencesStore } from '@/store/preferences'

const { t } = useI18n()
const store = usePreferencesStore()
const { appearance } = storeToRefs(store)
const options = computed(() => [
  { value: 'light', icon: Sunny, label: t('preferences.general.appearance.light') },
  { value: 'dark', icon: Moon, label: t('preferences.general.appearance.dark') },
  { value: 'system', icon: Monitor, label: t('preferences.general.appearance.system') }
])
const currentIcon = computed(
  () => options.value.find((item) => item.value === appearance.value)?.icon || Monitor
)
const currentLabel = computed(
  () =>
    t('preferences.general.appearance.label') +
    ': ' +
    options.value.find((item) => item.value === appearance.value)?.label
)
const selectAppearance = (value: unknown): void => {
  if (value === 'light' || value === 'dark' || value === 'system')
    store.SET_SINGLE_PREFERENCE({ type: 'appearance', value })
}
</script>

<style scoped>
.appearance-switch {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: var(--editorBgColor);
  color: var(--iconColor);
  cursor: pointer;
}
.appearance-switch:hover {
  background: var(--floatHoverColor);
  color: var(--editorColor);
}
.appearance-switch:focus-visible {
  outline: 2px solid var(--themeColor);
  outline-offset: -2px;
}
.appearance-menu span {
  flex: 1;
}
.appearance-check {
  margin-left: 16px;
}
</style>
