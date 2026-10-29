<script setup lang="ts">
/**
 * 主壳（D 段）—— `.app > .topbar + .workspace(.side|.canvas|.inspector) + .statusbar`
 * 结构照 01-editor.html；旧版 `.rc-shell` 两层壳已废弃。
 *
 * 职责：
 *  1. 启动/收尾：`boot()` 装配持久化并恢复上次编辑，卸载前 `flushSave()` 不丢最后一笔
 *  2. 降级提示：内存存储、字体未就绪两条 **必须** 显示（契约 §11.4 降级必须显式）
 *  3. 导出链路：格式选择 → 质量关卡（blocking 必须显式确认）→ 生成 → 下载
 *  4. 键盘：Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y / Delete，焦点在输入控件内一律跳过
 *
 * 导出实现要点：`extractText` / `extractBlocks` 用 `componentTextBlock` 映射，
 * 不让导出层退回自己的启发式提取器 —— 屏幕与文件必须是同一份文本来源。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { componentRegistry } from '../../components/runtime'
import type { ExtractBlocks, ExportResult } from '../../io/export-docx'
import type { TextRun } from '../../io/export-pdf'
import { downloadBytes, suggestFileName } from '../../io/download'
import { componentTextBlock, documentTextBlocks, toExportRole } from '../../layout/text-runs'
import { useEditorStore } from '../../state/editor-store'
import CanvasView from '../canvas/CanvasView.vue'
import OverflowDialog from '../overflow-dialog/OverflowDialog.vue'
import type { OverflowItem } from '../overflow-dialog/OverflowDialog.vue'
import { RcButton, RcIcon, RcNotice } from '../controls'
import PropertyPanel from '../panels/PropertyPanel.vue'
import TemplatesView from '../templates/TemplatesView.vue'
import Workbench from '../workbench/Workbench.vue'
import NewDocDialog from './NewDocDialog.vue'
import type { NewDocType } from './NewDocDialog.vue'
import ResourceBar from './ResourceBar.vue'
import StatusBar from './StatusBar.vue'
import Toolbar from './Toolbar.vue'

const store = useEditorStore()

const newDocOpen = ref(false)
const overflowOpen = ref(false)
const showChecks = ref(false)
const showFormat = ref(false)
/** 导出格式选中项（radio 语义）：点卡片只选中，确认按钮才前进 */
const selectedFormat = ref<Format | null>(null)
const exportError = ref<string | null>(null)
const exporting = ref(false)
const noticeDismissed = ref(false)

const storageWarning = computed(() => (noticeDismissed.value ? null : store.storageNotice))
const fontWarning = computed(() => {
  const readiness = store.fontReadiness
  if (noticeDismissed.value || readiness === null) return null
  if (readiness.ready) return null
  return readiness.supported
    ? `字体加载失败（${readiness.failed.join('、')}），预览与导出可能使用替代字体`
    : '当前环境不支持内置字体加载，预览与导出可能使用替代字体'
})

// ------------------------------- 溢出处理 -------------------------------

/**
 * 溢出项：组件级粒度。`lines` 是组件真实文本行（documentTextBlocks 的 runs），
 * `lineCount` / `overText` 契约给不出，缺省不填 —— 不编造"哪几行超出"。
 */
const overflowItems = computed<OverflowItem[]>(() => {
  const linesById = new Map<string, string[]>()
  for (const block of documentTextBlocks(store.doc)) {
    linesById.set(block.componentId, block.runs.map((run) => run.text))
  }
  return store.layout.warnings
    .filter((w) => w.type === 'overflow-page' || w.type === 'overflow-component')
    .map((w) => ({
      componentId: w.componentId ?? '',
      componentName: displayNameOf(w.componentId ?? ''),
      pageIndex: w.pageIndex,
      lines: linesById.get(w.componentId ?? '') ?? [],
      overLines: w.overLines,
    }))
})

function displayNameOf(componentId: string): string {
  const component = store.doc.components.find((c) => c.id === componentId)
  if (component === undefined) return '未知组件'
  return componentRegistry.get(component.type)?.displayName ?? component.type
}

// 压缩的数据语义在 store（compressComponent / compressPage）：那里有 clamp 下限与单步 undo 的约束
function onCompressComponent(componentId: string): void {
  store.compressComponent(componentId)
}

function onCompressPage(pageIndex: number): void {
  store.compressPage(pageIndex)
}

/**
 * 「预览整体下移」——**降级实现**：分页是自动的，没有"插入分页符"的原语，
 * 所以这里把组件移到文档末尾（通常会落到更后的页），一步 undo 可退。
 * 真正的"整体下移至下一页"需要 layout 层支持显式分页锚点，属 E 段之后的契约扩展。
 */
function onPreviewPushDown(componentId: string): void {
  store.moveComponentTo(componentId, store.components.length - 1)
}

// ------------------------------- 导出 -------------------------------

type Format = 'pdf' | 'docx'

