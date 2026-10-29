# DOCX 样式映射表（TC-011）

> 模型 `style` 字段 → DOCX Run / 段落属性 的映射规则。
> 实现方：`src/io/export-docx.ts` 的 `styleToRunProps` / `styleToParaProps`。
> 本表与 `docs/docx-mark-protocol.md` 一起构成 DOCX 导出的样式与结构约定；
> 映射语义变更时必须同步更新本表与实现，并在 `docs/plan/TASKS.md` §4 登记。
> 原则（FR-EXP-002）：**主要格式尽可能保留**；DOCX 是可编辑副本，Word 重排后分页可能变化，
> 但字号/字重/颜色/行距等直接格式必须保真。

## 1. Run 级（文字）

模型 style 键 → docx `TextRun` 属性。优先级：行内 `line.style` > 组件 `component.style` > 角色默认档。

| 模型键 | 类型 | DOCX 目标 | 转换规则 | 缺省/忽略 |
|---|---|---|---|---|
| `bold` | boolean | `bold` | 原值直传 | 不设（角色默认档生效） |
| `italic` | boolean | `italics` | 原值直传 | 不设 |
| `underline` | boolean | `underline: { type: 'single' }` | true → 单下划线；false 不设 | 不设 |
| `color` | string | `color` | `#RGB`/`#RRGGBB`/`RRGGBB` → 去 `#` 转大写 6 位 hex | 非法值忽略该键 |
| `fontSizePt` | number | `size` | pt × 2（OOXML 半磅），四舍五入 | 非正数忽略 |
| `titleSizePt` | number | `size` | 同上；仅 `role='title'` 且无 `fontSizePt` 时生效 | 同上 |
| `titleWeight` | number | `bold` | ≥600 → bold；<600 → 非粗。仅 `role='title'` | 无则 title 默认粗体 |
| `fontFamily` / `font` | string | `font` | `rc-sans`/`sans` → `Microsoft YaHei`；`rc-serif`/`serif` → `SimSun`；其余原值直传 | 空串忽略 |

### 角色默认档（style 未覆盖时）

| role | 默认字号 | 默认字重 |
|---|---|---|
| `title` | 13pt（26 半磅） | 粗体 |
| `body` | 11pt（22 半磅） | 常规 |
| `bullet` | 10pt（20 半磅） | 常规 |

## 2. 段落级

| 模型键 | 类型 | DOCX 目标 | 转换规则 | 缺省/忽略 |
|---|---|---|---|---|
| `lineHeight` | number | `spacing.line` + `lineRule: auto` | 倍数 × 240（1.0 倍行距 = 240 twips），四舍五入 | 非正数忽略 |
| `gapAbovePt` | number | `spacing.before` | pt × 20（twips） | 非正数忽略 |
| `marginBottomPt` / `gapBelowPt` | number | `spacing.after` | pt × 20；两者都有时 `marginBottomPt` 优先 | 非正数忽略 |
| `bulletIndentPt` | number | `indent.left` | pt × 20；仅 `role='bullet'` | 非正数忽略 |
| `ruleWidthPt` | number | `border.bottom` | pt × 8（1/8 磅线宽），单线黑色；仅 `role='title'` | 非正数忽略 |

## 3. 页面设置（FR-EXP-002）

`PageSettings`（模型 §2）→ `section.properties.page`：

| 模型键 | DOCX 目标 | 转换 |
|---|---|---|
| `widthMm` / `heightMm` | `size.width` / `size.height` | mm → twips（1mm ≈ 56.6929 twips，用 `convertMillimetersToTwip`） |
| `orientation` | `size.orientation` | `portrait` → `portrait`；`landscape` → `landscape` |
| `marginTopMm` 等四边 | `margin.top/right/bottom/left` | mm → twips |

## 4. 不保证的项（明示边界，FR-EXP-002）

- **绝对定位**：模型按盒布局（TC-007），DOCX 按流式排版，组件的 x/y 不写入文件。
- **分页位置**：分页由 Word 重算，`pageCount` 仅是估算值。
- **字体文件**：DOCX 不嵌字体，只写逻辑字体名；缺字时由 Word 用同族字体替代。
- **装饰元素**：分隔线以外的装饰（角标、阴影等）不导出。
