# UI 设计稿还原方案（2026-10-29 Amor 定）

> 触发：Amor 指出「开发出来的 UI 页面和定版设计稿完全不同」，要求把
> `docs/design/mockups/figma/` 的 `tokens.css → app.css → glass.css` 三层样式
> 逐条移植进 Vue 组件，冲突的改、不用的删。
>
> 本文是执行依据。凡与旧组件实现冲突，以本文 + 设计稿 CSS 为准。

---

## 0. 根因（先认账，避免重犯）

三处硬错，不是审美分歧：

| # | 事实 | 后果 |
|---|---|---|
| 1 | 设计稿用另一套 token 词表（`--rc-accent` / `--rc-text-2` / `--rc-s1` / `--rc-r-ctl` / `--rc-fz-*`），`src/design/tokens.css` 是 `--rc-color-*` / `--rc-space-*` / `--rc-radius-*` | 两套词表互不识别，设计稿数值从未生效 |
| 2 | `docs/design/mockups/figma/app.css`（1414 行）**从未进入 `src/`** | 所有结构与组件样式（`.topbar` / `.side` / `.canvas__bar` / `.inspector` / `.p-sec` …）在应用里完全不存在 |
| 3 | `src/design/glass.css`（151 行）是照 `.rc-*` 类名重写的**另一份**文件，且**全项目无人 import** | 材质层从未加载；它是分叉产物，不是设计稿 |

`src/ui/**` 从 TC-008 起就是"按 PRD 文字描述自建骨架"，没有一屏是按设计稿 DOM 搭的。
所以这不是"再调调样式"，是**把设计系统真正接进来**。

---

## 1. 三条不可让的边界

1. **契约类型不动**：`LayoutResult` / `ResumeDocument` / `QualityReport` / `MappingReport` 字段一个不多一个不少（`docs/contract/CONTRACT.md`）。
2. **坐标仍只来自 `LayoutResult.boxes`**（契约 §10.2）。设计稿纸面是语义流式排版，我们不能改成让 CSS 自然流——那会废掉分页与导出。**做法：boxes 定位 + box 内部用设计稿纸面类名渲染**。
3. **不得引入设计稿以外的色值**（2026-10-29 修订，原表述为"tokens.css 之外禁止 hex / rgb()"）。
   设计稿自身在 `glass.css` 有 31 处、`app.css` 有 5 处 `rgba()` 字面量（玻璃透明度、阴影），
   那是设计定义本身，**必须原样保留**——把它们提升成新 token 既不是"逐条移植"，也会改动渲染值。
   规则准确表述：
   - 设计稿里已有的 hex / rgba：原样搬，不改造；
   - 移植过程中**不得新增**任何设计稿没有的色值；
   - §2.2 新增的产品增补类若需要颜色，一律引既有 `var(--rc-*)`，不写字面量。

---

## 2. A 段 · 设计系统落位（`src/design/`）

### 2.1 `tokens.css` —— 用设计稿词表整体替换

以 `docs/design/mockups/figma/tokens.css` 为唯一来源，逐条搬入，只允许三处改动：

1. **删掉**第 17 行的 `@import url('https://fonts.googleapis.com/…')`。字体改为本地 `@font-face`（`fonts.css`），不依赖网络。
2. **删掉**文件末尾的 `.paper-slot` 规则（那是稿子页面的结构类，规则本体在 `app.css`，不要在这里重复）。
3. **追加**「§18 EP 桥接兼容别名」块：`element-plus-bridge.css` 仍在引用旧名（实测 **26 个** `--rc-color-*`，含 `primary` / `text` / `primary-light-3…9` / `primary-dark-2` / `border` / `bg` 等）。这些名字**一律用 `var()` 指向新 token**，除 6 条派生色必须实算外，不重复写数值。数量以 `grep -o -- '--rc-color-[a-z0-9-]*' src/design/element-plus-bridge.css | sort -u | wc -l` 的实测为准：

