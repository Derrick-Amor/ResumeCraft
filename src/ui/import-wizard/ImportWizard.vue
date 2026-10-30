<!--
  导入确认向导（TC-012 / FR-IMP-006/009）—— 「预览确认」屏照 03-import.html 1:1 重建

  架构约束（D 段决策）：向导在编辑器内以 `.scrim > .dialog` 对话框形态呈现，
  设计稿的整屏 chrome（topbar / sheet / actionbar）不照搬；1:1 指向导内容结构、
  类名与静态文案（本文件所有设计稿类名的规则见 src/design/app.css §12 导入向导）。

  步骤机收敛为设计稿 stepper 的 3 步：选择文件 / 解析中 / 预览确认
  （03-import.html:53-59）。原「逐项确认」独立步骤已删除 —— 设计稿把逐项确认
  融进预览屏：rcard 上的接受 / 修改 / 跳过 + actionbar 的待确认计数。
  done（导入完成反馈）保留为终态，不进 stepper。

  预览屏双栏（03-import.html:62-203）：
    左栏 .panel = 原始文档（.docpaper 完整原文，一个字节不丢）
    右栏 .panel = 识别到的结构化结果（.rcard 逐块 / 逐 pending 项）
  所需 CSS 类全部已在 src/design/，本文件不新增、不修改任何样式。

  决策模型（铁律：不做假状态 —— 参照 06b 锁定按钮的教训）：
    待确认队列 = 置信度 < 0.8 的块 + 全部 pending 项，key 用稳定标识
    （块 `block-${index}`、pending `pending-${index}`）。设计稿里「待确认」的卡
    本就包含低置信度块（03-import.html:152-169 的项目块），actionbar 的
    「还有 2 项待确认」也把这类块算进去。队列里每一项的「接受 / 跳过」都是
    真决策：接受的原样进 emit 载荷，跳过的用户显式放弃、不进载荷
    （设计稿 167/197 行本就有跳过按钮；放弃后仍可在编辑器撤销/重新导入，
    不构成静默丢失）。「确认导入」在队列有未决策项时 disabled。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'

import { componentRegistry } from '../../components/runtime'
import { canonicalType } from '../../io/import-bridge'
import type { ImportReport, PendingItem, RecognizedBlock } from '../../io/recognition-provider'
import { RcBadge, RcButton, RcIcon, RcNotice } from '../controls'

/** stepper 上的三步（设计稿只有这三步；done 是终态，不进 stepper） */
type StepperStep = 'select' | 'progress' | 'preview'

export type WizardStep = StepperStep | 'done'

const step = ref<WizardStep>('select')
const fileName = ref('')
const report = ref<ImportReport | null>(null)
/** 选文件按钮代理：input 本身 display:none，由 .optcard 触发 */
const fileInput = ref<HTMLInputElement | null>(null)
/**
 * 待确认队列的决策（key = 稳定标识：块 `block-${index}`、pending `pending-${index}`）：
 * 接受 / 跳过。纯 UI 态 —— 只影响「确认导入」门控与 emit 载荷，不落盘、不进 undo 栈。
 */
const decisions = ref<Map<string, 'accept' | 'skip'>>(new Map())
/** 「修改」诚实降级提示：当前没有编辑 UI，点了只提示，不装作用户能改 */
const showModifyHint = ref(false)

const emit = defineEmits<{
  import: [blocks: RecognizedBlock[], pending: PendingItem[]]
  cancel: []
}>()

/** 步骤标签：stepper 三项照 03-import.html:54-58 原文；done 只用于页脚脚注 */
const stepLabels: Record<WizardStep, string> = {
  select: '选择文件',
  progress: '解析中',
  preview: '预览确认',
  done: '完成',
}
const stepOrder: StepperStep[] = ['select', 'progress', 'preview']
/**
 * 当前步序号。done 不在 stepOrder 里，走到 done 时三步全亮 completed
 * （step__no 全部放 check 图标）—— 导入完成即全流程完成。
 */
const stepperIndex = computed(() =>
  step.value === 'done' ? stepOrder.length : stepOrder.indexOf(step.value),
)

