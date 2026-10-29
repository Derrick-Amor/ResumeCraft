<!--
  模板库整屏（02）—— DOM 逐层照抄 `docs/design/mockups/figma/02-templates.html`

  职责：选模板的整屏（`.app > .topbar + .sheet + .actionbar`）。
  替掉左栏「模板」Tab 的文字列表（那是临时实现）。

  三条实现纪律：
  1. 类名一律设计稿原名（`.sheet__head` / `.filters` / `.searchbox` / `.filterbtn` /
     `.tpl-grid` / `.tplcard` / `.mini*` / `.actionbar*`），新增类只许 ui-restore-plan.md §2.2。
  2. `.mini` 是**纯 DOM 缩略图**（设计稿 app.css:945-978 的 `.mini__*` 一族），
     不截图、不 canvas 画 —— "能看清大致版式但不承载阅读"。
  3. `.tplcard:hover` 的上浮 + 呼吸环由 glass.css 提供，这里**不手写任何 hover 效果**。

  两段式交互（与导出格式选择同一套语义）：点卡只选中（`.tplcard--on` + aria-checked），
  底部「使用此模板」才应用并进编辑器。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'

import { useEditorStore } from '../../state/editor-store'
import { getPublishedTemplates } from '../../template/registry'
import { ensureBuiltinTemplates } from '../../template/runtime'
import type { TemplateDefinition } from '../../template/schema'
import { RcBadge, RcButton, RcIcon } from '../controls'

const store = useEditorStore()
ensureBuiltinTemplates()

const emit = defineEmits<{ check: []; exportRequest: []; back: [] }>()

/**
 * 模板显示名与卖点文案。
 *
 * **显示名是产品文案，不是模板身份；身份是 id。改名只改这里，不动契约。**
 * **meta / desc 必须从 `02-templates.html` 原文提取，不得凭印象转述**（2026-10 踩过：
 * 转述版与原文有 4 处不一致，且"看着像对的"）。提取脚本口径：`tplcard__name` → 同卡的
 * `tplcard__meta` / `tplcard__desc`。
 * 理由：`TemplateDefinition` 只有 id（`zh-general-001`），加 displayName 会连带改
 * schema / 测试 / apply 的契约类型，为一个文案不值（team-lead 裁决）。
 *
 * industry / stage / language 是筛选维度的标签值，必须与下面 FILTER_OPTIONS 的枚举一致。
 */
const TEMPLATE_DISPLAY: Record<
  string,
  {
    name: string
    meta: string
    desc: string
    foot: string
    industry: string
    stage: string
    language: string
    langBadge: string
  }
> = {
  'zh-student-001': {
    name: '清晰 · 校园',
    meta: '应届生 / 校园招聘',
    desc: '单栏叙事，突出项目与成长',
    foot: 'A4 · 单栏 · 中文轨',
    industry: '教育',
    stage: '应届生',
    language: '中文',
    langBadge: '中文',
  },
  'zh-general-001': {
    name: '秩序 · 专业',
    meta: '1–5 年经验 / 通用',
    desc: '双栏信息，重点一目了然',
    foot: 'A4 · 双栏 · 中文轨',
    industry: '互联网',
    stage: '社招',
    language: '中文',
    langBadge: '中文',
  },
  'en-classic-001': {
    name: '留白 · 双语',
    meta: '外企 / 国际化岗位',
    desc: '中英独立排版，保留呼吸感',
    foot: 'A4 · 单栏 · 中英双轨',
    industry: '外企',
    stage: '海外投递',
    language: '中英双轨',
    langBadge: '中文 / EN',
  },
  'en-modern-001': {
    name: '精研 · 技术',
    meta: '研发 / 技术岗位',
    desc: '技术栈优先，量化工程成果',
    foot: 'A4 · 单栏 · 中文轨',
    industry: '互联网',
    stage: '技术岗',
    language: '英文',
    langBadge: '中文',
  },
}

type FilterKey = 'industry' | 'stage' | 'language'

/** 筛选枚举：全部 + 设计稿提到的那几类。内存过滤，无后端搜索 */
const FILTER_OPTIONS: Record<FilterKey, string[]> = {
  industry: ['全部', '教育', '互联网', '外企'],
  stage: ['全部', '应届生', '社招', '海外投递', '技术岗'],
  language: ['全部', '中文', '中英双轨', '英文'],
}

const FILTER_LABEL: Record<FilterKey, string> = {
  industry: '行业',
  stage: '职业阶段',
  language: '语言',
}