```css
/* §18 EP 桥接兼容别名 —— 仅为 element-plus-bridge.css 存在，产品 UI 禁用这些名字 */
--rc-color-primary: var(--rc-accent);
--rc-color-primary-hover: var(--rc-accent-hover);
--rc-color-primary-active: var(--rc-accent-active);
--rc-color-primary-light-3: #6d9fe0;   /* 30% 白 */
--rc-color-primary-light-5: #97bbe9;   /* 50% 白 */
--rc-color-primary-light-7: #c1d6f2;   /* 70% 白 */
--rc-color-primary-light-8: #d5e4f6;   /* 80% 白 */
--rc-color-primary-light-9: #eaf1fb;   /* 90% 白 */
--rc-color-primary-dark-2: #265ea8;    /* 20% 黑 */
--rc-color-text: var(--rc-text);
--rc-color-text-secondary: var(--rc-text-2);
--rc-color-text-tertiary: var(--rc-text-3);
…
```

> **派生色必须实算，不得目测、不得抄旧调色板。** 上述 6 个值是 2026-10-29 复核后的正确值。
> 算式与舍入规则（必须严格照此，否则会出现第三个版本）：
>
> ```
> 基色 #2f76d2 = rgb(47, 118, 210)
> light-N = round(c + (255 - c) × N%)      N = 3 / 5 / 7 / 8 / 9
> dark-2  = round(c × (1 - 20%))
> round    = Math.round（四舍五入，.5 进位；不要用 Python 的银行家舍入）
> ```
>
> 逐通道实算（供复核）：
>
> | 档位 | R | G | B | 结果 |
> |---|---|---|---|---|
> | light-3 | 47→109.4→109 | 118→159.1→159 | 210→223.5→224 | `#6d9fe0` |
> | light-5 | 47→151 | 118→186.5→**187** | 210→232.5→**233** | `#97bbe9` |
> | light-7 | 47→192.6→193 | 118→213.9→214 | 210→241.5→242 | `#c1d6f2` |
> | light-8 | 47→213.4→213 | 118→227.6→228 | 210→246 | `#d5e4f6` |
> | light-9 | 47→234.2→234 | 118→241.3→241 | 210→250.5→**251** | `#eaf1fb` |
> | dark-2 | 47→37.6→38 | 118→94.4→94 | 210→168 | `#265ea8` |
>
> **反例判定**：`tokens.css` 里若出现 `#5a92dc` / `#86aeda` / `#b2cbea` / `#c8dbf0` / `#dee9f6` / `#26609f`
> 这 6 个中的任何一个，判 FAIL——那是本文档旧版本的错误示例，不是从 `#2f76d2` 算出来的。
> 证伪依据不依赖算式：混白比例递增时三个通道必须**单调不减**，而旧值的 B 通道是
> 220→218→234→240→246（light-5 比 light-3 还暗），同基色递增混白产生不出这个序列。

**登记已知偏差**：`#2f76d2` 压在 EP 的浅色底上不达 AA，且**最低的一档不是 light-9**（2026-10-29 按 WCAG 相对亮度实测）：

| 组合 | 对比度 | AA 4.5:1 |
|---|---|---|
| `#2f76d2` on 白 | 4.52:1 | 通过 |
| `#2f76d2` on light-9 `#eaf1fb` | 3.98:1 | 不通过 |
| `#2f76d2` on light-7 `#c1d6f2` | **3.05:1** | 不通过，**本组最差** |

接受理由：EP 组件在 P0 只服务 `ElementProbe` 开发探针，产品界面全部走自研类名，不出现这些组合。
若将来产品要引入 EP 表单组件，必须回来把主色下沉到 `#2867c4`（旧版已在白底验证 4.78:1），并重审全部浅色底组合。

### 2.2 `app.css` —— 新建，逐条移植

把 `docs/design/mockups/figma/app.css` 搬到 `src/design/app.css`，规则声明**一字不改**（这是"逐条移植"的硬标准）。只允许两类删改：

