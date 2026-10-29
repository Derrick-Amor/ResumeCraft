<!--
  溢出处理弹窗（07）—— DOM 逐层照抄 `docs/design/mockups/figma/07-overflow.html:351-430`

  职责：把"哪部分超出可导出区域"摆给用户看，然后给三种处理方式。
  纸面侧的溢出标记（`.p-boundary` / `.paper-flag`）在 CanvasView；这里只负责弹窗本体。

  行级数据的来源（2026-10-30 裁决选 B）：
  契约 `LayoutWarning.overLines?: string[]` —— **仅 `overflow-page` 填**（分页续排不算溢出），
  其余警告类型是 undefined；取不到也是 undefined，禁止空数组冒充。
  所以 `<mark>` 只在 `overLines` 里有该行时才包；拿不到就整段不高亮，不编造。
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { RcButton, RcIcon } from '../controls'

/** 溢出项。`lineCount` / `overText` 是可选的：契约暂无行级数据，调用方有才给 */
export interface OverflowItem {
  componentId: string
  componentName: string
  pageIndex: number
  /** 溢出行数。契约（LayoutWarning）暂无行级粒度，调用方可不填 */
  lineCount?: number
  /** 被裁掉的文本行原文（契约 `LayoutWarning.overLines`）。有才 `<mark>`，没有就整段不高亮 */
  overLines?: string[]
  /** 组件的真实文本行（来自 documentTextBlocks 的 runs）。预览渲染它们，不显示占位文案 */
  lines?: string[]
}

const props = withDefaults(
  defineProps<{
    open: boolean
    items: OverflowItem[]
    /** 本页内容组件总数（"压缩本页全部"的 tag 文案用）；缺省按溢出项数 */
    pageComponentCount?: number
  }>(),
  { pageComponentCount: 0 },
)

const emit = defineEmits<{
  compressComponent: [componentId: string]
  compressPage: [pageIndex: number]
  previewPushDown: [componentId: string]
  skip: []
  locate: [componentId: string]
  close: []
}>()

type Choice = 'component' | 'page' | 'skip'

const choice = ref<Choice>('component')

watch(
  () => props.open,
  (open) => {
    if (open) choice.value = 'component'
  },
)

const primary = computed<OverflowItem | null>(() => props.items[0] ?? null)

/** 该行是否在被裁清单里（字符串逐字比较：overLines 收的是 run.text 原文） */
function isOverLine(line: string): boolean {
  return (primary.value?.overLines ?? []).includes(line)
}

const pageComponentTotal = computed(() =>
  props.pageComponentCount > 0 ? props.pageComponentCount : props.items.length,
)

/** 副标题文案照 07 原文；行数缺数据时不编数字 */
const subtitle = computed(() => {
  const item = primary.value
  if (item === null) return '有内容超出可导出区域。请选择一种处理方式。'
  const page = `第 ${item.pageIndex + 1} 页`
  const lines = item.lineCount === undefined ? '' : `有 ${item.lineCount} 行`
  return `${page} · ${item.componentName}${lines}超出可导出区域。请选择一种处理方式。`
})

const componentDesc = computed(() => {
  const item = primary.value
  const head = '行距 1.55 → 1.45 倍 · 字号保持 10.5 pt'
  const tail =
    item?.lineCount === undefined ? '其他组件不变' : `预计收回 ${item.lineCount} 行；其他组件不变`
  return `${head}\n${tail}`
})

const pageDesc = computed(() => {
  const head = '行距 1.55 → 1.40 倍 · 字号 10.5 → 10 pt'
  const tail = '保持本页版式一致'
  return `${head}\n${tail}`
})

function confirm(): void {
  const item = primary.value
  if (item === null) {
    emit('skip')
    emit('close')
    return
  }
  if (choice.value === 'component') emit('compressComponent', item.componentId)
  else if (choice.value === 'page') emit('compressPage', item.pageIndex)
  else emit('skip')
  emit('close')
}
</script>

