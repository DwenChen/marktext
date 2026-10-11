<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import zhTw from 'element-plus/es/locale/lang/zh-tw'

const { locale } = useI18n()
const elementLocale = computed(() =>
  locale.value === 'zh-CN' ? zhCn : locale.value === 'zh-TW' ? zhTw : en
)
</script>

<template>
  <div id="app">
    <el-config-provider :locale="elementLocale">
      <router-view />
    </el-config-provider>
  </div>
</template>
