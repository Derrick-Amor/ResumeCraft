<script setup lang="ts">
/**
 * RcTabs —— 标签页（TC-004）
 * 用途：左栏「模板 / 组件 / 素材 / 图层」、右栏「内容 / 样式 / 布局」。
 *
 * 无障碍：role="tablist" + 每个 tab 的 aria-selected；
 * 键盘用 roving tabindex（选中项 tabindex=0，其余 -1）+ 左右方向键在**可用项**间移动。
 * 禁用项跳过，但用 aria-disabled 标注，不隐藏。
 */
import { ref } from 'vue'

import type { RcTabItem } from './types'

const props = defineProps<{
  items: RcTabItem[]
  /** 当前选中的 key */
  modelValue: string
}>()

const emit = defineEmits<{ 'update:modelValue': [key: string] }>()

const tabEls = ref<Array<HTMLButtonElement | null>>([])

function setTabEl(el: unknown, index: number): void {
  tabEls.value[index] = (el as HTMLButtonElement | null) ?? null
}

function select(item: RcTabItem): void {
  if (item.disabled === true) return
  if (item.key === props.modelValue) return
  emit('update:modelValue', item.key)
}

/** 从 index 出发按 step 找下一个可用项，环形查找 */
function findEnabled(from: number, step: number): number {
  const total = props.items.length
  for (let offset = 1; offset <= total; offset += 1) {
    const index = (((from + step * offset) % total) + total) % total
    const item = props.items[index]
    if (item && item.disabled !== true) return index
  }
  return from
}

function onKeydown(event: KeyboardEvent, index: number): void {
  let target = index
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    target = findEnabled(index, 1)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    target = findEnabled(index, -1)
  } else if (event.key === 'Home') {
    target = findEnabled(-1, 1)
  } else if (event.key === 'End') {
    target = findEnabled(props.items.length, -1)
  } else {
    return
  }

  event.preventDefault()
  const item = props.items[target]
  if (!item) return
  select(item)
  tabEls.value[target]?.focus()
}
</script>

<template>
  <div class="rc-tabs" role="tablist">
    <button
      v-for="(item, index) in items"
      :key="item.key"
      :ref="(el) => setTabEl(el, index)"
      type="button"
      role="tab"
      class="rc-tabs__tab"
      :class="{
        'rc-tabs__tab--on': item.key === modelValue,
        'rc-tabs__tab--disabled': item.disabled === true,
      }"
      :aria-selected="item.key === modelValue ? 'true' : 'false'"
      :aria-disabled="item.disabled === true ? 'true' : undefined"
      :tabindex="item.key === modelValue ? 0 : -1"
      @click="select(item)"
      @keydown="onKeydown($event, index)"
    >
      <span class="rc-tabs__label">{{ item.label }}</span>
      <span v-if="item.count !== undefined" class="rc-tabs__count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.rc-tabs {
  display: flex;
  align-items: stretch;
  gap: 2px;
  border-bottom: 1px solid var(--rc-color-border);
}

.rc-tabs__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--rc-space-xs);
  height: var(--rc-size-tab-h);
  padding: 0 var(--rc-space-base);
  border: 0;
  background: transparent;
  font-family: inherit;
  font-size: var(--rc-font-size-sm);
  font-weight: var(--rc-font-weight-medium);
  color: var(--rc-color-text-secondary);
  cursor: pointer;
  transition: color var(--rc-duration-base) var(--rc-ease-standard);
}

.rc-tabs__tab:hover {
  color: var(--rc-color-text);
}

.rc-tabs__tab:focus-visible {
  box-shadow: var(--rc-focus-ring);
  outline: none;
  border-radius: var(--rc-radius-sm);
}

.rc-tabs__tab--on {
  color: var(--rc-color-text);
}

/* 选中下划线用伪元素，避免 extra DOM 影响 tab 数量断言 */
.rc-tabs__tab--on::after {
  content: '';
  position: absolute;
  left: var(--rc-space-sm);
  right: var(--rc-space-sm);
  bottom: -1px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--rc-color-primary);
}

.rc-tabs__tab--disabled {
  color: var(--rc-color-text-disabled);
  cursor: not-allowed;
}

.rc-tabs__tab--disabled:hover {
  color: var(--rc-color-text-disabled);
}

.rc-tabs__count {
  font-size: var(--rc-font-size-2xs);
  color: var(--rc-color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