**删掉（只服务稿子的说明书页与索引页，产品里没有这些屏）**

- §18 整节 `.specwrap` / `.spec*` / `.swatch` / `.typerow` / `.deltas` / `.chip`
- §19 整节 `.idx` / `.idx__*` / `.idxcard*`
- `.navhint` 及其 `@media (hover: none)` 块
- `.dot-*` 工具类（`.dot-accent` / `.dot-soft` / `.dot-white` / `.dot-canvas` / `.dot-text` / `.dot-secondary` / `.dot-border` / `.dot-danger` / `.dot-warn` / `.dot-select`）—— 它们是给 HTML 里放色卡用的，产品不用

**追加「§20 产品增补」一节**，只允许以下几类，每条写清为什么设计稿没有：

| 新增类 | 用途 | 为什么设计稿没有 |
|---|---|---|
| `.field__req` | 必填星号 | 稿子是静态页，不表达必填 |
| `.card__media` | 卡片媒体区 | 稿子的 `.card` 没有媒体槽 |
| `.hintbar--ok` / `.hintbar--warn` / `.hintbar--danger` | 提示条语气 | 稿子只有中性提示条，产品要三档语气 |
| `.p-piece` | 纸面片段容器 | 稿子纸面是 CSS 自然流（`.p-header` / `.p-sec` 直接排），**产品必须按 `LayoutResult.boxes` 绝对定位**（契约 §10.2）。片段需要 `position: absolute; overflow: hidden` 承接跨页裁切 |

其余一律不许自创类名。

> `.p-piece` 的完整声明（只有三条，不要加视觉样式——纸面观感全部由内部 `.p-*` 结构承担）：
> ```css
> .p-piece { position: absolute; overflow: hidden; }
> ```
> 定位所需的 `left/top/width/height` 由 Vue 内联样式给（mm 单位），不写进 CSS。

### 2.3 `glass.css` —— 用设计稿版本覆盖

用 `docs/design/mockups/figma/glass.css` **整体替换**现有 151 行版本（那份是分叉产物）。
只改一处：把 `.app, .idx, .specwrap { position: relative; z-index: 1; }` 里的 `.idx, .specwrap` 删掉，保留 `.app`。

同时删掉 `.canvas, .sheet, .specwrap, .idx, .page` 中的 `.specwrap, .idx`。

### 2.4 引入顺序（`src/App.vue`）

```css
@import './design/tokens.css';
@import './design/fonts.css';
@import './design/app.css';
@import './design/glass.css';
```

顺序不可换：值 → 结构 → 材质。`glass.css` 靠覆盖 `app.css` 的 `background` 生效，放前面等于没写。

---

## 3. B 段 · 图标体系

设计稿用 `icons.js` 在 DOMContentLoaded 时把 `data-ic` 注入 SVG（**52 个** lucide 风格图标，1.5 描边，24 viewBox。原文写"60 个"是笔误，2026-10-29 按 `P` 对象键数实测更正）。
Vue 里改成组件：

**`src/ui/controls/icons.ts`** —— 把 `icons.js` 的 `P` 对象原样搬成 `export const ICON_PATHS: Record<string, string>`（**52 条**，一个不少；以 `grep -oE "^    [a-z0-9'-]+:" icons.js | wc -l` 实测为准）。

**`src/ui/controls/RcIcon.vue`**

```vue
<RcIcon name="download" :size="14" />
<!-- 渲染 -->
<i class="ic ic--14"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">…</svg></i>
```

- `size` 只允许 12 / 14 / 16 / 18 / 20（对应 `.ic--12/14/18/20`，16 是默认不带修饰类）
- 未知 name 渲染空 svg，不抛错
- `aria-hidden="true"`，语义靠外层 `aria-label`/`title`

---

## 4. C 段 · 基础控件改造（保留组件，换类名）

