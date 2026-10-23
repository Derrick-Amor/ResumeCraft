# CONTRACT — ResumeCraft 模块契约

> 版本：v0.1（草案，待 Amor 确认）
> 生成：2026-10-23｜主控：阿U
> 状态：草案 → **v1.0 冻结**（TC-003 / TC-007 / TC-017 交付后）→ 此后只增不改，破坏性变更升 v2 并记 §11
> 依据：PRD V1.3 第 8 章｜《多Agent协同执行规范》V1.1 §1（两层契约）｜《开发任务分工》V1.2 附录 F.1

---

## 0. 契约地位与变更规则

1. **唯一事实源**：每一章标注「定义方」。定义方之外的任何模块**只读引用**，不得自行定义同名结构。
2. **缺省即违规**：两个模块之间需要传递的数据，若本文件没有定义，先补本文件再写代码。代码先改、契约后补 → 打回。
3. **变更流程**：改本文件 → 若涉文档模型则回写 PRD 第 8 章 → 在 `docs/plan/TASKS.md` §4 登记受影响卡 → 通知下游。
4. **字段级细节**：本文件锁定"有哪些结构、谁定义、谁消费、哪些不变量不能破"。具体字段名/类型以定义方卡的交付代码为准（TC-003 schema、TC-007 LayoutResult、TC-017 StorageAdapter）；冲突时以本文件的不变量条款为准，并触发一次契约修订。
5. **前端 MVP 无 HTTP**：所有跨模块通信都是同进程 TS 调用，不存在网络层、不存在鉴权中间件。

---

## 1. 分层与所有权

| 章 | 契约组 | 定义方（卡） | 消费方 |
|---|---|---|---|
| 2 | MVP-1 文档模型 | `src/model/`（TC-003） | 全部模块 |
| 3 | MVP-2 组件注册表 | `src/components/`（TC-005） | ui / layout / template |
| 4 | MVP-3 测量与单位 | `src/layout/`（TC-006） | layout / io / ui |
| 5 | MVP-4 布局结果 | `src/layout/`（TC-007） | ui / io / quality / template |
| 6 | MVP-5 持久化 | `src/storage/`（TC-017） | ui / model |
| 7 | MVP-6 导入导出 | `src/io/`（TC-010/011/012） | ui |
| 8 | MVP-7 质量检查 | `src/quality/`（TC-013a） | io / ui |
| 9 | MVP-8 模板 | `src/template/`（TC-009） | ui |
| 10 | MVP-9 UI 接线约定 | `src/ui/`（TC-004/008） | — |
| 11 | 错误与降级约定 | 全体 | 全体 |
| 12 | P1 HTTP 契约（骨架，**未定义任何端点**） | `server/`（TC-106，M6） | 前端 `src/api/` |

---

## 2. MVP-1 文档模型（定义方：`src/model/`，TC-003）

**结构**：`ResumeDocument`、`PageSettings`、`ResumeComponent`、`LanguageTrack`、`UnknownComponent`、`SchemaVersion`。

**不变量（任何模块不得破坏）**：

1. `ResumeDocument` 必带 `schemaVersion`（整数）与 `documentId`（唯一）。
2. **未知组件类型必须原样保留**并标记为 unknown，禁止静默丢弃（PRD 8.3、12 章错误表）。
3. `languageTrack` 决定字段可选性；未知字段保留不删（PRD 8.1 末段）。
4. 迁移前必须留有可恢复副本；迁移函数幂等（同版本重复执行结果不变）。
5. 序列化/反序列化往返一致：`deserialize(serialize(doc))` 深等于 `doc`（中英文档各一份基准）。

**四个唯一入口**：`serialize(doc)`、`deserialize(json)`、`migrate(doc)`、`validate(input)`。任何模块不得自行 JSON.parse 文档。

**undo 契约**：只暴露命令式接口（`push(command)` / `undo()` / `redo()` / `canUndo()` / `canRedo()`）。
不变量：① UI 不得直接改 store state 后不经过命令入栈；② 连续输入按"同一组件同一字段 + 时间窗"合并，不得逐字符入栈；③ 栈有上限，超限丢最早；④ 保存/重开后的撤销历史策略必须明确（MVP：清空历史，PRD FR-DOC-004 要求有说明）。

---

## 3. MVP-2 组件注册表（定义方：`src/components/`，TC-005）

