<script setup lang="ts">
/**
 * RcCard —— 玻璃卡片基座（TC-004）
 * 模板卡（规格 §2）、组件市场卡、入口卡都建在它上面。
 *
 * 材质按 v3：一层透明色 + backdrop-filter，**不画高光/色散/多重阴影**。
 * hover 只做两件事：上浮 + 蓝色呼吸环（环只动 opacity）。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 可交互：hover 上浮 + 呼吸环。纯展示卡关掉，省掉无谓动画 */
    interactive?: boolean
    selected?: boolean
    /** 内边距档位；带 media 插槽时通常用 none，由媒体区自己撑满 */
    padding?: 'none' | 'sm' | 'md'
  }>(),
  {
    interactive: false,
    selected: false,
    padding: 'md',
  },
)

const classes = computed(() => [
  'rc-card',
  `rc-card--pad-${props.padding}`,
  props.interactive ? 'rc-card--interactive' : '',
  props.selected ? 'rc-card--selected' : '',
])
</script>

<template>
  <div :class="classes">
    <div v-if="$slots.media" class="rc-card__media"><slot name="media" /></div>
    <div class="rc-card__body"><slot /></div>
  </div>
</template>

<style scoped>
.rc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--rc-glass-card);
  -webkit-backdrop-filter: var(--rc-glass-blur);
  backdrop-filter: var(--rc-glass-blur);
  border: 1px solid var(--rc-color-border);
  border-radius: var(--rc-radius-lg);
  box-shadow: none;
  transition:
    transform var(--rc-duration-card) var(--rc-ease-spring),
    background var(--rc-duration-base) var(--rc-ease-standard),
    border-color var(--rc-duration-base) var(--rc-ease-standard);
}

.rc-card--pad-none {
  padding: 0;
}
.rc-card--pad-sm {
  padding: var(--rc-space-sm);
}
.rc-card--pad-md {
  padding: var(--rc-space-base);
}

.rc-card__media {
  overflow: hidden;
  border-radius: calc(var(--rc-radius-lg) - 1px) calc(var(--rc-radius-lg) - 1px) 0 0;
}

.rc-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--rc-space-xs);
  min-width: 0;
}

/* ---- 交互：上浮 + 蓝色呼吸环 ---- */
.rc-card--interactive {
  cursor: pointer;
}

.rc-card--interactive::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  border: 1px solid var(--rc-color-primary);
  opacity: 0;
  transition: opacity var(--rc-duration-base) var(--rc-ease-standard);
}

.rc-card--interactive:hover {
  transform: translateY(var(--rc-lift-card)) scale(var(--rc-lift-scale));
  background: var(--rc-glass-card-hover);
  border-color: transparent;
  z-index: 1;
}

.rc-card--interactive:hover::after {
  animation: rc-card-breathe var(--rc-duration-breathe) ease-in-out infinite;
}

.rc-card--interactive:focus-visible {
  box-shadow: var(--rc-focus-ring);
  outline: none;
}

/* 选中态压过呼吸环：边框常亮，不参与动画 */
.rc-card--selected {
  border-color: var(--rc-color-primary);
  box-shadow: 0 0 0 1px var(--rc-color-primary);
}

@keyframes rc-card-breathe {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

/* 减少动态效果时环常亮、不位移 */
@media (prefers-reduced-motion: reduce) {
  .rc-card--interactive:hover {
    transform: none;
  }
  .rc-card--interactive:hover::after {
    animation: none;
    opacity: 1;
  }
}
</style>
