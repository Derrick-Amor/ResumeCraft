<script setup lang="ts">
/**
 * 画布（D 段几何 + E 段纸面结构）—— `.canvas` 结构照 01-editor.html
 *
 * 职责边界：
 *   几何（页 → `.paper-slot > .paper`，组件 → `.p-piece` 绝对定位 mm）在这里；
 *   排版语义（谁是小节标题、日期怎么并、字段怎么归行）在 `text-runs`。
 *
 * 仍然**不做**的三件事：
 *   1. 不读 `component.type` 拼 `.p-header` / `.p-sec__title`
 *   2. 不从 fields 取 start/end 拼日期（trailing 由 text-runs 给）
 *   3. 不拿 displayName 当小节标题（section run 由 text-runs 给）
 *   E 段已把 text-runs 升级成八角色，本文件只做「角色 → 设计稿类名」的机械映射。
 *
 * 缩放：`--rc-zoom` 只在预览层生效（契约 §10.2），文档尺寸与 boxes 一律不动。
 */
import { computed, nextTick, ref } from 'vue'

import { componentRegistry } from '../../components/runtime'
import { documentTextBlocks } from '../../layout/text-runs'
import type { ComponentTextBlock } from '../../layout/text-runs'
import type { TextRunSpec } from '../../layout/text-runs'
import { mmToPx } from '../../layout/units'
import { useEditorStore } from '../../state/editor-store'
import { RcIcon } from '../controls'

const store = useEditorStore()

const emit = defineEmits<{ openOverflow: [] }>()

/* ---- 文件名（重命名）：Amor 要求放在画布条居中（原在顶栏 docmeta）---- */
const editing = ref(false)
const titleDraft = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

async function startTitleEdit(): Promise<void> {
  titleDraft.value = store.doc.meta.title
  editing.value = true
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}

function commitTitle(): void {
  if (!editing.value) return
  editing.value = false
  store.renameDoc(titleDraft.value)
}

function cancelTitle(): void {
  editing.value = false
  titleDraft.value = store.doc.meta.title
}

/**
 * 每页的溢出数（`overflow-page` / `overflow-component` 两类警告）。
 * 行级标注（`.is-over` / `.p-ovf__tag`）用 `LayoutWarning.overLines` ——
 * 契约里**只有 overflow-page 填**它（分页续排是续排不是溢出，不标红）。
 */
const overflowByPage = computed(() => {
  const map = new Map<number, number>()
  for (const warning of store.layout.warnings) {
    if (warning.type !== 'overflow-page' && warning.type !== 'overflow-component') continue
    map.set(warning.pageIndex, (map.get(warning.pageIndex) ?? 0) + 1)
  }
  return map
})

/** 组件 → 被裁文本行（只来自 overflow-page 警告的 overLines） */
const overLinesByComponent = computed(() => {
  const map = new Map<string, string[]>()
  for (const warning of store.layout.warnings) {
    if (warning.type !== 'overflow-page' || warning.componentId === undefined) continue
    if (warning.overLines === undefined) continue
    map.set(warning.componentId, warning.overLines)
  }
  return map
})

/** 该行是否被裁（逐字比较 run.text 原文） */
function isOverLine(componentId: string, text: string): boolean {
  return (overLinesByComponent.value.get(componentId) ?? []).includes(text)
}

/** 被裁行数（`.p-ovf__tag` 的 N）；0 表示这个组件没有行级标注 */
function overCount(componentId: string): number {
  return overLinesByComponent.value.get(componentId)?.length ?? 0
}

/** 「超出 N 行」标签只挂在第一条被裁行上，避免每行重复 */
function isFirstOverLine(componentId: string, text: string): boolean {
  return overLinesByComponent.value.get(componentId)?.[0] === text
}

/** 08 浮层的逐条清单（组件级：页码 / 名称 / 原因 / 被裁行数） */
const overflowDetails = computed(() =>
  store.layout.warnings
    .filter((w) => w.type === 'overflow-page' || w.type === 'overflow-component')
    .map((w) => {
      const component = store.doc.components.find((c) => c.id === w.componentId)
      const name =
        component === undefined
          ? '未知组件'
          : (componentRegistry.get(component.type)?.displayName ?? component.type)
      return {
        key: `${w.componentId}-${w.pageIndex}-${w.type}`,
        pageIndex: w.pageIndex,
        componentId: w.componentId ?? '',
        name,
        cause: w.cause,
        // 有 overLines 才报「超出 N 行」；拿不到行数就不编数字
        badge: w.overLines === undefined ? null : `超出 ${w.overLines.length} 行`,
      }
    }),
)

