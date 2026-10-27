<script setup lang="ts">
/**
 * RcBadge —— 状态标签（TC-004）
 * 用途：已确认 / 待确认 / 阻断 / 警告 / 建议 / 当前模板。
 *
 * tone 语义固定，不要在调用处自造颜色：
 *   accent  品牌蓝，表示「当前 / 选中」
 *   success 绿，表示「已确认」
 *   warning 琥珀，表示「待确认」
 *   danger  红，表示「阻断」
 *   neutral 灰，表示「建议 / 次要计数」
 */
import { computed } from 'vue'

import type { RcBadgeSize, RcBadgeTone } from './types'

const props = withDefaults(
  defineProps<{
    tone?: RcBadgeTone
    size?: RcBadgeSize
    /** 左侧小圆点，用于密集列表里替代整块底色 */
    dot?: boolean
  }>(),
  {
    tone: 'neutral',
    size: 'md',
    dot: false,
  },
)

const classes = computed(() => ['rc-badge', `rc-badge--${props.tone}`, `rc-badge--${props.size}`])
</script>

<template>
  <span :class="classes">
    <span v-if="dot" class="rc-badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.rc-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--rc-space-xs);
  border: 1px solid transparent;
  /* 标签圆角用 --rc-radius-tag（4px）；--rc-radius-sm 必须留给 EP 的 checkbox 内框（2px） */
  border-radius: var(--rc-radius-tag);
  font-weight: var(--rc-font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.rc-badge--md {
  height: var(--rc-size-badge);
  padding: 0 var(--rc-space-sm);
  font-size: var(--rc-font-size-sm);
}

.rc-badge--sm {
  height: 18px;
  padding: 0 6px;
  font-size: var(--rc-font-size-2xs);
}

.rc-badge__dot {
  width: 5px;
  height: 5px;
  border-radius: var(--rc-radius-full);
  background: currentColor;
  flex: none;
}

.rc-badge--accent {
  background: var(--rc-color-primary-subtle);
  border-color: var(--rc-color-border);
  color: var(--rc-color-primary-ink);
}

.rc-badge--success {
  background: var(--rc-color-success-subtle);
  border-color: var(--rc-color-success-border);
  color: var(--rc-color-success);
}

.rc-badge--warning {
  background: var(--rc-color-warning-subtle);
  border-color: var(--rc-color-warning-border);
  color: var(--rc-color-warning);
}

.rc-badge--danger {
  background: var(--rc-color-danger-subtle);
  border-color: var(--rc-color-danger-border);
  color: var(--rc-color-danger-ink);
}

.rc-badge--neutral {
  background: var(--rc-color-bg-subtle);
  border-color: var(--rc-color-border-light);
  color: var(--rc-color-text-secondary);
}
</style>
