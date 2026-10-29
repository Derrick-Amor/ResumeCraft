<!--
  导入确认向导（TC-012 / FR-IMP-006/009）
  流程：选文件 → 进度 → 结构预览 → 逐项确认 → 生成

  D 段改动只在外壳：`.scrim > .dialog` + 设计稿类名（`.step` / `.optcard` / `.checkitem` / `.badge`），
  删掉原 209 行 scoped 样式 —— 那份样式全引用 `--rc-color-*` 旧词表，
  和已换词表的外壳是两套视觉，留着会被当成遗留 bug。

  业务逻辑（步骤机、模拟解析、待处理项、确认后 emit）一行没动。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'

import { RcBadge, RcButton, RcIcon, RcNotice } from '../controls'
import type { ImportReport, RecognizedBlock, PendingItem } from '../../io/recognition-provider'

export type WizardStep = 'select' | 'progress' | 'preview' | 'confirm' | 'done'

const step = ref<WizardStep>('select')
const fileName = ref('')
const report = ref<ImportReport | null>(null)
const selectedBlocks = ref<Set<string>>(new Set())
const resolvedPending = ref<Set<string>>(new Set())
/** 选文件按钮代理：input 本身 display:none，由 .optcard 触发 */
const fileInput = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  import: [blocks: RecognizedBlock[], pending: PendingItem[]]
  cancel: []
}>()

const stepLabels: Record<WizardStep, string> = {
  select: '选择文件',
  progress: '解析中',
  preview: '结构预览',
  confirm: '逐项确认',
  done: '完成',
}

const stepOrder: WizardStep[] = ['select', 'progress', 'preview', 'confirm', 'done']
const currentStepIndex = computed(() => stepOrder.indexOf(step.value))

/* 模板是渲染函数，`v-if="report"` 在嵌套块里不保证收窄；统一走 computed 取值 */
const reportBlocks = computed(() => report.value?.blocks ?? [])
const reportPending = computed(() => report.value?.pending ?? [])
const reportWarnings = computed(() => report.value?.warnings ?? [])
const reportConfidence = computed(() => report.value?.confidence ?? 0)
const reportSourceKind = computed(() => report.value?.sourceKind ?? '')

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  step.value = 'progress'

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

function toggleBlock(index: number) {
  const key = `block-${index}`
  if (selectedBlocks.value.has(key)) {
    selectedBlocks.value.delete(key)
  } else {
    selectedBlocks.value.add(key)
  }
}

function resolvePending(index: number) {
  resolvedPending.value.add(`pending-${index}`)
}

function onConfirm() {
  const blocks = report.value?.blocks ?? []
  const pending = (report.value?.pending ?? []).filter(
    (_, i) => !resolvedPending.value.has(`pending-${i}`),
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

      <!-- 步骤指示器 -->
      <div class="step" style="padding: 0 20px">
        <template v-for="(s, i) in stepOrder" :key="s">
          <span
            class="step__no"
            :class="{ 'step--done': i < currentStepIndex }"
            :aria-current="i === currentStepIndex ? 'step' : undefined"
          >
            {{ i + 1 }}
          </span>
          <span class="compcard__desc" :class="i === currentStepIndex ? 'compcard__name' : ''">
            {{ stepLabels[s] }}
          </span>
          <span v-if="i < stepOrder.length - 1" class="step__line"></span>
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

        <!-- 3 结构预览 -->
        <template v-else-if="step === 'preview' && report">
          <div class="side__section">
            <span class="side__section-title">识别结果</span>
            <span style="display: flex; gap: 4px">
              <RcBadge tone="success" size="sm">
                置信度 {{ (reportConfidence * 100).toFixed(0) }}%
              </RcBadge>
              <RcBadge :tone="reportSourceKind === 'self-docx' ? 'accent' : 'neutral'" size="sm">
                {{ reportSourceKind === 'self-docx' ? '自产 DOCX（无损）' : '第三方导入' }}
              </RcBadge>
            </span>
          </div>

          <button
            v-for="(block, i) in reportBlocks"
            :key="i"
            type="button"
            class="checkitem"
            @click="toggleBlock(i)"
          >
            <RcBadge tone="accent" size="sm">{{ block.type }}</RcBadge>
            <span class="compcard__name">{{ block.text }}</span>
            <RcBadge v-if="selectedBlocks.has(`block-${i}`)" tone="success" size="sm">已选</RcBadge>
            <span class="compcard__desc">{{ (block.confidence * 100).toFixed(0) }}%</span>
          </button>

          <RcNotice v-if="reportWarnings.length > 0" tone="warning">
            <div v-for="w in reportWarnings" :key="w">{{ w }}</div>
          </RcNotice>
        </template>

        <!-- 4 逐项确认 -->
        <template v-else-if="step === 'confirm' && report">
          <div class="side__section">
            <span class="side__section-title">已识别组件（{{ reportBlocks.length }}）</span>
          </div>
          <div v-for="(block, i) in reportBlocks" :key="i" class="checkitem">
            <RcBadge tone="accent" size="sm">{{ block.type }}</RcBadge>
            <span class="compcard__desc">{{ block.text.slice(0, 30) }}…</span>
            <RcBadge tone="success" size="sm">将被导入</RcBadge>
          </div>

          <div class="side__section">
            <span class="side__section-title">待处理列表（{{ reportPending.length }}）</span>
            <span class="side__section-hint">未识别内容不会丢弃</span>
          </div>
          <div v-for="(item, i) in reportPending" :key="i" class="checkitem">
            <span class="compcard__desc">{{ item.raw.slice(0, 30) }}…</span>
            <span class="side__section-hint">{{ item.reason }}</span>
            <RcButton
              v-if="!resolvedPending.has(`pending-${i}`)"
              variant="ghost"
              size="sm"
              @click="resolvePending(i)"
            >
              标记已处理
            </RcButton>
            <RcBadge v-else tone="success" size="sm">已处理</RcBadge>
          </div>
        </template>

        <!-- 5 完成 -->
        <template v-else-if="step === 'done'">
          <p class="checkitem">
            <RcIcon name="check-circle" :size="16" />
            <span class="compcard__name">导入完成</span>
          </p>
          <p class="compcard__desc">内容已添加到简历编辑器，可继续编辑调整。</p>
        </template>
      </div>

      <div class="dialog__foot">
        <div class="dialog__foot-meta">{{ stepLabels[step] }}</div>
        <div class="dialog__actions">
          <RcButton v-if="step === 'preview'" variant="ghost" @click="step = 'select'">
            重新选择
          </RcButton>
          <RcButton v-if="step === 'preview'" variant="primary" @click="step = 'confirm'">
            下一步
          </RcButton>

          <RcButton v-if="step === 'confirm'" variant="ghost" @click="step = 'preview'"
            >返回</RcButton
          >
          <RcButton v-if="step === 'confirm'" variant="primary" @click="onConfirm">
            确认导入
          </RcButton>

          <RcButton v-if="step === 'done'" variant="primary" @click="emit('cancel')">关闭</RcButton>
          <RcButton
            v-if="step === 'select' || step === 'progress'"
            variant="ghost"
            @click="emit('cancel')"
          >
            取消
          </RcButton>
        </div>
      </div>
    </div>
  </div>
</template>