/** 08 浮层开关（贴纸面右上，见 app.css 的 .popover 定位） */
const popoverOpen = ref(false)

const zoom = computed(() => store.zoom)

/** 每页的像素尺寸：`--rc-paper-w` 是 A4 纵向基准，横版必须按 page 实际 mm 算 */
function paperSize(pageWidthMm: number, pageHeightMm: number): { w: number; h: number } {
  return { w: mmToPx(pageWidthMm), h: mmToPx(pageHeightMm) }
}

/**
 * 跨页偏移：同一组件在更早片段里的高度之和（mm）。
 * 外层 `.p-piece` 的 overflow:hidden 负责裁切，内层用 translateY 把上半段移出可视区。
 */
const fragmentOffsetMm = computed(() => {
  const used = new Map<string, number>()
  const offsets = new Map<string, number>()
  for (const box of store.layout.boxes) {
    const key = `${box.componentId}#${box.fragmentIndex}`
    offsets.set(key, used.get(box.componentId) ?? 0)
    used.set(box.componentId, (used.get(box.componentId) ?? 0) + box.height)
  }
  return offsets
})

/**
 * 组件 id → 文本块。一次提取，供所有 box 复用（同组件可能有多片）。
 *
 * 必须走 `documentTextBlocks`，不能自己对每个组件调 `componentTextBlock`：
 * 小节标题的归属（同类型连续组件只给首个 emitSection）只在 documentTextBlocks 里判一次，
 * UI 自己调会漏掉这个标志 —— 结果是 `.p-sec__title` 一条都渲染不出来（QA 的 G2）。
 * 它已经按 order 排序并过滤 visible，这里不再判一次。
 */
const textBlocks = computed(() => {
  const map = new Map<string, ComponentTextBlock>()
  for (const block of documentTextBlocks(store.doc)) {
    map.set(block.componentId, block)
  }
  return map
})

function runsOf(componentId: string) {
  return textBlocks.value.get(componentId)?.runs ?? []
}

function offsetOf(componentId: string, fragmentIndex: number): number {
  return fragmentOffsetMm.value.get(`${componentId}#${fragmentIndex}`) ?? 0
}

interface PaperPiece {
  box: { componentId: string; fragmentIndex: number; x: number; y: number; width: number; height: number }
  entry: PaperEntry
  offsetMm: number
}

/** 某一页上的全部纸面片段（几何 + 排版语义一次取齐，模板里不再重复算 entryOf） */
function piecesOn(pageIndex: number): PaperPiece[] {
  return store.layout.boxes
    .filter((box) => box.pageIndex === pageIndex)
    .map((box) => ({
      box,
      entry: entryOf(box.componentId),
      offsetMm: offsetOf(box.componentId, box.fragmentIndex),
    }))
}

/**
 * 纸面结构单元：只由 run 的 role 决定，**不由组件 type 决定**。
 *
 * E 段升级后 text-runs 已产出八角色（section / item-title / item-role / …），
 * 这里只做「角色 → 设计稿类名」的机械映射：
 *   name      → .p-name       intent   → .p-intent    contact → .p-contact
 *   section   → .p-sec__title item-title → .p-item__head > .p-item__name (+ .p-item__date)
 *   item-role → .p-item__role plain    → .p-plain     bullet  → .p-bullets > li
 *
 * 仍然禁止在这里读 `component.type` / `displayName`：语义在 text-runs，
 * 这里只认 role。这样 E 段之后永远不需要"删一段现存逻辑"。
 */
interface PaperEntry {
  section?: TextRunSpec
  name?: TextRunSpec
  intent?: TextRunSpec
  contacts: TextRunSpec[]
  title?: TextRunSpec
  role?: TextRunSpec
  plain?: TextRunSpec
  bullets: string[]
}

function entryOf(componentId: string): PaperEntry {
  const entry: PaperEntry = { contacts: [], bullets: [] }
  for (const run of runsOf(componentId)) {
    switch (run.role) {
      case 'section':
        entry.section = run
        break
      case 'name':
        entry.name = run
        break
      case 'intent':
        entry.intent = run
        break
      case 'contact':
        entry.contacts.push(run)
        break
      case 'item-title':
        entry.title = run
        break
      case 'item-role':
        entry.role = run
        break
      case 'plain':
        entry.plain = run
        break
      case 'bullet':
        entry.bullets.push(run.text)
        break
    }
  }
  return entry
}

/** 抬头组件（.p-header）：有 name 或 contact 时按抬头渲染 */
function isHeaderEntry(entry: PaperEntry): boolean {
  return entry.name !== undefined || entry.contacts.length > 0
}

