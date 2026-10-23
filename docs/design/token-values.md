# ResumeCraft 设计 token 数值表（TC-016 定稿）

> 状态：**定稿**（非占位）。落地文件 `src/design/tokens.css`，本文是该文件的取值依据与解释。
> 对照规范：PRD 6.2（类别结构）、6.1（七条原则）、6.7（一致性检查清单）。
> 全项目只有 `tokens.css` 可以出现十六进制与 `rgba()`；其它文件一律 `var(--rc-*)`。

---

## 0. 一句话结论

主色定为 **深透青蓝 `#107093`**（HSL 196° / 80% / 32%）—— **色相与初版 `#1f6e8c` 完全相同，
只把饱和度 62%→80%、明度 34%→32%**。白底 5.58:1、选中底 5.01:1、Element Plus 的
`light-9` 底 4.86:1，三条全过 AA，因此文字与填充共用一个色值，
**不需要拆双音高，桥接层也不需要任何特判**。

这次返工的判断依据不是"蓝得好不好看"，而是两条可验证的量（2026-10-23 视觉评审实测）：

1. 初版界面 **82.8% 的面积是同一个 `#ffffff`**（工具栏 4.9% + 左栏 16.9% + 右栏 17.9% + A4 纸 43.1%），
   A4 纸与其周围面板的对比度是 **1.00:1** —— 「内容优先，界面退后」在物理上没有执行。
2. 主色在 1440×900 上只占 **0.42%** 的面积。**改主色是屏幕的统计误差，改界面壳才影响 39.7% 的面积。**

所以视觉方案分三级，不要一锅端：

| 级别 | 内容 | 状态 |
|---|---|---|
| P0 | 界面壳明度阶梯（面板/画布降一档，让 A4 纸成为屏幕唯一的纯白） | **待 Amor 拍板**，见 §18 |
| P1 | 主色 `#107093`（196°/80%/32%，色相未动） | 已落地 |
| P2 | 形状（按钮圆角 6）与位移动效 | 已落地，见 §10 / §12.1 |

若 Amor 认为"一点"就该是零色彩改动，回退主色只需把 §1 的三个色值换回 `#1f6e8c` 系列，
其余不变也自洽 —— 这正是 P0 与 P1 分开做的原因。

---

## 1. 品牌主色

### 1.1 提案与理由

| 项 | 值 |
|---|---|
| 名称 | 深透青蓝（Deep Clear Cyan-Blue） |
| 基色 | `#107093` |
| HSL | 196° / 80% / 32% |
| 白字在其上 | 5.58 : 1（AA） |
| 其作正文在 `#ecf4f6` 上 | 5.01 : 1（AA） |
| 其在 EP `light-9 #e7f1f4` 上 | 4.86 : 1（AA） |

**为什么是它**（四条，都可验证）：

1. **色相一个字没动。** 196° 与初版完全相同，品牌识别零损失；改的只有饱和度 62%→80%、
   明度 34%→32%。屏幕上能感知的是"更实、更透"，不会变成另一个产品。
2. **三条约束同时过。** 白底、选中底、EP 的 light-9 底都过 AA。这意味着
   不需要"浅底上的主色文字改用 dark-2"这类补丁规则——规则越少，后面 9 张卡漏掉的概率越低。
3. **高饱和靠低明度压住。** Word 蓝是 hsl(215/56/39)；本主色 hsl(196/80/32)。
   饱和度上去了，但明度更低，所以观感是"更实"而不是"更亮"，不会抢白纸。
   这也是为什么"提饱和"必须同时"压明度"，只提饱和会被 light-9 卡死。
4. **四版只留最后一个**（全部实算，见下表）。

| 版本 | L* | 白底 | subtle | light-9 | 结论 |
|---|---|---|---|---|---|
| `#1f6e8c` 初版 | 0.1334 | 5.73 | 5.11 | 5.00 | 全过但闷 |
| `#157d99` | 0.1713 | 4.74 | 4.24 | 4.17 | 三条全挂 |
| `#13769a` | 0.1543 | 5.14 | 4.61 | 4.48 | 差 0.02，否 |
| **`#107093` 采用** | **0.1380** | **5.58** | **5.01** | **4.86** | 全过 |

