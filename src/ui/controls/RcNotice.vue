<script setup lang="ts">
/**
 * RcNotice —— 提示条（TC-004）
 * 用途：导出前检查的警告条、拖拽落点非法的一次性提示、字体降级提示。
 * 契约 §10.3：界面对布局警告/质量报告只允许「警告条 / 右上角角标」两种载体，不得自造第三种。
 *
 * 语气语义：
 *   info    中性说明
 *   success 已处理 / 校验通过
 *   warning 需注意但可继续（琥珀）
 *   danger  阻断，必须处理（红）
 */
import { computed } from 'vue'
import type { RcNoticeTone } from './types'

const props = withDefaults(
  defineProps<{
    tone?: RcNoticeTone
    /** 加粗标题行，可省略 */
    title?: string
    /** 紧凑档：用于卡片内或对话框内的次级提示 */
    compact?: boolean
  }>(),
  {
    tone: 'info',
    title: '',
    compact: false,
  },
)

const classes = computed(() => [
  'rc-notice',
  `rc-notice--${props.tone}`,
  props.compact ? 'rc-notice--compact' : '',
])
</script>

<template>
  <div :class="classes" role="status">
    <span v-if="$slots.icon" class="rc-notice__icon"><slot name="icon" /></span>
    <div class="rc-notice__main">
      <p v-if="title" class="rc-notice__title">{{ title }}</p>
      <div class="rc-notice__body"><slot /></div>
    </div>
    <div v-if="$slots.actions" class="rc-notice__actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.rc-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--rc-space-sm);
  padding: var(--rc-space-base) var(--rc-space-lg);
  border: 1px solid var(--rc-color-border);
  border-radius: var(--rc-radius-lg);
  background: var(--rc-glass-bg-soft);
  -webkit-backdrop-filter: var(--rc-glass-blur-sm);
  backdrop-filter: var(--rc-glass-blur-sm);
  font-size: var(--rc-font-size-sm);
  line-height: var(--rc-line-height-base);
  color: var(--rc-color-text-secondary);
}

.rc-notice--compact {
  padding: var(--rc-space-sm) var(--rc-space-base);
  border-radius: var(--rc-radius);
}

.rc-notice__icon {
  display: inline-flex;
  flex: none;
  margin-top: 2px;
}

.rc-notice__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rc-notice__title {
  margin: 0;
  font-weight: var(--rc-font-weight-semibold);
  color: var(--rc-color-text);
}

.rc-notice__body {
  min-width: 0;
}

.rc-notice__actions {
  display: flex;
  align-items: center;
  gap: var(--rc-space-xs);
  flex: none;
}

.rc-notice--info {
  border-color: var(--rc-color-info-border);
  background: var(--rc-color-info-subtle);
  color: var(--rc-color-text-secondary);
}
.rc-notice--info .rc-notice__icon {
  color: var(--rc-color-info);
}

.rc-notice--success {
  border-color: var(--rc-color-success-border);
  background: var(--rc-color-success-subtle);
}
.rc-notice--success .rc-notice__icon {
  color: var(--rc-color-success);
}

.rc-notice--warning {
  border-color: var(--rc-color-warning-border);
  background: var(--rc-color-warning-subtle);
}
.rc-notice--warning .rc-notice__icon,
.rc-notice--warning .rc-notice__title {
  color: var(--rc-color-warning);
}

.rc-notice--danger {
  border-color: var(--rc-color-danger-border);
  background: var(--rc-color-danger-subtle);
}
.rc-notice--danger .rc-notice__icon,
.rc-notice--danger .rc-notice__title {
  color: var(--rc-color-danger-ink);
}
</style>
