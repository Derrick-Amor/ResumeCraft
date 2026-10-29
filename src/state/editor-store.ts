/**
 * 编辑器状态（Pinia，store id `editor`）—— 全项目唯一的文档状态源
 *
 * 四条不变量（契约 §10「MVP-9 UI 接线约定」）：
 *  1. **UI 只读 schema、只发命令、只渲染 LayoutResult**。文档只经 `commit()` 改动，
 *     UI 直接改 `store.doc` 会让撤销栈与磁盘副本同时失真。
 *  2. **画布坐标只来自 `layout.boxes`**；`zoom` 只影响预览变换，不改文档尺寸。
 *  3. **图层选中 / 锁定属 UI 态**，不进文档模型（所以这里没有 locked 字段）。
 *  4. 撤销用前后快照（`model/undo.ts`），因此**绝不允许原地改文档对象**：
 *     所有动作都是「克隆 → 改副本 → commit」。
 *
 * 两处刻意的工程选择（别顺手改回去）：
 *  - `doc` 用 `shallowRef` 而不是 `ref`：`ref` 会把文档包成响应式 Proxy，而
 *    `cloneDocument()` 走 `structuredClone`，**Proxy 不可克隆**（DataCloneError）。
 *    本模块每次提交都整份替换文档，浅层引用足够触发重渲染。
 *  - `UndoStack` 不是响应式的：`canUndo / undoLabel` 等 computed 通过读取 `revision`
 *    建立依赖，靠每次提交自增的 `revision` 触发重算。
 *
 * 自动保存**不清空撤销历史**（对 FR-DOC-004 的裁决）：autosave 是背景镜像，不是保存点；
 * 清历史只发生在 `newDocument` / `boot` 恢复旧文档这两种"换文件"的场合。
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { BASIC_INFO } from '../components/definitions'
import { defaultFields } from '../components/registry'
import { componentRegistry } from '../components/runtime'
import { composeLayout } from '../layout/compose'
import type { Measurer } from '../layout/compose'
import { ensureResumeFontsLoaded } from '../layout/fonts-ready'
import type { ResumeFontReadiness } from '../layout/fonts-ready'
import { createDefaultBackend, createMeasurer } from '../layout/measure'
import { summarizeWarnings } from '../layout/report'
import type { LayoutResult } from '../layout/types'
import { createComponent, createDocument, sortComponents } from '../model/factory'
import { cloneDocument, serialize } from '../model/serialize'
import { UndoStack } from '../model/undo'
import type { AnyComponent, PageSettings, ResumeComponent, ResumeDocument } from '../model/types'
import { runQualityChecks } from '../quality'
import type { QualityReport } from '../quality'
import { applyTemplate as applyTemplateToDocument } from '../template/apply'
import { getTemplate } from '../template/registry'
import { ensureBuiltinTemplates } from '../template/runtime'
import type { MappingReport } from '../template/schema'
import { createEditorPersistence } from './persistence'
import type { EditorPersistence, StorageKind } from './persistence'

/** 保存状态。与 AutosaveController 的状态机同构，UI 直接按它换文案与色调。 */
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/** 新建文档的三种入口 */
export type NewDocumentKind = 'blank' | 'template' | 'board'

/**
 * 屏幕态。**不进文档模型**（契约 §10.4：选中/锁定这类 UI 态不落盘），
 * 所以它只是 store 里的一个 ref，serialize 里永远不会有它。
 *   workbench  产品入口屏（05）：新建 / 导入 / 选模板
 *   templates  模板库整屏（02）：选中 ≠ 应用，底部动作条确认
 *   editor     主编辑器（01）
 */
export type EditorScreen = 'workbench' | 'templates' | 'editor'

/** 画布默认缩放：与 `--rc-layout-zoom-default` 同值（794×1123 整页可见） */
export const DEFAULT_ZOOM = 0.6
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2

/** 未指定模板时新建用的默认模板 */
export const DEFAULT_TEMPLATE_ID = 'zh-general-001'

/**
 * 模板槽位名 → 组件注册表真实类型。
 * 与 `src/template/apply.ts` 的 `SLOT_ALIASES` 同源；那边还没导出这个映射，
 * 先各留一份，E 段统一导出后删掉这份副本（改一处必须两边一起改）。
 */