> **真正的约束不是白底，是 light-9**：Element Plus 里「`primary-light-9` 底 + primary 文字」
> 这条规则块有 20 处（下拉选中项、hover 项、plain 按钮……）。要过 AA，主色相对亮度必须 ≤ 0.1533。
> 初版 `#1f6e8c` 的 L=0.1334 本来就压着这条线——它不是"随手选的深蓝"。

**明确排除**：Indigo→Pink 渐变、紫粉渐变 + 外发光 + 毛玻璃卡片、≥16px 胶囊按钮堆叠
（AI 生成界面的指纹，与"办公软件心智"相悖）；以及把主色往绿推（`#0f7d84` 184°，
离 success 绿 147° 只剩 37°，会污染状态语义）。

### 1.2 主色派生色（Element Plus 约定）

桥接层留了注释要求 TC-016 定 `--rc-color-primary-light-N` / `-dark-2`，计算规则按 Element Plus 的官方约定：
`light-N` = 主色混入 N×10% 的白色，`dark-2` = 主色混入 20% 黑色（混色在 sRGB 通道上按权重线性插值，四舍五入取整）。

| 变量 | 混色 | 值 |
|---|---|---|
| `--rc-color-primary` | 基色 | `#107093` |
| `--rc-color-primary-hover` | 8% 黑 | `#0f6787` |
| `--rc-color-primary-active` | 16% 黑 | `#0d5e7b` |
| `--rc-color-primary-subtle` | 92% 白 | `#ecf4f6` |
| `--rc-color-primary-light-3` | 30% 白 | `#589bb3` |
| `--rc-color-primary-light-5` | 50% 白 | `#88b8c9` |
| `--rc-color-primary-light-7` | 70% 白 | `#b7d4df` |
| `--rc-color-primary-light-8` | 80% 白 | `#cfe2e9` |
| `--rc-color-primary-light-9` | 90% 白 | `#e7f1f4` |
| `--rc-color-primary-dark-2` | 20% 黑 | `#0d5a76` |

验算样例（`light-5`）：R = (16+255)/2 = 135.5 → `88`；G = (112+255)/2 = 183.5 → `b8`；
B = (147+255)/2 = 201 → `c9`，得 `#88b8c9`。其余各阶同法。

**主色相关映射已在 TC-016 补齐**：`--el-color-primary` 指向 `--rc-color-primary`，
六条派生色（`light-3/5/7/8/9`、`dark-2`）一并映射。**改主色时桥接层无需改动**——
它跟着 `--rc-*` 变量走。**不要再补一行 `--el-color-primary`**，那会覆盖现有这条带兜底的映射。
dark-2 只保留它在 EP 里的原义：填充按钮的 active 态。

用途约束：`light-3/-5` 只用于 hover 底、进度条轨道、图表辅助线；`light-7/-8` 用于描边与分割；
`light-9` 与 `subtle` 同值族，用于选中行底。**任何 `light-*` 都不得承载正文文字**（对比度不足）。

---

## 2. 中性色（6 阶）

端点严格对齐 PRD 6.2 的 `#f9f9f9 → #2b2b2b`。中间四阶按 Fluent Neutral 的"窄端密、宽端疏"级差思路排布，
并在 210° 上加 ≤4% 的极轻冷偏移，使灰阶与 196° 主色同族——纯中性灰放在白纸旁会显脏、显旧。

| 阶 | 值 | 角色 | 白底对比度 |
|---|---|---|---|
| `--rc-neutral-50` | `#f9f9f9` | 页面底（五区域的外壳） | 1.05 |
| `--rc-neutral-100` | `#eff1f3` | 面板/工具栏底 | 1.13 |
| `--rc-neutral-200` | `#dde1e5` | 分隔线/浅边框 | 1.31 |
| `--rc-neutral-400` | `#8c949c` | 占位符/次要图标 | 3.07 |
| `--rc-neutral-600` | `#5b636b` | 二级文本 | 6.10 |
| `--rc-neutral-800` | `#2b2b2b` | 主文本 | 14.16 |

