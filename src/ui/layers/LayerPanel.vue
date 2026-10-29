<script setup lang="ts">
/**
 * 图层面板（D 段）—— 「页面」Tab 底部的一段，类名照 06a-layers.html
 *
 * 为什么合进「页面」Tab 而不是单独一个 Tab：06a 的 `.layerhead` 上写的就是「第 1 页」，
 * 图层本来就是"某一页的图层"。页面列表与图层树是同一件事的两个层次，
 * 拆成两个 Tab 会逼用户来回切，而 01 稿的 Tab 数固定是 4 个。
 *
 * props 驱动（不是直接读 store）：图层面板与「当前选中」是两件事，
 * 由左栏把两者同时传进来，面板本身不关心文档从哪来，便于单独测。
 *
 * 契约 §10.4：**图层的选中/锁定属 UI 态，不进文档模型**。
 * Amor 2026-10-30 裁决：按 06b 模式补渲染 —— 06a 设计稿里每个图层行都有锁定按钮，
 * 照稿做；但锁定仍是纯 UI 态（lockedIds 只活在组件里，不 emit、不碰 store/doc、不进 undo 栈）。
 * 锁定的功能性含义是防误操作（禁拖拽、禁上下移），与 06b 的 `.bg-locked`
 * （PropertyPanel 的 bgLocked ref）同一范式。设计稿原话：「背景默认锁定，避免误选」。
 */
import { ref } from 'vue'

import type { AnyComponent } from '../../model/types'
import { BACKGROUND_LAYER_ID } from './layer-ids'
import { componentRegistry } from '../../components/runtime'
import { RcIcon } from '../controls'

const props = withDefaults(
  defineProps<{
    components: AnyComponent[]
    selectedId: string | null
    /** 这一组图层属于第几页（从 0 起）。图层是"某一页的图层"，所以页号是它的上下文 */
    pageIndex?: number
  }>(),
  { pageIndex: 0 },
)

const emit = defineEmits<{
  select: [id: string | null]
  toggleVisible: [id: string]
  move: [id: string, direction: -1 | 1]
  /** 拖拽排序：把 id 移到 toIndex（最终位置） */
  moveTo: [id: string, toIndex: number]
}>()

/**
 * 锁定中的图层 id 集合 —— **纯 UI 态**（契约 §10.4，Amor 2026-10-30 裁决按 06b 模式补渲染）：
 * 只活在组件里，不 emit、不碰 store、不碰 doc、不进 undo 栈。
 * 功能含义是防误操作：锁定的行禁拖拽、禁上下移（见模板里的 `:draggable` / `:disabled`），
 * 与 06b 的 `.bg-locked`（PropertyPanel 的 bgLocked ref）同一范式。
 */
const lockedIds = ref<Set<string>>(new Set())

function isLocked(id: string): boolean {
  return lockedIds.value.has(id)
}