控件不是设计稿里的东西，是 TC-004 自建的。**保留组件、保留 props/emits、保留无障碍行为**，只把内部 class 换成设计稿类名。这样 `tests/controls/controls.test.ts` 的 45 条用例只需机械替换类名断言。

| 组件 | 旧类 | 新类（设计稿） | 备注 |
|---|---|---|---|
| `RcButton` | `.rc-btn` `--primary/--default/--ghost/--danger` `--sm/--md` `.rc-btn__icon/__label` | `.btn` `--primary/--danger`（default 不带修饰，ghost 用 `--ghost`）`--sm/--lg/--icon` | icon 槽改放 `<RcIcon>`；`.rc-btn__label` 删掉，文字直接进 button |
| `RcBadge` | `.rc-badge` `--accent/--success/--warning/--danger/--neutral` `.rc-badge__dot` | `.badge` `--accent/--ok/--warn/--danger/--neutral/--outline`，`size="md"` → `--lg` | **`dot` 属性删掉**（设计稿 badge 无圆点），对应测试用例改写为断言 tone 类 |
| `RcField` | `.rc-field` `__label/__error/__hint/__required/__head/__actions` | `.field` `__label/__error/__hint`，必填用 `__req` | `head`/`actions` 两个槽删掉（设计稿没有），用到的地方改由调用方排版 |
| `RcNotice` | `.rc-notice` `__icon/__title/__body/__actions` | `.hintbar` `__ico/__t`，语气 `--ok/--warn/--danger` | `actions` 槽内容直接进 `.hintbar`（flex 已够） |
| `RcSwitch` | `.rc-switch` `--on` `.rc-switch__thumb` | `.switch` `--on`（滑块走 `::after`） | **删掉 thumb span**，样式由伪元素画 |
| `RcCard` | `.rc-card` `__media/__body` | `.card` `__media` | body 槽不需要包裹层 |
| `RcTabs` | `.rc-tabs` | **拆成两个**：`RcSideTabs`（`.side__tabs/.side__tab/--on`）与 `RcInspectorTabs`（`.inspector__tabs/.inspector__tab/--on`） | 设计稿三处 tab 形态不同，硬套一个组件会互相将就 |
| `RcOverflowBadge` | `.rc-overflow-badge` | `.paper-flag` | 数字态仍显示计数，单条显示 `!` |

**同步改** `tests/controls/controls.test.ts`：只改选择器字符串与 tone→class 的映射，断言语义与用例数（45）不变。

---

## 5. D 段 · 外壳组件按设计稿 DOM 重写

参照 `docs/design/mockups/figma/01-editor.html` 的结构逐块对齐。类名一律用设计稿原名。

### 5.1 `Toolbar.vue` → `.topbar`

```
.topbar
├ .topbar__left   → .brand(.brand__mark>RcIcon file-text, .brand__name) + .topbar__divider + .docmeta(.docmeta__name, .docmeta__sub)
├ .topbar__mid    → .segmented(中文/English，English 带 .segmented__dot title="英文轨未完成" 且 disabled) + .iconbtn undo/redo
└ .topbar__right  → 保存态(.statusbar__item.muted + RcIcon check-circle) + .btn「导出前检查」+ .btn.btn--primary「导出」+ .avatar
```

- `.docmeta__name` 绑定 `doc.meta.title`，可编辑（点击变 input，失焦回文本）
- `.docmeta__sub` 显示 `语言轨 · 自动排版`
- 导出两个按钮：`导出前检查` → 打开检查弹窗；`导出` → 弹格式选择（PDF / Word），再走质量关卡
- 保存态文案与 tone 按 `saveStatus`：`已保存` / `待保存` / `保存中` / `保存失败`（失败时用 `.statusbar__item--warn`）

### 5.2 `ResourceBar.vue` → `.side`