> 六阶是**色板**，不是**语义**。业务代码禁止直接用 `--rc-neutral-*` 上色，必须走第 3~4 节的语义变量；
> 色板只在 tokens.css 内部被语义层引用（当前实现中语义层已展开为具体值，色板保留作为设计意图记录）。

---

## 3. 表面（背景）

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-color-bg-page` | `#f9f9f9` | 主窗口外壳 |
| `--rc-color-bg` | `#ffffff` | 输入框、列表、卡片底 |
| `--rc-color-bg-elevated` | `#ffffff` | 浮层：下拉、popover、对话框（靠 `--rc-shadow-*` 与背景分离） |
| `--rc-color-bg-subtle` | `#eff1f3` | 工具栏、表头、只读字段 |
| `--rc-color-bg-hover` | `#f3f5f6` | 行 hover、图标按钮 hover |
| `--rc-color-bg-active` | `#e9ecee` | 行 pressed、图标按钮 pressed |
| `--rc-color-canvas` | `#e8ebed` | A4 纸外的画布底（必须比页面底深，PRD 6.3「页面阴影与画布底色分离」） |
| `--rc-color-paper` | `#ffffff` | A4 纸面，与导出 PDF 同色（原则 3「画布即结果」） |
| `--rc-color-scrim` | `rgba(43,43,43,.32)` | 对话框遮罩 |

---

## 4. 边框

由 `--rc-neutral-200` 向白 / 向深按固定比例混出的单调阶梯，避免手挑五个灰导致"深浅不一但看不出差别"。

| 变量 | 值 | 混色来源 | 用途 |
|---|---|---|---|
| `--rc-color-border-extra-light` | `#f0f2f3` | N200 + 55% 白 | 表格内分隔、极弱分割 |
| `--rc-color-border-lighter` | `#ebedef` | N200 + 40% 白 | 卡片内部分隔 |
| `--rc-color-border-light` | `#e4e7ea` | N200 + 20% 白 | 面板之间分隔线 |
| `--rc-color-border` | `#bdc2c7` | N200 + 25% N600 | 输入框/按钮描边（默认态） |
| `--rc-color-border-strong` | `#8c949c` | = N400 | 需要明确边界的容器、hover 态描边 |

---

## 5. 文本

| 变量 | 值 | 白底对比度 | 用途 |
|---|---|---|---|
| `--rc-color-text` | `#2b2b2b` | 14.16 | 正文、标题、当前选中项名称 |
| `--rc-color-text-secondary` | `#5b636b` | 6.10 | 次要说明、字段标签 |
| `--rc-color-text-tertiary` | `#6e767e` | 4.52 | 辅助信息（页码、单位、时间戳），恰达 AA 下限 |
| `--rc-color-text-placeholder` | `#8c949c` | 3.07 | 输入占位、空值提示 |
| `--rc-color-text-disabled` | `#a9afb5` | 2.31 | 禁用态（WCAG 1.4.3 对禁用控件豁免） |
| `--rc-color-text-on-primary` | `#ffffff` | 5.58（对主色） | 主按钮文字、选中 Tab 文字 |

三级文本 `#6e767e` 是从 N600 与 N400 之间插值取的，目的是"能读但退后"；再浅一档就会跌破 AA。

---

## 6. 语义色（信息 / 成功 / 警告 / 危险）

基色在白色上全部 ≥4.5:1，可直接做文字与图标色；`-subtle` 做状态底色，`-border` 做状态描边（32% 基色 + 68% 白）。