`ComponentDefinition{ type, 显示名, 语言轨字段裁剪声明, zod schema, 默认值, 样式档 L1/L2 }`；注册表提供 `register / get / list`。

**不变量**：

1. 组件类型只在注册表登记一次；UI 与布局不得对 `type` 写 `switch` 硬编码分支（PRD FR-CMP-001）。
2. **语言轨差异在组件声明里表达**，不允许在 UI 层散落 `if (languageTrack === 'en')` 判断。
3. L1/L2 样式必须随文档序列化往返（PRD FR-EDT-006 P0 部分）；L3 形状与样式市场属 P2，本契约不定义。

---

## 4. MVP-3 测量与单位（定义方：`src/layout/`，TC-006）

- 单位换算：`pt`（PDF 点）／`px`（CSS 像素）／`mm`（页面物理尺寸）／Word 半磅 四向换算，唯一换算层。
- `measure(text, style) → { width, height, lineBreaks, cached }`：**纯函数**，同输入必同输出（确定性，PRD FR-LAY-010）。
- `FontLoader`：显式加载内置字体；加载失败必须返回可判定的降级标记并触发界面提示（PRD 12 章），**不得静默回退后仍声称测量可信**。

**不变量**：测量层不得依赖 DOM 布局（只允许 Canvas2D `measureText`）；任何 DOM 读数都必须经过对照验证（`docs/verify/canvas-vs-dom.md`）。

---

## 5. MVP-4 布局结果（定义方：`src/layout/`，TC-007）

```
layout(doc, measure, options) → LayoutResult{
  boxes:      ComponentBox[]   // 组件几何：componentId, pageIndex, x, y, width, height,片段序号
  pages:      PageBox[]        // 页面：pageIndex, width, height, 内容区
  warnings:   LayoutWarning[]  // type, pageIndex, componentId, severity, cause, suggestion
  engineVersion: string
  inputHash:  string           // 用于确定性比对（同输入必同 hash）
}
```

**不变量**：

1. **纯函数**：不得读写 store、不得读 DOM、不得读时间/随机数。
2. 溢出不自动删内容（PRD 4.8 裁决：数据完整性 > 布局合法性）。
3. 溢出三阶段各自产出**候选结果**，不产 UI：`compress(scope='component'|'page')`、`split()`、`pushDown()`；压缩手段限行距/字距/组件内留白微调。
4. 跨页：短语义组件（≤页高 60%）keep-together；长语义组件与连续组件降级为可拆分；标题不得孤立。
5. 两次相同输入必须得到逐字节一致的 `boxes` 与 `inputHash`（快照回归的判定依据）。

---

## 6. MVP-5 持久化（定义方：`src/storage/`，TC-017）

```
StorageAdapter{ save(doc), load(id), list(), remove(id), exportJSON(id), importJSON(file) }
FileAccessAdapter{ canWriteBack(), writeBack(doc), download(doc) }
QuotaInfo{ usage, quota, percent }
SecurityCheck(file) → { ok, reason }   // 类型/大小/含宏
```

**不变量**：

1. **业务核心禁止直接调用 IndexedDB / File System Access API**（后端架构 §2.3、任务分工 E.3）；只经本接口。
2. 接口签名与云存二期 `CloudStorageAdapter` 完全一致，新增实现不改调用方。
3. "保存到原文件"与"下载副本"在接口层就是两个方法，UI 必须分别呈现（PRD 4.4）。
4. 日志不得包含简历正文/电话/邮箱（FR-SEC-004）。

---

## 7. MVP-6 导入导出（定义方：`src/io/`，TC-010/011/012）

```
exportPdf(doc, layout, opts) → ExportResult{ ok, pageCount, bytes, warnings, fontSubstituted }
exportDocx(doc, opts)        → ExportResult{ ok, pageCount, bytes, warnings }
importDocx(file) / importPdf(file) → ImportReport{ blocks[], confidence, pending[], warnings, sourceKind }
runQualityChecks(...)        → 见 §8（导出前必调）
RecognitionProvider          → recognize(file) → ImportReport   （可切换实现）
```

**不变量**：