```
.side
├ .side__tabs → 模板 / 组件 / 素材 / 页面（四个 .side__tab，当前 .side__tab--on）
└ .side__body
   ├ 组件 Tab：.side__section(标题+提示) + .compgrid > .compcard × N（2 列，最后奇数张横跨两列——靠 CSS `:last-child:nth-child(odd)` 已实现）+ .side__note
   ├ 模板 Tab：.side__section + 模板卡列表（复用 `.tplcard` 的简化版：`.card` + 名称 + 语言轨 badge + 应用按钮）
   ├ 素材 Tab：占位（`.bg-empty` 样式 + 文案「素材库规划在 P2」）
   └ 页面 Tab：`.pagerow` 列表（每页一行：页码 / 名称 / 该页组件数）
```

**图层不再放左栏**——设计稿左栏第 4 个 Tab 是「页面」，图层在 06a 里是第 4 个 `side__tab`（图层）。以 06a 为准：第 4 个 Tab 叫「图层」，内容用 `.layerhead` + `.layergroup` + `.layerrow`。

### 5.3 `CanvasView.vue` → `.canvas`

```
.canvas
├ .canvas__bar   → .canvas__meta(第 N / M 页 + 分隔 + A4 · 210 × 297 mm) + .canvas__tools(.canvas__zoom 缩小/百分比/放大 + 适合页面)
└ .canvas__scroll
   ├ .paper-slot > .paper   （每页一个 slot）
   └ .paper-next             （第二页残页示意，仅在多页时显示）
```

`.paper` 的渲染规则（**本方案最关键的一条**）：

- `.paper` 保留设计稿的 `width/height/transform: scale(var(--rc-zoom))/transform-origin: top left/background/box-shadow`
- **`padding` 必须改成 `0`**：boxes 已含页边距（`contentX = marginLeftMm`），保留 padding 会二次偏移
- 每个 `ComponentBox` → 绝对定位 `div.p-piece`，`left/top/width/height` 用 **mm 单位**（浏览器 96dpi 换算与 `mmToPx` 完全一致）
- `div.p-piece` 内部按组件类型渲染设计稿纸面结构：
  - `basics` → `.p-header > .p-header__main > (.p-name / .p-intent / .p-contact)` + 可选 `.p-photo`
  - 其他 → `.p-sec__title`（组件 `displayName`）+ `.p-item`（`.p-item__head > .p-item__name + .p-item__date` / `.p-item__role` / `.p-bullets > li`）
- 跨页片段：`div.p-piece` 内层 `transform: translateY(-offsetMm)` + 外层 `overflow: hidden`
- 选中态：`.p-piece` 上叠 `.selbox`（设计稿已有的 8 个手柄 + `.selbox__label`）
- 页码：`.paper-foot` 显示 `当前页 / 总页数`

### 5.4 `PropertyPanel.vue` → `.inspector`

```
.inspector
├ .inspector__head  → .inspector__title（选中组件名，未选中显示「页面设置」）+ .iconbtn sliders
├ .inspector__tabs  → 内容 / 样式 / 布局（三个 .inspector__tab）
└ .inspector__body
   ├ 内容 Tab：.field × N（.field__label + .input/.textarea/.select）；列表字段用 .textarea--tall；
   │           必填未填时 .input--invalid + .field__error + .field__hint（上次有效值）
   ├ 样式 Tab：.field-row.field-row--tight 正文字号/行距（.unit-input + .unit-input__unit）
   │           + .colorfield 强调色（.colorfield__chip + .colorfield__hex，只读展示纸面墨绿）
   │           + .inspector__switchrow 可见性开关
   └ 布局 Tab：该组件的布局警告（.checkitem 或 .hintbar--warn）+ 上移/下移 + 删除（.btn--danger）
```

### 5.5 `StatusBar.vue` → `.statusbar`

```
.statusbar
├ .statusbar__group 左：.statusbar__item(保存态 + 时间)
└ .statusbar__group 右：.statusbar__item--warn(.statusbar__dot + 「N 处溢出」) + 阻断项计数
```

### 5.6 弹窗