| 语义 | 基色 | 白底对比度 | hover | active | subtle 底 | border |
|---|---|---|---|---|---|---|
| 信息 info | `#4a6d8c` | 5.44 | `#446481` | `#3e5c76` | `#f1f3f6` | `#c5d0da` |
| 成功 success | `#1f7a4c` | 5.32 | `#1d7046` | `#1a6640` | `#edf4f1` | `#b7d4c6` |
| 警告 warning | `#a86400` | 4.68 | `#9b5c00` | `#8d5400` | `#f8f3eb` | `#e3cdad` |
| 危险 danger | `#b3352b` | 6.07 | `#a53128` | `#962d24` | `#f9efee` | `#e7bebb` |

**为什么警告是深琥珀而不是亮黄**：`#ffcc00` 这类亮黄在白底上对比度只有 1.6:1，做文字不可读，
做纯色块又会成为屏幕最亮点、抢走纸面注意力。压到 36° 深琥珀（4.68:1）后它既能当文字，
也能在 `--rc-color-warning-subtle` 底上做"图标 + 文字"的复合表达（原则 7：状态不只用颜色表达）。

**信息色为什么去饱和**：`--rc-color-info` 与主色同属蓝色域，靠饱和度（28% vs 62%）和明度区分，
避免出现"这是可点的还是这是提示"的二义。

---

## 7. 字体

### 7.1 UI 字体栈

```
--rc-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei",
                  "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif;
--rc-font-family-mono: "SF Mono", "Cascadia Mono", Consolas, "Liberation Mono", monospace;
```

在 PRD 6.2 给定的 `-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif` 基础上补了三项，原因：
`-apple-system` 只管西文，macOS 上中文会 fallback 到系统默认（可能是宋体），显式加 `PingFang SC` 才能保证
中文界面是黑体；`Hiragino Sans GB` 覆盖旧版 macOS；`Noto Sans SC` 覆盖 Linux 与 CI 截图环境。
`mono` 栈只用于"数值型 UI"——缩放百分比、页码、尺寸字段，避免数字跳动时宽度抖。

### 7.2 简历渲染字体族（变量名 + 回退链，**不含字体文件**）

```
--rc-font-resume-sans:  "Noto Sans SC", "Source Sans 3", "PingFang SC", "Microsoft YaHei", sans-serif;
--rc-font-resume-serif: "Noto Serif SC", "Source Serif 4", "Songti SC", "SimSun", serif;
```

按 PRD 6.2「与 UI 字体严格分离（TC-006 托管）」，本卡**只定义变量名与回退链**，
`@font-face`、字体文件、子集化、中英混排基线与字重映射全部由 TC-006 交付。
UI 侧任何元素都不得引用 `--rc-font-resume-*`；简历画布内任何元素都不得引用 `--rc-font-family`。

---

## 8. 字号阶梯

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-font-size-sm` | 12px | 角标、单位、状态栏、Tab 计数 |
| `--rc-font-size-base` | 14px | 界面正文、输入框、菜单项（默认值） |
| `--rc-font-size-lg` | 16px | 面板标题、卡片名称、对话框正文 |
| `--rc-font-size-xl` | 20px | 对话框标题、分区标题 |
| `--rc-font-size-2xl` | 24px | 空状态标题、引导标题 |
| `--rc-font-size-3xl` | 28px | 仅用于首次引导/空状态的主标题 |

`sm / base / lg` 三个名字被 `element-plus-bridge.css` 直接占用（分别映射 EP 的 small/base/large），**不得改名**。
简历正文的字号不在此表内，由模板规则定义（PRD 6.2 原话）。

字重只用 400 / 500 / 600 三档；不用 700，中文粗体在 14px 下会糊成一团。
行高：`tight 1.25`（工具栏/状态栏单行）、`base 1.5`（界面正文）、`relaxed 1.7`（多行说明）。

---

## 9. 间距（4px 网格）

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-space-2xs` | 2px | 图标与文字贴合、角标内边距 |
| `--rc-space-xs` | 4px | 图标按钮内边距、标签内边距 |
| `--rc-space-sm` | 8px | 控件之间、行内元素之间 |
| `--rc-space-base` | 12px | 面板内边距、字段之间的标准间距 |
| `--rc-space-lg` | 16px | 面板区块间距、卡片内边距 |
| `--rc-space-xl` | 24px | 对话框内边距、区块大间距 |
| `--rc-space-2xl` | 32px | 空状态与页面级留白 |

