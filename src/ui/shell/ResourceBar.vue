<script setup lang="ts">
/**
 * 左栏（D 段）—— `.side` 结构照 01-editor.html + 06a-layers.html
 *
 * 四个 Tab：模板 / 组件 / 素材 / 页面（与 01-editor.html 严格一致）。
 * 「页面」Tab 里既有页面列表，也有当前页的图层树 —— 图层是"某一页的图层"（06a 的
 * `.layerhead` 上就写着「第 1 页」），把它拆成第 5 个 Tab 会让 Tab 数与稿子不一致。
 *
 * 组件卡**注册表驱动**：`componentRegistry.list()` 决定有哪些卡，
 * 不在模板里硬编码类型 —— 以后加组件只改 definitions.ts（契约 §3 不变量 1）。
 *
 * 拖拽：本轮只保留提示文案「点击添加」，**不做落点计算**（drag-sort 完整接线属 P2）。
 * 不做"能拖但放不下"的假交互。
 */
import { computed, ref } from 'vue'

import { componentRegistry } from '../../components/runtime'
import { DEFAULT_TEMPLATE_ID, useEditorStore } from '../../state/editor-store'
import { getPublishedTemplates } from '../../template/registry'
import { ensureBuiltinTemplates } from '../../template/runtime'
import type { RcTabItem } from '../controls'
import { RcBadge, RcIcon, RcNotice, RcSideTabs } from '../controls'
import LayerPanel from '../layers/LayerPanel.vue'

const store = useEditorStore()
ensureBuiltinTemplates()

const activeTab = ref('components')

const tabs: RcTabItem[] = [
  { key: 'templates', label: '模板' },
  { key: 'components', label: '组件' },
  { key: 'assets', label: '素材' },
  { key: 'pages', label: '页面' },
]

/**
 * 新建入口放在「页面」Tab 底部：设计稿只画了"已有文档"的状态，没有新建按钮，
 * 但产品必须能开新文档（否则 NewDocDialog 是死组件）。新建/切换文档本来属于
 * 「页面」语义，且复用既有 `.btn`，不新增任何设计稿之外的视觉。
 */
const emit = defineEmits<{ newDoc: [] }>()

/** 组件卡图标：按语义给图标，不按类型名硬套 */
const ICON_BY_TYPE: Record<string, string> = {
  basics: 'user',
  education: 'graduation-cap',
  experience: 'briefcase',
  projects: 'code',
  skills: 'quote',
  awards: 'flag',
}

const DESC_BY_TYPE: Record<string, string> = {
  basics: '姓名、意向与联系方式',
  education: '学校、专业与学业表现',
  experience: '公司、职责与量化成果',
  projects: '职责、技术栈与量化成果',
  skills: '专业能力与语言水平',
  awards: '荣誉、证书与时间',
}

const cards = computed(() =>
  componentRegistry.list().map((definition) => ({
    type: definition.type,
    name: definition.displayName,
    desc: DESC_BY_TYPE[definition.type] ?? '',
    icon: ICON_BY_TYPE[definition.type] ?? 'square-dashed',
  })),
)

const templates = computed(() => getPublishedTemplates())

const appliedNotice = ref<string | null>(null)

/** 拖入添加的自定义 MIME。用自定义类型而不是 text/plain：避免与普通文本拖拽互相干扰 */
const CARD_MIME = 'application/x-rc-component'

function addComponent(type: string): void {
  store.addComponent(type)
}

/** 组件卡拖拽开始：把类型塞进 dataTransfer，画布 drop 时读它 */
function onCardDragStart(event: DragEvent, type: string): void {
  const dt = event.dataTransfer
  if (dt === null) return
  dt.setData(CARD_MIME, type)
  dt.effectAllowed = 'copy'
}

function applyTemplate(templateId: string): void {
  const report = store.applyTemplateById(templateId)
  appliedNotice.value =
    report === null ? '模板不可用，请刷新后重试' : `已应用模板「${templateId}」，可撤销`
}

const pageRows = computed(() =>
  store.layout.pages.map((page) => ({
    index: page.pageIndex,
    count: store.layout.boxes.filter((b) => b.pageIndex === page.pageIndex).length,
  })),
)
</script>

