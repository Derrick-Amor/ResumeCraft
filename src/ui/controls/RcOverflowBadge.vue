<script setup lang="ts">
/**
 * RcOverflowBadge —— 溢出角标（C 段：类名换成设计稿 `.paper-flag`）
 *
 * 两个刻意的细节：
 *  1. 单个问题显示「!」，多个显示数字。数字用 tabular-nums（设计稿 `.paper-flag` 已带）。
 *  2. 感叹号用 **stroke-width=2** —— 它是圆内唯一图形，1.5 在红底上会糊
 *     （components-spec §0.2 明确列出的例外）。
 *
 * 位置由使用方决定：设计稿里它绝对定位在纸面右上角（`.paper-flag` 自带 top/right），
 * 所以这个按钮应当放在 `.paper` 内部。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 溢出条数。1 显示感叹号，>1 显示数字 */
    count: number
    /** 无障碍描述，例如「第 1 页有 3 处内容溢出」 */
    label?: string
  }>(),
  {
    label: '',
  },
)

const showNumber = computed(() => props.count > 1)
const ariaLabel = computed(() => props.label || `${props.count} 处内容溢出`)
</script>

<template>
  <button type="button" class="paper-flag" :aria-label="ariaLabel" :title="ariaLabel">
    <span v-if="showNumber">{{ count }}</span>
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 7v6" />
      <path d="M12 17h.01" />
    </svg>
  </button>
</template>
