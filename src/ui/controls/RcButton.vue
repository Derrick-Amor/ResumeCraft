<script setup lang="ts">
/**
 * RcButton —— 基础按钮（C 段：类名换成设计稿 `.btn`）
 *
 * 保留的三条行为约定（与设计稿无关，是产品契约）：
 *  1. **不绑定原生 `disabled`**：禁用态仍可聚焦，键盘用户才能读到原因。
 *     改用 `aria-disabled` + 点击时自己拦。
 *  2. 禁用原因走 `title`。
 *  3. 视觉一律由 `src/design/app.css` 的 `.btn` 提供，本组件**不再自带 scoped 样式** ——
 *     两套样式同时存在会在对稿时互相甩锅。
 *
 * 类名映射按设计稿：variant=default 不带修饰类（`.btn` 本身就是默认拟态），
 * size=md 也不带（30px 是设计稿基准），sm → `.btn--sm`。
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

/** default 无修饰类；其余一一对应设计稿 */
const VARIANT_CLASS: Record<RcButtonVariant, string> = {
  default: '',
  primary: 'btn--primary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
}

const classes = computed(() =>
  [
    'btn',
    VARIANT_CLASS[props.variant],
    // md 是设计稿基准高度 30px，不带修饰类；sm/lg 对应 .btn--sm / .btn--lg
    props.size === 'sm' ? 'btn--sm' : props.size === 'lg' ? 'btn--lg' : '',
    props.iconOnly ? 'btn--icon' : '',
  ].filter((name) => name !== ''),
)

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
    <slot name="icon" />
    <slot />
  </button>
</template>
