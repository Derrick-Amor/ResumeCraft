<script setup lang="ts">
/**
 * RcSwitch —— 开关（TC-004）
 * 用途：「允许自动分页」「背景锁定」这类布尔设置。
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

const classes = computed(() => ['rc-switch', props.modelValue ? 'rc-switch--on' : ''])

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
  >
    <span class="rc-switch__thumb" />
  </button>
</template>

<style scoped>
.rc-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 34px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--rc-radius-full);
  background: var(--rc-color-border-strong);
  cursor: pointer;
  flex: none;
  transition: background var(--rc-duration-base) var(--rc-ease-standard);
}

.rc-switch:focus-visible {
  box-shadow: var(--rc-focus-ring);
  outline: none;
}

.rc-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: var(--rc-radius-full);
  background: var(--rc-color-bg);
  transition: transform var(--rc-duration-base) var(--rc-ease-standard);
}

.rc-switch--on {
  background: var(--rc-color-primary);
}

.rc-switch--on .rc-switch__thumb {
  transform: translateX(14px);
}

.rc-switch[aria-disabled='true'] {
  background: var(--rc-color-border-light);
  cursor: not-allowed;
}

.rc-switch[aria-disabled='true'] .rc-switch__thumb {
  background: var(--rc-color-bg-subtle);
}
</style>
