<script setup lang="ts">
/**
 * 属性面板（D 段）—— `.inspector` 结构照 01-editor.html
 *
 * 三态：
 *   未选中 → 页面设置（纸张只读、方向切换时同步交换宽高、四边页边距）
 *   选中   → 内容 / 样式 / 布局 三 Tab
 *
 * 字段表单**全部由注册表驱动**：`componentRegistry.fieldsFor(type, track)` 决定出哪些控件，
 * 本文件不写 `if (type === 'experience')` —— 语言轨裁剪与字段语义都只属于注册表（契约 §3 不变量 2）。
 *
 * 错误态按设计稿画在控件上（`.input--invalid`），外壳只渲染 `.field__error` + `.field__hint`。
 */
import { computed, ref, watch } from 'vue'

import { componentRegistry } from '../../components/runtime'
import type { FieldSpec } from '../../components/registry'
import { useEditorStore } from '../../state/editor-store'
import { BACKGROUND_LAYER_ID } from '../layers/layer-ids'
import type { AnyComponent, PageSettings, ResumeComponent } from '../../model/types'
import type { RcTabItem } from '../controls'
import { RcButton, RcField, RcIcon, RcInspectorTabs, RcNotice, RcSwitch } from '../controls'

const store = useEditorStore()

/**
 * 纸面墨绿的展示文案（01-editor.html:314 的 `.colorfield__hex` 就是这个文本给人看）。
 * **此值仅作展示文案，与 `--rc-paper-accent` 同值；改颜色请改 token，不要只改这里。**
 * 色块本身由 `.dot-paper` 的 CSS 提供（glass.css:276 → --rc-paper-accent），
 * 这个字符串不参与着色 —— 所以它出现在 .vue 里不算"引入设计稿以外的色值"。
 */
const PAPER_ACCENT_HEX = '#4b7168'

/**
 * 背景层锁定 —— **纯 UI 态**（契约 §10.4：锁定不进文档模型）。
 * 点它只切这个 ref，不产生任何文档改动、不进 undo 栈。
 */
const bgLocked = ref(true)

const activeTab = ref('content')

const tabs: RcTabItem[] = [
  { key: 'content', label: '内容' },
  { key: 'style', label: '样式' },
  { key: 'layout', label: '布局' },
]

/** 未知组件没有 fields，表单渲染不了 —— 用显式守卫收窄，不靠 `in` 让 TS 猜 */
function isEditable(component: AnyComponent | null): component is ResumeComponent {
  return component !== null && !('unknown' in component)
}

const selected = computed<ResumeComponent | null>(() => {
  const component = store.selectedComponent
  return isEditable(component) ? component : null
})

const definition = computed(() => {
  const component = selected.value
  return component === null ? undefined : componentRegistry.get(component.type)
})

const title = computed(() => {
  if (store.selectedId === BACKGROUND_LAYER_ID) return '背景层'
  const component = store.selectedComponent
  if (component === null) return '页面设置'
  if ('unknown' in component && component.unknown === true) return component.originalType
  return definition.value?.displayName ?? component.type
})

const fields = computed<readonly FieldSpec[]>(() => {
  const component = selected.value
  if (component === null) return []
  return componentRegistry.fieldsFor(component.type, store.doc.languageTrack)
})

/** 校验错误按字段 key 建索引，渲染时直接取，避免每行重复跑校验 */
const errors = computed<Record<string, string>>(() => {
  const component = selected.value
  const def = definition.value
  if (component === null || def === undefined) return {}
  const result = def.validate(component.fields, store.doc.languageTrack)
  if (result.ok) return {}
  const map: Record<string, string> = {}
  for (const issue of result.errors) map[issue.path] = issue.message
  return map
})

const componentWarnings = computed(() => {
  const component = store.selectedComponent
  if (component === null) return []
  return store.layout.warnings.filter((w) => w.componentId === component.id)
})

function textValue(key: string): string {
  const raw = selected.value?.fields[key]
  return typeof raw === 'string' ? raw : ''
}

function listValue(key: string): string {
  const raw = selected.value?.fields[key]
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').join('\n') : ''
}

function onText(key: string, event: Event): void {
  const component = selected.value
  if (component === null) return
  store.updateField(component.id, key, (event.target as HTMLInputElement).value)
}

function onList(key: string, event: Event): void {
  const component = selected.value
  if (component === null) return
  const lines = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  store.updateField(component.id, key, lines)
}

const fontSize = computed(() => {
  const raw = selected.value?.style?.fontSizePt
  return typeof raw === 'number' ? raw : 10.5
})

const lineHeight = computed(() => {
  const raw = selected.value?.style?.lineHeight
  return typeof raw === 'number' ? raw : 1.55
})