/** 组件 → PDF 文本段。fontKey 按组件类型给 serif/sans 是模板的事，这里统一 sans */
function extractTextForPdf(componentId: string): TextRun[] {
  const component = store.doc.components.find((c) => c.id === componentId)
  if (component === undefined) return []
  return componentTextBlock(component, store.doc.languageTrack).runs.map((run) => ({
    text: run.text,
    fontKey: 'rc-sans',
    fontSizePt: run.fontSizePt,
    bold: run.bold,
    lineHeight: run.fontSizePt * run.lineHeight,
  }))
}

/** 同样走 componentTextBlock：DOCX 与屏幕必须同源，否则文件内容会和预览对不上 */
const extractBlocksForDocx: ExtractBlocks = (componentId, doc) => {
  const component = doc.components.find((c) => c.id === componentId)
  if (component === undefined) return []
  const block = componentTextBlock(component, doc.languageTrack)
  return [
    {
      kind: 'lines',
      // 八角色降级成导出档位：屏幕/纸面用语义角色，DOCX 只认 title/body/bullet
      lines: block.runs.map((run) => ({ text: run.text, role: toExportRole(run.role) })),
    },
  ]
}

function openFormatPicker(): void {
  exportError.value = null
  selectedFormat.value = null
  showFormat.value = true
}

async function runExport(format: Format, forceExport: boolean): Promise<void> {
  exporting.value = true
  exportError.value = null
  const doc = store.doc
  const layout = store.layout

  try {
    let result: ExportResult
    if (format === 'pdf') {
      // 动态 import：pdf-lib 与字体读取器体积大，不该进首屏 chunk（首屏只留编辑器壳）
      const [{ exportPdf }, { loadPdfFonts }] = await Promise.all([
        import('../../io/export-pdf'),
        import('../../io/font-assets'),
      ])
      const fonts = await loadPdfFonts()
      result = await exportPdf(doc, layout, {
        forceExport,
        extractText: (componentId) => extractTextForPdf(componentId),
        ...(fonts === null ? {} : { fonts }),
      })
    } else {
      const { exportDocx } = await import('../../io/export-docx')
      result = await exportDocx(doc, {
        forceExport,
        layout,
        extractBlocks: extractBlocksForDocx,
      })
    }

    if (!result.ok || result.data === undefined) {
      exportError.value = result.error ?? '导出失败，请重试'
      // blocking 未放行时回到质量关卡，而不是静默失败
      if (result.qualityReport.blocking.length > 0 && !forceExport) showChecks.value = true
      return
    }

    const mime =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    downloadBytes(result.data, suggestFileName(doc.meta.title, format), mime)
    showChecks.value = false
    showFormat.value = false
  } finally {
    exporting.value = false
  }
}

function confirmFormat(format: Format): void {
  showFormat.value = false
  if (store.qualityReport.blocking.length > 0) {
    // 有阻断必须先过质量关卡，不能直接产出文件（契约 §8 不变量 1）
    showChecks.value = true
    pendingFormat.value = format
    return
  }
  void runExport(format, false)
}

const pendingFormat = ref<Format>('pdf')

// ------------------------------- 键盘 -------------------------------

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return EDITABLE_TAGS.has(target.tagName)
}

function onKeydown(event: KeyboardEvent): void {
  // 焦点在输入控件里时一律不拦：否则在标题框按退格会删掉整个组件
  if (isEditableTarget(event.target)) return

  const meta = event.metaKey || event.ctrlKey
  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (meta && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    store.redo()
    return
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedId !== null) {
    event.preventDefault()
    store.removeComponent(store.selectedId)
  }
}

/**
 * 新建文档：三种模式的落点都在 store.newDocument。
 * 这是**单步可撤销**的操作（team-lead 裁决：新建可回退到上一份），所以不清历史。
 */
function onCreateDoc(type: NewDocType): void {
  store.newDocument(type)
  newDocOpen.value = false
}

onMounted(async () => {
  await store.boot()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  void store.flushSave()
})
</script>

