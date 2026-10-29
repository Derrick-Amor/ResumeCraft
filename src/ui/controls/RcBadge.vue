<script setup lang="ts">
/**
 * RcBadge —— 状态标签（C 段：类名换成设计稿 `.badge`）
 *
 * tone 语义固定，不要在调用处自造颜色：
 *   accent  品牌蓝，表示「当前 / 选中」      → .badge--accent
 *   success 绿，表示「已确认」              → .badge--ok
 *   warning 琥珀，表示「待确认」            → .badge--warn
 *   danger  红，表示「阻断」                → .badge--danger
 *   neutral 灰，表示「建议 / 次要计数」      → .badge--neutral
 *
 * `dot` 属性已按设计稿删除（设计稿的 badge 不带圆点）；设计稿有两档高度：
 * 基准 18px 与 `.badge--lg` 20px，对应 size sm / md。
 */
import { computed } from 'vue'

import type { RcBadgeSize, RcBadgeTone } from './types'

const props = withDefaults(
  defineProps<{
    tone?: RcBadgeTone
    size?: RcBadgeSize
  }>(),
  {
    tone: 'neutral',
    size: 'sm',
  },
)

const TONE_CLASS: Record<RcBadgeTone, string> = {
  accent: 'badge--accent',
  success: 'badge--ok',
  warning: 'badge--warn',
  danger: 'badge--danger',
  neutral: 'badge--neutral',
}

const classes = computed(() => [
  'badge',
  TONE_CLASS[props.tone],
  // sm 是设计稿基准高度 18px；md 走 20px 的 --lg
  props.size === 'md' ? 'badge--lg' : '',
])
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