const SLOT_TO_TYPE: Record<string, string> = {
  work: 'experience',
  project: 'projects',
  custom: 'awards',
}

function canonicalType(slot: string): string {
  return SLOT_TO_TYPE[slot] ?? slot
}

/** 比较内容时顶替 `meta.updatedAt` 的哨兵值：只要求两边一致 */
const UPDATED_AT_SENTINEL = ' content-key '

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

/**
 * 内容指纹：忽略 `meta.updatedAt` 的序列化结果。
 * 为什么不用 `documentsEqual`：它把 updatedAt 算进去，于是「同一毫秒内的第二步编辑」
 * 会被判成"没变"而静默丢弃；反之内容没变但时间戳变了又会被当成新改动入栈。
 */
function contentKey(document: ResumeDocument): string {
  return serialize({ ...document, meta: { ...document.meta, updatedAt: UPDATED_AT_SENTINEL } })
}

function isKnownComponent(component: AnyComponent): component is ResumeComponent {
  return !('unknown' in component) || component.unknown !== true
}

/** 把 order 重排成 0..n-1，保证「文档内顺序」只有一个表示法 */
function renumber(components: AnyComponent[]): void {
  components.forEach((component, index) => {
    component.order = index
  })
}

/**
 * 可读性下限（07 弹窗 floorhint 的硬约束）：正文 10pt / 行距 1.40 倍。
 * 低于下限的样式值在写入前就被丢掉，不允许"先压下去再说"。
 */
export const MIN_BODY_FONT_SIZE_PT = 10
export const MIN_LINE_HEIGHT = 1.4

/** 丢掉低于可读下限的键；其余键原样保留（不 clamp 其它属性） */
function clampStylePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'fontSizePt' && typeof value === 'number' && value < MIN_BODY_FONT_SIZE_PT) continue
    if (key === 'lineHeight' && typeof value === 'number' && value < MIN_LINE_HEIGHT) continue
    out[key] = value
  }
  return out
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index])
  }
  return false
}

/** 空白文档：一个空的「基本信息」，其余留给用户点选 */
export function createBlankDocument(now: string): ResumeDocument {
  const draft = createDocument({ now, title: '未命名简历' })
  draft.components = [
    createComponent({
      type: BASIC_INFO.type,
      order: 0,
      fields: defaultFields(BASIC_INFO, draft.languageTrack),
    }),
  ]
  return draft
}

