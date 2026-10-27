<script setup lang="ts">
/**
 * RcField —— 字段外壳（TC-004）
 * 把「标签 / 控件 / 错误行 / 辅助说明 / 行内动作」这几块固定下来，
 * 避免每个面板各写一套间距。
 *
 * 真实用到它的场景（01 主编辑器右栏）：
 *   联系方式 · 邮箱草稿 → 控件是 el-input，error 显示「邮箱格式不完整，未应用到纸面。」，
 *   下方 hint 给上次有效值，actions 槽放「恢复上次有效值」。
 *
 * 无障碍：错误行 role="alert"，出现即播报；控件 id 由调用方通过 `for` 关联。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    /**
     * 与标签关联的控件 id。
     * 不能叫 `for`：for 是 JS 保留字，模板表达式 `:for="for"` 会解析失败（vue/no-parsing-error）。
     */
    htmlFor?: string
    /** 错误文案。有值即进入错误态 */
    error?: string
    /** 辅助说明，常在错误态下补充「上次有效值」 */
    hint?: string
    required?: boolean
  }>(),
  {
    label: '',
    htmlFor: '',
    error: '',
    hint: '',
    required: false,
  },
)

const hasError = computed(() => props.error.length > 0)
const classes = computed(() => ['rc-field', hasError.value ? 'rc-field--invalid' : ''])
</script>

<template>
  <div :class="classes">
    <div v-if="label || $slots.actions" class="rc-field__head">
      <label v-if="label" class="rc-field__label" :for="htmlFor || undefined">
        {{ label }}
        <span v-if="required" class="rc-field__required" aria-hidden="true">*</span>
      </label>
      <div v-if="$slots.actions" class="rc-field__actions"><slot name="actions" /></div>
    </div>

    <div class="rc-field__control"><slot /></div>

    <p v-if="hasError" class="rc-field__error" role="alert">
      <span v-if="$slots['error-icon']" class="rc-field__error-icon"><slot name="error-icon" /></span>
      {{ error }}
    </p>

    <p v-if="hint" class="rc-field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.rc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.rc-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rc-space-sm);
}

.rc-field__label {
  font-size: var(--rc-font-size-2xs);
  font-weight: var(--rc-font-weight-medium);
  color: var(--rc-color-text-secondary);
}

.rc-field__required {
  color: var(--rc-color-danger);
  margin-left: 2px;
}

.rc-field__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--rc-space-xs);
  flex: none;
}

.rc-field__control {
  min-width: 0;
}

.rc-field__error {
  display: flex;
  align-items: flex-start;
  gap: var(--rc-space-xs);
  margin: 0;
  font-size: var(--rc-font-size-sm);
  line-height: var(--rc-line-height-base);
  color: var(--rc-color-danger-ink);
}

.rc-field__error-icon {
  display: inline-flex;
  flex: none;
  margin-top: 1px;
}

.rc-field__hint {
  margin: 0;
  font-size: var(--rc-font-size-sm);
  line-height: var(--rc-line-height-base);
  color: var(--rc-color-text-tertiary);
}
</style>
