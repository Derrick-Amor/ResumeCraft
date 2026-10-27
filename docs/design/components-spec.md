# ResumeCraft 组件规格（TC-016）

> ⚠️ **本文的尺寸与结构仍然有效，但配色与材质部分已被 2026-10-27 定稿的 v3 取代。**
> v3 的关键变更：边框全部转蓝、按钮与卡片改为「一层透明色 + backdrop-filter」、
> 卡片悬停上浮 + 蓝色呼吸环。详见 **`docs/design/V3-DELTA.md`**，生产值以 `src/design/tokens.css`（v3）为准。

> 覆盖 PRD 6.4「核心组件规格」全部 11 项。每一项给出 **尺寸 / 状态 / 间距 / 对应 token 变量**。
> 本文不含任何色值：所有颜色一律写 token 变量名；变量定义见 `docs/design/token-values.md` 与 `src/design/tokens.css`。
> 视觉参照：`docs/design/mockups/` 下 8 张静态稿（编号在每节标题后标注）。

## 0. 全局约定（先读这一节，后面不再重复）

### 0.1 尺寸基准

| 项 | 值 | token |
|---|---|---|
| 控件标准高 | 32px | `--rc-size-control` |
| 控件紧凑高 | 28px | `--rc-size-control-sm` |
| 列表/图层行高 | 32px | `--rc-size-row` |
| 顶部工具栏高 | 44px | `--rc-layout-toolbar-h` |
| 状态栏高 | 28px | `--rc-layout-statusbar-h` |
| Tab 高 | 36px | `--rc-size-tab-h` |
| 图标档位 | 16 / 20 / 24 三档 | `--rc-size-icon-sm/md/lg` |

### 0.2 图标

- 一律**内联 SVG**，`viewBox="0 0 24 24"`，`fill="none"`，`stroke="currentColor"`，`stroke-width="1.5"`，`stroke-linecap/linejoin="round"`。
- 只有 16 / 20 / 24 三个尺寸；不给 18、22 这类中间值。
- 不使用 emoji 表达任何状态（PRD 6.7 / 原则 7）；不引入第三方图标库（不增加依赖）。
- 例外：溢出角标的感叹号用 `stroke-width="2"`——它是 20px 圆内的唯一图形，1.5 在红底上会糊。

### 0.3 状态与焦点

| 状态 | 表达 |
|---|---|
| default | 边框 `--rc-color-border`，背景 `--rc-color-bg`，文字 `--rc-color-text` |
| hover | 背景 `--rc-color-bg-hover`，边框 `--rc-color-border-strong` |
| pressed | 背景 `--rc-color-bg-active` |
| focus-visible | `box-shadow: var(--rc-focus-ring)`（2px 主色 45% 透明），**不**用 `outline: none` 抹掉 |
| disabled | 文字 `--rc-color-text-disabled`，背景 `--rc-color-bg-subtle`，边框 `--rc-color-border-light`，`cursor: not-allowed` |

焦点环统一用 `box-shadow` 而非 `outline`：A4 纸面与画布容器有 `overflow: hidden`，`outline` 会被裁掉。

### 0.4 动效

状态过渡 `--rc-duration-base`（150ms）+ `--rc-ease-standard`；面板展开 `--rc-duration-slow`（200ms）；对话框 `--rc-duration-dialog`（300ms）。`prefers-reduced-motion: reduce` 下由 `tokens.css` 统一压到 1ms，组件不需要各自写媒体查询。

---

## 1. 按钮

> 视觉稿：01（工具栏、属性面板）、02（应用此模板）、03/04（对话框页脚）、07（应用并重新排版）

### 1.1 尺寸

| 变体 | 高 | 横向内边距 | 字号 | 图标 | 圆角 | 间距 |
|---|---|---|---|---|---|---|
| 标准 | 32px `--rc-size-control` | 12px `--rc-space-base` | 14px `--rc-font-size-base` | 16px `--rc-size-icon-sm` | 4px `--rc-radius` | 图标与文字 4px `--rc-space-xs` |
| 紧凑 | 28px `--rc-size-control-sm` | 8px `--rc-space-sm` | 12px `--rc-font-size-sm` | 16px | 4px | 4px |
| 图标按钮 | 28×28 / 32×32 | 0（正方形） | — | 16px 或 20px | 4px | — |

按钮高度只有 28 / 32 两档（PRD 6.4）。宽度不写死，由内容 + 内边距决定；同一行按钮等宽时取最长者，靠 `flex` 拉伸，不设固定 px。

### 1.2 类型

| 类型 | 背景 | 文字 | 边框 | 用在哪 |
|---|---|---|---|---|
| 主按钮 | `--rc-color-primary`，hover `--rc-color-primary-hover`，pressed `--rc-color-primary-active` | `--rc-color-text-on-primary` | 同背景色 | 每个对话框**只有 1 个**：应用模板 / 生成文档 / 导出 PDF / 应用并重新排版 |
| 次按钮 | `--rc-color-bg` | `--rc-color-text` | `--rc-color-border` | 取消、上一步、修复等非终态动作 |
| 幽灵按钮 | 透明 | `--rc-color-text-secondary` | 透明 | 稍后处理、忽略、排序切换 |
| 危险按钮 | `--rc-color-danger` | `--rc-color-bg` | 同背景 | 删除文档、清空页面；P0 仅删除确认对话框使用 |

