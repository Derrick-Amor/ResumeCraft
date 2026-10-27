<script setup lang="ts">
/**
 * RcButton —— 基础按钮（TC-004）
 * 规格：docs/design/components-spec.md §1；材质：docs/design/V3-DELTA.md §5
 *
 * 三个刻意的实现决定：
 *  1. **不绑定原生 `disabled`**。规格 §1.3 要求禁用按钮仍可聚焦，否则键盘用户读不到原因。
 *     改用 `aria-disabled` + tabindex 默认可聚焦 + 点击时自己拦。
 *  2. 禁用原因走 `title`（浮层组件还没做，先按规格允许的兜底做）。
 *  3. 主按钮是**透明蓝玻璃**，文字用 `--rc-color-primary-ink`，不是白字。
 */
import { computed } from 'vue'

import type { RcButtonSize, RcButtonVariant } from './types'

const props = withDefaults(
  defineProps<{
    variant?: RcButtonVariant
    size?: RcButtonSize
    /** 图标按钮：正方形，无文字内边距 */
    iconOnly?: boolean
    disabled?: boolean
    /** 禁用原因。规格要求「说清缺什么」，不允许空着 */
    disabledReason?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'default',
    size: 'md',
    iconOnly: false,
    disabled: false,
    disabledReason: '',
    type: 'button',
  },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const classes = computed(() => [
  'rc-btn',
  `rc-btn--${props.variant}`,
  `rc-btn--${props.size}`,
  props.iconOnly ? 'rc-btn--icon' : '',
])

const titleAttr = computed(() => (props.disabled ? props.disabledReason || undefined : undefined))

function handleClick(event: MouseEvent): void {
  if (props.disabled) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :class="classes"
    :type="type"
    :aria-disabled="disabled ? 'true' : undefined"
    :title="titleAttr"
    @click="handleClick"
  >
    <span v-if="$slots.icon" class="rc-btn__icon"><slot name="icon" /></span>
    <span v-if="$slots.default" class="rc-btn__label"><slot /></span>
  </button>
</template>

<style scoped>
.rc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--rc-space-xs);
  border: 1px solid transparent;
  border-radius: var(--rc-radius);
  font-family: inherit;
  font-weight: var(--rc-font-weight-medium);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--rc-duration-base) var(--rc-ease-standard),
    border-color var(--rc-duration-base) var(--rc-ease-standard),
    color var(--rc-duration-base) var(--rc-ease-standard);
}

.rc-btn:focus-visible {
  /* 焦点环用 box-shadow：A4 纸面与画布容器有 overflow:hidden，outline 会被裁掉 */
  box-shadow: var(--rc-focus-ring);
  outline: none;
}

.rc-btn__icon {
  display: inline-flex;
  flex: none;
}

/* ---- 尺寸：只有 28 / 32 两档 ---- */
.rc-btn--md {
  height: var(--rc-size-control);
  padding: 0 var(--rc-space-base);
  font-size: var(--rc-font-size-base);
}

.rc-btn--sm {
  height: var(--rc-size-control-sm);
  padding: 0 var(--rc-space-sm);
  font-size: var(--rc-font-size-sm);
}

.rc-btn--icon.rc-btn--md {
  width: var(--rc-size-control);
  padding: 0;
}

.rc-btn--icon.rc-btn--sm {
  width: var(--rc-size-control-sm);
  padding: 0;
}

/* ---- 类型：v3 全部是透明色，主按钮只是把透明色换成蓝 ---- */
.rc-btn--default {
  background: var(--rc-glass-bg-tint);
  border-color: var(--rc-color-border);
  color: var(--rc-color-text);
  -webkit-backdrop-filter: var(--rc-glass-blur-sm);
  backdrop-filter: var(--rc-glass-blur-sm);
}

.rc-btn--default:hover {
  background: var(--rc-glass-bg-tint-hover);
  border-color: var(--rc-color-border-strong);
}

.rc-btn--primary {
  background: var(--rc-glass-primary);
  border-color: var(--rc-glass-primary-border);
  color: var(--rc-color-primary-ink);
  -webkit-backdrop-filter: var(--rc-glass-blur-sm);
  backdrop-filter: var(--rc-glass-blur-sm);
}

.rc-btn--primary:hover {
  background: var(--rc-glass-primary-hover);
  border-color: var(--rc-color-primary);
}

.rc-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--rc-color-text-secondary);
}

.rc-btn--ghost:hover {
  background: var(--rc-color-bg-hover);
  color: var(--rc-color-text);
}

.rc-btn--danger {
  background: var(--rc-color-danger-subtle);
  border-color: var(--rc-color-danger-border);
  color: var(--rc-color-danger-ink);
}

.rc-btn--danger:hover {
  border-color: var(--rc-color-danger);
}

.rc-btn:active {
  background: var(--rc-color-bg-active);
}

/* ---- 禁用：不用 opacity，逐项换色（规格 §1.2 末尾） ---- */
.rc-btn[aria-disabled='true'] {
  background: var(--rc-color-bg-subtle);
  border-color: var(--rc-color-border-light);
  color: var(--rc-color-text-disabled);
  cursor: not-allowed;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.rc-btn[aria-disabled='true']:hover {
  background: var(--rc-color-bg-subtle);
  border-color: var(--rc-color-border-light);
}

.rc-btn[aria-disabled='true']:active {
  background: var(--rc-color-bg-subtle);
}
</style>