/* 模板是渲染函数，`v-if="report"` 在嵌套块里不保证收窄；统一走 computed 取值 */
const reportBlocks = computed(() => report.value?.blocks ?? [])
const reportPending = computed(() => report.value?.pending ?? [])
const reportWarnings = computed(() => report.value?.warnings ?? [])
const reportSourceKind = computed(() => report.value?.sourceKind ?? '')

/** sourceKind → 标签：沿用原 preview 步的映射（自产 DOCX 与第三方导入两档） */
const sourceKindLabel = computed(() =>
  reportSourceKind.value === 'self-docx' ? '自产 DOCX（无损）' : '第三方导入',
)

/** 置信度阈值：>=0.8 记「已确认」，<0.8 记「待确认」（右栏 badge 与左栏 doc-hl 同一阈值） */
const CONFIRMED_CONFIDENCE = 0.8

/** 决策 key：块与 pending 各按自己的下标，两类项不会串键 */
function blockKey(index: number): string {
  return `block-${index}`
}

function pendingKey(index: number): string {
  return `pending-${index}`
}

/** 高置信度块数（置信度过阈值即已确认，无需用户决策） */
const highConfidenceBlockCount = computed(
  () => reportBlocks.value.filter((b) => b.confidence >= CONFIRMED_CONFIDENCE).length,
)

/** 已接受决策数（低置信度块 + pending 项，用户点过「接受」的） */
const acceptedDecisionCount = computed(() => {
  let count = 0
  for (const decision of decisions.value.values()) {
    if (decision === 'accept') count += 1
  }
  return count
})

/**
 * 右栏 head「已确认 N / M」：
 *   M = 块数 + pending 数（总卡数；设计稿静态值 4/6 的 6 就是总卡数）
 *   N = 高置信度块数 + 已接受决策数
 */
const confirmedCount = computed(() => highConfidenceBlockCount.value + acceptedDecisionCount.value)
const totalCardCount = computed(() => reportBlocks.value.length + reportPending.value.length)

/**
 * 未决策项数（actionbar 待确认计数 + 确认导入门控）：
 * 待确认队列 = 置信度 < 0.8 的块 + 全部 pending 项，队列里没有决策的才算。
 */
const undecidedCount = computed(() => {
  let count = 0
  reportBlocks.value.forEach((block, index) => {
    if (block.confidence < CONFIRMED_CONFIDENCE && decisions.value.get(blockKey(index)) === undefined) {
      count += 1
    }
  })
  reportPending.value.forEach((_, index) => {
    if (decisions.value.get(pendingKey(index)) === undefined) count += 1
  })
  return count
})

/**
 * 识别块类型 → 注册表 displayName，经 import-bridge 的别名归一：
 * basics / education 等直连；work→experience、project→projects 等走 canonicalType。
 * 注册表没有的类型返回 undefined，调用方决定兜底，不编造显示名。
 */
function registryDisplayName(type: string): string | undefined {
  return componentRegistry.get(canonicalType(type))?.displayName
}

/**
 * 章节型块（识别侧语义名，照设计稿左栏 h3 分组）：
 * education / work / project / skills / awards。basics 等非章节块不进 h3 结构。
 */
const CHAPTER_TYPES: readonly string[] = ['education', 'work', 'project', 'skills', 'awards']

/** 章节型块且注册表有 displayName → h3 标题；否则 ''（该块不进 h3 结构） */
function chapterName(block: RecognizedBlock): string {
  if (!CHAPTER_TYPES.includes(block.type)) return ''
  return registryDisplayName(block.type) ?? ''
}

/** pending 卡显示名：suggestedType 经注册表 displayName，无则「未识别内容」 */
function pendingDisplayName(item: PendingItem): string {
  if (item.suggestedType === undefined) return '未识别内容'
  return registryDisplayName(item.suggestedType) ?? '未识别内容'
}

/** 按行拆文本：设计稿用 <br> 分行，这里用元素分行实现（禁 v-html） */
function textLines(text: string): string[] {
  return text.split('\n')
}