主按钮的禁用态用 `--rc-color-primary-light-9`（`#e7f1f4`）作底、`--rc-color-text-secondary`（`#5b636b`）作字、
`--rc-color-border-light` 作描边，**不用**整体 `opacity: .5`。

> 2026-10-23 修正：原稿写的是 `light-7` 底 + 白字，实测只有 **1.56:1** ——
> 这条规则自己违反了自己引用的 AA 理由。改为现方案后 **5.31:1**。

### 1.3 disabled 必须解释原因

| 规则 | 说明 |
|---|---|
| 触发时机 | 鼠标悬停 300ms 或键盘聚焦时显示 tooltip（`title` 只是兜底，正式实现用浮层） |
| 位置 | 按钮上方 10px，右对齐按钮右缘 |
| 样式 | 背景 `--rc-neutral-800`、文字 `--rc-color-bg`、圆角 `--rc-radius`（4px）、内边距 8/12、`--rc-shadow-8`、字号 12 |
| 文案 | 一句话说清**缺什么**，不说「不可用」这种废话。例：「还有 1 项阻断问题（第 2 页底部文字将被裁切）。处理后此按钮自动可用。」 |
| 例外 | 纯装饰性禁用（如空文档的「保存」）可以用 `title` 简化，但同样要给原因 |

禁用按钮仍要可聚焦（`tabindex="0"` + `aria-disabled="true"`），否则键盘用户永远读不到原因。

### 1.4 token

`--rc-size-control` / `--rc-size-control-sm` / `--rc-radius` / `--rc-space-xs` / `--rc-space-sm` / `--rc-space-base` / `--rc-color-primary` / `--rc-color-primary-hover` / `--rc-color-primary-active` / `--rc-color-primary-light-7` / `--rc-color-border` / `--rc-color-border-strong` / `--rc-color-bg` / `--rc-color-bg-hover` / `--rc-color-bg-active` / `--rc-color-bg-subtle` / `--rc-color-text` / `--rc-color-text-on-primary` / `--rc-color-text-disabled` / `--rc-focus-ring`

---

## 2. 模板卡

> 视觉稿：02

### 2.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 卡片 | 宽由栅格决定（2 列时约 500px，3 列时约 330px），圆角 8px，1px 描边 | `--rc-radius-lg`、`--rc-color-border-light` |
| 缩略图区 | 高 200px，底色 `--rc-color-bg-subtle`，下边框 1px | `--rc-space-*`（内部居中） |
| 卡片内边距 | 12px 四周 | `--rc-space-base` |
| 缩略图本体 | 150 × 200（A4 比例 1:1.414），`--rc-shadow-2` | — |
| 名称行 | 14px / 500 字重，行高 1.25 | `--rc-font-size-base`、`--rc-font-weight-medium` |
| 适用场景 | 12px，三级灰，最多 1 行（超出省略） | `--rc-color-text-tertiary` |
| 标签行 | 高 20px，圆角 2px，间距 4px，自动换行 | `--rc-radius-sm`、`--rc-space-xs` |

### 2.2 状态

| 状态 | 表现 |
|---|---|
| default | 1px `--rc-color-border-light`，无阴影 |
| hover | 描边 `--rc-color-border-strong` + `--rc-shadow-4`；同时 600ms 后弹大图预览浮层（260px 宽，`--rc-shadow-8`） |
| selected | 描边 `--rc-color-primary` + 1px 主色外环（`0 0 0 1px`），右上角挂「已应用 / 当前使用」标签 |
| focus-visible | `--rc-focus-ring` |
| 不可用 | 缩略图整体降到 60% 不透明，右上角挂「暂不支持此语言轨」标签，`cursor: not-allowed` |

### 2.3 卡内信息顺序（不允许调换）

1. 缩略图（表达版式）
2. 名称 + 状态标签（表达「这是哪一套」）
3. 适用场景一句话（表达「适不适合我」）
4. 标签组：**语言轨** 必须排第一，其后是人群（校招/社招）、页数、特性（ATS 友好 / 含发表物）

语言轨用 `tag--outline`，其余用默认 `tag`——语言轨是硬约束（切错语言轨等于重排），视觉上要比其他标签更"框定"。

### 2.4 token

`--rc-radius-lg` / `--rc-radius-sm` / `--rc-color-border-light` / `--rc-color-border-strong` / `--rc-color-primary` / `--rc-color-bg-subtle` / `--rc-color-bg-elevated` / `--rc-color-text-tertiary` / `--rc-shadow-2` / `--rc-shadow-4` / `--rc-shadow-8` / `--rc-space-base` / `--rc-space-sm` / `--rc-space-xs` / `--rc-font-size-sm` / `--rc-font-size-base` / `--rc-font-weight-medium` / `--rc-duration-base`

---

## 3. 组件拖拽项

> 视觉稿：01（左侧「分栏容器」处于拖拽中，画布出现插入线）

