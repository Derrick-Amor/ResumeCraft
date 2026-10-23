# TASKS — ResumeCraft 逐卡执行台账（18 张卡）

> 版本：v0.1（待 Amor 确认）
> 生成：2026-10-23｜主控：阿U
> 说明：卡的定义（任务内容/交付物/验收标准/边界）在《ResumeCraft 开发任务分工》V1.2 §2，本文件**不重复**，只补四件任务分工没落到命令级的东西：**可写目录、前置、卡级验收命令、FR 映射**，并记录状态。
> 状态取值：未开始 / 进行中 / 待验收 / 已完成 / 阻塞（阻塞须写原因与解除条件）。

---

## 0. 全局质量门（TC-003 起每卡必过）

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build
```

例外（工程尚未初始化，改用文件存在性与内容核对）：
- **TC-001**：`docs/` 下四份产物存在 + 需求摘要字数 ≤5000 + 含 FR 引用 + `git status` 只允许 docs/ 下新增
- **TC-002**：`pnpm install` 通过 + 上述四门空跑 + `verify:*` 占位可执行 + 十目录齐 + `git remote -v` 指向目标仓库

命名裁决（2026-10-23 阿U）：验收脚本统一为 **`type-check`**（任务分工附录 F.2 为准）；TAPD 规范 §6/§7 模板里的 `typecheck` 视为笔误，包管理器统一 **pnpm**。

---

## 1. 逐卡台账

| ID | 卡名 | 角色 | 前置 | 可写目录（所有权边界） | 卡级验收命令 | FR 映射 | 工期 | 状态 |
|---|---|---|---|---|---|---|---|---|
| TC-001 | 需求摘要与边界确认 | arch | — | `docs/plan/`（仅加批注）、`docs/contract/`（仅加批注）、`docs/handoff/`、`docs/` 下本卡四份产物 | 见 §0 例外条 + `wc -m docs/需求摘要.md` ≤5000 | 全文；重点 2/4 章 | 0.5–1d | 未开始 |
| TC-002 | 工程脚手架与工程规范 | fe-foundation | 001 | 工程根配置、`src/`（骨架）、`tests/`（空跑）、`.github/`、`docs/ui-lib-compare.md`、`README.md` | `pnpm lint && pnpm type-check && pnpm test && pnpm build` + `pnpm verify:layout && pnpm verify:export && pnpm verify:import` | 13 章、3.2 | 1.5–2.5d | 未开始 |
| TC-016 | UI 视觉设计专题（视觉先行） | fe-foundation | 002 | `docs/design/`、`src/design/tokens.css` | `ls docs/design/{token-values.md,components-spec.md,mockups/index.html}`；mockups ≥8 个 html 可开；硬编码色值扫描为空；6.7 自检逐条 | 6 章全、6.7、FR-EDT-001/002（视觉）、FR-LAY-011/012（视觉） | 1.5–2d | 未开始 |
| TC-003 | 文档模型与序列化 + undo 栈 | fe-editor | 002 | `src/model/`、`tests/model/` | `pnpm test -- src/model` | FR-DOC-002/003/004、8 章 | 2–3d | 未开始 |
| TC-004 | 设计 token 落地与基础控件 | fe-foundation | 002、016 | `src/design/`、`src/ui/controls/`、`tests/controls/` | `pnpm test -- src/ui/controls` | 6.1–6.4 | 1.5–2d | 未开始 |
| TC-006 | 布局引擎·测量与单位 + 字体资产 | fe-layout | 003 | `src/layout/{units,measure,font-loader}.ts`、`src/assets/fonts/`、`docs/font-license.md`、`docs/verify/canvas-vs-dom.md` | `pnpm test -- src/layout/measure` + `pnpm verify:layout` | FR-LAY-001/002/010、13.1#8/#17 | 3–4d | 未开始 |
| TC-007 | 布局引擎·排列/分页/溢出 | fe-layout | 006 | `src/layout/`（flow/pagination/overflow/overflow-stages/report/types）、`docs/layout-rules.md`、`tests/layout/` | `pnpm verify:layout` | FR-LAY-003~008、010、011（引擎） | 3–4d | 未开始 |
| TC-005 | 简历组件集（中英双轨） | fe-content | 003、004 | `src/components/`、`tests/components/` | `pnpm test -- src/components` | FR-CMP-001~010、FR-EDT-004、FR-EDT-006（P0 部分） | 2.5–3d | 未开始 |
| TC-017 | 持久化与数据安全 | fe-content | 003 | `src/storage/`、`tests/storage/` | `pnpm test -- src/storage` | FR-SEC-001~005、FR-DOC-002/003 配套、4.4（**FR-SEC-005 只验 JSON 备份核心，完整删除/恢复策略留 P1**） | 1.5–2d | 未开始 |
| TC-013a | 质量检查引擎 | fe-content | 003、007 | `src/quality/`、`tests/quality/` | `pnpm test -- src/quality` | FR-QA-001/002、FR-EXP-003 接口 | 1.5–2d | 未开始 |
| TC-010 | 导出层·PDF | fe-io | 006、007、013a | `src/io/export-pdf.ts`、`src/io/pdf-smoke.ts`、`docs/verify/pdf-cross-reader.md`、`tests/io/export-pdf.test.ts` | `pnpm verify:export` | FR-EXP-001/003/004、13.1#10 | 2.5–3d | 未开始 |
| TC-011 | 导出层·DOCX | fe-io | 007、013a | `src/io/export-docx.ts`、`src/io/docx-marks.ts`、`src/io/docx-style-map.md`、`docs/docx-mark-protocol.md`、`docs/verify/docx-open-check.md` | `pnpm verify:export` | FR-EXP-002/003/005、4.5 | 2.5–3d | 未开始 |
| TC-008 | 编辑器 UI 骨架与画布渲染 | fe-editor | 004、007、016 | `src/ui/`（shell/canvas/panels/layers/overflow-dialog/board、undo-wiring.ts）、`tests/ui/` | `pnpm test -- src/ui` + 手动回归清单 | 5 章、FR-DOC-001/004、FR-EDT-001~005、FR-LAY-011/012（UI） | 3–4d | 未开始 |
| TC-009 | 模板系统（4 套） | fe-content | 005、007 | `src/template/`、`docs/template-design-notes.md`、`docs/template-licenses.md`、`tests/template/` | `pnpm test -- src/template` | FR-TPL-001~005、9 章 | 2.5–3d | 未开始 |
| TC-012 | 导入层（DOCX+PDF） | fe-io | 005、008、011 | `src/io/import-*.ts`、`src/io/recognition-provider.ts`、`src/ui/import-wizard/`、`tests/io/import-*.test.ts`、`docs/verify/mammoth-samples.md` | `pnpm verify:import` | FR-IMP-001~010、FR-EXP-005（反向侧） | 4–5d | 未开始 |
| TC-013 | 测试体系 | qa | 008、010、011、013a | `tests/`（e2e、fixtures、visual）、`docs/test-report.md` | `pnpm test:e2e && pnpm test:visual` | FR-QA-005、14 章 | 3–4d | 未开始 |
| TC-015 | 发布准备与运营素材 | doc | 全部 P0 卡 | `scripts/`、`docs/deploy/`、`docs/compliance-checklist.md`、`docs/user-guide.md`、`docs/release-acceptance.md`、`docs/marketing/` | `pnpm verify:release`（14.3 阻断条件脚本化）+ 线上地址可访问 | 14.3/15/16 章 | 2–3d | 未开始 |
| TC-014 | AI 建议层（P1 后置） | 另行指派 | 003、009 | `src/ai/`、`tests/ai/` | `pnpm test -- src/ai` | FR-AI-001~010、10 章 | P1 | 后置 |

> **映射口径说明（2026-10-23 补，TC-001 核对 K4）**：TC-002 / TC-004 / TC-015 为**章节级映射**（工程基座、视觉 token、发布准备在 PRD 中无对应 FR 编号），验收时以章节条款替代 FR 逐条对照；其余 14 张卡均为 FR 编号级映射。

### 执行顺序（严格串行，一次一卡）

```
M0: 001 → 002
M1: 016 → 003 → 004
M2: 006 → 007 → 005 → 017
M3: 013a → 010 → 011 → 008 → 009
M4: 012 → 013
M5: 015
后置: 014（P1）
```

M2/M3 的卡内顺序由我按关键路径重排（文档罗列顺序不同），不改依赖关系：M2 先做 006/007 以最早暴露 Canvas 测量风险（PRD 13.2#1）；M3 先做 013a/010 以最快打通 PDF 闭环终点。

---

## 2. 外部前置（不在任务卡内，但会卡住卡）

| # | 事项 | 需要谁 | 卡住哪张卡 | 状态 |
|---|---|---|---|---|
| E1 | 真实简历样本（见 §3） | Amor 提供 | TC-012、TC-013 | 待提供 |
| E2 | GitHub 推送授权 | Amor 已授权（2026-10-23） | TC-002 起每卡验收后 push | 已解决 |
| E3 | UI 组件库最终选型 | Amor 看小样后拍板 | TC-004 及后续全部控件 | 待 Amor 看小样 |
| E4 | `src/assets/fonts/` 是否补入任务分工附录 A | Amor 确认 | TC-006（字体落位） | **待确认** |
| E5 | 剪藏样本签字（模板授权登记） | Amor 确认 4 套模板全部自设计 | TC-009 | 待确认 |

---

## 3. 导入测试样本清单（Q5：Amor 提供）

| 类别 | 要求 | 用途 | 数量 |
|---|---|---|---|
| 第三方 DOCX | WPS/Office 手写，**含表格** | mammoth 解析 + 结构识别 | 1–2 份 |
| 第三方 DOCX | 含**文本框或浮动图片**的简历 | 边界能力验证 | 1 份 |
| 中文简历 DOCX | 常规单页，真实内容（可脱敏） | 主路径样本 | 1 份 |
| 英文 CV DOCX | 单栏、动词开头 bullet | 英文轨样本 | 1 份 |
| 文本型 PDF | 有文字层的简历 PDF | pdfjs 提取 + 版面分析 | 1 份 |
| 扫描型 PDF | 无文字层的扫描件 | 仅验证"正确提示是扫描件"，不做 OCR | 1 份 |

脱敏要求：姓名/电话/邮箱可替换为假值，结构必须真实（不要为了好看而删掉表格、文本框）。我在 M2 结束前一周向你收，不急。

> **与 PRD 14.2 的关系（2026-10-23 补，TC-001 核对 K6）**：上表只是「**必须由真人提供**」的子集。PRD 14.2 的其余必建样本——长网址/特殊字符、含图片、缺图资源、替代字体、损坏或不完整文件、中英混排基准、≥3 页、内容密集单页、空白简历——由 TC-013 的 qa 自造，不占 Amor 时间。**TC-012 / TC-013 的样本覆盖以 PRD 14.2 全量为准**，不得只用上表。

---

## 4. 状态流转记录（TAPD 镜像）

| 日期 | 卡 | 变更 | 证据 |
|---|---|---|---|
| 2026-10-23 | — | 计划包 v0.1 落盘，待 Amor 确认 | 本文件 + PLAN.md + CONTRACT.md + PROGRESS.md |
| 2026-10-23 14:24 | — | **计划包 v0.1 经 Amor 确认通过** | 对话确认 |
| 2026-10-23 14:28 | — | TAPD 建 6 个迭代（M0–M5，估算窗口）+ 18 条需求并挂迭代；回读 count=18 全部为 TC-* | TAPD 回读 |
| 2026-10-23 14:31 | — | 关闭 4 个模板自带示例迭代后，16 条【示例】需求不再出现在需求列表（列表实测 count=18）；API 直接改示例需求状态返回 404，推断随迭代关闭进入归档态，待 Amor 界面确认 | TAPD 回读 |
| 2026-10-23 14:38 | TC-001 | 转 `developing`（owner 郭涛）+ 评论派单六项 | TAPD 回读 status=developing |
| 2026-10-23 14:46 | TC-001 | 交付 → `status_2` → 验收通过 → `status_3` → `resolved`（comments 分别贴报告路径与验收证据） | TAPD 回读 status=resolved, completed=14:46:46 |
| 2026-10-23 14:50 | — | 按 TC-001 核对结论修计划包：K1 任务分工 TC-002 补 assets（11 目录）／K2 执行规范 §6 速查补 assets／K3 TC-014 补 FR-AI-010／K4 加章节级映射说明／K5 TC-015 增 verify:release／K6 §3 区分"真人提供"与"自造样本"／K7 TC-017 收窄 FR-SEC-005／K10 CONTRACT §1 加"未定义任何端点" | 本文件 + 两处基线文档 |
| — | — | **K9（git 嵌套仓库）升级为 A12 阻塞项，等 Amor 三选一后才能派 TC-002** | 待裁决 |

---

## 5. TAPD 映射（2026-10-23 建立，回读核对通过）

**迭代（估算窗口，随实际滚动更新）**

| 迭代 | ID | 窗口 | 挂载需求 |
|---|---|---|---|
| M0 需求与脚手架 | `1133059095001000005` | 2026-10-26 ~ 10-28 | TC-001、TC-002 |
| M1 视觉与模型基座 | `1133059095001000006` | 10-29 ~ 11-04 | TC-016、TC-003、TC-004 |
| M2 组件与布局引擎 | `1133059095001000007` | 11-05 ~ 11-17 | TC-006、TC-007、TC-005、TC-017 |
| M3 检查引擎与模板导出 | `1133059095001000008` | 11-18 ~ 12-02 | TC-013a、TC-010、TC-011、TC-008、TC-009 |
| M4 导入与测试体系 | `1133059095001000009` | 12-03 ~ 12-12 | TC-012、TC-013 |
| M5 打磨与发布 | `1133059095001000010` | 12-13 ~ 12-16 | TC-015 |

**需求（每条 ID，便于状态流转时直接取用）**

| 卡 | TAPD 需求 ID | 卡 | TAPD 需求 ID |
|---|---|---|---|
| TC-001 | `1133059095001000017` | TC-013a | `1133059095001000026` |
| TC-002 | `1133059095001000018` | TC-010 | `1133059095001000027` |
| TC-016 | `1133059095001000019` | TC-011 | `1133059095001000028` |
| TC-003 | `1133059095001000020` | TC-008 | `1133059095001000029` |
| TC-004 | `1133059095001000021` | TC-009 | `1133059095001000030` |
| TC-006 | `1133059095001000022` | TC-012 | `1133059095001000031` |
| TC-007 | `1133059095001000023` | TC-013 | `1133059095001000032` |
| TC-005 | `1133059095001000024` | TC-015 | `1133059095001000033` |
| TC-017 | `1133059095001000025` | TC-014 | `1133059095001000034`（不挂迭代，标签 P1后置） |

全部当前状态：`planning 规划中`。

> **接口实测（2026-10-23）**：`update_story_or_task` 对新建需求正常（已用 TC-014 打标签验证）；对模板自带的 16 条示例需求返回 404。状态流转（developing / status_2 / status_3 / resolved）尚未在真实卡上跑过，派 TC-001 时首次验证，失败即按 §5.6 降级并告知。