/**
 * 左栏大名字：仅当 basics 块识别出了 name 字段才渲染。
 * 没有就不渲染 —— 禁编造姓名。
 */
const basicsName = computed(() => {
  const basics = reportBlocks.value.find((b) => b.type === 'basics')
  const name = basics?.fields.name ?? ''
  return name.trim() === '' ? '' : name
})

/** 低置信度块（confidence < 0.8，与右栏「待确认」同阈值）—— 左栏文字行加 .doc-hl */
function isLowConfidence(block: RecognizedBlock): boolean {
  return block.confidence < CONFIRMED_CONFIDENCE
}

/** 写入一条真决策（块与 pending 共用；Map 整体替换一次保证响应式触发） */
function decide(key: string, decision: 'accept' | 'skip'): void {
  decisions.value.set(key, decision)
  decisions.value = new Map(decisions.value)
}

/**
 * 卡片态：confirmed 已确认（高置信度原样）/ undecided 待确认 /
 *         accepted 用户已接受 / skipped 用户已跳过。
 * 接受的卡片转「已确认」（去掉琥珀底，foot 变「修改」链接）；
 * 跳过的卡片保留待确认样式 + 中性「已跳过」徽标（它不会进文档，仍需留意）。
 * 块卡与 pending 卡共用这套态与流转，按钮完全同构。
 */
type CardState = 'confirmed' | 'undecided' | 'accepted' | 'skipped'

interface BadgeView {
  tone: 'success' | 'warning' | 'neutral'
  text: string
}

function badgeOf(state: CardState): BadgeView {
  if (state === 'undecided') return { tone: 'warning', text: '待确认' }
  if (state === 'skipped') return { tone: 'neutral', text: '已跳过' }
  return { tone: 'success', text: '已确认' }
}

interface BlockCardView {
  /** 决策 key：block-${index} */
  key: string
  block: RecognizedBlock
  /** 注册表 displayName（经别名归一），未登记类型回退原始 type */
  name: string
  badge: BadgeView
  /** 是否带 rcard--pending（低置信度且未被接受） */
  pending: boolean
  state: CardState
}

interface PendingCardView {
  /** 决策 key：pending-${index} */
  key: string
  item: PendingItem
  name: string
  badge: BadgeView
  state: CardState
}

/** 右栏识别块卡视图（低置信度块与 pending 项一样要用户真决策） */
const blockCards = computed<BlockCardView[]>(() =>
  reportBlocks.value.map((block, index) => {
    const key = blockKey(index)
    const decision = decisions.value.get(key)
    const state: CardState =
      decision === 'accept'
        ? 'accepted'
        : decision === 'skip'
          ? 'skipped'
          : block.confidence >= CONFIRMED_CONFIDENCE
            ? 'confirmed'
            : 'undecided'
    return {
      key,
      block,
      name: registryDisplayName(block.type) ?? block.type,
      badge: badgeOf(state),
      pending: block.confidence < CONFIRMED_CONFIDENCE && state !== 'accepted',
      state,
    }
  }),
)

/** 右栏 pending 卡视图（conf 不显示：pending 无置信度，禁编） */
const pendingCards = computed<PendingCardView[]>(() =>
  reportPending.value.map((item, index) => {
    const key = pendingKey(index)
    const decision = decisions.value.get(key)
    const state: CardState =
      decision === 'accept' ? 'accepted' : decision === 'skip' ? 'skipped' : 'undecided'
    return {
      key,
      item,
      name: pendingDisplayName(item),
      badge: badgeOf(state),
      state,
    }
  }),
)

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  step.value = 'progress'
  // 新一次导入：清掉上一轮的决策与提示
  decisions.value = new Map()
  showModifyHint.value = false

  // 模拟解析（实际由 RecognitionProvider 处理）
  setTimeout(() => {
    report.value = {
      blocks: [
        {
          type: 'basics',
          text: '张明 · 前端工程师',
          confidence: 0.9,
          sourceLocation: 'p0',
          fields: { name: '张明' },
        },
        {
          type: 'education',
          text: '华南理工大学 · 软件工程',
          confidence: 0.8,
          sourceLocation: 'p1',
          fields: { school: '华南理工' },
        },
        {
          type: 'work',
          text: '字节跳动 · 前端工程师',
          confidence: 0.7,
          sourceLocation: 'p2',
          fields: { company: '字节' },
        },
      ],
      confidence: 0.8,
      pending: [
        { raw: '一段无法识别的文字内容', reason: '无法识别所属组件' },
        { raw: '另一段待处理内容', reason: '置信度过低' },
      ],
      warnings: [],
      sourceKind: 'third-party-docx',
    }
    step.value = 'preview'
  }, 1500)
}