### 3.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 行高 | 32px | `--rc-size-row` |
| 横向内边距 | 8px（左侧 4px 给手柄） | `--rc-space-sm` / `--rc-space-xs` |
| 手柄图标 | 16px，六点竖排 | `--rc-size-icon-sm` |
| 图标与文字间距 | 8px | `--rc-space-sm` |
| 圆角 | 4px | `--rc-radius` |

### 3.2 状态

| 状态 | 表现 |
|---|---|
| default | 手柄透明（不显示），文字 `--rc-color-text` |
| hover | 背景 `--rc-color-bg-hover`，手柄变 `--rc-color-text-placeholder`；`cursor: grab` |
| dragging | 背景 `--rc-color-primary-subtle`，整体不透明度 55%，手柄变主色，`cursor: grabbing` |
| 落点合法 | 画布出现 2px 主色插入线（左右各内缩页边距 76px），左端一个 8px 主色圆点 |
| 落点非法 | 插入线消失，光标变 `not-allowed`，画布右上角出现一次性提示条「此处不能放置该组件」（不弹对话框） |

拖拽阈值 4px：小于 4px 视为点击（展开说明），大于 4px 进入拖拽，避免误拖。

### 3.3 吸附

插入线在距离已有组件边界 8px 内自动吸附到该边界（`--rc-space-sm`），吸附时不额外画对齐线——插入线本身已经是唯一视觉信号，再加参考线会让画布变吵。

### 3.4 token

`--rc-size-row` / `--rc-size-icon-sm` / `--rc-radius` / `--rc-space-xs` / `--rc-space-sm` / `--rc-color-bg-hover` / `--rc-color-primary` / `--rc-color-primary-subtle` / `--rc-color-text` / `--rc-color-text-placeholder` / `--rc-layout-page-margin` / `--rc-duration-fast`

---

## 4. 属性字段控件

> 视觉稿：01（右侧属性面板：字号校验失败、行高步进、字重分段、颜色字段、开关）

四类控件共用一套外壳：**高 32px、1px `--rc-color-border`、圆角 4px、内边距 8px、字号 12px**。聚焦时边框转 `--rc-color-primary` + `--rc-focus-ring`。

### 4.1 数字（带单位步进）

| 元素 | 规格 | token |
|---|---|---|
| 输入区 | 数字右对齐，等宽字体（避免数字变化时抖动） | `--rc-font-family-mono` |
| 单位 | 紧贴数字右侧，三级灰，不可编辑 | `--rc-color-text-tertiary` |
| 步进器 | 上下两个 20×15 的按钮，贴右边缘，中间用 1px 分隔线 | `--rc-color-border-light` |
| 步长 | 单击 ±1；Shift + 单击 ±10；按住 400ms 后连发（间隔 80ms） | — |
| 合法范围 | 每个字段独立声明（字号 8–24pt、行高 1.0–3.0、段前 0–72pt） | — |

### 4.2 颜色

| 元素 | 规格 | token |
|---|---|---|
| 色块 | 20×20，圆角 2px，1px `--rc-color-border-light` 描边 | `--rc-radius-sm` |
| 文本 | 首选显示 token 别名（如「正文墨色」）；hover 显示变量名 | `--rc-font-size-sm` |
| 取色面板 | 只给 token 派生色板（纸白、页面灰、主色浅底、暖米、冷绿、浅灰）+ 自定义入口；**不允许**自由 hex 输入 | — |

只给 token 色板是刻意的：简历要打印，屏幕上的自由取色在 CMYK 下会偏色，且破坏「导出 = 预览」。

### 4.3 下拉

| 元素 | 规格 | token |
|---|---|---|
| 触发器 | 同输入框外壳，右侧 16px chevron | `--rc-size-icon-sm` |
| 面板 | 背景 `--rc-color-bg-elevated`，圆角 8px，`--rc-shadow-8`，内边距 4px，最大高 280px 滚动 | `--rc-radius-lg` |
| 选项 | 高 32px，内边距 8px，hover `--rc-color-bg-hover`，选中项主色文字 + 左侧 2px 主色竖条 | `--rc-size-row` |
| 键盘 | 上下移动、Enter 选中、Esc 关闭并回焦到触发器 | — |

### 4.4 开关

| 元素 | 规格 | token |
|---|---|---|
| 轨道 | 32×18，圆角 full | `--rc-radius-full` |
| 关闭 | 底 `--rc-color-border` | — |
| 开启 | 底 `--rc-color-primary` | — |
| 滑块 | 14×14 白圆，左侧内缩 2px，`--rc-shadow-2`，位移 14px，150ms | `--rc-space-2xs`、`--rc-duration-base` |
| 标签 | 永远在左，开关在右，中间用 `--rc-space-sm` | — |

开关不做成纯图标 toggle：`aria-checked` + 可见文字标签 + 位置共同表达状态（原则 7）。

### 4.5 校验失败与回滚

