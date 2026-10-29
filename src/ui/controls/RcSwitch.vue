<script setup lang="ts">
/**
 * RcSwitch —— 开关（C 段：类名换成设计稿 `.switch`）
 *
 * 滑块由设计稿的 `.switch::after` 伪元素画，所以**不再渲染 thumb span**
 * （多一个 span 会让伪元素的定位基准变成 span，滑块会歪）。
 *
 * 无障碍：role="switch" + aria-checked；原生 button 自带空格/回车触发。
 * 禁用时同样不用原生 disabled，保持可聚焦以便读到原因（与 RcButton 一致）。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    disabledReason?: string
  }>(),
  {
    disabled: false,
    disabledReason: '',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const classes = computed(() => ['switch', props.modelValue ? 'switch--on' : ''])

const titleAttr = computed(() => (props.disabled ? props.disabledReason || undefined : undefined))

function toggle(): void {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :class="classes"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : undefined"
    :title="titleAttr"
    @click="toggle"
  />
</template>