const keyword = ref('')
const activeFilter = ref<FilterKey | null>(null)
const selectedId = ref<string | null>(store.appliedTemplateId)

const filters = ref<Record<FilterKey, string>>({
  industry: '全部',
  stage: '全部',
  language: '全部',
})

const templates = computed<TemplateDefinition[]>(() => getPublishedTemplates())

function displayOf(id: string) {
  return (
    TEMPLATE_DISPLAY[id] ?? {
      name: id,
      meta: '未登记文案',
      desc: '在 TEMPLATE_DISPLAY 里补上这套模板的显示名与卖点',
      foot: 'A4',
      industry: '全部',
      stage: '全部',
      language: '全部',
      langBadge: '—',
    }
  )
}

/** 模糊过滤：名称 + 使用场景（meta/desc）+ 三个维度标签 */
const visibleTemplates = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return templates.value.filter((template) => {
    const display = displayOf(template.id)
    if (filters.value.industry !== '全部' && display.industry !== filters.value.industry) return false
    if (filters.value.stage !== '全部' && display.stage !== filters.value.stage) return false
    if (filters.value.language !== '全部' && display.language !== filters.value.language)
      return false
    if (kw === '') return true
    return `${display.name}${display.meta}${display.desc}`.toLowerCase().includes(kw)
  })
})

const countText = computed(() => `${visibleTemplates.value.length} 套原创模板`)

const selectedDisplay = computed(() =>
  selectedId.value === null ? null : displayOf(selectedId.value),
)

/** 当前已应用的模板（进这屏前用户在用的那套） */
const appliedId = computed(() => store.appliedTemplateId)

function toggleFilter(key: FilterKey): void {
  activeFilter.value = activeFilter.value === key ? null : key
}

function pickOption(key: FilterKey, value: string): void {
  filters.value[key] = value
  activeFilter.value = null
}

function selectCard(id: string): void {
  selectedId.value = id
}

function useTemplate(): void {
  const id = selectedId.value
  if (id === null) return
  store.applyTemplateById(id)
  store.setScreen('editor')
}

function cancel(): void {
  emit('back')
  store.setScreen('editor')
}
</script>