`NewDocDialog` / `ExportDialog` / `OverflowDialog` / `ImportWizard` 统一改成 `.scrim > .dialog`：

```
.scrim > .dialog.dialog--md
├ .dialog__head  → .dialog__title + .dialog__sub
├ .dialog__body  → 内容（检查项用 .checkitem，选项用 .optcard）
└ .dialog__foot  → .dialog__foot-meta + .dialog__actions(.btn / .btn--primary)
```

`OverflowDialog` 的角标改用 `.paper-flag`，浮层用 `.popover`。

### 5.7 `BoardToolbar.vue`

画板属 P2，但**不能删**（`NewDocDialog` 有画板入口）。按 `.actionbar` 风格保留，按钮全部 `disabled` + `title="画板功能规划在 P2"`。

---

## 6. E 段 · 纸面结构化（引擎侧，本方案唯一动引擎的地方）

设计稿的小节标题、条目「名称 + 日期同行」、「角色行」、「要点列表」在现有 `text-runs.ts` 里表达不出来——它只产出扁平 body/title/bullet。必须升级。

### 6.1 `TextRunRole` 扩为

```ts
export type TextRunRole =
  | 'name'        // 姓名 30px
  | 'intent'      // 求职意向 13px
  | 'contact'     // 联系方式 11px
  | 'section'     // 小节标题 17px（组件 displayName，带竖条）
  | 'item-title'  // 条目标题 14px（左），可带 trailing 日期
  | 'item-role'   // 角色行 11.5px
  | 'bullet'      // 要点 14px
  | 'plain'       // 普通段落 14px
```

`TextRunSpec` 增加 `trailing?: string`（仅 `item-title` 用，红色右对齐日期）。

### 6.2 字号对照（照设计稿 `--rc-p-fz-*` 换算，1px = 0.75pt）

| role | 设计稿 px | pt | 行高 |
|---|---|---|---|
| name | 30 | 22.5 | 1.15 |
| intent | 13 | 9.75 | 1.5 |
| contact | 11 | 8.25 | 1.75 |
| section | 17 | 12.75 | 1.5 |
| item-title | 14 | 10.5 | 1.35 |
| item-role | 11.5 | 8.625 | 1.5 |
| bullet | 14 | 10.5 | 1.62 |
| plain | 14 | 10.5 | 1.62 |

### 6.3 各组件 → 行序列

| 组件 | 行序列 |
|---|---|
| `basics` | name(姓名) / intent(求职意向) / contact(电话 · 邮箱 · 城市，多段合并成一行以 `·` 分隔) |
| `education` | section(教育经历) / item-title(学校 · 专业, trailing=起止) / item-role(学历 · GPA) |
| `experience` | section / item-title(公司 · 职位, trailing=起止) / bullet×N |
| `projects` | section / item-title(项目名, trailing=起止) / item-role(角色 · 技术栈) / bullet×N |
| `skills` | section / plain(技能名 · 熟练度 · 佐证) 每个技能一条 |
| `awards` | section / item-title(奖项, trailing=时间) / plain(备注) |
| 未知组件 | section(originalType) + plain×N（从 raw 收集） |

### 6.4 `compose.ts` 适配

- `section` 行参与测量，`item-title` 带 `trailing` 时按「内容宽 − 日期宽 − 12px 间距」测量正文
- 块高 = 各行高之和 + 上下 padding
- `isHeading` 判定：块首行为 `section` 时该块是标题块（沿用现有"本类型首次出现"规则）
- 确定性、`inputHash`、mm 单位等既有不变量全部不变

**`tests/layout/compose.test.ts` 需同步更新**：这是本卡新写的测试，允许改断言；但必须保留原有覆盖面（确定性 / 可见性 / 分页 / overflow / 未知组件 / 语言轨），并新增「section 行存在」「item-title 带 trailing」两条。

---

## 7. 已知偏差（必须登记，不许悄悄糊过去）