`2px` 是唯一破格值：它只用于"2px 级"的视觉贴合（角标描边内缩、图标与文字基线对齐），
不参与区域布局。所有区域布局必须是 4 的倍数。

---

## 10. 圆角

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-radius-sm` | 2px | 标签、角标内层、输入框内小元素 |
| `--rc-radius` | 6px | **按钮**、输入框、下拉项、Tab（2026-10-23 由 4 提到 6） |
| `--rc-radius-lg` | 8px | **卡片**、模板卡、面板内分区、浮层 |
| `--rc-radius-xl` | 12px | **对话框**、抽屉 |
| `--rc-radius-full` | 999px | 胶囊标签、圆形角标（不参与四级阶梯） |

`--rc-radius-lg` 必须是 8（PRD：卡片 8），但桥接层当前把 `--rc-radius-lg` 映射给了 EP 的
`--el-border-radius-round`（语义是胶囊），这是桥接层的一处错配，已在交接报告 §5 记录，
建议 TC-004 接线时改为 `var(--rc-radius-full)`。

---

## 11. 阴影

四层，色相统一取 `#2b2b2b`，透明度随层高递增（越"高"的浮层阴影越深但越扩散）。

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-shadow-2` | `0 1px 2px rgba(43,43,43,.06)` | 卡片、模板卡静止态 |
| `--rc-shadow-4` | `0 2px 4px rgba(43,43,43,.07), 0 1px 2px rgba(43,43,43,.05)` | 面板、工具条、悬浮工具条 |
| `--rc-shadow-8` | `0 8px 8px -4px rgba(43,43,43,.08), 0 2px 6px rgba(43,43,43,.06)` | 下拉、popover、悬浮摘要 |
| `--rc-shadow-16` | `0 16px 16px -8px rgba(43,43,43,.10), 0 4px 10px rgba(43,43,43,.06)` | 对话框 |
| `--rc-shadow-paper` | `0 1px 3px rgba(43,43,43,.08), 0 8px 24px -6px rgba(43,43,43,.12)` | A4 纸面（唯一允许"大扩散"的静态阴影） |

不用彩色阴影，不用内阴影，不用发光。

---

## 12. 动效

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-duration-fast` | 100ms | 按压、角标出现/消失、hover |
| `--rc-duration-base` | 150ms | 常规状态过渡（PRD：状态过渡 150） |
| `--rc-duration-slow` | 200ms | 面板展开/收起、Tab 切换（PRD：面板 200） |
| `--rc-duration-dialog` | 300ms | 对话框进出（PRD：对话框 300） |

缓动：`--rc-ease-standard: cubic-bezier(.2,0,0,1)`（默认，快出慢停，办公软件应有的"干脆"）、
`--rc-ease-out: cubic-bezier(0,0,.2,1)`（进入）、`--rc-ease-in-out: cubic-bezier(.4,0,.2,1)`（位移）。

### 12.1 位移规则（2026-10-23 补，Amor 定「位移档」）

原版只有一个问题：**所有过渡都只改颜色，不位移**。鼠标按下去，屏幕不动，手感就是"死"的。
补位移不等于加花活——位移量控制在 1–2px，且只在鼠标/手指真的作用于某物时才发生。

| 元素 | 位移 | 时长 / 缓动 |
|---|---|---|
| 按钮 hover | `translateY(-1px)` + `shadow-2` | 150ms standard |
| 按钮 pressed | `translateY(0) scale(.98)`，阴影归零 | 150ms standard |
| 工具栏图标按钮 pressed | `scale(.96)` | 100ms standard |
| 卡片 hover（模板卡/空状态入口） | `translateY(-2px)` + `shadow-2 → shadow-4` | 150ms standard |
| 列表项 hover（组件项/图层行） | `translateX(2px)` | 100ms standard |
| Tab 切换 | 下划线 `scaleX(0→1)`，从左展开（替掉 border-color 瞬切） | 200ms ease-out |
| 空状态三入口 | `opacity 0→1` + `translateY(6px→0)`，相邻错开 40ms，**只播一次** | 200ms ease-out |