function lineStyle(item: {
  fontSizePt: number
  lineHeight: number
  bold?: boolean
  text?: string
  trailing?: string
}) {
  return {
    fontSize: `${item.fontSizePt}pt`,
    lineHeight: item.lineHeight,
    // 设计稿的加粗档是 600（.p-name / .p-item__name / .p-sec__title 都写死 600）；
    // 内联只表达"是否加粗"，具体字重跟着设计稿档位走，不用 700 盖掉它
    fontWeight: item.bold === true ? 600 : 400,
    margin: 0,
  }
}

/**
 * 两个自定义 MIME：拖入添加与拖动排序分开，避免组件卡掉进图层排序、图层行落进纸面变成"新增"。
 * 用原生 HTML5 DnD（不引拖拽库）；指示线用内联样式 + var(--rc-accent)，不新增 CSS 类。
 */
const CARD_MIME = 'application/x-rc-component'
const LAYER_MIME = 'application/x-rc-layer'

/** 纸面接受"拖入添加"：只有携带组件卡 MIME 时才成为 drop 目标 */
function onPaperDragOver(event: DragEvent): void {
  const dt = event.dataTransfer
  if (dt !== null && dt.types.includes(CARD_MIME)) event.preventDefault()
}

function onPaperDrop(event: DragEvent): void {
  const type = event.dataTransfer?.getData(CARD_MIME) ?? ''
  if (type === '') return
  event.preventDefault()
  store.addComponent(type)
}

/** 纸面片段可拖去排序（与图层树同一套语义，落到 moveComponentTo） */
function onPieceDragStart(event: DragEvent, componentId: string): void {
  const dt = event.dataTransfer
  if (dt === null) return
  dt.setData(LAYER_MIME, componentId)
  dt.effectAllowed = 'move'
}

function onPieceDragOver(event: DragEvent): void {
  const dt = event.dataTransfer
  if (dt === null || !dt.types.includes(LAYER_MIME)) return
  event.preventDefault()
}

function onPieceDrop(event: DragEvent, targetComponentId: string): void {
  const id = event.dataTransfer?.getData(LAYER_MIME) ?? ''
  if (id === '' || id === targetComponentId) return
  // stopPropagation：否则纸面会把它当成"拖入添加"再插一个组件
  event.preventDefault()
  event.stopPropagation()
  const toIndex = store.components.findIndex((component) => component.id === targetComponentId)
  if (toIndex >= 0) store.moveComponentTo(id, toIndex)
}

const isEmpty = computed(() => store.components.length === 0)

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

function zoomStep(delta: number): void {
  store.setZoom(zoom.value + delta)
}
</script>

