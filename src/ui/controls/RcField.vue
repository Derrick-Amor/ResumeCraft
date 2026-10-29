<script setup lang="ts">
/**
 * RcField —— 字段外壳（C 段：类名换成设计稿 `.field`）
 *
 * 设计稿把「错误态」画在控件自己身上（`.input--invalid`），外壳只负责标签/错误行/说明，
 * 所以本组件不再挂 `--invalid` 标记类：调用方给控件加 `.input--invalid` 即可。
 * 这样"哪里红"和"哪里报错"不会出现两套判断。
 *
 * 无障碍：错误行 role="alert"，出现即播报；控件 id 由调用方通过 htmlFor 关联。
 * 设计稿没有单独的头部/动作槽，`actions` 槽已删除（需要时由调用方自己排版）。
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
    /** 错误文案。有值即渲染错误行 */
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
</script>

<template>
  <div class="field">
    <label v-if="label" class="field__label" :for="htmlFor || undefined">
      {{ label }}
      <span v-if="required" class="field__req" aria-hidden="true">*</span>
    </label>

    <slot />

    <p v-if="hasError" class="field__error" role="alert">{{ error }}</p>
    <p v-if="hint" class="field__hint">{{ hint }}</p>
  </div>
</template>