三条硬约束：

1. **位移不超过 2px**。4px 以上在大列表里会晃成"抖动"，尤其是图层行和组件项。
2. **不用回弹曲线**。P0-3 禁止 `cubic-bezier(0.68,-0.55,0.265,1.55)`，位移到位即停。
3. **不为了动而动**。首屏错开只给空状态三张入口卡，不给编辑器主界面——编辑时任何多余位移都是干扰。

`prefers-reduced-motion: reduce` 下，四档时长与所有入场动画统一压到 1ms（见 `mockup.css` 末尾降级块），
状态照常切换，只是不做补间。

**降级**：`@media (prefers-reduced-motion: reduce)` 把四个 duration 全部压到 `1ms`。
状态照常切换，只是不做补间——不采用 `animation: none`，因为那会让"状态是否真的变了"失去视觉确认。

---

## 13. 尺寸与布局常量

| 变量 | 值 | 依据 |
|---|---|---|
| `--rc-layout-toolbar-h` | 44px | PRD 6.3 顶部工具栏 40–48px，取中位数 |
| `--rc-layout-statusbar-h` | 28px | 状态栏单行 12px 字 + 上下 8px |
| `--rc-layout-left-w` | 264px | PRD 6.3 左侧 240–280px |
| `--rc-layout-left-w-narrow` | 240px | PRD 6.6（1280–1440px 收窄） |
| `--rc-layout-right-w` | 280px | PRD 6.3 属性面板 |
| `--rc-layout-a4-w` | 794px | 210mm @96dpi |
| `--rc-layout-a4-h` | 1123px | 297mm @96dpi |
| `--rc-layout-page-margin` | 76px | 20mm 页边距，画布辅助线位置 |
| `--rc-size-control-sm` | 28px | PRD 6.4 按钮高 28（紧凑） |
| `--rc-size-control` | 32px | PRD 6.4 按钮高 32（标准） |
| `--rc-size-row` | 32px | 图层行、列表行 |
| `--rc-size-tab-h` | 36px | 左侧资源栏 Tab |
| `--rc-size-badge` | 20px | 溢出角标直径 |
| `--rc-size-icon-sm/md/lg` | 16/20/24px | 图标只允许三档 |

---

## 14. 焦点与层级

| 变量 | 值 | 说明 |
|---|---|---|
| `--rc-focus-ring-width` | 2px | 键盘焦点环 |
| `--rc-focus-ring-color` | `rgba(16,112,147,.45)` | 主色 45% 透明 |
| `--rc-focus-ring` | `0 0 0 2px rgba(16,112,147,.45)` | 直接可用的 box-shadow |
| `--rc-z-artboard-toolbar` | 20 | 画板工具条 |
| `--rc-z-badge` | 30 | 溢出角标 |
| `--rc-z-popover` | 40 | 摘要浮层、下拉 |
| `--rc-z-dialog` | 50 | 对话框 |
| `--rc-z-toast` | 60 | 全局提示 |

焦点环用 `box-shadow` 而不是 `outline`，避免在 A4 纸面与画布上被 `overflow: hidden` 裁掉；
不用 `outline: none`（原则 7 键盘可达）。

---

## 15. 桥接层变量覆盖对照（32 个，逐个核对）

`src/design/element-plus-bridge.css` 引用的全部 `--rc-*` 与本文/`tokens.css` 的对应关系：

