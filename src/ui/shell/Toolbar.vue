<script setup lang="ts">
/**
 * 顶栏（D 段）—— `.topbar` 结构照 01-editor.html
 *
 * 三段布局：左（品牌 + 返回工作台）/ 中（语言轨 + 撤销重做）/ 右（保存态 + 导出 + 头像）。
 *
 * 三处刻意的产品取舍：
 *  1. **保存态绝不谎报**：`saveStatus === 'error'` 时显示「保存失败」并挂 `.statusbar__item--warn`，
 *     title 里带脱敏原因；只有 `saved` 才显示「已保存」（契约 §11.4 降级必须显式）。
 *  2. **英文轨按钮 disabled**：英文轨尚未完成，用 `.segmented__dot` + title 说明，
 *     不做"能点但什么都没发生"的假按钮。
 *  3. **文件名不在这里**（2026-10-30 Amor 调整）：重命名移到画布条居中（见 CanvasView），
 *     本处改为「返回工作台」按钮。
 */
import { computed } from 'vue'

import { useEditorStore } from '../../state/editor-store'
import { RcIcon } from '../controls'

const store = useEditorStore()

const emit = defineEmits<{ check: []; exportRequest: [] }>()

const SAVE_TEXT = {
  idle: '未保存',
  pending: '待保存',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
} as const

const saveText = computed(() => SAVE_TEXT[store.saveStatus])
const saveTitle = computed(() => store.saveError ?? undefined)
const isError = computed(() => store.saveStatus === 'error')
const isSaved = computed(() => store.saveStatus === 'saved')
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <div class="brand">
        <span class="brand__mark"><RcIcon name="file-text" :size="14" /></span>
        <span class="brand__name">ResumeCraft</span>
      </div>
      <span class="topbar__divider"></span>

      <!-- 返回工作台：按 Amor 图示从左栏移到这里（原文件名的位置），
           样式与顶栏其他按钮一致（.btn，非 ghost）。文件名已移至画布条居中。 -->
      <button
        class="btn"
        data-testid="rc-back-workbench"
        title="返回工作台"
        @click="store.setScreen('workbench')"
      >
        <RcIcon name="chevron-left" :size="14" />返回工作台
      </button>
    </div>

    <div class="topbar__mid">
      <div class="segmented" role="group" aria-label="内容语言轨">
        <button
          class="segmented__item"
          :class="store.doc.languageTrack === 'zh' ? 'segmented__item--on' : ''"
        >
          中文
        </button>
        <button
          class="segmented__item"
          :class="store.doc.languageTrack === 'en' ? 'segmented__item--on' : ''"
          aria-disabled="true"
          title="英文轨未完成"
        >
          English<span class="segmented__dot" title="英文轨未完成"></span>
        </button>
      </div>

      <button
        class="iconbtn"
        :title="store.canUndo ? `撤销：${store.undoLabel ?? ''}` : '没有可撤销的操作'"
        :aria-disabled="store.canUndo ? undefined : 'true'"
        data-testid="rc-undo"
        @click="store.undo"
      >
        <RcIcon name="undo" :size="14" />
      </button>
      <button
        class="iconbtn"
        :title="store.canRedo ? `重做：${store.redoLabel ?? ''}` : '没有可重做的操作'"
        :aria-disabled="store.canRedo ? undefined : 'true'"
        data-testid="rc-redo"
        @click="store.redo"
      >
        <RcIcon name="redo" :size="14" />
      </button>
    </div>

    <div class="topbar__right">
      <span
        class="statusbar__item muted"
        :class="isError ? 'statusbar__item--warn' : ''"
        :title="saveTitle"
        style="margin-right: 6px"
        data-testid="rc-save-badge"
      >
        <RcIcon
          :name="isError ? 'alert-circle' : isSaved ? 'check-circle' : 'refresh'"
          :size="12"
        />
        {{ saveText }}
      </span>

      <button class="btn" data-testid="rc-check" @click="emit('check')">
        <RcIcon name="clipboard-check" :size="14" />导出前检查
      </button>
      <button class="btn btn--primary" data-testid="rc-export" @click="emit('exportRequest')">
        <RcIcon name="download" :size="14" />导出
      </button>
      <span class="avatar">{{ store.doc.meta.title.slice(0, 1) || '简' }}</span>
    </div>
  </header>
</template>