<template>
  <aside class="side">
    <RcSideTabs v-model="activeTab" :items="tabs" />

    <div class="side__body">
      <!-- 组件 -->
      <template v-if="activeTab === 'components'">
        <div class="side__section">
          <span class="side__section-title">简历组件</span>
          <span class="side__section-hint">点击添加到简历</span>
        </div>

        <div class="compgrid">
          <button
            v-for="card in cards"
            :key="card.type"
            class="compcard"
            draggable="true"
            :data-testid="`rc-component-item-${card.type}`"
            @click="addComponent(card.type)"
            @dragstart="onCardDragStart($event, card.type)"
          >
            <span class="compcard__ico"><RcIcon :name="card.icon" /></span>
            <span class="compcard__text">
              <span class="compcard__name">{{ card.name }}</span>
              <span class="compcard__desc">{{ card.desc }}</span>
            </span>
            <span class="compcard__grip"><RcIcon name="grip-vertical" :size="14" /></span>
          </button>
        </div>

        <!-- 文案照 01-editor.html:114 原文。曾被改写成「顺序请用「图层」页调整」
             （当时拖拽未实现），现在拖拽已落地（组件卡/图层行/纸面片段三处），
             设计稿原文反而是准确的 —— 不许改写文案来迁就实现。 -->
        <p class="side__note">内容自动参与排版与分页。拖动组件可调整顺序。</p>
      </template>

      <!-- 模板 -->
      <template v-else-if="activeTab === 'templates'">
        <div class="side__section">
          <span class="side__section-title">内置模板</span>
          <span class="side__section-hint">{{ templates.length }} 套</span>
        </div>
        <RcNotice v-if="appliedNotice" tone="success">{{ appliedNotice }}</RcNotice>
        <button
          v-for="template in templates"
          :key="template.id"
          class="card"
          :data-testid="`rc-template-item-${template.id}`"
          style="width: 100%; text-align: left; margin-bottom: 8px"
          @click="applyTemplate(template.id)"
        >
          <span class="compcard__text">
            <span class="compcard__name">{{ template.id }}</span>
            <span class="compcard__desc">{{ template.componentOrder.length }} 个区块</span>
          </span>
          <span style="display: flex; align-items: center; gap: 6px; margin-top: 6px">
            <RcBadge :tone="template.languageTrack === 'zh' ? 'accent' : 'neutral'" size="sm">
              {{ template.languageTrack === 'zh' ? '中文' : 'English' }}
            </RcBadge>
            <RcBadge v-if="template.id === DEFAULT_TEMPLATE_ID" tone="neutral" size="sm"
              >默认</RcBadge
            >
          </span>
        </button>
      </template>

      <!-- 素材 -->
      <template v-else-if="activeTab === 'assets'">
        <div class="bg-empty">素材库规划在 P2</div>
      </template>

      <!-- 页面 -->
      <template v-else-if="activeTab === 'pages'">
        <!-- 「返回工作台」已按 Amor 图示移到顶栏左上（原文件名的位置），此处不再重复 -->

        <div class="side__section">
          <span class="side__section-title">文档页面</span>
          <span class="side__section-hint">{{ pageRows.length }} 页</span>
        </div>
        <button
          v-for="row in pageRows"
          :key="row.index"
          class="pagerow"
          :class="row.index === 0 ? 'pagerow--on' : ''"
        >
          <span class="pagerow__no">{{ row.index + 1 }}</span>
          <span class="pagerow__name">第 {{ row.index + 1 }} 页</span>
          <span class="pagerow__count">{{ row.count }}</span>
        </button>

        <p class="side__note">
          模板与素材库规划在 P2；新建会开启一份空白简历，当前文档可撤销回退。
        </p>
        <button
          class="btn btn--ghost btn--sm"
          style="width: 100%"
          data-testid="rc-new-doc"
          @click="emit('newDoc')"
        >
          新建简历
        </button>

        <LayerPanel
          :components="store.components"
          :selected-id="store.selectedId"
          :page-index="0"
          @select="store.selectComponent"
          @toggle-visible="store.toggleVisible"
          @move="(id, direction) => store.moveComponent(id, direction)"
          @move-to="(id, toIndex) => store.moveComponentTo(id, toIndex)"
        />
      </template>

    </div>
  </aside>
</template>