| # | 变量 | 值 | 语义归属 |
|---|---|---|---|
| 1 | `--rc-color-bg` | `#ffffff` | 表面 |
| 2 | `--rc-color-bg-elevated` | `#ffffff` | 表面 |
| 3 | `--rc-color-bg-page` | `#f9f9f9` | 表面 |
| 4 | `--rc-color-bg-subtle` | `#eff1f3` | 表面 |
| 5 | `--rc-color-border` | `#bdc2c7` | 边框 |
| 6 | `--rc-color-border-extra-light` | `#f0f2f3` | 边框 |
| 7 | `--rc-color-border-light` | `#e4e7ea` | 边框 |
| 8 | `--rc-color-border-lighter` | `#ebedef` | 边框 |
| 9 | `--rc-color-border-strong` | `#8c949c` | 边框 |
| 10 | `--rc-color-danger` | `#b3352b` | 语义 |
| 11 | `--rc-color-info` | `#4a6d8c` | 语义 |
| 12 | `--rc-color-primary` | `#107093` | 品牌 |
| 13 | `--rc-color-success` | `#1f7a4c` | 语义 |
| 14 | `--rc-color-warning` | `#a86400` | 语义 |
| 15 | `--rc-color-text` | `#2b2b2b` | 文本 |
| 16 | `--rc-color-text-disabled` | `#a9afb5` | 文本 |
| 17 | `--rc-color-text-placeholder` | `#8c949c` | 文本 |
| 18 | `--rc-color-text-secondary` | `#5b636b` | 文本 |
| 19 | `--rc-color-text-tertiary` | `#6e767e` | 文本 |
| 20 | `--rc-font-family` | 系统栈 | 字体 |
| 21 | `--rc-font-size-base` | `14px` | 字号 |
| 22 | `--rc-font-size-lg` | `16px` | 字号 |
| 23 | `--rc-font-size-sm` | `12px` | 字号 |
| 24 | `--rc-radius` | `6px` | 圆角 |
| 25 | `--rc-radius-lg` | `8px` | 圆角 |
| 26 | `--rc-radius-sm` | `2px` | 圆角 |
| 27 | `--rc-space-base` | `12px` | 间距 |
| 28 | `--rc-space-lg` | `16px` | 间距 |
| 29 | `--rc-space-sm` | `8px` | 间距 |
| 30 | `--rc-space-xl` | `24px` | 间距 |
| 31 | `--rc-space-xs` | `4px` | 间距 |
| 32 | `--rc-color-primary-light-3/-5/-7/-8/-9`、`-dark-2` | 见 §1.2 | 品牌派生 |

> 第 32 项是桥接层注释点名要 TC-016 定的一批。桥接层目前**尚未**为它们写映射行
> （注释原文："等 token 定稿时在这里补一批 `--rc-color-primary-light-N` 语义变量再一一对应"），
> 本卡已把变量定义好，补 6 行映射属于桥接层的后续动作，不在本卡可写范围内，见交接报告 §4。

---

## 16. 对比度实测汇总（WCAG 2.1）

| 前景 | 背景 | 比值 | 结论 |
|---|---|---|---|
| `#2b2b2b` 主文本 | `#f9f9f9` 页面底 | 13.45 | AAA |
| `#5b636b` 二级文本 | `#f9f9f9` 页面底 | 5.80 | AA |
| `#5b636b` 二级文本 | `#eff1f3` 面板底 | 5.39 | AA |
| `#6e767e` 三级文本 | `#ffffff` | 4.52 | AA（下限） |
| `#8c949c` 占位符 | `#ffffff` | 3.07 | 仅占位，非承载信息 |
| `#ffffff` | `#107093` 主按钮 | 5.58 | AA |
| `#107093` 主色文字 | `#ffffff` | 5.58 | AA |
| `#107093` 主色文字 | `#ecf4f6` 选中底 | 5.01 | AA |
| `#107093` 主色文字 | `#e7f1f4` EP light-9 底 | 4.86 | AA |
| `#0d5a76` dark-2 | `#ecf4f6` 选中底 | 6.87 | AA |
| `#1f7a4c` 成功 | `#ffffff` | 5.32 | AA |
| `#a86400` 警告 | `#ffffff` | 4.68 | AA |
| `#b3352b` 危险 | `#ffffff` | 6.07 | AA |
| `#4a6d8c` 信息 | `#ffffff` | 5.44 | AA |