| 阶段 | 行为 |
|---|---|
| 输入中 | 不打断。允许临时非法值（如字号输入到「2」），不立刻标红 |
| 失焦 / Enter | 校验范围；非法则：① 边框转 `--rc-color-danger`；② 字段下方出现 12px 红字，格式「范围 8–24 pt，已恢复为 12.5 pt」；③ 值回滚到**上一个合法值**；④ 文本全选，方便直接重打 |
| 回滚后 | 错误提示保留 4s 或直到下次输入；不弹 toast（同屏已经有红字，toast 是第三处重复） |
| 合法但异常 | 只提示不拦截，例如「行高 1.1 会让密排更紧」用 `--rc-color-info` |

红字前必须有图标（感叹号圆圈 16px），否则色觉障碍用户只能看到"字变红了"。

### 4.6 token

`--rc-size-control` / `--rc-radius` / `--rc-radius-lg` / `--rc-radius-sm` / `--rc-radius-full` / `--rc-space-2xs` / `--rc-space-xs` / `--rc-space-sm` / `--rc-space-base` / `--rc-color-border` / `--rc-color-border-light` / `--rc-color-border-strong` / `--rc-color-primary` / `--rc-color-bg` / `--rc-color-bg-hover` / `--rc-color-bg-elevated` / `--rc-color-text` / `--rc-color-text-secondary` / `--rc-color-text-tertiary` / `--rc-color-danger` / `--rc-color-info` / `--rc-shadow-2` / `--rc-shadow-8` / `--rc-focus-ring` / `--rc-font-family-mono`

---

## 5. 导入向导对话框

> 视觉稿：03

### 5.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 对话框宽 | 1080px（宽版），最大高 `100vh - 96px` | `--rc-radius-xl`、`--rc-shadow-16` |
| 内边距 | 头部 24/24/12，主体 0/24/12，页脚 12/24/24 | `--rc-space-xl`、`--rc-space-base` |
| 分步条 | 圆点 20px，序号 12px 等宽，步与步之间 1px 连接线（最短 24px） | `--rc-size-icon-md` |
| 左右对照 | 两列等宽，间距 12px；每列高 340px 独立滚动 | `--rc-space-base` |
| 识别块 | 内边距 8px，圆角 4px，块间距 8px，1px 描边 | `--rc-radius`、`--rc-space-sm` |
| 置信度 | 40×3 进度条 + 等宽百分比数字 | `--rc-font-family-mono` |

### 5.2 四个步骤的状态

| 步骤 | 圆点 | 文字 |
|---|---|---|
| 未开始 | 1px `--rc-color-border` 描边，透明底，三级灰字 | `--rc-color-text-tertiary` |
| 进行中 | 主色实心 + 白字序号 | `--rc-color-primary` |
| 已完成 | 成功色实心 + 白色勾（SVG），连接线转 `--rc-color-success-border` | `--rc-color-success` |
| 跳过 | 描边虚线 + 「已跳过」小字 | `--rc-color-text-placeholder` |

### 5.3 分层承诺必须明示

三种文件的承诺不一样，必须在解析前用警告条说清（PRD 6.5）：

| 文件类型 | 承诺 | 提示条类型 |
|---|---|---|
| 本工具导出的 DOCX | 无损，直接进编辑器 | `banner--success` |
| 第三方 DOCX | 高保真 + 人工对照 | `banner--warning` |
| PDF | 降级：只取文字，版式重排 | `banner--danger` |

### 5.4 对照视图

- 左列是**原文件的只读渲染**（缩放到 62%，不可编辑），需要确认的区域加 `--rc-color-warning-subtle` 底 + 虚线描边。
- 右列是识别块列表，每块：拖拽手柄 + 块类型 + 置信度 + 内容摘要。
- 置信度分档：≥85% 成功色；60–84% 警告色；<60% 危险色 + 「待处理」标签 + 就地操作按钮（拆分 / 合并 / 保留）。
- 合并后的块用虚线主色描边 + 「已合并 N 块」标签，**不改变内容文字**。

### 5.5 阻断规则

待处理项 > 0 时，「生成文档」按钮禁用，按钮文字带上数量（「生成文档（5 项待处理）」），tooltip 说明原因。页脚同时显示「高置信 19 块 / 待确认 5 处」。

任何阶段取消都不写库、不改原文件——这句话要出现在页脚（12px 三级灰），不能只写在文档里。

### 5.6 token

`--rc-radius-xl` / `--rc-radius-lg` / `--rc-radius` / `--rc-shadow-16` / `--rc-space-xl` / `--rc-space-base` / `--rc-space-sm` / `--rc-color-primary` / `--rc-color-primary-subtle` / `--rc-color-primary-light-5` / `--rc-color-success` / `--rc-color-success-border` / `--rc-color-warning` / `--rc-color-warning-subtle` / `--rc-color-warning-border` / `--rc-color-danger` / `--rc-color-bg` / `--rc-color-bg-subtle` / `--rc-color-border` / `--rc-color-border-light` / `--rc-color-border-lighter` / `--rc-color-text-tertiary` / `--rc-font-family-mono`

---

## 6. 警告条

> 视觉稿：01（拖拽说明）、02（内容无法归位）、03（分层承诺）、04（阻断提示）