function onStyle(key: 'fontSizePt' | 'lineHeight', event: Event): void {
  const component = selected.value
  if (component === null) return
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value) || value <= 0) return
  store.updateComponentStyle(component.id, { [key]: value })
}

// ---------------- 页面设置（未选中时） ----------------

const settings = computed<PageSettings>(() => store.doc.pageSettings)

function onMargin(key: keyof PageSettings, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  // 5–50mm 之外的输入不写回：越界会让内容区变成负宽度，比"没反应"更糟
  if (!Number.isFinite(value) || value < 5 || value > 50) return
  store.setPageSettings({ [key]: value })
}

const ORIENTATION_LABEL = { portrait: '纵向', landscape: '横向' } as const

function onOrientation(event: Event): void {
  const next = (event.target as HTMLSelectElement).value as PageSettings['orientation']
  if (next === settings.value.orientation) return
  // 换方向必须同时交换宽高，否则 A4 会变成"竖着的横版"
  store.setPageSettings({
    orientation: next,
    widthMm: settings.value.heightMm,
    heightMm: settings.value.widthMm,
  })
}

watch(
  () => store.selectedId,
  () => {
    activeTab.value = 'content'
  },
)
</script>

<template>
  <aside class="inspector">
    <div class="inspector__head">
      <span class="inspector__title">{{ title }}</span>
      <button class="iconbtn iconbtn--sm" title="面板设置">
        <RcIcon name="sliders" :size="14" />
      </button>
    </div>

    <RcInspectorTabs v-if="store.selectedComponent !== null" v-model="activeTab" :items="tabs" />

    <div class="inspector__body">
      <!-- ---------- 背景层（06b）：锁定是 UI 态，拖图/填色 P2 ---------- -->
      <template v-if="store.selectedId === BACKGROUND_LAYER_ID">
        <div class="bg-locked" data-testid="rc-bg-locked">
          <div class="bg-locked__head">
            <RcIcon name="lock" :size="14" />
            <span>{{ bgLocked ? '背景已锁定' : '背景已解锁' }}</span>
          </div>
          <p class="bg-locked__desc">解锁后可修改背景。选择图层框不会自动解锁。</p>
          <button
            class="btn"
            style="width: 100%"
            data-testid="rc-bg-toggle-lock"
            @click="bgLocked = !bgLocked"
          >
            <RcIcon :name="bgLocked ? 'unlock' : 'lock'" :size="14" />{{ bgLocked ? '解锁背景' : '锁定背景' }}
          </button>
        </div>

        <div class="field">
          <label class="field__label">读取颜色</label>
          <div class="colorfield">
            <span class="colorfield__chip dot-white"></span>
            <span class="colorfield__hex">#FFFFFF</span>
          </div>
        </div>

        <div class="field">
          <label class="field__label">透明度</label>
          <div class="unit-input">
            <input class="input tnum" value="100" :disabled="bgLocked" />
            <span class="unit-input__unit">%</span>
          </div>
        </div>

        <div class="field">
          <label class="field__label">纹理</label>
          <select class="select" :disabled="bgLocked">
            <option>无纹理</option>
          </select>
        </div>

        <div class="field">
          <label class="field__label">背景图片</label>
          <div class="bg-empty" data-testid="rc-bg-empty">
            <RcIcon name="image" :size="18" />
            <span>未上传</span>
          </div>
        </div>

        <p class="field__hint">锁定时无法上传、替换或调整背景。</p>
      </template>

      <!-- ---------- 未选中：页面设置 ---------- -->
      <template v-else-if="store.selectedComponent === null">
        <RcField label="纸张">
          <input class="input" :value="settings.paper" readonly />
        </RcField>

        <RcField label="方向" html-for="rc-orientation">
          <select
            id="rc-orientation"
            class="select"
            :value="settings.orientation"
            @change="onOrientation"
          >
            <option value="portrait">{{ ORIENTATION_LABEL.portrait }}</option>
            <option value="landscape">{{ ORIENTATION_LABEL.landscape }}</option>
          </select>
        </RcField>

        <div class="field-row">
          <RcField label="上边距" html-for="rc-margin-top">
            <input
              id="rc-margin-top"
              class="input tnum"
              type="number"
              min="5"
              max="50"
              :value="settings.marginTopMm"
              data-testid="rc-margin-top"
              @change="onMargin('marginTopMm', $event)"
            />
          </RcField>
          <RcField label="下边距" html-for="rc-margin-bottom">
            <input
              id="rc-margin-bottom"
              class="input tnum"
              type="number"
              min="5"
              max="50"
              :value="settings.marginBottomMm"
              data-testid="rc-margin-bottom"
              @change="onMargin('marginBottomMm', $event)"
            />
          </RcField>
        </div>

        <div class="field-row">
          <RcField label="左边距" html-for="rc-margin-left">
            <input
              id="rc-margin-left"
              class="input tnum"
              type="number"
              min="5"
              max="50"
              :value="settings.marginLeftMm"
              @change="onMargin('marginLeftMm', $event)"
            />
          </RcField>
          <RcField label="右边距" html-for="rc-margin-right">
            <input
              id="rc-margin-right"
              class="input tnum"
              type="number"
              min="5"
              max="50"
              :value="settings.marginRightMm"
              @change="onMargin('marginRightMm', $event)"
            />
          </RcField>
        </div>

        <p class="field__hint">页边距范围 5–50 mm。改完即重排，不需要手动刷新。</p>
      </template>

      <!-- ---------- 选中：内容 ---------- -->
      <template v-else-if="activeTab === 'content'">
        <RcField
          v-for="field in fields"
          :key="field.key"
          :label="field.labelByTrack?.[store.doc.languageTrack] ?? field.label"
          :html-for="`rc-field-${field.key}`"
          :required="field.required === true"
          :error="errors[field.key] ?? ''"
        >
          <textarea
            v-if="field.kind === 'list'"
            :id="`rc-field-${field.key}`"
            class="textarea textarea--tall"
            :class="errors[field.key] ? 'input--invalid' : ''"
            :value="listValue(field.key)"
            :data-testid="`rc-field-${field.key}`"
            placeholder="一行一条"
            @change="onList(field.key, $event)"
          ></textarea>
          <input
            v-else
            :id="`rc-field-${field.key}`"
            class="input"
            :class="[
              errors[field.key] ? 'input--invalid' : '',
              field.kind === 'date' ? 'tnum' : '',
            ]"
            :value="textValue(field.key)"
            :data-testid="`rc-field-${field.key}`"
            @input="onText(field.key, $event)"
          />
        </RcField>
      </template>

      <!-- ---------- 选中：样式 ---------- -->
      <template v-else-if="activeTab === 'style'">
        <div class="field-row field-row--tight">
          <RcField label="正文字号" html-for="rc-style-font-size">
            <div class="unit-input">
              <input
                id="rc-style-font-size"
                class="input tnum"
                type="number"
                min="6"
                max="72"
                step="0.5"
                :value="fontSize"
                data-testid="rc-style-font-size"
                @change="onStyle('fontSizePt', $event)"
              />
              <span class="unit-input__unit">pt</span>
            </div>
          </RcField>
          <RcField label="行距" html-for="rc-style-line-height">
            <div class="unit-input">
              <input
                id="rc-style-line-height"
                class="input tnum"
                type="number"
                min="1"
                max="3"
                step="0.05"
                :value="lineHeight"
                data-testid="rc-style-line-height"
                @change="onStyle('lineHeight', $event)"
              />
              <span class="unit-input__unit">倍</span>
            </div>
          </RcField>
        </div>

        <!-- 强调色：只读展示（取色器 P2）。色块由 glass.css 的 .dot-paper 提供（纸面墨绿），
             这里的 hex 只是给人看的文字，不是样式声明 -->
        <div class="field">
          <label class="field__label">强调色</label>
          <div class="colorfield">
            <span class="colorfield__chip dot-paper"></span>
            <span class="colorfield__hex">{{ PAPER_ACCENT_HEX }}</span>
          </div>
        </div>

        <div class="inspector__switchrow">
          <span class="inspector__switchname">在简历中显示</span>
          <RcSwitch
            :model-value="selected?.visible ?? true"
            @update:model-value="selected && store.toggleVisible(selected.id)"
          />
        </div>
      </template>

      <!-- ---------- 选中：布局 ---------- -->
      <template v-else>
        <RcNotice
          v-for="(warning, index) in componentWarnings"
          :key="index"
          :tone="
            warning.severity === 'blocking'
              ? 'danger'
              : warning.severity === 'warning'
                ? 'warning'
                : 'info'
          "
          :title="warning.cause"
        >
          {{ warning.suggestion }}
        </RcNotice>

        <div class="field-row field-row--tight">
          <RcButton @click="selected && store.moveComponent(selected.id, -1)">上移</RcButton>
          <RcButton @click="selected && store.moveComponent(selected.id, 1)">下移</RcButton>
        </div>

        <RcButton
          variant="danger"
          data-testid="rc-delete-component"
          @click="selected && store.removeComponent(selected.id)"
        >
          删除该组件
        </RcButton>
      </template>
    </div>
  </aside>
</template>