function onConfirm() {
  // 门控：队列里还有未决策项就不放行（按钮同时 disabled，双保险）
  if (undecidedCount.value > 0) return

  // blocks = 高置信度块 + 决策为「接受」的低置信度块；跳过的块用户显式放弃
  const blocks = reportBlocks.value.filter(
    (block, index) =>
      block.confidence >= CONFIRMED_CONFIDENCE || decisions.value.get(blockKey(index)) === 'accept',
  )
  // pending = 决策为「接受」的项；接受的原样进 bridge 落 UnknownComponent
  // （raw 保留原文），跳过的由用户显式放弃，不静默丢任何东西
  const pending = reportPending.value.filter(
    (_, index) => decisions.value.get(pendingKey(index)) === 'accept',
  )
  emit('import', blocks, pending)
  step.value = 'done'
}
</script>

<template>
  <div class="scrim" @click.self="emit('cancel')">
    <div
      class="dialog dialog--md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rc-import-title"
    >
      <div class="dialog__head">
        <span id="rc-import-title" class="dialog__title">导入简历</span>
        <span class="dialog__sub">识别结果需逐项确认，未识别内容不会丢弃</span>
      </div>

      <!-- 步骤指示器：照 03-import.html:53-59 的 .stepper > .step(--done/--on) > .step__no + 标签，步骤间 .step__line；
           done 态 step__no 放 check 图标（设计稿 data-ic="check" 10px），当前态放数字。
           内边距与 dialog__head / dialog__body 的 s6（24px）对齐 -->
      <div class="stepper" style="padding: 0 24px 12px">
        <template v-for="(s, i) in stepOrder" :key="s">
          <span
            class="step"
            :class="i < stepperIndex ? 'step--done' : i === stepperIndex ? 'step--on' : ''"
          >
            <span class="step__no">
              <RcIcon v-if="i < stepperIndex" name="check" style="width: 10px; height: 10px" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            {{ stepLabels[s] }}
          </span>
          <span
            v-if="i < stepOrder.length - 1"
            class="step__line"
            :class="i < stepperIndex ? 'step__line--done' : ''"
          ></span>
        </template>
      </div>

      <div class="dialog__body">
        <!-- 1 选文件（input 藏起来，由 optcard 代理点击；两者必须同属一个 v-if 分支） -->
        <template v-if="step === 'select'">
          <button type="button" class="optcard" @click="fileInput?.click()">
            <RcIcon name="upload" :size="18" />
            <span class="compcard__name">选择 DOCX 或 PDF 文件导入</span>
            <span class="compcard__desc">支持 .docx / .pdf，最大 20MB</span>
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".docx,.pdf"
            style="display: none"
            @change="onFileSelected"
          />
        </template>

        <!-- 2 解析中 -->
        <p v-else-if="step === 'progress'" class="checkitem">
          <RcIcon name="refresh" :size="14" />
          <span>正在解析「{{ fileName }}」…</span>
        </p>

        <!-- 3 预览确认：照 03-import.html:62-203 的 .importgrid 双栏 -->
        <template v-else-if="step === 'preview' && report">
          <div class="importgrid">
            <!-- ---------- 左：原始文档（完整原文，一个字节不丢） ---------- -->
            <section class="panel">
              <div class="panel__head">
                <span class="panel__title"><RcIcon name="file-text" :size="14" />原始文档</span>
                <!-- 副标题用动态数据：来源标签 + 内容块数；禁编造影印页数 / 缩放 -->
                <span>{{ sourceKindLabel }} · {{ reportBlocks.length }} 个内容块</span>
              </div>
              <!-- design 行 70 的内联 background:var(--rc-canvas) 照抄 -->
              <div class="panel__body" style="background: var(--rc-canvas)">
                <div class="docpaper">
                  <!-- 照片占位：设计稿固有 chrome（03-import.html:72），占位符不构成编造 -->
                  <div class="docpaper__photo"><RcIcon name="user" :size="14" />照片占位</div>
                  <!-- 大名字：仅当 basics 块识别出 name 才渲染（没有就不渲染，禁编造） -->
                  <div v-if="basicsName" class="docpaper__name">{{ basicsName }}</div>

                  <template v-for="(block, i) in reportBlocks" :key="`block-${i}`">
                    <!-- 章节型块（h3 标题来自注册表 displayName，经别名归一）；
                         低置信度块的文字行加 .doc-hl —— 设计稿的高亮类，用于标注
                         需留意内容（与右栏「待确认」同一阈值 confidence < 0.8） -->
                    <h3 v-if="chapterName(block)">{{ chapterName(block) }}</h3>
                    <p
                      v-for="(line, li) in textLines(block.text)"
                      :key="li"
                      :class="{ 'doc-hl': isLowConfidence(block) }"
                    >
                      {{ line }}
                    </p>
                  </template>

                  <!-- pending 项原文同样进左栏（一个字节不丢）。识别报告不记录
                       pending 的原文位置，按忠实保底追加在文档末尾；pending 整体
                       即「待确认」，与低置信度块同属需留意内容，同样加 .doc-hl -->
                  <template v-for="(item, pi) in reportPending" :key="`pending-${pi}`">
                    <p v-for="(line, li) in textLines(item.raw)" :key="li" class="doc-hl">
                      {{ line }}
                    </p>
                  </template>
                </div>
              </div>
            </section>

            <!-- ---------- 右：识别到的结构化结果 ---------- -->
            <section class="panel">
              <div class="panel__head">
                <span class="panel__title"
                  ><RcIcon name="layers" :size="14" />识别到的结构化结果</span
                >
                <!-- 样式照 design 行 104。口径：M = 块数 + pending 数（总卡数，
                     设计稿静态值 4/6 的 6 即总卡数）；N = 高置信度块数 + 已接受决策数 -->
                <span
                  ><b style="color: var(--rc-text)"
                    >已确认 {{ confirmedCount }} / {{ totalCardCount }}</b
                  ></span
                >
              </div>
              <div class="panel__body">
                <!-- 提示段：文案与内联样式照 design 行 108-110 -->
                <p class="muted" style="font-size: var(--rc-fz-xs); line-height: 1.6; margin: 0 0 10px">
                  请逐项核对。表格、文本框与浮动图片需要人工确认。
                </p>

                <!-- 「修改」诚实降级：无编辑 UI 存在，点击只提示，不假装能改 -->
                <RcNotice v-if="showModifyHint" tone="warning">导入后可在编辑器继续修改</RcNotice>

                <!-- 识别块卡：每块一张 .rcard；低置信度块与 pending 项一样进待确认队列 -->
                <div
                  v-for="card in blockCards"
                  :key="card.key"
                  class="rcard"
                  :class="{ 'rcard--pending': card.pending }"
                >
                  <div class="rcard__head">
                    <span class="rcard__name">{{ card.name }}</span>
                    <RcBadge :tone="card.badge.tone">{{ card.badge.text }}</RcBadge>
                    <span class="rcard__conf">{{ (card.block.confidence * 100).toFixed(0) }}%</span>
                  </div>
                  <!-- 按行渲染（设计稿用 <br> 分行；用元素分行实现，禁 v-html） -->
                  <div class="rcard__text">
                    <div v-for="(line, li) in textLines(card.block.text)" :key="li">{{ line }}</div>
                  </div>
                  <div class="rcard__foot">
                    <!-- 待确认卡：接受 / 修改 / 跳过 三按钮（design 行 165-167） -->
                    <template v-if="card.state === 'undecided'">
                      <RcButton size="sm" @click="decide(card.key, 'accept')">接受</RcButton>
                      <RcButton size="sm" @click="showModifyHint = true">修改</RcButton>
                      <RcButton variant="ghost" size="sm" @click="decide(card.key, 'skip')"
                        >跳过</RcButton
                      >
                    </template>
                    <!-- 已确认卡 / 已接受卡：单个「修改」链接（design 行 122） -->
                    <button
                      v-else-if="card.state !== 'skipped'"
                      type="button"
                      class="rcard__link"
                      @click="showModifyHint = true"
                    >
                      修改
                    </button>
                    <!-- 已跳过卡：中性状态标签 -->
                    <RcBadge v-else tone="neutral">已跳过</RcBadge>
                  </div>
                </div>

                <!-- pending 卡：每项一张 .rcard rcard--pending（与块卡同构，接受后转已确认去掉 pending 类） -->
                <div
                  v-for="card in pendingCards"
                  :key="card.key"
                  class="rcard"
                  :class="{ 'rcard--pending': card.state !== 'accepted' }"
                >
                  <div class="rcard__head">
                    <span class="rcard__name">{{ card.name }}</span>
                    <RcBadge :tone="card.badge.tone">{{ card.badge.text }}</RcBadge>
                    <!-- conf 不显示：pending 无置信度，禁编 -->
                  </div>
                  <div class="rcard__text">
                    <div v-for="(line, li) in textLines(card.item.raw)" :key="li">{{ line }}</div>
                  </div>
                  <p class="rcard__hint">{{ card.item.reason }}</p>
                  <div class="rcard__foot">
                    <template v-if="card.state === 'undecided'">
                      <RcButton size="sm" @click="decide(card.key, 'accept')">接受</RcButton>
                      <RcButton size="sm" @click="showModifyHint = true">修改</RcButton>
                      <RcButton variant="ghost" size="sm" @click="decide(card.key, 'skip')"
                        >跳过</RcButton
                      >
                    </template>
                    <button
                      v-else-if="card.state !== 'skipped'"
                      type="button"
                      class="rcard__link"
                      @click="showModifyHint = true"
                    >
                      修改
                    </button>
                    <RcBadge v-else tone="neutral">已跳过</RcBadge>
                  </div>
                </div>

                <!-- 识别报告的 warnings（条件渲染，空时不破坏设计稿结构） -->
                <RcNotice v-if="reportWarnings.length > 0" tone="warning">
                  <div v-for="w in reportWarnings" :key="w">{{ w }}</div>
                </RcNotice>
              </div>
            </section>
          </div>
        </template>

        <!-- 4 完成（终态，不进 stepper） -->
        <template v-else-if="step === 'done'">
          <p class="checkitem">
            <RcIcon name="check-circle" :size="16" />
            <span class="compcard__name">导入完成</span>
          </p>
          <p class="compcard__desc">内容已添加到简历编辑器，可继续编辑调整。</p>
        </template>
      </div>

      <div class="dialog__foot">
        <!-- 预览步：照设计稿 actionbar 语义（design 行 207-215）—— 左返回、中待确认计数、右确认导入 -->
        <template v-if="step === 'preview'">
          <RcButton variant="ghost" size="lg" @click="step = 'select'">
            <template #icon><RcIcon name="chevron-left" :size="14" /></template>
            返回选择文件
          </RcButton>
          <span class="actionbar__desc">还有 {{ undecidedCount }} 项待确认，确认后可导入</span>
          <RcButton
            variant="primary"
            size="lg"
            :disabled="undecidedCount > 0"
            disabled-reason="还有待确认项未处理"
            @click="onConfirm"
          >
            确认导入
          </RcButton>
        </template>

        <template v-else-if="step === 'done'">
          <div class="dialog__foot-meta">{{ stepLabels[step] }}</div>
          <div class="dialog__actions">
            <RcButton variant="primary" @click="emit('cancel')">关闭</RcButton>
          </div>
        </template>

        <template v-else>
          <div class="dialog__foot-meta">{{ stepLabels[step] }}</div>
          <div class="dialog__actions">
            <RcButton variant="ghost" @click="emit('cancel')">取消</RcButton>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