### 6.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 高 | 不限，最小 36px（单行） | — |
| 内边距 | 上下 8px，左右 12px | `--rc-space-sm`、`--rc-space-base` |
| 圆角 | 8px（面板内嵌）/ 4px（对话框内嵌） | `--rc-radius-lg` / `--rc-radius` |
| 图标 | 16px，与首行文字基线对齐（`margin-top: 2px`） | `--rc-size-icon-sm` |
| 图标与文字 | 8px | `--rc-space-sm` |
| 标题 | 500 字重，与正文同字号（12px），**不加大字号** | `--rc-font-weight-medium` |
| 正文 | 12px，行高 1.7 | `--rc-font-size-sm`、`--rc-line-height-relaxed` |

### 6.2 四级

| 类型 | 底 | 边框 | 图标 | 用途 |
|---|---|---|---|---|
| 信息 | `--rc-color-info-subtle` | `--rc-color-info-border` | 圆圈感叹号 | 操作说明、已知限制 |
| 成功 | `--rc-color-success-subtle` | `--rc-color-success-border` | 圆圈勾 | 处理完成、无损导入 |
| 警告 | `--rc-color-warning-subtle` | `--rc-color-warning-border` | 三角感叹号 | 需人工确认、将导致空白 |
| 危险 | `--rc-color-danger-subtle` | `--rc-color-danger-border` | 圆圈感叹号（实心感更强） | 阻断项、将丢内容 |

### 6.3 硬规则

- **禁止纯色块**：必须有图标 + 文字，颜色只是第三重信号。
- **禁止纯图标**：不允许出现"只有一个小红点"的提示（除溢出角标，它有数量与浮层兜底）。
- 一条警告条只说一件事；两件事拆两条。
- 可操作时，动作按钮放在右侧（`margin-left: auto`），不与正文挤在一行末尾。

### 6.4 token

`--rc-color-*-subtle` / `--rc-color-*-border` / `--rc-color-*-base` / `--rc-radius` / `--rc-radius-lg` / `--rc-space-sm` / `--rc-space-base` / `--rc-font-size-sm` / `--rc-line-height-relaxed`

---

## 7. 图层项

> 视觉稿：06

### 7.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 行高 | 32px | `--rc-size-row` |
| 横向内边距 | 左 4px，右 8px | `--rc-space-xs`、`--rc-space-sm` |
| 可见性按钮 | 20×20，图标 16px | `--rc-size-icon-sm` |
| 锁定按钮 | 20×20，图标 16px | — |
| 缩略块 | 20×20，圆角 2px，1px 描边，内嵌 16px 类型图标 | `--rc-radius-sm` |
| 名称 | 12px，单行省略 | `--rc-font-size-sm` |
| 类型标记 | 12px 等宽（bg / img / text / table），三级灰 | `--rc-font-family-mono`、`--rc-color-text-placeholder` |
| 组标题 | 高 28px，12px，500 字重，右侧计数徽章 | — |
| 子层缩进 | 左内边距 24px | `--rc-space-xl` |

### 7.2 状态

| 状态 | 表现 |
|---|---|
| default | 透明底，文字 `--rc-color-text` |
| hover | 底 `--rc-color-bg-hover` |
| selected | 底 `--rc-color-primary-subtle` + 文字主色 + **左侧 2px 主色内阴影竖条**（双标识，不只靠底色） |
| 隐藏 | 名称变 `--rc-color-text-placeholder`，可见性图标为「眼睛带斜线」 |
| 锁定 | 名称 `--rc-color-text-tertiary`，锁定图标转 `--rc-color-warning`，拖拽手柄消失，`cursor: default` |
| 拖拽中 | 整体 55% 不透明 + 2px 主色上/下插入线 |
| 背景层（默认锁定） | 行尾固定挂 `tag--warning`「默认锁定」；组标题右侧也挂一次，避免用户以为是 bug |

### 7.3 三层结构与顺序

| 层 | 内容 | 是否可选 | 默认锁定 |
|---|---|---|---|
| 背景 | 1 个（纯色 / 纹理 / 上传图） | 可选可解锁 | **是**（CONTRACT §10.4） |
| 插图 | N 个图片、装饰线 | 可选 | 否 |
| 组件 | 文本/表格/分栏内容 | 可选 | 否 |

顺序固定为「背景 → 插图 → 组件」（上→下对应视觉的后→前），不允许用户自定义层的顺序——P0 只做上移/下移图层**项**，不做层组重排。

锁定与可见性是 **UI 状态，不进文档模型**（CONTRACT §10.4），刷新后回到默认（背景锁定、其余可见未锁）。

### 7.4 token

`--rc-size-row` / `--rc-size-icon-sm` / `--rc-radius` / `--rc-radius-sm` / `--rc-space-xs` / `--rc-space-sm` / `--rc-space-xl` / `--rc-color-bg-hover` / `--rc-color-bg-active` / `--rc-color-primary` / `--rc-color-primary-subtle` / `--rc-color-text` / `--rc-color-text-tertiary` / `--rc-color-text-placeholder` / `--rc-color-warning` / `--rc-color-border-light` / `--rc-font-family-mono`

---

## 8. 溢出角标