<template>
  <div v-if="props.open" class="scrim" data-testid="rc-overflow-dialog" @click.self="emit('close')">
    <div class="dialog dialog--lg" role="dialog" aria-modal="true" aria-labelledby="rc-ovf-title">
      <div class="dialog__head">
        <div>
          <h2 id="rc-ovf-title" class="dialog__title">处理内容溢出</h2>
          <p class="dialog__sub">{{ subtitle }}</p>
        </div>
        <button
          class="iconbtn"
          title="关闭"
          data-testid="rc-ovf-close"
          @click="emit('close')"
        >
          <RcIcon name="x" :size="14" />
        </button>
      </div>

      <div class="dialog__body">
        <!-- 溢出预览：让用户看见"哪部分超出" -->
        <div v-if="primary" class="ovfpreview">
          <div class="ovfpreview__cols">
            <div class="ovfpreview__label">
              <strong>{{ primary.componentName }}</strong>
              仅影响要变形的文本
            </div>
            <!--
              <mark> 只在调用方给了 overText 时才出现：契约没有行级溢出数据，
              不编造"哪几行超出"。能力在、数据缺，就诚实地留空。
            -->
            <!--
              渲染组件真实文本行（documentTextBlocks 的 runs）。
              `overLines`（契约 overflow-page 专有）里的行用 <mark> 包；拿不到就整段不高亮。
            -->
            <div class="ovfpreview__text" data-testid="rc-ovf-preview-text">
              <template v-if="(primary.lines ?? []).length > 0">
                <span v-for="(line, i) in primary.lines ?? []" :key="i">
                  <mark v-if="isOverLine(line)">{{ line }}</mark>
                  <template v-else>{{ line }}</template>
                  <br v-if="i < (primary.lines?.length ?? 0) - 1" />
                </span>
              </template>
              <template v-else>{{ primary.componentName }}（该组件暂无可预览文本）</template>
            </div>
          </div>
          <div class="ovfpreview__line"><span>可导出区域边界</span></div>
        </div>

        <!-- 三种处理方式（radio 语义：optcard--on 表示选中） -->
        <div
          class="optcard"
          :class="choice === 'component' ? 'optcard--on' : ''"
          role="radio"
          :aria-checked="choice === 'component'"
          data-testid="rc-ovf-choice-component"
          @click="choice = 'component'"
        >
          <span class="optcard__radio"></span>
          <div class="optcard__body">
            <div class="optcard__head">
              <span class="optcard__name">压缩该组件</span>
              <span class="optcard__tag">仅影响「{{ primary?.componentName ?? '' }}」项目</span>
            </div>
            <div class="optcard__desc">{{ componentDesc }}</div>
          </div>
        </div>

        <div
          class="optcard"
          :class="choice === 'page' ? 'optcard--on' : ''"
          role="radio"
          :aria-checked="choice === 'page'"
          data-testid="rc-ovf-choice-page"
          @click="choice = 'page'"
        >
          <span class="optcard__radio"></span>
          <div class="optcard__body">
            <div class="optcard__head">
              <span class="optcard__name">压缩本页全部</span>
              <span class="optcard__tag">
                影响第 {{ (primary?.pageIndex ?? 0) + 1 }} 页的 {{ pageComponentTotal }} 个内容组件
              </span>
            </div>
            <div class="optcard__desc">{{ pageDesc }}</div>
          </div>
        </div>

        <div
          class="optcard optcard--muted"
          :class="choice === 'skip' ? 'optcard--on' : ''"
          role="radio"
          :aria-checked="choice === 'skip'"
          data-testid="rc-ovf-choice-skip"
          @click="choice = 'skip'"
        >
          <span class="optcard__radio"></span>
          <div class="optcard__body">
            <div class="optcard__head">
              <span class="optcard__name">暂不处理</span>
              <span class="optcard__tag">保留当前字号与间距</span>
            </div>
            <div class="optcard__desc">
              继续编辑，溢出标记会保留，导出前再次提醒。<br />未处理内容可能不会出现在导出区域内
            </div>
          </div>
        </div>

        <!-- 压缩下限：文案与 store 的 clamp 常量同源（MIN_BODY_FONT_SIZE_PT / MIN_LINE_HEIGHT） -->
        <p class="floorhint">
          <RcIcon name="info" :size="12" />压缩下限：正文 10 pt，行距 1.40 倍。不会低于可读下限。
        </p>

        <!-- 备选：整体下移 -->
        <div class="altcard">
          <span class="altcard__thumb"></span>
          <div class="altcard__body">
            <div class="altcard__name">或将该组件整体下移至下一页</div>
            <div class="altcard__desc">将导致页面出现空白</div>
          </div>
          <button
            class="btn"
            data-testid="rc-ovf-push-down"
            :disabled="primary === null"
            @click="primary && emit('previewPushDown', primary.componentId)"
          >
            <RcIcon name="arrow-down-to-line" :size="14" />预览整体下移
          </button>
        </div>
      </div>

      <div class="dialog__foot">
        <span class="dialog__foot-meta">
          <RcIcon name="refresh" :size="12" />可在应用后撤销本次调整
        </span>
        <div class="dialog__actions">
          <RcButton variant="ghost" size="lg" data-testid="rc-ovf-cancel" @click="emit('close')">
            取消
          </RcButton>
          <RcButton
            variant="primary"
            size="lg"
            :disabled="primary === null"
            :disabled-reason="primary === null ? '没有需要处理的溢出' : ''"
            data-testid="rc-ovf-apply"
            @click="confirm"
          >
            应用压缩
          </RcButton>
        </div>
      </div>
    </div>
  </div>
</template>