<template>
  <!-- 两个形态各自带自己的 .topbar / .statusbar（05 的顶栏与 01 不同内容，不做组件硬套） -->
  <Workbench v-if="store.screen === 'workbench'" />

  <TemplatesView
    v-else-if="store.screen === 'templates'"
    @check="showChecks = true"
    @export-request="openFormatPicker"
  />

  <div v-else class="app" data-testid="rc-app-shell">
    <Toolbar @check="showChecks = true" @export-request="openFormatPicker" />

    <div class="workspace">
      <ResourceBar @new-doc="newDocOpen = true" />
      <CanvasView @open-overflow="overflowOpen = true" />
      <PropertyPanel />
    </div>

    <StatusBar />

    <!-- 降级提示：两条都必须能看见，不允许只在 store 里躺着 -->
    <div
      v-if="storageWarning || fontWarning || exportError"
      style="
        position: fixed;
        left: 50%;
        top: 56px;
        transform: translateX(-50%);
        z-index: 60;
        width: min(560px, 90vw);
      "
    >
      <RcNotice v-if="storageWarning" tone="danger" title="本地存储不可用">
        {{ storageWarning }}
      </RcNotice>
      <RcNotice v-if="fontWarning" tone="warning" title="字体降级">{{ fontWarning }}</RcNotice>
      <RcNotice v-if="exportError" tone="danger" title="导出失败">{{ exportError }}</RcNotice>
      <button class="btn btn--ghost btn--sm" @click="noticeDismissed = true">知道了</button>
    </div>

    <NewDocDialog v-if="newDocOpen" @create="onCreateDoc" @close="newDocOpen = false" />

    <OverflowDialog
      :open="overflowOpen"
      :items="overflowItems"
      :page-component-count="store.components.filter((c) => c.visible).length"
      @compress-component="onCompressComponent"
      @compress-page="onCompressPage"
      @preview-push-down="onPreviewPushDown"
      @locate="store.selectComponent"
      @skip="overflowOpen = false"
      @close="overflowOpen = false"
    />

    <!-- 格式选择 -->
    <div v-if="showFormat" class="scrim" @click.self="showFormat = false">
      <div
        class="dialog dialog--md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rc-format-title"
      >
        <div class="dialog__head">
          <span id="rc-format-title" class="dialog__title">选择导出格式</span>
          <span class="dialog__sub">PDF 保真排版，Word 可继续编辑</span>
        </div>
        <div class="dialog__body">
          <!-- optcard 是可选中项卡（glass.css:191 的 .optcard--on 是 radio 选中态），
               不是直接动作：点卡只选中，确认按钮才前进 -->
          <button
            type="button"
            role="radio"
            class="optcard"
            :class="selectedFormat === 'pdf' ? 'optcard--on' : ''"
            :aria-checked="selectedFormat === 'pdf'"
            data-testid="rc-export-pdf"
            @click="selectedFormat = 'pdf'"
          >
            <span class="compcard__name">PDF</span>
            <span class="compcard__desc">与预览逐页一致，嵌入字体</span>
          </button>
          <button
            type="button"
            role="radio"
            class="optcard"
            :class="selectedFormat === 'docx' ? 'optcard--on' : ''"
            :aria-checked="selectedFormat === 'docx'"
            data-testid="rc-export-docx"
            @click="selectedFormat = 'docx'"
          >
            <span class="compcard__name">Word（.docx）</span>
            <span class="compcard__desc">可在 Word 里继续修改，排版由 Word 重排</span>
          </button>
        </div>
        <div class="dialog__foot">
          <div class="dialog__foot-meta">
            {{ selectedFormat === null ? '先选一种格式' : `已选：${selectedFormat === 'pdf' ? 'PDF' : 'Word'}` }}
          </div>
          <div class="dialog__actions">
            <RcButton variant="ghost" @click="showFormat = false">取消</RcButton>
            <RcButton
              variant="primary"
              :disabled="selectedFormat === null"
              :disabled-reason="selectedFormat === null ? '先选一种格式' : ''"
              data-testid="rc-confirm-format"
              @click="selectedFormat && confirmFormat(selectedFormat)"
            >
              下一步
            </RcButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 质量关卡 -->
    <div v-if="showChecks" class="scrim" @click.self="showChecks = false">
      <div
        class="dialog dialog--md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rc-check-title"
      >
        <div class="dialog__head">
          <span id="rc-check-title" class="dialog__title">导出前检查</span>
          <span class="dialog__sub">
            阻断 {{ store.qualityReport.blocking.length }} 项 · 警告
            {{ store.qualityReport.warnings.length }} 项
          </span>
        </div>
        <div class="dialog__body">
          <p
            v-for="(issue, index) in store.qualityReport.blocking"
            :key="`b-${index}`"
            class="checkitem"
            data-testid="rc-check-blocking"
          >
            <RcIcon name="alert-circle" :size="14" />
            <span>{{ issue.cause }}</span>
          </p>
          <p v-if="store.qualityReport.blocking.length === 0" class="checkitem">
            <RcIcon name="check-circle" :size="14" />
            <span>没有阻断项，可以放心导出。</span>
          </p>
        </div>
        <div class="dialog__foot">
          <div class="dialog__foot-meta">阻断项会被裁切，导出前请确认</div>
          <div class="dialog__actions">
            <RcButton variant="ghost" @click="showChecks = false">返回修改</RcButton>
            <RcButton
              v-if="store.qualityReport.blocking.length > 0"
              variant="primary"
              :disabled="exporting"
              :disabled-reason="exporting ? '正在导出…' : ''"
              data-testid="rc-force-export"
              @click="runExport(pendingFormat, true)"
            >
              仍要导出
            </RcButton>
            <RcButton
              v-else
              variant="primary"
              :disabled="exporting"
              :disabled-reason="exporting ? '正在导出…' : ''"
              @click="runExport(pendingFormat, false)"
            >
              导出
            </RcButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