> 视觉稿：08（以及 01 的页面右上角）

### 8.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 圆 | 直径 20px，白描边 1px（与纸面分隔） | `--rc-size-badge` |
| 图标 | 16px 感叹号，`stroke-width: 2`，`currentColor` | `--rc-size-icon-sm` |
| 数量角标 | 高 14px，左右内边距 3px，最小宽 14px，10px 等宽字，右上偏移（top -4 / right -6） | `--rc-font-family-mono` |
| 浮层 | 宽 300px，圆角 8px，内边距 0（头/项/脚各自 8/12） | `--rc-radius-lg`、`--rc-shadow-8` |
| 定位 | 页面右上角内缩 12px | `--rc-space-base` |
| 层级 | 30 | `--rc-z-badge` |

### 8.2 状态

| 状态 | 表现 |
|---|---|
| 1 处溢出 | 只有圆，无数量角标 |
| ≥2 处 | 圆 + 数量角标（N800 底、白字）；>9 显示「9+」 |
| hover / focus | `--rc-shadow-4` 加重，600ms 后弹出摘要浮层 |
| 展开 | 浮层列出每条：组件名 + 原因 + 页码 + 状态；末尾两个动作「逐条处理」「全部按推荐处理」 |
| 处理完成 | 角标整体消失，**不留占位、不留灰点** |
| 键盘 | Tab 可聚焦，Enter/空格展开浮层，Esc 关闭并回焦 |

### 8.3 SVG 规格（非 emoji）

```
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 6.5v8"/>
  <path d="M12 18h.01"/>
</svg>
```

用两条 path 而不是实心三角：实心图形在 20px 里会糊成一团，细描边在红底上更清楚。

### 8.4 为什么不是 emoji

emoji 在不同系统的字形、颜色、基线都不一样（Windows 是彩色方框，macOS 是另一套），会破坏「导出结果与预览一致」的承诺；且 emoji 不可被 `currentColor` 控制，无法随主题变量走。

### 8.5 token

`--rc-size-badge` / `--rc-size-icon-sm` / `--rc-radius-full` / `--rc-radius-lg` / `--rc-color-danger` / `--rc-color-bg` / `--rc-neutral-800` / `--rc-shadow-4` / `--rc-shadow-8` / `--rc-z-badge` / `--rc-z-popover` / `--rc-space-base` / `--rc-space-sm` / `--rc-font-family-mono`

---

## 9. 溢出三阶段弹窗

> 视觉稿：07

### 9.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 对话框宽 | 640px（介于默认 720 与紧凑 520 之间的自定义宽） | `--rc-radius-xl`、`--rc-shadow-16` |
| 溢出摘要块 | 内边距 12px，圆角 8px，右侧大数字 20px 等宽 | `--rc-space-base`、`--rc-radius-lg` |
| 选项卡 | 内边距 12px，圆角 8px，1px 描边，间距 8px | `--rc-radius-lg`、`--rc-space-sm` |
| 单选圆点 | 16px，内点 8px | `--rc-radius-full` |
| 段落说明 | 12px / 1.7 | `--rc-font-size-sm`、`--rc-line-height-relaxed` |
| 阶段指示 | 胶囊 20px 高，当前阶段实心主色 | `--rc-radius-full`、`--rc-color-primary` |

### 9.2 三个选项（顺序固定，PRD FR-LAY-011）

| # | 选项 | 副作用范围 | 必须给出的数字 |
|---|---|---|---|
| 1 | 压缩该组件 | 仅该组件 | 压缩前后行距/字号、预计收回 mm、是否仍不足 |
| 2 | 压缩本页全部 | 本页全部组件 | 受影响组件数、预计收回 mm |
| 3 | 不压缩，进入下一阶段 | 转入拆分续写 | 说明下一步是「拆分续写」，再拆不开才「整体下移」 |

选项 1 是默认选中项并挂「推荐」标签——它副作用最小。

### 9.3 「整体下移将导致空白」的警告样式

只在选项 3 的描述区底部出现，用 `note-warn`：

| 属性 | 值 |
|---|---|
| 左边框 | 2px `--rc-color-warning` |
| 底色 | `--rc-color-warning-subtle` |
| 圆角 | 2px（`--rc-radius-sm`） |
| 内边距 | 8 / 12 |
| 文字 | 12px，加粗句首「整体下移将导致空白。」+ 具体空白量（mm 与页高百分比） |

空白量必须给具体数字（例：62mm，约占页高 21%）。只写"会有空白"等于没写。

### 9.4 其他规则

- 标题不说「警告」「注意」，直接说事实：「第 2 页内容溢出」。
- 关闭按钮 ×、Esc、以及「稍后处理」三者行为一致：**收缩为右上角角标**，不改文档。
- 页脚按钮顺序：左侧幽灵「稍后处理」→ 右侧「取消」+ 主按钮「应用并重新排版」。
- 主按钮文案是动作 + 结果（「应用并重新排版」），不是「确定」。

### 9.5 token

