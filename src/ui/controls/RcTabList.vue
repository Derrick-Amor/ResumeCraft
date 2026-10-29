<script setup lang="ts">
/**
 * RcTabList —— Tab 条的共享实现（C 段内部件，不对外导出）
 *
 * 为什么拆成「一个实现 + 两个包装」：设计稿三处 tab 形态不同
 * （左栏 `.side__tab`、右栏 `.inspector__tab`），硬套一个组件会互相将就；
 * 但**键盘行为与 aria 语义完全一样**，不该写两遍。
 *
 * 无障碍：role="tablist" + 每项 aria-selected；
 * roving tabindex（选中项 0，其余 -1）+ 方向键在**可用项**间环形移动；
 * 禁用项跳过但保留 aria-disabled，不隐藏（隐藏会让用户以为功能被删了）。
 */
import { ref } from 'vue'

import type { RcTabItem } from './types'

const props = defineProps<{
  items: RcTabItem[]
  /** 当前选中的 key */
  modelValue: string
  /** 设计稿的类名前缀：`side` → .side__tabs / .side__tab；`inspector` 同理 */
  prefix: 'side' | 'inspector'
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
  <div :class="`${prefix}__tabs`" role="tablist">
    <button
      v-for="(item, index) in items"
      :key="item.key"
      :ref="(el) => setTabEl(el, index)"
      type="button"
      role="tab"
      :class="[`${prefix}__tab`, item.key === modelValue ? `${prefix}__tab--on` : '']"
      :aria-selected="item.key === modelValue ? 'true' : 'false'"
      :aria-disabled="item.disabled === true ? 'true' : undefined"
      :tabindex="item.key === modelValue ? 0 : -1"
      @click="select(item)"
      @keydown="onKeydown($event, index)"
    >
      {{ item.label }}
      <template v-if="item.count !== undefined">{{ item.count }}</template>
    </button>
  </div>
</template>
