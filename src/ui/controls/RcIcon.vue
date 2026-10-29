<!--
  图标组件（B 段）
  设计稿用 icons.js 在 DOMContentLoaded 时向 [data-ic] 注入 SVG；Vue 里改成数据表驱动，
  保证图标与外壳组件同一次渲染就位，不会出现"先空后画"的闪烁。

  为什么要 v-html：一个图标是若干 <path>/<circle>/<rect> 的序列，逐种形状建子组件没有收益。
  安全性：内容全部来自 src/ui/controls/icons.ts 的静态常量表，不含任何用户输入。
  语义：svg 带 aria-hidden，语义一律交给外层 aria-label / title（设计稿同此约定）。
-->
<script setup lang="ts">
import { computed } from 'vue'

import { ICON_SIZES, iconMarkup } from './icons'
import type { IconSize } from './icons'

const props = withDefaults(
  defineProps<{
    /** icons.ts 里的键名 */
    name: string
    /** 只允许 12 / 14 / 16 / 18 / 20；16 是设计稿默认，不带修饰类 */
    size?: IconSize
  }>(),
  { size: 16 },
)

const markup = computed(() => iconMarkup(props.name))

const sizeClass = computed(() => (props.size === 16 ? null : `ic--${props.size}`))

/** 未知尺寸回落到 16，避免拼出 `.ic--13` 这种没有对应样式的类 */
const resolvedSize = computed(() => (ICON_SIZES.includes(props.size) ? props.size : 16))
</script>

<template>
  <i
    class="ic"
    :class="sizeClass"
    :style="{ width: `${resolvedSize}px`, height: `${resolvedSize}px` }"
  >
    <!-- eslint-disable vue/no-v-html -- 图标 path 来自 icons.ts 静态常量表，不含用户输入 -->
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="markup"
    />
    <!-- eslint-enable vue/no-v-html -->
  </i>
</template>