`--rc-radius-xl` / `--rc-radius-lg` / `--rc-radius-sm` / `--rc-radius-full` / `--rc-shadow-16` / `--rc-space-sm` / `--rc-space-base` / `--rc-space-lg` / `--rc-color-danger` / `--rc-color-danger-subtle` / `--rc-color-danger-border` / `--rc-color-warning` / `--rc-color-warning-subtle` / `--rc-color-primary` / `--rc-color-primary-subtle` / `--rc-color-border` / `--rc-color-border-light` / `--rc-color-bg` / `--rc-font-family-mono`

---

## 10. 画板工具条

> 视觉稿：06

### 10.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 容器 | 内边距 2px，圆角 8px，1px 描边，`--rc-shadow-4` | `--rc-radius-lg` |
| 按钮 | 高 28px，内边距 8px，图标 16 + 文字 12 | `--rc-size-control-sm` |
| 按钮间距 | 2px | `--rc-space-2xs` |
| 分组分隔 | 1px 竖线，高 16px，左右各留 2px | `--rc-color-border-light` |
| 定位 | 画布顶部居中，距画布顶 16px；吸附后固定不随滚动位移 | `--rc-space-lg`、`--rc-z-artboard-toolbar` |

### 10.2 条目

| 顺序 | 按钮 | 图标语义 | 行为 |
|---|---|---|---|
| 1 | 背景上传 | 上箭头 + 底线 | 选择本地图片，作为背景层替换（需先解锁或自动解锁并提示） |
| 2 | 背景色 | 水滴 | 打开 token 色板（6 色 + 纹理） |
| 3 | 纹理 | 网格 | 4 种内置纹理（网格 / 点阵 / 细斜线 / 纸张噪点） |
| — | 分隔 | — | — |
| 4 | 插图 | 图片框 | 进入插图添加，落位到插图图层 |
| 5 | 存为背景模板 | 卡片 + 下箭头 | 把当前背景（色/纹理/图）存为可复用背景，供其他文档使用 |
| — | 分隔 | — | — |
| 6 | 图钉 | 图钉 | 固定在画布顶部 / 随内容滚动，仅会话内有效 |

当前激活项（如「背景上传」）用 `--rc-color-primary-subtle` 底 + 主色文字，与工具栏的 `aria-pressed` 状态一致。

### 10.3 约束

- 只有一条，不同时出现第二条浮动工具条（避免遮挡纸面）。
- 窄于 1280px 时整条并入左侧资源栏的「页面」Tab，不再浮动（PRD 6.6）。
- 工具条不覆盖页边距辅助线：向上吸附在纸面上方，压在画布底色上。

### 10.4 token

`--rc-radius-lg` / `--rc-radius` / `--rc-size-control-sm` / `--rc-size-icon-sm` / `--rc-space-2xs` / `--rc-space-sm` / `--rc-space-lg` / `--rc-color-bg-elevated` / `--rc-color-bg-hover` / `--rc-color-border-light` / `--rc-color-primary` / `--rc-color-primary-subtle` / `--rc-color-text-secondary` / `--rc-shadow-4` / `--rc-z-artboard-toolbar`

---

## 11. 空状态与首次引导

> 视觉稿：05

### 11.1 尺寸

| 元素 | 规格 | token |
|---|---|---|
| 容器 | 最大宽 760px，上下内边距 32px，水平 24px，画布内垂直居中 | `--rc-space-2xl`、`--rc-space-xl` |
| 插画 | 120×152 的空白纸面 + 右下角 32px 主色圆形加号 | `--rc-radius-lg`、`--rc-shadow-4` |
| 主标题 | 24px / 600，行高 1.25 | `--rc-font-size-2xl`、`--rc-font-weight-semibold` |
| 说明 | 14px，最大宽 460px，行高 1.7 | `--rc-font-size-base`、`--rc-line-height-relaxed` |
| 入口卡 | 三列等宽，间距 12px，内边距 16px，圆角 8px | `--rc-space-base`、`--rc-space-lg`、`--rc-radius-lg` |
| 卡内图标底 | 32×32，圆角 4px，主色浅底 | `--rc-radius`、`--rc-color-primary-subtle` |

### 11.2 三个入口

| 顺序 | 入口 | 图标 | 一句话说明 | 视觉权重 |
|---|---|---|---|---|
| 1 | 从模板开始 | 双栏版式 | 4 套内置模板，选一套再改文字 | 主（主色浅描边 + 主色图标底） |
| 2 | 导入已有简历 | 下载入托盘 | DOCX 保留结构；PDF 只取文字需对照 | 平 |
| 3 | 空白画板 | 文档 | A4 空白页 + 页边距参考线 | 平 |

顺序不能变：默认用户是「先有模板」，导入是第二常见路径，空白画板是给明确知道自己要什么的人。

### 11.3 状态

| 状态 | 表现 |
|---|---|
| default | 1px `--rc-color-border-light` |
| hover | 描边转 `--rc-color-border-strong` + `--rc-shadow-4` + 上移 1px |
| focus-visible | `--rc-focus-ring`，整卡可聚焦（不是只有文字链） |
| 主入口 | 描边 `--rc-color-primary-light-5`，其余同 hover |

### 11.4 配套

