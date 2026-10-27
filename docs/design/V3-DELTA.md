# V3 设计定稿变更（TC-016 · 2026-10-27）

> 本文是 **v2「冷灰 + 青蓝」→ v3「蓝玻璃 + 白纸」** 的唯一权威变更说明。
> 生产值以 `src/design/tokens.css`（v3）为准；`token-values.md` 与 `components-spec.md` 保留作演进记录。
> 视觉稿：`docs/design/mockups/figma/`（11 个文件，入口 `index.html`）。

---

## 0. 一句话结论

界面从「冷灰底 + 青蓝强调」改为 **「白纸工作台 + 全面转蓝的外壳 + 一层透明色的材质」**。
蓝是外壳（chrome），墨绿退到纸面（content）；材质只做「一层 `rgba` + `backdrop-filter`」，
不画任何模拟高光。纸面仍是纯白不透明，A4 真值 `794 × 1123` 不变。

---

## 1. 与 v2 的 6 处变更

| # | 项 | v2 | v3 | 依据 |
|---|---|---|---|---|
| 1 | 边框 | 冷灰 `#e2e6e9` 族 | **全蓝** `#c3d8f2` / `#93b3dc` | Amor 2026-10-27「所有组件边框改蓝，包括导出按钮」 |
| 2 | 强调色 | 青蓝 `#0b7298` | **品牌蓝 `#2867c4`** | 同上；稿面给的是 `#2f76d2`，生产下沉一档，见 §3 |
| 3 | 墨绿 | 无 | **`#4b7168` 纸面专用** | 界面转蓝后要保住纸面的印刷感，绿不能消失也不能上界面 |
| 4 | 材质 | 实色面板 | **透明色 + 背景模糊** | Amor 2026-10-27「透明色，不需要添加多余的渲染，这样看起来很假」 |
| 5 | 卡片交互 | 无 | **悬停上浮 + 蓝色呼吸环** | Amor 2026-10-27；环只动 opacity，2.6s 一周期 |
| 6 | 工作台 | `#e3e7ea` 纯灰 | `#edf1f7` + 极光底 | 玻璃要有东西可透；纯色底上玻璃只会变成更白的方块 |

---

## 2. 配色表（v3 生产值，全部实测）

### 2.1 外壳 · 蓝族

| 变量 | 值 | 白底对比度 | 用途 |
|---|---|---|---|
| `--rc-color-bg-page` | `#edf1f7` | — | 工作台 |
| `--rc-color-border-extra-light` | `#eef3f9` | — | 最浅分隔 |
| `--rc-color-border-lighter` | `#e6edf7` | — | 浅分隔 |
| `--rc-color-border-light` | `#dbe5f1` | — | 卡片内分隔 |
| `--rc-color-border` | `#c3d8f2` | — | 组件描边（主用） |
| `--rc-color-border-strong` | `#93b3dc` | — | hover / 聚焦前 |
| `--rc-color-primary` | `#2867c4` | **5.49** | 品牌蓝、文字与填充 |
| `--rc-color-primary-light-9` | `#eaf0f9` | 4.78（primary 压其上） | 下拉选中底 |

### 2.2 文本

| 变量 | 值 | 白底 | 备注 |
|---|---|---|---|
| `--rc-color-text` | `#1b2430` | 15.2 | |
| `--rc-color-text-secondary` | `#5a6879` | 5.6 | |
| `--rc-color-text-tertiary` | `#66788f` | 4.9 | 仅 ≥11px |
| `--rc-color-text-placeholder` | `#9aabc0` | 3.0 | 占位，豁免 |
| `--rc-color-text-disabled` | `#a9b6c6` | — | 禁用，豁免 |

### 2.3 纸面（content）

| 变量 | 值 | 用途 |
|---|---|---|
| `--rc-color-paper` | `#ffffff` | A4 纸，与导出 PDF 同色，**永不加滤镜** |
| `--rc-color-paper-accent` | `#4b7168` | 小节竖条、求职意向、强调词（白底 5.44） |
| `--rc-color-paper-accent-soft` | `#edf4f1` | 纸内浅底 |
| `--rc-color-paper-border` | `#d9dee2` | 纸内分隔线，**中性灰，不能带蓝** |
| `--rc-color-paper-neutral` | `#f2f4f5` | 纸内占位块 |

### 2.4 语义

| 变量 | 值 | 白底 | 备注 |
|---|---|---|---|
| `--rc-color-success` | `#2e7a57` | 4.72 | 「已确认」徽标 |
| `--rc-color-warning` | `#96611a` | 5.23 | warning-subtle 上 4.78 |
| `--rc-color-danger` | `#b6544f` | 4.80 | 文字用 `--rc-color-danger-ink #8e3d39` |
| `--rc-color-info` | `#3b6fa8` | 4.98 | |

---

## 3. 关键裁决：稿面 `#2F76D2` → 生产 `#2867C4`

**这不是审美选择，是硬约束。**

Element Plus 里「`primary-light-9` 底 + primary 文字」这条规则块有 20 处（下拉选中项、hover 项、
plain 按钮……）。要过 AA，**主色相对亮度必须 ≤ 0.1533**。

| 候选 | 相对亮度 L | 白底 | light-9 底 | 结论 |
|---|---|---|---|---|
| 稿面 `#2f76d2` | 0.1822 | 4.52 | **3.96** | ❌ 挂 AA |
| 生产 `#2867c4` | 0.1413 | 5.49 | **4.78** | ✅ 三档全过 |

两者肉眼几乎无差（同为色相 218°，明度差 4%）。稿面值保留在
`docs/design/mockups/figma/tokens.css` 里作对照，生产端不采用。

