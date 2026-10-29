<script setup lang="ts">
/**
 * 状态栏（D 段）—— `.statusbar` 结构照 01-editor.html
 *
 * 只承载两类信息：保存状态（左）与问题计数（右）。
 * 数字全部来自 store 的派生值，不在模板里重算 —— 页数与警告数只允许有一个真相。
 * `saveStatus === 'error'` 时点变成红色语气并显示原因，绝不显示"已保存"。
 */
import { computed } from 'vue'

import { useEditorStore } from '../../state/editor-store'
import { RcIcon } from '../controls'

const store = useEditorStore()

const SAVE_TEXT = {
  idle: '未保存',
  pending: '待保存',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
} as const

const saveText = computed(() => SAVE_TEXT[store.saveStatus])
const isError = computed(() => store.saveStatus === 'error')

const blockingCount = computed(() => store.qualityReport.blocking.length)
const overflowCount = computed(
  () =>
    store.layout.warnings.filter(
      (w) => w.type === 'overflow-page' || w.type === 'overflow-component',
    ).length,
)
const issueCount = computed(() => store.warningSummary.total)
</script>

<template>
  <footer class="statusbar">
    <div class="statusbar__group">
      <span
        class="statusbar__item"
        :class="isError ? 'statusbar__item--warn' : ''"
        :title="store.saveError ?? undefined"
        data-testid="rc-status-save"
      >
        <RcIcon :name="isError ? 'alert-circle' : 'check-circle'" :size="12" />
        {{ saveText
        }}<template v-if="isError && store.saveError"> · {{ store.saveError }}</template>
      </span>
      <span class="statusbar__item muted" data-testid="rc-status-pages"
        >{{ store.pageCount }} 页</span
      >
    </div>

    <div class="statusbar__group">
      <span
        v-if="overflowCount > 0"
        class="statusbar__item statusbar__item--warn"
        data-testid="rc-status-overflow"
      >
        <span class="statusbar__dot"></span>{{ overflowCount }} 处溢出
      </span>
      <span
        class="statusbar__item"
        :class="blockingCount > 0 ? 'statusbar__item--warn' : 'muted'"
        data-testid="rc-status-blocking"
      >
        阻断 {{ blockingCount }} · 提示 {{ issueCount }}
      </span>
    </div>
  </footer>
</template>