function toggleLock(id: string): void {
  // 复制一份再改：换引用触发响应更新，也比原地 mutate 更稳
  const next = new Set(lockedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  lockedIds.value = next
}

/** 拖拽排序的自定义 MIME，与"拖入添加"区分开，避免卡片掉进图层树 */
const LAYER_MIME = 'application/x-rc-layer'

/** 当前悬停的目标行下标，null = 没有拖拽悬停 */
const dragOverIndex = ref<number | null>(null)

function onRowDragStart(event: DragEvent, id: string): void {
  const dt = event.dataTransfer
  if (dt === null) return
  dt.setData(LAYER_MIME, id)
  dt.effectAllowed = 'move'
}

function onRowDragOver(event: DragEvent, index: number): void {
  const dt = event.dataTransfer
  // 只认自己的 MIME：组件卡拖过图层树时不显示指示线、也不算 drop 目标
  if (dt === null || !dt.types.includes(LAYER_MIME)) return
  event.preventDefault()
  dragOverIndex.value = index
}

function onRowDrop(event: DragEvent, index: number): void {
  const dt = event.dataTransfer
  dragOverIndex.value = null
  const id = dt?.getData(LAYER_MIME) ?? ''
  if (id === '') return
  event.preventDefault()
  emit('moveTo', id, index)
}

function onRowDragEnd(): void {
  dragOverIndex.value = null
}

function labelOf(component: AnyComponent): string {
  if ('unknown' in component && component.unknown === true) return component.originalType
  return componentRegistry.get(component.type)?.displayName ?? component.type
}
</script>

<template>
  <div>
    <div class="layerhead" :data-testid="`rc-layerhead-${props.pageIndex}`">
      <span class="layerhead__name">
        <RcIcon name="layers" :size="12" />第 {{ props.pageIndex + 1 }} 页
      </span>
      <span class="layerhead__count">{{ props.components.length }} 个图层</span>
    </div>

    <div class="layergroup">
      <div class="layergroup__title">背景</div>
      <!-- 背景层：可选中（右栏显示 06b 的属性），但**不是文档组件**——
           锁定是 UI 态，点了只切 UI 态，不改 doc（契约 §10.4） -->
      <div
        class="layerrow"
        :class="selectedId === BACKGROUND_LAYER_ID ? 'layerrow--on' : ''"
        :data-testid="`rc-layer-${BACKGROUND_LAYER_ID}`"
      >
        <button
          class="layerrow__main"
          title="背景层（锁定状态是界面状态，不写进文档）"
          @click="emit('select', BACKGROUND_LAYER_ID)"
        >
          <RcIcon name="flag" :size="14" />
          <span class="layerrow__name">背景层</span>
        </button>
        <span class="layerrow__acts">
          <!-- 背景恒锁定：06a 设计稿 :155 锁定态 + :161「背景默认锁定，避免误选」。
               功能性的解锁在 06b 属性面板的 bgLocked，归 PropertyPanel 管，这里只呈现锁定态 -->
          <button class="iconbtn iconbtn--sm iconbtn--lock" title="背景层锁定" disabled>
            <RcIcon name="lock" :size="12" />
          </button>
        </span>
      </div>
    </div>

    <div class="layergroup">
      <div class="layergroup__title">内容</div>
      <div
        v-for="(component, index) in props.components"
        :key="component.id"
        class="layerrow"
        :class="selectedId === component.id ? 'layerrow--on' : ''"
        :data-testid="`rc-layer-${component.id}`"
        :draggable="!isLocked(component.id)"
        :style="dragOverIndex === index ? { borderTop: '2px solid var(--rc-accent)' } : undefined"
        @dragstart="onRowDragStart($event, component.id)"
        @dragover="onRowDragOver($event, index)"
        @drop="onRowDrop($event, index)"
        @dragend="onRowDragEnd"
      >
        <button class="layerrow__main" @click="emit('select', component.id)">
          <RcIcon name="square-dashed" :size="14" />
          <span class="layerrow__name" :class="component.visible ? '' : 'muted'">
            {{ labelOf(component) }}
          </span>
        </button>
        <span class="layerrow__acts">
          <button
            class="iconbtn iconbtn--sm"
            :title="component.visible ? '隐藏' : '显示'"
            :data-testid="`rc-layer-visible-${component.id}`"
            @click="emit('toggleVisible', component.id)"
          >
            <RcIcon :name="component.visible ? 'eye' : 'eye-off'" :size="12" />
          </button>
          <button
            class="iconbtn iconbtn--sm"
            :class="isLocked(component.id) ? 'iconbtn--lock' : ''"
            :title="isLocked(component.id) ? '解锁' : '锁定'"
            :data-testid="`rc-layer-lock-${component.id}`"
            @click="toggleLock(component.id)"
          >
            <RcIcon :name="isLocked(component.id) ? 'lock' : 'unlock'" :size="12" />
          </button>
          <button
            class="iconbtn iconbtn--sm"
            title="上移"
            :disabled="index === 0 || isLocked(component.id)"
            @click="emit('move', component.id, -1)"
          >
            <RcIcon name="chevron-left" :size="12" />
          </button>
          <button
            class="iconbtn iconbtn--sm"
            title="下移"
            :disabled="index === props.components.length - 1 || isLocked(component.id)"
            @click="emit('move', component.id, 1)"
          >
            <RcIcon name="chevron-right" :size="12" />
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