<template>
  <main class="canvas" data-testid="rc-canvas">
    <div class="canvas__bar" style="position: relative">
      <div class="canvas__meta">
        <span class="canvas__pageno">第 1 / {{ store.pageCount }} 页</span>
        <span class="canvas__meta-sep"></span>
        <span class="canvas__size">
          {{ store.doc.pageSettings.paper }} · {{ store.doc.pageSettings.widthMm }} ×
          {{ store.doc.pageSettings.heightMm }} mm
        </span>
      </div>

      <!-- 文件名（重命名）：Amor 要求放在画布条头部居中。
           .canvas__bar 是 space-between 三段，居中用绝对定位，不破坏左右两组。 -->
      <div style="position: absolute; left: 50%; transform: translateX(-50%)">
        <input
          v-if="editing"
          ref="titleInput"
          v-model="titleDraft"
          class="docmeta__name"
          data-testid="rc-title-input"
          style="text-align: center; min-width: 160px"
          @blur="commitTitle"
          @keydown.enter.prevent="commitTitle"
          @keydown.esc.prevent="cancelTitle"
        />
        <span
          v-else
          class="docmeta__name"
          title="点击重命名"
          data-testid="rc-title-display"
          style="cursor: text"
          @click="startTitleEdit"
        >
          {{ store.doc.meta.title }}
        </span>
      </div>
      <div class="canvas__tools">
        <div class="canvas__zoom">
          <button
            class="iconbtn iconbtn--sm"
            title="缩小"
            data-testid="rc-zoom-out"
            @click="zoomStep(-0.1)"
          >
            <RcIcon name="minus" :size="12" />
          </button>
          <span class="canvas__pct">{{ zoomPercent }}</span>
          <button
            class="iconbtn iconbtn--sm"
            title="放大"
            data-testid="rc-zoom-in"
            @click="zoomStep(0.1)"
          >
            <RcIcon name="plus" :size="12" />
          </button>
        </div>
        <button
          class="iconbtn iconbtn--sm"
          title="适合页面"
          data-testid="rc-zoom-fit"
          @click="store.setZoom(0.6)"
        >
          <RcIcon name="maximize" :size="14" />
        </button>
      </div>
    </div>

    <div class="canvas__scroll" @click.self="store.selectComponent(null)">
      <div v-if="isEmpty" class="bg-empty">从左侧组件库点选开始搭建</div>

      <div
        v-for="page in store.layout.pages"
        :key="page.pageIndex"
        class="paper-slot"
        :style="{
          width: `${paperSize(page.width, page.height).w * zoom}px`,
          height: `${paperSize(page.width, page.height).h * zoom}px`,
        }"
        :data-testid="`rc-page-${page.pageIndex}`"
      >
        <article
          class="paper"
          :style="{
            width: `${paperSize(page.width, page.height).w}px`,
            height: `${paperSize(page.width, page.height).h}px`,
            transform: `scale(${zoom})`,
          }"
          @click.self="store.selectComponent(null)"
          @dragover="onPaperDragOver"
          @drop="onPaperDrop"
        >
          <div
            v-for="piece in piecesOn(page.pageIndex)"
            :key="`${piece.box.componentId}#${piece.box.fragmentIndex}`"
            class="p-piece"
            :style="{
              left: `${piece.box.x}mm`,
              top: `${piece.box.y}mm`,
              width: `${piece.box.width}mm`,
              height: `${piece.box.height}mm`,
            }"
            :data-testid="`rc-box-${piece.box.componentId}`"
            draggable="true"
            @click.stop="store.selectComponent(piece.box.componentId)"
            @dragstart.stop="onPieceDragStart($event, piece.box.componentId)"
            @dragover.stop="onPieceDragOver"
            @drop.stop="onPieceDrop($event, piece.box.componentId)"
          >
            <div :style="{ transform: `translateY(-${piece.offsetMm}mm)` }">
              <!-- 抬头组件：.p-header / .p-name / .p-intent / .p-contact（照 01-editor.html） -->
              <div v-if="isHeaderEntry(piece.entry)" class="p-header">
                <div class="p-header__main">
                  <h1
                    v-if="piece.entry.name"
                    class="p-name"
                    :style="lineStyle(piece.entry.name)"
                  >
                    {{ piece.entry.name.text }}
                  </h1>
                  <p
                    v-if="piece.entry.intent"
                    class="p-intent"
                    :style="lineStyle(piece.entry.intent)"
                  >
                    {{ piece.entry.intent.text }}
                  </p>
                  <p
                    v-if="piece.entry.plain"
                    class="p-contact"
                    :style="lineStyle(piece.entry.plain)"
                  >
                    {{ piece.entry.plain.text }}
                  </p>
                  <p
                    v-for="(contact, ci) in piece.entry.contacts"
                    :key="ci"
                    class="p-contact"
                    :style="lineStyle(contact)"
                  >
                    {{ contact.text }}
                  </p>
                </div>

                <!-- 照片占位框：设计稿 01-editor.html:162-165。纯视觉占位，不承载用户数据 ——
                     photo 字段的文本仍按 plain run 渲染成一行，一个字都不能丢 -->
                <div class="p-photo">
                  <RcIcon name="user" :size="18" />
                  <span>照片</span>
                </div>
              </div>

              <!-- 内容组件：小节标题 + 单条目（.p-sec 的 margin 由布局 gap 承担，
                   不用 CSS margin —— box 是 overflow:hidden 的绝对定位盒，
                   32px margin-top 会把内容推出盒外被裁掉） -->
              <template v-else>
                <h2
                  v-if="piece.entry.section"
                  class="p-sec__title"
                  :style="lineStyle(piece.entry.section)"
                >
                  {{ piece.entry.section.text }}
                </h2>
                <div
                  v-if="
                    piece.entry.title !== undefined ||
                    piece.entry.role !== undefined ||
                    piece.entry.plain !== undefined ||
                    piece.entry.bullets.length > 0
                  "
                  class="p-item"
                >
                  <div v-if="piece.entry.title" class="p-item__head">
                    <span class="p-item__name" :style="lineStyle(piece.entry.title)">
                      {{ piece.entry.title.text }}
                    </span>
                    <span v-if="piece.entry.title.trailing" class="p-item__date">
                      {{ piece.entry.title.trailing }}
                    </span>
                  </div>
                  <div
                    v-if="piece.entry.role"
                    class="p-item__role"
                    :style="lineStyle(piece.entry.role)"
                  >
                    {{ piece.entry.role.text }}
                  </div>
                  <p
                    v-if="piece.entry.plain"
                    class="p-plain"
                    :class="isOverLine(piece.box.componentId, piece.entry.plain.text) ? 'is-over' : ''"
                    :style="lineStyle(piece.entry.plain)"
                  >
                    {{ piece.entry.plain.text }}
                  </p>
                  <ul
                    v-if="piece.entry.bullets.length > 0"
                    class="p-bullets"
                    :style="
                      lineStyle(
                        piece.entry.plain ??
                          piece.entry.title ??
                          piece.entry.section ?? { fontSizePt: 10.5, lineHeight: 1.62 },
                      )
                    "
                  >
                    <li
                      v-for="(line, liIndex) in piece.entry.bullets"
                      :key="liIndex"
                      :class="isOverLine(piece.box.componentId, line) ? 'is-over' : ''"
                    >
                      {{ line }}
                      <span
                        v-if="isFirstOverLine(piece.box.componentId, line)"
                        class="p-ovf__tag"
                        :data-testid="`rc-ovf-tag-${piece.box.componentId}`"
                      >
                        超出 {{ overCount(piece.box.componentId) }} 行
                      </span>
                    </li>
                  </ul>
                </div>
              </template>
            </div>

            <span
              v-if="piece.box.fragmentIndex > 0"
              class="canvas__meta-sep"
              :data-testid="`rc-continue-${piece.box.componentId}`"
              title="该组件从上一页续排"
            >
              续
            </span>

            <div
              v-if="store.selectedId === piece.box.componentId"
              class="selbox"
              style="inset: -6px -8px"
            >
              <span class="selbox__h selbox__h--tl"></span>
              <span class="selbox__h selbox__h--tc"></span>
              <span class="selbox__h selbox__h--tr"></span>
              <span class="selbox__h selbox__h--ml"></span>
              <span class="selbox__h selbox__h--mr"></span>
              <span class="selbox__h selbox__h--bl"></span>
              <span class="selbox__h selbox__h--bc"></span>
              <span class="selbox__h selbox__h--br"></span>
            </div>
          </div>

          <!-- 溢出标记：可导出区域边界 + 右上角标。有溢出才渲染 -->
          <div v-if="overflowByPage.get(page.pageIndex)" class="p-boundary"></div>
          <button
            v-if="overflowByPage.get(page.pageIndex)"
            type="button"
            class="paper-flag"
            :data-testid="`rc-paper-flag-${page.pageIndex}`"
            :aria-label="`${overflowByPage.get(page.pageIndex)} 处内容溢出，点击查看清单`"
            :title="`${overflowByPage.get(page.pageIndex)} 处内容溢出`"
            @click.stop="popoverOpen = !popoverOpen"
          >
            {{ overflowByPage.get(page.pageIndex) }}
          </button>

          <!-- 08 角标浮层：贴纸面右上（.popover 的 CSS 已定位，不要改成贴按钮） -->
          <div v-if="popoverOpen && overflowDetails.length > 0" class="popover" data-testid="rc-overflow-popover">
            <div class="popover__head">
              <RcIcon name="alert-triangle" :size="14" />
              {{ overflowDetails.length }} 处内容溢出
              <button class="iconbtn iconbtn--sm" title="关闭" @click.stop="popoverOpen = false">
                <RcIcon name="x" :size="12" />
              </button>
            </div>
            <div class="popover__body">
              <div v-for="item in overflowDetails" :key="item.key" class="popover__item">
                <div class="popover__meta">
                  <span class="popover__page">第 {{ item.pageIndex + 1 }} 页</span>
                  <span class="popover__name">{{ item.name }}</span>
                </div>
                <div class="popover__desc">
                  <span>{{ item.cause }}</span>
                </div>
                <div class="popover__meta">
                  <span v-if="item.badge" class="badge badge--danger">{{ item.badge }}</span>
                  <a class="popover__loc" href="#" @click.prevent="store.selectComponent(item.componentId)">
                    定位<RcIcon name="arrow-up-right" :size="12" />
                  </a>
                </div>
              </div>
            </div>
            <div class="popover__foot">
              <button
                class="btn btn--primary"
                style="width: 100%"
                data-testid="rc-overflow-handle"
                @click.stop="popoverOpen = false; emit('openOverflow')"
              >
                <RcIcon name="arrow-down-to-line" :size="14" />逐项处理溢出
              </button>
              <p class="popover__note">自动检查 · 规则更新后重新计数；导出前会再次校验完整性。</p>
            </div>
          </div>

          <div class="paper-foot">{{ page.pageIndex + 1 }} / {{ store.pageCount }}</div>
        </article>
      </div>

      <div v-if="store.pageCount > 1" class="paper-next"></div>
    </div>
  </main>
</template>
