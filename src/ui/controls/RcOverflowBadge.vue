<script setup lang="ts">
/**
 * RcOverflowBadge —— 溢出角标（TC-004）
 * 规格：components-spec.md §11；视觉：mockups/figma/08-badge.html
 *
 * 两个刻意的细节：
 *  1. 尺寸取 `--rc-size-badge`（20px 圆）。**感叹号用 stroke-width=2**——
 *     它是圆内唯一图形，1.5 在红底上会糊（规格 §0.2 明确列出的例外）。
 *  2. 单个问题显示「!」，多个显示数字。数字用 tabular-nums，否则 3 和 8 会跳宽。
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
const classes = computed(() => ['rc-overflow-badge', showNumber.value ? 'rc-overflow-badge--num' : ''])
</script>

<template>
  <button
    type="button"
    :class="classes"
    :aria-label="ariaLabel"
    :title="ariaLabel"
  >
    <span v-if="showNumber" class="rc-overflow-badge__num">{{ count }}</span>
    <svg
      v-else
      class="rc-overflow-badge__mark"
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

<style scoped>
.rc-overflow-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rc-size-badge);
  height: var(--rc-size-badge);
  padding: 0;
  border: 0;
  border-radius: var(--rc-radius-full);
  background: var(--rc-color-danger);
  color: var(--rc-color-bg);
  font-family: inherit;
  cursor: pointer;
  flex: none;
}

.rc-overflow-badge:focus-visible {
  box-shadow: var(--rc-focus-ring);
  outline: none;
}

.rc-overflow-badge__mark {
  width: 14px;
  height: 14px;
}

.rc-overflow-badge__num {
  font-size: var(--rc-font-size-2xs);
  font-weight: var(--rc-font-weight-semibold);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* 两位数时字号再压一点，避免溢出圆形 */
.rc-overflow-badge--num .rc-overflow-badge__num {
  font-size: 10px;
}
</style>