- 卡下方显示「最近打开」（最多 3 条，超出进「全部文件」），每条：文件名 + 修改时间 + 页数 + 打开动作。
- 右侧属性面板在空状态下显示空态说明（不显示空白面板）：未选中对象时的解释文案 2 行。
- 状态栏显示「第 0 / 0 页 · 缩放 100% · 未保存」，不隐藏状态栏——界面结构不要因为没内容就塌陷。

### 11.5 token

`--rc-space-2xl` / `--rc-space-xl` / `--rc-space-lg` / `--rc-space-base` / `--rc-radius-lg` / `--rc-radius` / `--rc-shadow-4` / `--rc-color-border-light` / `--rc-color-border-strong` / `--rc-color-primary-light-5` / `--rc-color-primary-subtle` / `--rc-color-primary` / `--rc-color-bg` / `--rc-color-text` / `--rc-color-text-secondary` / `--rc-font-size-2xl` / `--rc-font-weight-semibold` / `--rc-line-height-relaxed` / `--rc-focus-ring`

---

## 12. 五区域骨架尺寸（PRD 6.3 / 6.6）

| 区域 | 尺寸 | token |
|---|---|---|
| 顶部工具栏 | 高 44px，左右内边距 12px；分组之间 1px 竖分隔线，分组内按钮间距 2px | `--rc-layout-toolbar-h`、`--rc-space-base` |
| 左侧资源栏 | 宽 264px（≥1440），1280–1440 收窄到 240px；可折叠为 44px 图标条 | `--rc-layout-left-w`、`--rc-layout-left-w-narrow` |
| 中央画布 | 自适应；A4 纸面 794×1123，缩放默认 85%，纸面阴影 `--rc-shadow-paper` | `--rc-layout-a4-w`、`--rc-layout-a4-h` |
| 右侧属性面板 | 宽 280px；<1280px 转抽屉 | `--rc-layout-right-w` |
| 底部状态栏 | 高 28px，12px 字，项之间 16px + 1px 分隔 | `--rc-layout-statusbar-h`、`--rc-space-lg` |

页边距辅助线：距纸边 76px（20mm），1px 虚线 `--rc-color-border-light`。

> **缩放下的线宽（2026-10-23 修正）**：画布用 CSS `transform: scale()` 缩放，1px 边框会随之变成亚像素
> （85% 时是 0.85px），虚线在亚像素下会断成不均匀的点。原文写的"保持 1 物理像素"在 85% 下**做不到**。
> `vector-effect="non-scaling-stroke"` 也解决不了——它只中和 SVG 自身坐标变换，中和不了祖先元素的 CSS transform。
> 两个可行做法（TC-008 落地时二选一）：
> ① 辅助线 overlay 放在缩放容器**外面**，尺寸用 `calc(794px * var(--rc-canvas-zoom, 1))` 反算，1px 是真 1px；
> ② 接受亚像素，但 **zoom < 100% 时把虚线换成 8% 不透明度实线**——实线的亚像素退化比虚线体面得多。
> **不做**：锁定缩放档位。A4 宽 794px，1280 视口下只放得下 75%，正文会读不清。

---

## 13. 一致性检查（对应 PRD 6.7）

| # | 检查项 | 本规格的落实方式 |
|---|---|---|
| 1 | 颜色/间距/圆角/阴影全部引用 token | tokens.css 是唯一数值源；mockup.css 与 8 张稿零硬编码色值（脚本扫描 0 命中） |
| 2 | 控件状态完整（default/hover/pressed/disabled/focus） | 每个组件的「状态」表都列了 5 态；缺 pressed 的（如模板卡）明确说明为何不需要 |
| 3 | 主要功能键盘可达，焦点顺序合理 | 焦点环统一样式；拖拽项、图层行、角标均给 Tab 顺序；对话框有 `role="dialog"` + `aria-modal` |
| 4 | 文本对比度 AA | token 表给了逐对实测值；三级文本 4.52:1 是刻意卡在下限 |
| 5 | 警告/状态非纯色表达 | 警告条强制「图标 + 文字」；角标「颜色 + 图形 + 数量 + 浮层文案」四重 |
| 6 | 侧栏折叠行为与 6.6 断点一致 | 骨架表列了 264 / 240 / 抽屉 / 只读四档 |
| 7 | 中文字体渲染无溢出截断 | UI 字体栈含 PingFang SC + Noto Sans SC；单行文本一律 `text-overflow: ellipsis` 且给 `title` |

---

## 14. 未覆盖项（明确留给后续卡）

| 项 | 归属 | 说明 |
|---|---|---|
| 暗色主题 | 不进 P0 | tokens.css 只留 `[data-theme='dark']` 注释位 |
| 简历渲染字体资产 | TC-006 | 本卡只定义 `--rc-font-resume-sans/serif` 变量名与回退链 |
| Element Plus 主题派生色映射 | TC-004 | `--rc-color-primary-light-*` 已定义，桥接层尚未写映射行 |
| 真实拖拽/布局计算 | TC-007 / TC-008 | 本卡只给视觉与尺寸，不含算法 |
| 打印样式（`@media print`） | TC-010 | 导出走独立 PDF 管线，不依赖浏览器打印 |