验算方法：WCAG 相对亮度公式 `L = 0.2126R + 0.7152G + 0.0722B`（通道先做 sRGB 线性化），
对比度 `(L1+0.05)/(L2+0.05)`，L1 为较亮者。

---

## 17. 使用规则（写给后续实现卡）

1. **只引用语义变量**：`--rc-color-text` 而不是 `--rc-neutral-800`；色板不外泄。
2. **不新增颜色**：需要新色先改本表 + `tokens.css`，再在组件里引用，禁止组件内写 `#hex`。
3. **间距只用 4 的倍数**（唯一例外 `--rc-space-2xs: 2px`）。
4. **图标尺寸只能 16/20/24**，通过 `width/height` 直接引用 `--rc-size-icon-*`。
5. **状态必须"图标 + 文字 + 颜色"三者至少占两者**，禁止只用颜色表达（原则 7）。
6. **暗色不实现**：需要主题化的组件请用语义变量（而非色板），以便将来只替换 `[data-theme='dark']` 块。
7. **主色文字只允许落在白名单底色上**：`#ffffff` / `#f9f9f9`（页面底）/ `bg-hover` / `bg-subtle` /
   `light-9`（`#e7f1f4`）。`bg-active`、画布底、`neutral-200` 及更深的一律**不得**承载主色文字。
   > 为什么用白名单而不是阈值：`bg-active`（主色 L 上限 0.1466）和画布（0.1449）比 `light-9`
   > （0.1532）还严，余量只剩 0.0086 / 0.0068 —— 薄到任何一次微调都会破线。
   > 白名单不需要计算，对照即可执行。

---

## 18. 界面壳明度阶梯：**已降级 P2，暂不做**（2026-10-23 双方复核）

**问题**（2026-10-23 实测）：初版界面 **82.8% 的面积是同一个 `#ffffff`**。工具栏 4.9% + 左栏 16.9%
+ 右栏 17.9% + A4 纸 43.1%，全部纯白；A4 纸与它周围面板的对比度是 **1.00:1**。
「内容优先，界面退后」在物理上没有执行——纸和界面是一个颜色。

**方案**（只加档，不动 PRD 锁死的中性端点 `#f9f9f9 → #2b2b2b` 的语义）：

| 角色 | 现值 | 建议值 | 与面板的 ΔL* |
|---|---|---|---|
| 应用底 `--rc-color-bg-page` | `#f9f9f9` | `#f1f3f4` | — |
| 面板底（工具栏/左右栏） | `#ffffff` | `#eff1f3` | 0 |
| 画布底 `--rc-color-canvas` | `#e8ebed` | `#dde1e5` | −8.41 |
| A4 纸面 `--rc-color-paper` | `#ffffff` | `#ffffff`（**不动**） | +5.63 |

纸面 5.63 对面板、8.41 对画布，两个读数都超过"能察觉"的 5 个单位——屏幕上只有纸是纯白。

**必须先解决的前置冲突**（前端实测，不解决就不能上）：

1. **选中态塌陷**：选中态 `#ecf4f6` 在白面板上 ΔL\* **4.52**（可见），在灰面板 `#eff1f3` 上只剩 **0.43**（不可辨）。
   06 稿选中图层、01 稿 AI 建议按键、02 稿选中模板卡——所有"浅底选中"静默消失，**且与选哪个主色无关**。
2. 面板内 4 处用 `bg-subtle` 的元素会消失：`.segmented` 底、`.layer-thumb--img`、
   `cmp__head`、`layer-group__h` 的 hover 底。需改 `bg-active` 或加描边。
3. `--rc-color-bg-active` 在页面底上 **ΔE76 = 2.92**，鼠标按住时几乎看不出反馈。

**结论**：收益是层次感，代价是**选中态要重新设计 + 主色锁死**。MVP 阶段不划算，移入 P2。
**P0 只降工具栏与状态栏**（8% 面积，复用现成 `bg-subtle`，零连带成本），
`primary-subtle` 在白色面板上继续以 ΔL\* 4.52 正常工作。