1. 导出前必须调用质量检查；**阻断级问题默认拦截**，需用户显式确认才可强制导出（FR-EXP-003）。
2. 导入任何阶段失败**不得破坏原文件与当前文档**（FR-IMP-007）。
3. 未识别块一律进 `pending[]`，不得静默丢弃（FR-IMP-008）。
4. 分层承诺在返回结构里可判别：`sourceKind = 'self-docx' | 'third-party-docx' | 'pdf'`；`self-docx` 走结构标记无损路径，标记受损则降级并置警告（FR-EXP-005 / FR-IMP-009）。
5. DOCX 结构标记的具体命名与版本规则见 `docs/docx-mark-protocol.md`（TC-011 交付），本文件只锁"协议变更必须升版本号"。

---

## 8. MVP-7 质量检查（定义方：`src/quality/`，TC-013a）

```
runQualityChecks(doc, layoutResult) → QualityReport{
  blocking:    Issue[]   // 内容裁切/内容丢失/必然错页
  warnings:    Issue[]   // 溢出、重叠、异常空白页、页数超建议
  suggestions: Issue[]   // 可改善项
}
Issue{ type, pageIndex, componentId, severity, cause, suggestion }
```

**不变量**：严重度语义固定（裁切/丢内容 = blocking）；`blocking` 非空时导出层不得静默产出文件；报告结构是导出层与 UI 的唯一消费入口。

---

## 9. MVP-8 模板（定义方：`src/template/`，TC-009）

```
TemplateDefinition{ id, version, languageTrack, pageSettings, theme, componentOrder,
                    styles, layoutRules, preview, license }
applyTemplate(doc, templateId) → { doc, mappingReport{ preserved[], pending[], warnings[] }, undoToken }
```

**不变量**：已识别字段切换模板后零丢失；无法映射的内容进 `pending`；操作可撤销（返回 undoToken 供 undo 栈回滚）；`license` 字段不可为空（PRD FR-TPL-005）。

---

## 10. MVP-9 UI 接线约定（定义方：`src/ui/`，TC-004/008）

1. UI **只读** schema、**只发命令**（经 undo 栈）、**只渲染** LayoutResult；UI 不得定义数据结构、不得回写 schema。
2. 画布坐标只来自 `LayoutResult.boxes`，缩放仅影响预览变换，不得改文档尺寸（PRD 5.4）。
3. 布局警告/质量报告到界面的映射统一走「警告条 / 右上角角标」两种载体，禁止自造第三种提示形态（PRD 6.4、FR-LAY-012）。
4. 三层图层的选中/锁定状态属于 UI 状态，**不进文档模型**；背景层默认锁定。

---

## 11. 错误与降级约定（全体适用）

1. 跨模块调用**返回结果对象，不抛异常**（可抛的只有程序性错误，且必须被边界捕获并转为 `{ code, message, cause, recoverable }`）。
2. 错误必须可判可读：`code` 稳定、`message` 面向用户、`cause` 面向开发者。
3. 禁止吞异常；禁止 catch 后返回"成功"。
4. 降级必须显式：字体降级、File System Access 降级、结构标记降级，都要在返回值里带标记并由 UI 呈现，不得静默。

---

## 12. P1 HTTP 契约（骨架 — 本文件不写任何端点）

> 触发条件：M5 发布后启动后端（M6）。以下只锁约定，不锁端点。**任何人在此处补端点前必须先有 PRD 依据 + 后端卡号。**

| 约定项 | 内容 |
|---|---|
| 前缀与版本 | `/api/v1/`；删/改字段必须升 `/api/v2/`，只加字段属向后兼容 |
| 统一响应体 | `{ code, message, data, traceId }` |
| 错误码分段 | `0` 成功／`1xxx` 参数／`2xxx` 业务／`3xxx` 认证／`5xxx` 服务端 |
| 认证 | JWT：access 15min + refresh 7d；refresh 旋转；Redis 黑名单支持主动失效 |
| 分页 | 通用 `page + limit`；社区 feed 预留 `cursor` |
| 写操作幂等 | 支持幂等键头；支付回调必须幂等 |
| 契约产物 | `openapi.yaml`（OpenAPI 3.0），前端据此生成 TS 类型 |
| 端点清单 | **留空**，由 M6 的 TC-106 依据 PRD 与后端 25 模块补写 |

---

## 13. 版本与变更记录

| 版本 | 日期 | 变更 | 状态 |
|---|---|---|---|
| v0.1 | 2026-10-23 | 初版：9 组 MVP 契约 + 错误约定 + P1 骨架（无端点） | 待 Amor 确认 |
