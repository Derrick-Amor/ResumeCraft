<!--
  工作台（05 空状态 / 首次引导）—— DOM 逐层照抄 `docs/design/mockups/figma/05-empty.html`

  职责：产品入口屏。没有它，用户进不了「新建 / 导入 / 选模板」。
  三个入口各自落到 store 的一个动作，然后 `setScreen('editor')`。

  三条纪律：
  1. 类名一律设计稿原名（`.rail` / `.sheet` / `.entrygrid` / `.entrycard` / `.progress3` /
     `.footnote` / `.eyebrow` …），新增类只许 ui-restore-plan.md §2.2 表里那几个。
  2. 不写内联 hex / rgb()；颜色一律 `var(--rc-*)`。内联只保留稿子里就有的布局值
     （`max-width: 1120px` / `560px` / `margin-top: 3px`）。
  3. 间距交给 `.entrygrid` 的 gap 与 CSS，组件里不手写 margin。
-->
<script setup lang="ts">
import { ref } from 'vue'

import { pendingItemsToComponents, recognizedBlocksToComponents } from '../../io/import-bridge'
import type { PendingItem, RecognizedBlock } from '../../io/recognition-provider'
import { useEditorStore } from '../../state/editor-store'
import { ensureBuiltinTemplates } from '../../template/runtime'
import ImportWizard from '../import-wizard/ImportWizard.vue'
import { RcBadge, RcIcon } from '../controls'

const store = useEditorStore()
ensureBuiltinTemplates()

const showImport = ref(false)

/** 「从模板开始」→ 02 模板库整屏（此前的临时弹窗已删除，那层临时性解除） */
function openTemplatePicker(): void {
  store.setScreen('templates')
}

/**
 * 导入确认：识别块 → 组件 → **一次 commit 写进文档**（[数据丢失风险] 数据落盘）。
 * 以前这里只 `newDocument('blank')`，识别结果被静默丢弃 —— 那是矩阵里唯一的 [数据丢失风险]。
 *
 * pending（未识别内容）同样落盘为 UnknownComponent：一个字节都不能丢。
 */
function onImported(blocks: RecognizedBlock[], pending: PendingItem[]): void {
  showImport.value = false

  const orderStart = store.doc.components.length
  const incoming = [
    ...recognizedBlocksToComponents(blocks, orderStart, store.doc.languageTrack),
    ...pendingItemsToComponents(pending, orderStart + blocks.length),
  ]
  store.importComponents(incoming)
  store.setScreen('editor')
}

function createBlank(): void {
  store.newDocument('blank')
  store.setScreen('editor')
}
</script>

<template>
  <div class="app" data-testid="rc-workbench">
    <!-- 顶栏：工作台语义，不暴露导出动作 -->
    <header class="topbar">
      <div class="topbar__left">
        <div class="brand">
          <span class="brand__mark"><RcIcon name="file-text" :size="14" /></span>
          <span class="brand__name">ResumeCraft</span>
        </div>
        <span class="topbar__divider"></span>
        <div class="docmeta">
          <span class="docmeta__name">我的工作台</span>
          <span class="docmeta__sub">开始你的第一份简历</span>
        </div>
      </div>
      <div class="topbar__mid"></div>
      <div class="topbar__right">
        <button class="btn" data-testid="rc-help">
          <RcIcon name="info" :size="14" />使用帮助
        </button>
        <span class="avatar">张</span>
      </div>
    </header>

    <div class="workspace">
      <!-- 左栏：我的简历 / 模板库 -->
      <aside class="rail">
        <button class="rail__item rail__item--on">
          <RcIcon name="file-text" :size="14" />我的简历
        </button>
        <button class="rail__item" data-testid="rc-rail-templates" @click="openTemplatePicker">
          <RcIcon name="layout-template" :size="14" />模板库
        </button>
        <div class="rail__divider"></div>
        <p class="rail__empty">
          <span class="rail__empty-t">还没有简历文档</span>
          创建后，你的简历会显示在这里。
        </p>
      </aside>

      <!-- 主区：三张入口卡 -->
      <main class="sheet">
        <div class="sheet__inner" style="max-width: 1120px">
          <p class="eyebrow">开始使用 / 01</p>
          <h1 class="h1">创建你的第一份简历</h1>
          <p class="h1__sub" style="max-width: 560px">
            选择一种开始方式，先把经历写清楚，排版交给工作台。
          </p>

          <div class="entrygrid">
            <article class="entrycard entrycard--on">
              <div class="entrycard__top">
                <span class="entrycard__ico"><RcIcon name="layout-template" :size="18" /></span>
                <RcBadge tone="accent">推荐</RcBadge>
              </div>
              <h2 class="entrycard__title">从模板开始</h2>
              <p class="entrycard__desc">
                选择适合你的版式，按章节填写内容。系统自动对齐、分页与排版。
              </p>
              <p class="entrycard__note">适合第一次制作简历</p>
              <button
                class="btn btn--lg btn--primary entrycard__btn"
                data-testid="rc-entry-template"
                @click="openTemplatePicker"
              >
                <RcIcon name="arrow-up-right" :size="14" />选择模板
              </button>
            </article>

            <article class="entrycard">
              <div class="entrycard__top">
                <span class="entrycard__ico"><RcIcon name="file-up" :size="18" /></span>
              </div>
              <h2 class="entrycard__title">导入已有简历</h2>
              <p class="entrycard__desc">
                上传 DOCX 或 PDF，对照原文确认识别结果，保留你的经历与成果。
              </p>
              <p class="entrycard__note">支持 DOCX / PDF · 最大 20 MB</p>
              <button
                class="btn btn--lg entrycard__btn"
                data-testid="rc-entry-import"
                @click="showImport = true"
              >
                选择文件
              </button>
            </article>

            <article class="entrycard">
              <div class="entrycard__top">
                <span class="entrycard__ico"><RcIcon name="square-plus" :size="18" /></span>
              </div>
              <h2 class="entrycard__title">空白画板</h2>
              <p class="entrycard__desc">
                从一张 A4 白纸开始，自由添加简历组件，建立自己的内容顺序。
              </p>
              <p class="entrycard__note">适合已有明确排版思路</p>
              <button
                class="btn btn--lg entrycard__btn"
                data-testid="rc-entry-blank"
                @click="createBlank"
              >
                新建空白简历
              </button>
            </article>
          </div>

          <div class="progress3">
            <div class="progress3__head">
              <span class="progress3__title">三步骤完成一份可投递的简历</span>
              <span class="progress3__count">0 / 3 完成</span>
            </div>
            <div class="progress3__item"><span class="progress3__no">1</span>选择版式或导入文件</div>
            <div class="progress3__item"><span class="progress3__no">2</span>填写并核对个人经历</div>
            <div class="progress3__item"><span class="progress3__no">3</span>检查后导出 PDF / Word</div>
          </div>

          <p class="footnote">
            <RcIcon name="info" :size="12" style="margin-top: 3px" />
            <span>PDF 保持最终版式；Word 可继续编辑。支持中文与 English 独立内容轨。</span>
          </p>
        </div>
      </main>
    </div>

    <footer class="statusbar">
      <span>尚未创建文档</span>
      <span>PDF · Word 可编辑导出</span>
    </footer>

    <!-- 导入向导（05 只负责打开；block → 组件的映射归 03 屏） -->
    <ImportWizard v-if="showImport" @import="onImported" @cancel="showImport = false" />
  </div>
</template>