1. **纸面页边距**（**已解决**，2026-10-30，Amor 1:1 裁决）：设计稿 `.paper` 内边距 54/60/44px（≈14.3/15.9/11.6mm），文档默认 20mm。
   本方案保留 20mm（印刷更稳、PRD 已定），视觉上四周宽约 4mm。
   ~~如需与稿子完全一致，改 `DEFAULT_PAGE_SETTINGS` 的四个 margin 为 14.29/15.88/11.64/15.88 —— 需 Amor 拍板。~~
   **整改记录（2026-10-30）**：Amor 立「前端 UI 必须一比一复刻 Figma 设计稿」铁律后拍板整改。
   `src/model/factory.ts` 的 `DEFAULT_PAGE_SETTINGS`、`src/model/validate.ts` 的兜底 fallback、
   `src/template/templates/builtin.ts` 的内置模板 pageSettings，四个 margin 统一改为设计稿换算值
   **14.28 / 15.87 / 11.64 / 15.87**（54/60/44px 按 794px=210mm 换算，保留 2 位小数；
   注意与上面划线里的建议值 14.29/15.88 的差异是四舍五入方向，以本记录为准）。
   `src/design/app.css` 的 `.paper` padding 保持 0 不动：页边距由 `LayoutResult.boxes` 的 mm 坐标承担，
   保留 padding 会二次偏移。保真测试见 `tests/model/model.test.ts`「默认页边距与设计稿 1:1」。
2. **EPS 主题色**：`#2f76d2` 在 EP `light-9` 上不达 AA（见 §2.1）。EP 仅服务开发探针，产品界面不用。
3. **字体**：设计稿用 Google Fonts 的 Inter + Noto Sans SC；本地方案用 `Rc Sans`（Noto Sans SC 子集）替代 Inter 承担中文，西文回退系统栈。字形宽度略有差异，排版以本地字体为准。

---

## 8. 验收

1. **四门全绿**：`pnpm lint` / `pnpm type-check` / `pnpm test` / `pnpm build`
2. **截图比对**：`npx vite` 起服务，headless Chrome 截 1440×900 整屏到 `$TEMP`，与 `01-editor.html` 同尺寸截图并排比对。至少比对：顶栏高度与三段布局、左栏 2 列组件卡、画布纸面与页码、右栏三 Tab 表单、状态栏两项。
3. **保真守卫测试** `tests/design/fidelity.test.ts`：读 `src/design/app.css` 断言关键声明存在，防止以后被"顺手优化"掉。
   - `.topbar` 含 `height: var(--rc-topbar-h)`
   - `.paper` 含 `width: var(--rc-paper-w)` 与 `transform: scale(var(--rc-zoom))`
   - `.paper` 含 `padding: 0`（本方案的刻意改动，防回退）
   - `.btn` 含 `height: 30px`
   - `.side` 含 `width: var(--rc-left-w)`
   - `.inspector` 含 `width: var(--rc-right-w)`
   - `.p-sec__title` 含 `font-size: var(--rc-p-fz-sec)`
   - `tokens.css` 定义 `--rc-accent: #2f76d2`、`--rc-zoom: 0.6`、`--rc-paper-w: 794px`
4. **无死代码**：`src/design/glass.css` 的旧 151 行版本必须不存在；`src/` 内无未被 import 的设计文件；`RcTabs` 旧实现删净。

---

## 9. 执行顺序

```
A 段（tokens / app.css / glass.css / App.vue 引入）
  → B 段（icons.ts + RcIcon）
    → C 段（Rc* 控件换类名 + 更新 controls.test.ts）
      → D 段（6 个外壳组件 + 4 个弹窗按设计稿重写，绑 store 只读数据）
        → 四门 + 截图比对
          → E 段（text-runs v2 + compose 适配 + CanvasView 纸面语义渲染）
            → 四门 + 截图比对
```

A→B→C→D 一次做完再跑四门；E 段单独跑一次四门。
每段跑完把真实输出记下来，红了就地修到绿再往下走。
