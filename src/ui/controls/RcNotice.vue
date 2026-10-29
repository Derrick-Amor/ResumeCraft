<script setup lang="ts">
/**
 * RcNotice —— 提示条（C 段：类名换成设计稿 `.hintbar`）
 * 用途：导出前检查的警告条、字体降级提示、存储降级提示。
 * 契约 §10.3：界面对布局警告/质量报告只允许「警告条 / 右上角角标」两种载体。
 *
 * 语气语义（设计稿只画了中性一条，三档语气见 app.css §20 的产品增补）：
 *   info    中性说明        → .hintbar（无修饰）
 *   success 已处理/校验通过 → .hintbar--ok
 *   warning 需注意但可继续   → .hintbar--warn
 *   danger  阻断，必须处理   → .hintbar--danger
 *
 * `actions` 槽内容直接放进 `.hintbar`（flex 已够），不再单独包一层；
 * `compact` 档设计稿没有，已在 C 段删除。
 */
import { computed } from 'vue'

import type { RcNoticeTone } from './types'

const props = withDefaults(
  defineProps<{
    tone?: RcNoticeTone
    /** 加粗标题行，可省略 */
    title?: string
  }>(),
  {
    tone: 'info',
    title: '',
  },
)

const TONE_CLASS: Record<RcNoticeTone, string> = {
  info: '',
  success: 'hintbar--ok',
  warning: 'hintbar--warn',
  danger: 'hintbar--danger',
}

const classes = computed(() => ['hintbar', TONE_CLASS[props.tone]].filter((name) => name !== ''))
</script>

<template>
  <div :class="classes" role="status">
    <span v-if="$slots.icon" class="hintbar__ico"><slot name="icon" /></span>
    <div>
      <p v-if="title" class="hintbar__t">{{ title }}</p>
      <slot />
    </div>
    <slot name="actions" />
  </div>
</template>