<template>
  <div class="app" data-testid="rc-templates">
    <!-- 顶栏：编辑器语义（与 01 同构），docmeta 副标题显示当前模板名 -->
    <header class="topbar">
      <div class="topbar__left">
        <div class="brand">
          <span class="brand__mark"><RcIcon name="file-text" :size="14" /></span>
          <span class="brand__name">ResumeCraft</span>
        </div>
        <span class="topbar__divider"></span>
        <div class="docmeta">
          <span class="docmeta__name">{{ store.doc.meta.title }}</span>
          <span class="docmeta__sub">
            {{ appliedId === null ? '尚未应用模板' : displayOf(appliedId).name }} / 自动排版
          </span>
        </div>
      </div>
      <div class="topbar__mid">
        <div class="segmented" role="group" aria-label="内容语言轨">
          <button
            class="segmented__item"
            :class="store.doc.languageTrack === 'zh' ? 'segmented__item--on' : ''"
          >
            中文
          </button>
          <button
            class="segmented__item"
            :class="store.doc.languageTrack === 'en' ? 'segmented__item--on' : ''"
            aria-disabled="true"
            title="英文轨未完成"
          >
            English<span class="segmented__dot" title="英文轨未完成"></span>
          </button>
        </div>
        <button
          class="iconbtn"
          :title="store.canUndo ? `撤销：${store.undoLabel ?? ''}` : '没有可撤销的操作'"
          :aria-disabled="store.canUndo ? undefined : 'true'"
          @click="store.undo"
        >
          <RcIcon name="undo" :size="14" />
        </button>
        <button
          class="iconbtn"
          :title="store.canRedo ? `重做：${store.redoLabel ?? ''}` : '没有可重做的操作'"
          :aria-disabled="store.canRedo ? undefined : 'true'"
          @click="store.redo"
        >
          <RcIcon name="redo" :size="14" />
        </button>
      </div>
      <div class="topbar__right">
        <span class="statusbar__item muted" style="margin-right: 6px">
          <RcIcon name="check-circle" :size="12" />{{ store.saveStatus }}
        </span>
        <button class="btn" @click="emit('check')">
          <RcIcon name="clipboard-check" :size="14" />导出前检查
        </button>
        <button class="btn btn--primary" @click="emit('exportRequest')">
          <RcIcon name="download" :size="14" />导出
        </button>
        <span class="avatar">{{ store.doc.meta.title.slice(0, 1) || '简' }}</span>
      </div>
    </header>

    <div class="sheet">
      <div class="sheet__inner">
        <!-- 标题行 -->
        <div class="sheet__head">
          <div>
            <h1 class="h1">选择模板</h1>
            <p class="h1__sub">只改排版，不改变你的内容。切换前将保留当前版本。</p>
          </div>
          <button class="btn btn--lg" data-testid="rc-tpl-back" @click="cancel">
            <RcIcon name="x" :size="14" />返回编辑器
          </button>
        </div>

        <!-- 搜索 + 筛选 -->
        <div class="filters">
          <label class="searchbox">
            <RcIcon name="search" :size="14" class="muted" />
            <input
              v-model="keyword"
              placeholder="搜索模板名称或使用场景"
              data-testid="rc-tpl-search"
            />
          </label>

          <template v-for="(label, key) in FILTER_LABEL" :key="key">
            <!-- 每个筛选器包一层 position:relative，让下拉贴在自己按钮下面。
                 `.popover` 的默认 top:40px/right:16px 是给 08 角标浮层写的（贴屏幕右上），
                 直接用会飘到窗口右上角 —— 这里用内联样式锚回按钮下方。 -->
            <span style="position: relative">
              <button
                class="filterbtn"
                :data-testid="`rc-filter-${key}`"
                @click="toggleFilter(key as FilterKey)"
              >
                {{ label }}：<span class="filterbtn__v">{{ filters[key as FilterKey] }}</span>
                <RcIcon name="chevron-down" :size="12" />
              </button>

              <div
                v-if="activeFilter === key"
                class="popover"
                style="top: calc(100% + 4px); left: 0; right: auto; width: max-content; min-width: 120px"
                :data-testid="`rc-filter-pop-${key}`"
              >
                <button
                  v-for="option in FILTER_OPTIONS[key as FilterKey]"
                  :key="option"
                  type="button"
                  class="checkitem"
                  @click="pickOption(key as FilterKey, option)"
                >
                  {{ option }}
                </button>
              </div>
            </span>
          </template>

          <span class="filters__count" data-testid="rc-tpl-count">{{ countText }}</span>
        </div>

        <!-- 模板卡网格 -->
        <div class="tpl-grid">
          <article
            v-for="template in visibleTemplates"
            :key="template.id"
            class="tplcard"
            :class="selectedId === template.id ? 'tplcard--on' : ''"
            role="radio"
            :aria-checked="selectedId === template.id"
            :data-testid="`rc-tplcard-${template.id}`"
            @click="selectCard(template.id)"
          >
            <div class="tplcard__stage">
              <!-- 缩略图：纯 DOM 纹理，内容是设计稿的静态示意（不承载用户数据）。
                   **这是手绘版式示意，不是按模板 componentOrder 生成的**：
                   mock 里四张卡的内容与各自 componentOrder 并不对应（如「清晰 · 校园」的
                   mini 里没有工作经历），它表达的是"这套版式长什么样"。
                   不是 bug，别来"修"——由数据生成缩略图是新设计，要先定缩略图布局规则。 -->
              <div v-if="template.id === 'zh-student-001'" class="mini">
                <div class="mini__photo"></div>
                <div class="mini__name">张明</div>
                <div class="mini__sub">前端开发工程师</div>
                <div class="mini__contact">
                  广州 · 138 0013 8000<br />zhangming.dev@example.com
                </div>

                <div class="mini__sec">教育经历</div>
                <div class="mini__rule"></div>
                <div class="mini__row">
                  <span class="mini__t">华南理工大学 · 软件工程</span
                  ><span class="mini__d">2022.09-2026.06</span>
                </div>
                <div class="mini__m">本科 · GPA 3.7/4.0 · 专业前 10%</div>

                <div class="mini__sec">项目经历</div>
                <div class="mini__rule"></div>
                <div class="mini__row">
                  <span class="mini__t">校招通 · 校园招聘协作平台</span
                  ><span class="mini__d">2025.03-2025.06</span>
                </div>
                <div class="mini__m">前端负责人 | React / TypeScript / Node.js</div>
                <div class="mini__b">设计岗位检索与投递看板，覆盖 12 个学院。</div>
                <div class="mini__b">虚拟列表与请求缓存，首屏 2.8s→1.4s。</div>
                <div class="mini__row">
                  <span class="mini__t">课表助手 · 多端日程管理</span
                  ><span class="mini__d">2024.09-2024.12</span>
                </div>
                <div class="mini__m">前端开发 | Vue 3 / Pinia / IndexedDB</div>
                <div class="mini__b">课程导入与冲突检测，支持 6 类格式。</div>
                <div class="mini__b">离线缓存与提醒，累计 800+ 用户。</div>

                <div class="mini__sec">专业技能</div>
                <div class="mini__rule"></div>
                <div class="mini__b">TypeScript / JavaScript · React / Vue · Git</div>

                <div class="mini__sec">自我评价</div>
                <div class="mini__rule"></div>
                <div class="mini__b">关注用户体验与工程质量，重视协作与复盘。</div>
              </div>

              <div v-else-if="template.id === 'zh-general-001'" class="mini">
                <div class="mini__name">张明</div>
                <div class="mini__sub">前端开发工程师</div>
                <div class="mini__contact">广州 · 138 0013 8000</div>
                <div class="mini__cols" style="margin-top: 4px">
                  <div>
                    <div class="mini__sec">项目经历</div>
                    <div class="mini__rule"></div>
                    <div class="mini__row">
                      <span class="mini__t">校招通</span><span class="mini__d">25.03-25.06</span>
                    </div>
                    <div class="mini__m">React / TypeScript</div>
                    <div class="mini__b">岗位检索与投递看板，12 个学院。</div>
                    <div class="mini__b">虚拟列表，首屏 2.8s→1.4s。</div>
                    <div class="mini__row">
                      <span class="mini__t">课表助手</span><span class="mini__d">24.09-24.12</span>
                    </div>
                    <div class="mini__m">Vue 3 / Pinia</div>
                    <div class="mini__b">课程导入与冲突检测，6 类格式。</div>
                    <div class="mini__b">离线缓存，800+ 用户。</div>
                    <div class="mini__sec">专业技能</div>
                    <div class="mini__rule"></div>
                    <div class="mini__b">TypeScript · React / Vue</div>
                    <div class="mini__b">Git · 可访问性 · CET-6</div>
                  </div>
                  <div>
                    <div class="mini__sec">教育经历</div>
                    <div class="mini__rule"></div>
                    <div class="mini__t">华南理工大学</div>
                    <div class="mini__m">软件工程 · 本科</div>
                    <div class="mini__m">GPA 3.7/4.0</div>
                    <div class="mini__m">专业前 10%</div>
                    <div class="mini__sec">自我评价</div>
                    <div class="mini__rule"></div>
                    <div class="mini__b">关注体验与工程质量，独立拆解需求。</div>
                    <div class="mini__b">重视协作与复盘。</div>
                    <div class="mini__sec">证书</div>
                    <div class="mini__rule"></div>
                    <div class="mini__b">CET-6 568</div>
                  </div>
                </div>
              </div>

              <div v-else-if="template.id === 'en-classic-001'" class="mini mini--latin">
                <div class="mini__name" style="font-size: 10.5px; letter-spacing: 0.02em">
                  ZHANG MING
                </div>
                <div class="mini__sub">Frontend Developer</div>
                <div class="mini__contact">
                  Guangzhou, China · 138 0013 8000<br />zhangming.dev@example.com
                </div>

                <div class="mini__sec" style="margin-top: 8px">EDUCATION</div>
                <div class="mini__t">South China University of Technology</div>
                <div class="mini__m">B.Eng. Software Engineering · Sep 2022 – Jun 2026</div>
                <div class="mini__m">GPA 3.7/4.0 · Top 10%</div>

                <div class="mini__sec" style="margin-top: 8px">PROJECT EXPERIENCE</div>
                <div class="mini__row">
                  <span class="mini__t">Campus Hire Platform</span
                  ><span class="mini__d">Mar – Jun 2025</span>
                </div>
                <div class="mini__m">Frontend Lead · React / TypeScript / Node.js</div>
                <div class="mini__b">
                  Built a role search and application dashboard for 1,200 students across 12
                  schools.
                </div>
                <div class="mini__b">
                  Reduced initial load from 2.8s to 1.4s with virtualized lists and request caching.
                </div>

                <div class="mini__row">
                  <span class="mini__t">Timetable Assistant</span
                  ><span class="mini__d">Sep – Dec 2024</span>
                </div>
                <div class="mini__m">Frontend · Vue 3 / Pinia / IndexedDB</div>
                <div class="mini__b">
                  Implemented schedule import and conflict detection for six formats.
                </div>
                <div class="mini__b">
                  Added offline cache and reminders; reached 800+ users with 62% weekly active
                  rate.
                </div>

                <div class="mini__sec" style="margin-top: 8px">SKILLS</div>
                <div class="mini__b">TypeScript / JavaScript · React / Vue · HTML / CSS · Git</div>
              </div>

              <div v-else class="mini">
                <div class="mini__name" style="font-size: 9px">张明</div>
                <div class="mini__sub">前端开发工程师</div>
                <div class="mini__contact">广州 · 138 0013 8000 · zhangming.dev@example.com</div>

                <div class="mini__sec">技术能力</div>
                <div class="mini__rule"></div>
                <div class="mini__b">TypeScript / JavaScript · React / Vue · HTML / CSS</div>
                <div class="mini__b">Git · 基础可访问性与性能分析 · CET-6 568</div>

                <div class="mini__sec">教育经历</div>
                <div class="mini__rule"></div>
                <div class="mini__row">
                  <span class="mini__t">华南理工大学 · 软件工程</span
                  ><span class="mini__d">2022.09-2026.06</span>
                </div>
                <div class="mini__m">本科 · GPA 3.7/4.0 · 专业前 10%</div>

                <div class="mini__sec">项目经历</div>
                <div class="mini__rule"></div>
                <div class="mini__row">
                  <span class="mini__t">校招通 · 校园招聘协作平台</span
                  ><span class="mini__d">2025.03-2025.06</span>
                </div>
                <div class="mini__m">前端负责人 · React / TypeScript / Node.js</div>
                <div class="mini__b">设计岗位检索与投递看板，覆盖 12 个学院、1,200 名试用用户。</div>
                <div class="mini__b">采用虚拟列表与请求缓存，首屏 2.8s 降至 1.4s，重复请求减少 38%。</div>

                <div class="mini__row">
                  <span class="mini__t">课表助手 · 多端日程管理</span
                  ><span class="mini__d">2024.09-2024.12</span>
                </div>
                <div class="mini__m">前端开发 · Vue 3 / Pinia / IndexedDB</div>
                <div class="mini__b">构建课程导入与冲突检测，支持 6 类课表格式，导入成功率 96%。</div>
                <div class="mini__b">实现离线缓存及提醒设置，累计 800+ 用户，周活跃率 62%。</div>
              </div>
            </div>

            <div class="tplcard__info">
              <div class="tplcard__titlerow">
                <span class="tplcard__name">{{ displayOf(template.id).name }}</span>
                <RcBadge v-if="template.id === appliedId" tone="accent">当前模板</RcBadge>
                <!-- `.badge--outline` 是设计稿已有类，RcBadge 的 tone 没有这一档，
                     直接用原生 span，不为一个类去扩 controls 的 tone 枚举 -->
                <span v-else class="badge badge--outline">{{ displayOf(template.id).langBadge }}</span>
              </div>
              <div class="tplcard__meta">{{ displayOf(template.id).meta }}</div>
              <p class="tplcard__desc">{{ displayOf(template.id).desc }}</p>
              <div class="tplcard__foot">
                {{ displayOf(template.id).foot
                }}{{ template.id === appliedId ? ' · 已应用' : '' }}
              </div>
            </div>
          </article>
        </div>

        <div class="hintbar">
          <RcIcon name="sparkle" :size="18" class="hintbar__ico" />
          <span>
            <span class="hintbar__t">为不同语言保留合适的简历惯例</span><br />
            「留白 · 双语」支持中文与 English 独立内容轨。英文 CV 不展示照片或政治面貌，项目以
            Built / Implemented / Reduced / Led 等动作动词开头。
          </span>
        </div>
      </div>
    </div>

    <!-- 底部动作条：两段式（选中 ≠ 应用） -->
    <div class="actionbar">
      <div class="actionbar__sel">
        <span class="actionbar__label">已选择：</span>
        <span class="actionbar__name" data-testid="rc-tpl-sel-name">
          {{ selectedDisplay === null ? '未选择模板' : selectedDisplay.name }}
        </span>
        <span class="actionbar__desc">
          {{ selectedDisplay === null ? '点上方卡片选择一套模板' : `${selectedDisplay.foot} · 保留现有内容` }}
        </span>
      </div>
      <div class="actionbar__actions">
        <RcButton variant="default" size="lg" @click="cancel">取消</RcButton>
        <RcButton
          variant="primary"
          size="lg"
          :disabled="selectedId === null"
          :disabled-reason="selectedId === null ? '先选一种模板' : ''"
          data-testid="rc-tpl-use"
          @click="useTemplate"
        >
          <RcIcon name="check" :size="14" />使用此模板
        </RcButton>
      </div>
    </div>
  </div>
</template>