> 与 v2 的处理方式一致：v2 也曾因为同一条约束把审计建议的 `#0E7A9E`（light-9 4.29）否掉。
> **每次改主色都要重算 light-9，不能只看白底。**

---

## 4. 材质规则（只有两条）

1. **一层透明色**：就是 `rgba()`。
   - 顶栏/侧栏 `.62`、面板内卡槽 `.52`、默认按钮 `.42`（hover `.66`）
   - 主按钮 `rgba(40,103,196,.14)`（hover `.22`）
   - 卡片 `.5`（hover `.72`）、对话框 `.86`
2. **背景模糊**：`backdrop-filter: blur(12~20px) saturate(140%)`，唯一作用是把背后柔化。

**明确不做**（2026-10-27 Amor 否决）：
镜面高光弧、色散彩边、多重 `inset` 阴影、外发光、渐变填充（极光底除外）。

> 理由：这些都是用 CSS 去模拟光学现象，模拟得越像越假。
> 真玻璃在界面上就两件事——一层半透明 + 背后被柔化。

**唯一装饰**：卡片 hover 的蓝色呼吸环（1px `--rc-color-primary`，`opacity .45↔1`，2.6s），
以及上浮 `translateY(-8px) scale(1.012)`。`prefers-reduced-motion` 下降级为常亮静态框。

**前提**：透明色必须背后有东西。极光底 `--rc-aurora` 四层 radial-gradient（峰值 alpha 0.24）
铺在 `body::before`，纸面本身仍纯白不透明。

---

## 5. 组件变更摘要

| 组件 | v3 规格 |
|---|---|
| 默认按钮 | `background: --rc-glass-bg-tint`；`border: 1px --rc-color-border`；无阴影；hover 只提 alpha 与边框 |
| 主按钮（导出/确认） | `background: --rc-glass-primary`；`border: 1px --rc-glass-primary-border`；文字 `--rc-color-accent-ink`；**不加实心填充** |
| 主按钮禁用 | alpha 降到 `.3`，边框退成 `--rc-color-border-soft`，文字 `--rc-color-text-disabled` |
| 卡片（模板/组件/入口/索引） | `background: --rc-glass-card`；`border: 1px --rc-color-border`；无阴影；hover 上浮 + 呼吸环 |
| 当前态卡片 | 边框常亮 `--rc-color-primary`，不参与呼吸 |
| 组件市场 | 面板内**两列卡片网格**（`.compgrid`），奇数末卡横跨两列；拖拽柄移到右上角、hover 才出现 |
| 输入框 | `--rc-glass-bg-soft` + 蓝边；focus 转 `--rc-color-primary` + 2px 光晕 |
| 对话框 / 浮层 | `--rc-glass-bg-strong` + 模糊 + 1px 蓝边；**唯一保留阴影的两处**（需与遮罩分离） |

---

## 6. 布局常量变更

| 变量 | v2 | v3 | 说明 |
|---|---|---|---|
| `--rc-layout-toolbar-h` | 44px | 48px | 稿面更高，容纳文档名 + 副标题两行 |
| `--rc-layout-left-w` | 264px | 296px | 组件区改两列卡片需要宽度 |
| `--rc-layout-left-w-narrow` | 240px | 264px | 同上 |
| `--rc-layout-right-w` | 280px | 292px | 稿面属性面板字段更密 |
| `--rc-layout-page-margin` | 76px（20mm） | 60px | 稿面纸内边距更透气；**不是 20mm 了，导出时以模板规则为准** |
| `--rc-layout-zoom-default` | — | 0.6 | 新增：适合页面档 |
| `--rc-radius` | 6px | 7px | 控件 |
| `--rc-radius-xl` | 12px | 14px | 对话框 |
| `--rc-radius-sm` | 2px | **2px（不动）** | ⚠ 桥接层把它喂给 EP checkbox 内框，改大会变成小圆饼；标签圆角另开 `--rc-radius-tag: 4px` |

---

## 7. 稿面与生产的已知差异

1. **纸面视图**：稿面标 87%，但稿内纸面是按 ~0.6 缩放绘制的，87% 时整页不可能装进画布。
   生产取 `60%`（适合页面），A4 真值不变。
2. **主色**：稿面 `#2f76d2` vs 生产 `#2867c4`，见 §3。
3. **选中框**：稿面用未登记的蓝；v3 起「选中蓝」并入品牌蓝，不再单独存在。
4. **状态栏分工**：稿面把「页码 · A4 · 缩放 · 已保存 · 溢出数」在同一位置重复出现两次；
   v3 拆为「画布条放页信息与缩放」「状态栏放保存时间与溢出计数」。
5. **模板卡徽标**：稿面「当前模板」与「已应用」同时出现在两张卡上；v3 收敛为只有当前卡带徽标。

---

## 8. 落地与验证状态

| 项 | 状态 |
|---|---|
| `src/design/tokens.css` 回灌 v3 | ✅ 已完成（纯增量 + 换值，变量名一个未改，桥接层零改动） |
| `element-plus-bridge.css` | ✅ 无需改动（全部 `var(--rc-*)` 引用仍存在） |
| 视觉稿 11 个文件 | ✅ `docs/design/mockups/figma/` |
| **四门（lint / type-check / test / build）** | ⚠ **未跑**：本轮沙箱拒绝 shell 进程访问项目目录（`pnpm` / `git` / `grep` 均 EPERM），需 Amor 侧执行或放开权限 |
| git 提交 | ⚠ **未提交**：同上，`.git` 读取被拦 |

> 四门命令：`pnpm lint && pnpm type-check && pnpm test && pnpm build`
