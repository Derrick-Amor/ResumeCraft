<script setup lang="ts">
/**
 * RcCard —— 卡槽基座（C 段：类名换成设计稿 `.card`）
 *
 * 设计稿的 `.card` 只有一层壳 + 固定内边距，没有"档位"概念，所以 C 段删掉了 `padding` 属性；
 * 需要不同留白的场景（模板卡 `.tplcard`、组件卡 `.compcard`）在 D 段直接用设计稿类名，
 * 不再靠基座加修饰类拼出来 —— 那正是上一版"看着像、其实不是设计稿"的根因之一。
 *
 * `interactive` / `selected` 保留为**语义**（点击与选中），不再造设计稿里没有的类：
 * 可交互 → `role="button"` + `tabindex="0"`；选中 → `aria-selected`。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 可交互：补 role/tabindex，键盘可聚焦 */
    interactive?: boolean
    selected?: boolean
  }>(),
  {
    interactive: false,
    selected: false,
  },
)

const roleAttr = computed(() => (props.interactive ? 'button' : undefined))
const tabindexAttr = computed(() => (props.interactive ? 0 : undefined))
</script>

<template>
  <div
    class="card"
    :role="roleAttr"
    :tabindex="tabindexAttr"
    :aria-selected="selected ? 'true' : undefined"
  >
    <div v-if="$slots.media" class="card__media"><slot name="media" /></div>
    <slot />
  </div>
</template>