export const useEditorStore = defineStore('editor', () => {
  // 模板与组件注册是纯内存操作且幂等；store 一建好就必须能列出模板与字段
  ensureBuiltinTemplates()

  const doc = shallowRef<ResumeDocument>(createBlankDocument(new Date().toISOString()))
  // 换文件（新建 / 恢复）时用 clear() 复位，不重新赋值，所以是 const
  const stack = new UndoStack(doc.value)

  const selectedId = ref<string | null>(null)
  const zoom = ref<number>(DEFAULT_ZOOM)
  const screen = ref<EditorScreen>('workbench')
  /** 当前已应用的模板 id（UI 态，不进文档模型：契约类型里没有 templateId 字段） */
  const appliedTemplateId = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('idle')
  const saveError = ref<string | null>(null)
  const storageKind = ref<StorageKind | 'unknown'>('unknown')
  const revision = ref(0)
  const boardMode = ref(false)
  const fontReadiness = ref<ResumeFontReadiness | null>(null)
  const measurerRef = shallowRef<Measurer | null>(null)

  let persistence: EditorPersistence | null = null

  // ------------------------------- 派生状态 -------------------------------

  const layout = computed<LayoutResult>(() => {
    // 依赖 measurerRef：字体就绪后 boot() 换新测量器，这里必须跟着重算
    const measurer = measurerRef.value
    return composeLayout(doc.value, measurer === null ? {} : { measurer })
  })

  const components = computed<AnyComponent[]>(() => sortComponents(doc.value.components))

  const selectedComponent = computed<AnyComponent | null>(
    () => components.value.find((component) => component.id === selectedId.value) ?? null,
  )

  /**
   * 撤销栈的可观测投影。`revision` 在这里被读进返回值，用来建立 computed 依赖 ——
   * UndoStack 自身不是响应式的，没有这一步按钮的禁用态永远不更新。
   */
  const historyState = computed(() => {
    const tick = revision.value
    return {
      tick,
      canUndo: stack.canUndo(),
      canRedo: stack.canRedo(),
      undoLabel: stack.peekUndoLabel(),
      redoLabel: stack.peekRedoLabel(),
    }
  })

  const canUndo = computed(() => historyState.value.canUndo)
  const canRedo = computed(() => historyState.value.canRedo)
  const undoLabel = computed(() => historyState.value.undoLabel)
  const redoLabel = computed(() => historyState.value.redoLabel)

  const pageCount = computed(() => layout.value.pages.length)

  const warningSummary = computed(() => summarizeWarnings(layout.value.warnings))

  const qualityReport = computed<QualityReport>(() =>
    runQualityChecks({ doc: doc.value, layout: layout.value }),
  )

  /** 存储降级文案。`storageKind === 'memory'` 时非空，UI 必须展示（不谎报"已保存"）。 */
  const storageNotice = computed<string | null>(() =>
    storageKind.value === 'memory'
      ? '本地存储不可用，改动仅保存在内存中，刷新或关闭标签页会丢失。请用「导出备份」保存到文件。'
      : null,
  )

  // ------------------------------- 内部工具 -------------------------------

  /** 换文档：清失效选中、自增 revision、登记自动保存 */
  function adopt(next: ResumeDocument): void {
    doc.value = next
    revision.value += 1
    if (selectedId.value !== null && !next.components.some((c) => c.id === selectedId.value)) {
      selectedId.value = null
    }
    persistence?.controller.schedule(next)
  }

  /**
   * 唯一改文档入口。
   * @returns 是否真的产生了改动（空操作不入栈、不自增 revision、不排保存）
   */
  function commit(next: ResumeDocument, label: string, mergeKey?: string): boolean {
    if (contentKey(doc.value) === contentKey(next)) return false

    // updatedAt 只表达「内容变了」，所以先判等再打时间戳
    next.meta.updatedAt = new Date().toISOString()
    stack.push(next, mergeKey === undefined ? { label } : { label, mergeKey })
    adopt(stack.current)
    return true
  }

  /** 克隆当前文档并施加改动；fn 返回 false 表示放弃这一步 */
  function mutate(
    label: string,
    fn: (draft: ResumeDocument) => boolean,
    mergeKey?: string,
  ): boolean {
    const draft = cloneDocument(doc.value)
    if (!fn(draft)) return false
    return commit(draft, label, mergeKey)
  }

  function fieldLabelOf(type: string, key: string): string {
    const track = doc.value.languageTrack
    const spec = componentRegistry.fieldsFor(type, track).find((f) => f.key === key)
    if (spec === undefined) return key
    return spec.labelByTrack?.[track] ?? spec.label
  }

  function displayNameOf(type: string): string {
    return componentRegistry.get(type)?.displayName ?? type
  }

  /** AutosaveController 的状态回调 → store 的两个字段 */
  function handleAutosaveStatus(info: {
    status: SaveStatus
    lastError: { message: string } | null
  }): void {
    saveStatus.value = info.status
    saveError.value = info.lastError === null ? null : info.lastError.message
  }

  // ------------------------------- 文档动作 -------------------------------

  /**
   * 新建文档。
   * - `blank`：一个空 basics
   * - `template`：按模板 componentOrder 造齐组件后走 applyTemplate（未指定则用默认模板）
   * - `board`：同 blank，另置 boardMode（UI 态，不进文档）
   * 三种都**清空撤销历史**：换了文件，历史没有意义。
   */
  function newDocument(kind: NewDocumentKind, templateId?: string): void {
    ensureBuiltinTemplates()
    const now = new Date().toISOString()

    let next: ResumeDocument
    if (kind === 'template') {
      const wantedId = templateId ?? DEFAULT_TEMPLATE_ID
      const template = getTemplate(wantedId)
      if (template === undefined) {
        console.warn(`模板「${wantedId}」未注册，改为新建空白文档`)
        next = createBlankDocument(now)
      } else {
        const draft = createDocument({
          now,
          title: '未命名简历',
          languageTrack: template.languageTrack,
        })
        const created: AnyComponent[] = []
        for (const slot of template.componentOrder) {
          const type = canonicalType(slot)
          const definition = componentRegistry.get(type)
          // 模板槽位里可能有本运行时没有的组件类型：跳过，不让它变成未知组件
          if (definition === undefined) continue
          created.push(
            createComponent({
              type,
              order: created.length,
              fields: defaultFields(definition, template.languageTrack),
            }),
          )
        }
        draft.components = created
        next = applyTemplateToDocument(draft, wantedId).doc
      }
    } else {
      next = createBlankDocument(now)
    }

    boardMode.value = kind === 'board'
    selectedId.value = null
    // 只有"按模板新建"才算应用了模板；空白/画板没有模板语义
    appliedTemplateId.value = kind === 'template' ? (templateId ?? DEFAULT_TEMPLATE_ID) : null
    stack.clear(next)
    adopt(next)
  }

  /** 追加组件到末尾并选中。未登记的类型直接拒绝（不让 UI 造出渲染不了的组件）。 */
  function addComponent(type: string): string | null {
    const definition = componentRegistry.get(type)
    if (definition === undefined) return null

    const draft = cloneDocument(doc.value)
    const component = createComponent({
      type,
      order: 0,
      fields: defaultFields(definition, draft.languageTrack),
    })
    const list = sortComponents(draft.components)
    list.push(component)
    draft.components = list
    renumber(draft.components)

    commit(draft, `添加「${definition.displayName}」`)
    selectedId.value = component.id
    return component.id
  }

  /**
   * 导入识别结果（[数据丢失风险] 数据落盘）。**一次 commit**：整批进 undo 栈，一步回退。
   * 顺序接在现有组件之后（调用方也可以传 orderStart 由 bridge 预排好，这里再编号兜底）。
   */
  function importComponents(components: readonly AnyComponent[]): void {
    if (components.length === 0) return
    mutate('导入识别结果', (draft) => {
      const base = draft.components.length
      const incoming = components.map((component, index) => ({
        ...component,
        order: base + index,
      }))
      draft.components = sortComponents([...draft.components, ...incoming])
      renumber(draft.components)
      return true
    })
  }

  function removeComponent(id: string): void {
    const target = doc.value.components.find((c) => c.id === id)
    if (target === undefined) return

    mutate(`删除「${displayNameOf(target.type)}」`, (draft) => {
      draft.components = sortComponents(draft.components).filter((c) => c.id !== id)
      renumber(draft.components)
      return true
    })
  }

  /** 改字段。同一组件同一字段的连续输入在 800ms 窗口内合并成一步撤销。 */
  function updateField(id: string, key: string, value: unknown): void {
    const target = doc.value.components.find((c) => c.id === id)
    if (target === undefined || !isKnownComponent(target)) return
    if (sameValue(target.fields[key], value)) return

    mutate(
      `修改「${fieldLabelOf(target.type, key)}」`,
      (draft) => {
        const component = draft.components.find((c) => c.id === id)
        if (component === undefined || !isKnownComponent(component)) return false
        component.fields = { ...component.fields, [key]: value }
        return true
      },
      `${id}:${key}`,
    )
  }

  /**
   * 改组件级样式（L1/L2）。合并键取第一个键：一次拖动只改一个属性。
   *
   * 压缩下限在这里真的拦：正文 10pt / 行距 1.40 倍（与 07 弹窗 floorhint 的文案一致）。
   * 低于下限的值**不写入**——"默默压到 9pt"会让版面变糊，还骗用户说"已优化"。
   */
  function updateComponentStyle(id: string, patch: Record<string, unknown>): void {
    const target = doc.value.components.find((c) => c.id === id)
    if (target === undefined || !isKnownComponent(target)) return

    const safe = clampStylePatch(patch)
    const keys = Object.keys(safe)
    if (!keys.some((key) => !sameValue(target.style?.[key], safe[key]))) return

    const firstKey = keys[0]
    mutate(
      '修改组件样式',
      (draft) => {
        const component = draft.components.find((c) => c.id === id)
        if (component === undefined || !isKnownComponent(component)) return false
        component.style = { ...(component.style ?? {}), ...safe }
        return true
      },
      firstKey === undefined ? undefined : `${id}:${firstKey}`,
    )
  }

  /**
   * 批量改样式（"压缩本页全部"这类一次要动 N 个组件的动作）。
   * 与 `updateComponentStyle` 走同一条 commit 路径（同样过 clamp、同样进 undo 栈），
   * 但**只入一步 undo**：拆成 N 次调用会得到 N 个撤销步，用户得点 N 次才能回退。
   */
  function updateComponentStyles(
    entries: ReadonlyArray<{ id: string; patch: Record<string, unknown> }>,
  ): void {
    const changes: Array<{ id: string; patch: Record<string, unknown> }> = []
    for (const entry of entries) {
      const target = doc.value.components.find((c) => c.id === entry.id)
      if (target === undefined || !isKnownComponent(target)) continue
      const safe = clampStylePatch(entry.patch)
      if (Object.keys(safe).length === 0) continue
      if (!Object.keys(safe).some((key) => !sameValue(target.style?.[key], safe[key]))) continue
      changes.push({ id: entry.id, patch: safe })
    }
    if (changes.length === 0) return

    mutate('压缩样式', (draft) => {
      for (const change of changes) {
        const component = draft.components.find((c) => c.id === change.id)
        if (component === undefined || !isKnownComponent(component)) continue
        component.style = { ...(component.style ?? {}), ...change.patch }
      }
      return true
    })
  }

  /**
   * 压缩该组件（07 弹窗选项一）：行距 1.55 → 1.45，字号不动。
   * 走 updateComponentStyle → undo 栈，一步可退。
   */
  function compressComponent(id: string): void {
    updateComponentStyle(id, { lineHeight: 1.45 })
  }

  /**
   * 压缩本页全部内容组件（07 弹窗选项二）：行距 1.40 + 字号 10pt。
   * 批量动作只入**一步** undo：用户点一次撤销就要整页回退。
   */
  function compressPage(pageIndex: number): void {
    const ids = new Set<string>()
    for (const box of layout.value.boxes) {
      if (box.pageIndex === pageIndex) ids.add(box.componentId)
    }
    updateComponentStyles(
      [...ids].map((id) => ({ id, patch: { lineHeight: 1.4, fontSizePt: 10 } })),
    )
  }

  /**
   * 移到指定位置（拖拽排序的落点语义）。
   * `toIndex` 是**最终位置**，越界夹到合法区间；原地不动是空操作。
   *
   * 为什么拖拽必须用它而不是 moveComponent：拖放的落点是"第几行"，不是"移几格"——
   * 跨 5 行的拖动用 direction 表达就得循环 5 次、产生 5 个 undo 步，撤销体验完全不对。
   */
  function moveComponentTo(id: string, toIndex: number): boolean {
    const ordered = sortComponents(doc.value.components)
    const from = ordered.findIndex((c) => c.id === id)
    if (from === -1) return false
    const to = Math.min(Math.max(0, Math.trunc(toIndex)), ordered.length - 1)
    if (to === from) return false

    return mutate('调整组件顺序', (draft) => {
      const list = sortComponents(draft.components)
      const current = list.findIndex((c) => c.id === id)
      if (current === -1) return false
      const [moved] = list.splice(current, 1)
      if (moved === undefined) return false
      list.splice(to, 0, moved)
      draft.components = list
      renumber(draft.components)
      return true
    })
  }

  /** 与相邻组件交换位置（键盘 / 上移下移按钮）。direction -1 上移、1 下移；到头了是空操作。 */
  function moveComponent(id: string, direction: -1 | 1): void {
    const ordered = sortComponents(doc.value.components)
    const from = ordered.findIndex((c) => c.id === id)
    if (from === -1) return
    moveComponentTo(id, from + direction)
  }

  function toggleVisible(id: string): void {
    const target = doc.value.components.find((c) => c.id === id)
    if (target === undefined) return
    const willShow = !target.visible

    mutate(willShow ? '显示组件' : '隐藏组件', (draft) => {
      const component = draft.components.find((c) => c.id === id)
      if (component === undefined) return false
      component.visible = willShow
      return true
    })
  }

  function renameDoc(title: string): void {
    const trimmed = title.trim()
    if (trimmed === '' || trimmed === doc.value.meta.title) return

    mutate(
      '重命名简历',
      (draft) => {
        draft.meta.title = trimmed
        return true
      },
      'meta:title',
    )
  }

  function setPageSettings(patch: Partial<PageSettings>): void {
    const draft = cloneDocument(doc.value)
    const before = draft.pageSettings
    const merged: PageSettings = { ...before, ...patch }
    const changed = (Object.keys(merged) as Array<keyof PageSettings>).some(
      (key) => merged[key] !== before[key],
    )
    if (!changed) return
    draft.pageSettings = merged
    commit(draft, '修改页面设置')
  }

  /**
   * 应用模板（单步可撤销）。返回映射报告，未注册模板返回 null 并告警（不抛）。
   * 切模板是一次整体决策，不该按组件拆成十几步撤销。
   */
  function applyTemplateById(templateId: string): MappingReport | null {
    ensureBuiltinTemplates()
    const template = getTemplate(templateId)
    if (template === undefined) {
      console.warn(`模板「${templateId}」未注册，忽略本次应用`)
      return null
    }

    const result = applyTemplateToDocument(doc.value, templateId)
    if (commit(result.doc, `应用模板「${templateId}」`)) appliedTemplateId.value = templateId
    return result.mappingReport
  }

  function selectComponent(id: string | null): void {
    selectedId.value = id
  }

  /** 切屏。只换 UI 形态，不动文档 —— 文档切走前已经由 autosave 排队保存 */
  function setScreen(next: EditorScreen): void {
    screen.value = next
  }

  function setZoom(value: number): void {
    zoom.value = clampZoom(value)
  }

  function undo(): void {
    const previous = stack.undo()
    if (previous === null) return
    // 快照与当前文档之间不允许共享引用：克隆一份交给 UI，后续任何原地改写都伤不到历史
    adopt(cloneDocument(previous))
  }

  function redo(): void {
    const next = stack.redo()
    if (next === null) return
    adopt(cloneDocument(next))
  }

  // ------------------------------- 生命周期 -------------------------------

  /** 立即落盘并等待收敛（手动保存 / 离开页面前） */
  async function flushSave(): Promise<void> {
    if (persistence === null) return
    const info = await persistence.controller.flush()
    handleAutosaveStatus(info)
  }

  /**
   * 启动：装配持久化 → 尝试恢复上次编辑 → 等待字体 → 换测量器重排。
   *
   * 恢复的是**最近一份文档**（list 已按 updatedAt 倒序）。字体这一步无论成败都要换测量器：
   * 字体变了行宽就变，旧测量器的缓存必须丢掉，否则整份分页沿用回退字体的结果。
   */
  async function boot(): Promise<void> {
    ensureBuiltinTemplates()

    if (persistence === null) {
      persistence = createEditorPersistence({ onStatus: handleAutosaveStatus })
      storageKind.value = persistence.kind
    }

    const restored = await persistence.restoreLatest()
    if (restored !== null) {
      // 恢复旧文档 = 换文件：历史清空（FR-DOC-004 只对"打开"与显式保存点成立）
      stack.clear(restored)
      adopt(restored)
      selectedId.value = null
    }

    // 恢复到已保存文档 → 直接进编辑器；没有文档 → 进工作台（产品入口屏）
    screen.value = restored !== null ? 'editor' : 'workbench'

    fontReadiness.value = await ensureResumeFontsLoaded()
    measurerRef.value = createMeasurer(createDefaultBackend()).measure
    revision.value += 1
  }

  return {
    // 状态
    doc,
    selectedId,
    zoom,
    screen,
    appliedTemplateId,
    saveStatus,
    saveError,
    storageKind,
    revision,
    boardMode,
    fontReadiness,

    // 派生
    layout,
    components,
    selectedComponent,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    pageCount,
    warningSummary,
    qualityReport,
    storageNotice,

    // 动作
    newDocument,
    addComponent,
    importComponents,
    removeComponent,
    updateField,
    updateComponentStyle,
    updateComponentStyles,
    compressComponent,
    compressPage,
    moveComponent,
    moveComponentTo,
    toggleVisible,
    renameDoc,
    setPageSettings,
    applyTemplateById,
    selectComponent,
    setScreen,
    setZoom,
    undo,
    redo,
    flushSave,
    boot,
  }
})
