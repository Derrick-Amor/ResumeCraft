<script setup lang="ts">
/**
 * RcSideTabs —— 左栏 Tab 条（C 段，替代原 RcTabs）
 * 设计稿类名：`.side__tabs` / `.side__tab` / `.side__tab--on`。
 * 键盘与 aria 行为在 RcTabList 里统一实现。
 */
import RcTabList from './RcTabList.vue'
import type { RcTabItem } from './types'

defineProps<{ items: RcTabItem[]; modelValue: string }>()

defineEmits<{ 'update:modelValue': [key: string] }>()
</script>

<template>
  <RcTabList
    :items="items"
    :model-value="modelValue"
    prefix="side"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
