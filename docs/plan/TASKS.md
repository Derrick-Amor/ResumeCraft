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
| TC-016 | UI 视觉设计专题（视觉先行） | fe-foundation | 002 | `docs/design/`、`src/design/tokens.css` | `ls docs/design/{token-values.md,components-spec.md,mockups/index.html}`；mockups ≥8 个 html 可开；硬编码色值扫描为空；6.7 自检逐条 | 6 章全、6.7、FR-EDT-001/002（视觉）、FR-LAY-011/012（视觉） | 1.5–2d | 已完成（四门全绿 2026-10-27 19:13） |
| TC-003 | 文档模型与序列化 + undo 栈 | fe-editor | 002 | `src/model/`、`tests/model/` | `pnpm test -- src/model` | FR-DOC-002/003/004、8 章 | 2–3d | 已完成（四门全绿 2026-10-27 19:24，49 tests） |
| TC-004 | 设计 token 落地与基础控件 | fe-foundation | 002、016 | `src/design/`、`src/ui/controls/`、`tests/controls/` | `pnpm test -- src/ui/controls` | 6.1–6.4 | 1.5–2d | 进行中（8 件已落盘：按钮/标签/Tab/卡片/开关/提示条/字段外壳/溢出角标，待四门） |
| TC-006 | 布局引擎·测量与单位 + 字体资产 | fe-layout | 003 | `src/layout/{units,measure,font-loader}.ts`、`src/assets/fonts/`、`docs/font-license.md`、`docs/verify/canvas-vs-dom.md` | `pnpm test -- src/layout/measure` + `pnpm verify:layout` | FR-LAY-001/002/010、13.1#8/#17 | 3–4d | **待验收**（四段代码全绿 152 tests；仅「字体资产」子交付待 Amor 放入，见 E6） |
| TC-007 | 布局引擎·排列/分页/溢出 | fe-layout | 006 | `src/layout/`（flow/pagination/overflow/overflow-stages/report/types）、`docs/layout-rules.md`、`tests/layout/` | `pnpm verify:layout`（**暂由方案 A 替代：`pnpm exec vitest run src/layout` + 快照**） | FR-LAY-003~008、010、011（引擎） | 3–4d | **待验收**（types / report / flow / pagination / overflow-stages + layout-rules.md 全部落盘） |
| TC-005 | 简历组件集（中英双轨） | fe-content | 003、004 | `src/components/`、`tests/components/` | `pnpm test -- src/components` | FR-CMP-001~010、FR-EDT-004、FR-EDT-006（P0 部分） | 2.5–3d | 进行中（registry 已落盘，具体组件定义未做） |
| TC-017 | 持久化与数据安全 | fe-content | 003 | `src/storage/`、`tests/storage/` | `pnpm test -- src/storage` | FR-SEC-001~005、FR-DOC-002/003 配套、4.4（**FR-SEC-005 只验 JSON 备份核心，完整删除/恢复策略留 P1**） | 1.5–2d | **已完成**（四门全绿 2026-10-28 12:11，333 tests） |
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

> ⚠️ **卡级验收命令写法勘误（2026-10-27 实测）**：本表「卡级验收命令」列里的 `pnpm test -- <路径>` **过滤不生效**。
> 实测 `pnpm test -- src/layout/measure` 实际执行的是 `vitest run -- src/layout/measure`，
> `--` 之后被当作位置参数忽略，**跑的是全量 8 个测试文件**。
>
> 后果：结论仍然有效（全量通过 ⇒ 该卡通过，是更严格的口径），但「只跑该卡」是错的。
> 需要真正过滤时用 **`pnpm exec vitest run <路径>`**（去掉 `--`，直接作为 positional filter）。
> 本表命令暂不改写，因为全量口径不影响验收判定；如需收窄请按新写法执行并回填本注。

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
| **E6** | ~~字体二进制文件~~ **已解除（2026-10-27 21:50）**：Amor 跑 `scripts/get-fonts.cmd` 完成下载+子集化，11 个文件到位（woff2 5.4MB + ttf 12MB + OFL.txt）；`_raw/` 已 gitignore；canvas-vs-dom 已按 §6 重跑（`FONT_CHECK=RcSans-loaded`，PASS） | — | 不再阻塞 | **已完成** |

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
| 2026-10-23 14:54 | — | **A12 按方案① 解决**：家目录新建 `.gitignore` 排除 `WorkBuddy/简历项目开发/`（`git check-ignore` 命中、父仓库 status 归零）；`corepack enable pnpm` → pnpm 12.15.0 | 命令实测 |
| 2026-10-23 14:56 | TC-002 | 转 `developing`（owner 郭涛）+ 派单评论；拆 A/B 两段，A 段派 `fe-foundation` | TAPD 回读 |
| 2026-10-23 15:30 | TC-002 | **A 段验收通过**（四门 0 错、verify 三连打印 PLACEHOLDER、11 目录、远端 main=2cb6ec9）；TAPD 保持 `developing` + 标签「阻塞」，卡点＝等 Amor 选组件库 | 本文件 + handoff 验收记录 |
| 2026-10-23 16:00 | — | Amor 拍板 **Element Plus**；暗色不进 P0（阿U 裁决）；解除 TC-002 阻塞标签 | 对话 + 项目记忆 |
| 2026-10-23 16:37 | TC-002 | **B 段验收通过 → 全卡关闭**：`developing → status_2 → status_3 → resolved`（completed 16:37:39）。Element Plus 2.14.7 按需引入 + 桥接层（零 hex/rgb）+ vendor 已删；远端 main=`cdd4956` | TAPD 回读 + handoff B 段验收记录 |
| 2026-10-23 16:37 | — | 备注：PRD 13.1#3 / 13.2#6 已于 15:41 由外部会话回写（V1.3b）、15:49 同步资料库，阿U 核对一致未重复改 | 文件 mtime + 资料库 updatedAt |
| 2026-10-27 18:57 | TC-016 | **视觉 v3 经 Amor 定稿**（蓝玻璃 + 白纸）；11 张稿落在 `docs/design/mockups/figma/`；生产 token 回灌 `src/design/tokens.css`；变更全文 `docs/design/V3-DELTA.md` | 对话确认 + 文件落盘 |
| 2026-10-27 19:20 | TC-016 | 状态转 **待验收**：设计已定稿、token 已回灌，**四门与 git 提交未做**（沙箱拒绝 shell 访问项目目录，`pnpm`/`git`/`grep` EPERM） | 本文件 + PROGRESS §0 |
| 2026-10-27 19:14 | TC-016 | **四门全绿 → 全卡关闭**：lint 0 警告 / vue-tsc 通过 / **16 tests passed（3 files）** / build 6.52s（css 52.54 kB、js 208.35 kB）。由 `scripts\gate.cmd` 执行，日志 `docs/verify/gate-latest.log` | 门禁日志 |
| 2026-10-27 19:22 | TC-003 | 首轮四门：lint / type-check / build 过，**test 挂 2 条**——`validate` 对自己的输出不幂等（unknown 组件 raw 二次包裹、extra 未列入已知顶层字段）。已修 + 补 2 条回归测试 | 门禁日志 19:20 |
| 2026-10-27 19:24 | TC-003 | **四门全绿 → 全卡关闭**：49 tests passed（model 33 / smoke 3 / verify-scripts 6 / element-probe 7）/ build 6.63s | 门禁日志 19:24 |
| 2026-10-27 19:38 | TC-016 | **TAPD：developing → status_2 → status_3 → resolved**（completed 19:38:40）。此前一直在改本地台账、TAPD 未同步，属主控失误，Amor 指出后补齐 | TAPD 回读 status=resolved |
| 2026-10-27 19:39 | TC-003 | **TAPD：planning → developing（owner 郭涛）→ status_2 → status_3 → resolved**（completed 19:39:08） | TAPD 回读 status=resolved |
| 2026-10-27 19:39 | TC-004 | **TAPD：planning → developing**（owner 郭涛）。8 件控件已落盘，等四门后转 status_2 | TAPD 回读 status=developing |
| 2026-10-27 19:43 | TC-004 | lint 挂 2 条：`RcField` 的 prop 取名 `for`（JS 保留字）导致模板表达式解析失败 + 漏配默认值。改 `htmlFor` 后修复，补 1 条测试 | 门禁日志 19:43 |
| 2026-10-27 19:43 | TC-004 | **四门全绿 → 全卡关闭**：94 tests passed（5 files，controls 45）/ build 5.86s | 门禁日志 19:43 |
| 2026-10-27 19:45 | TC-004 | **TAPD：developing → status_2 → status_3 → resolved**（completed 19:45:14）。M1 三卡（016 / 003 / 004）全部 resolved | TAPD 回读 status=resolved |
| 2026-10-27 19:45 | TC-006 | **TAPD：planning → developing**（owner 郭涛） | TAPD 回读 status=developing |
| 2026-10-27 19:47 | TC-006 | 段① 单位换算层四门通过：**113 tests passed（6 files，units 19）** / build 5.83s | 门禁日志 19:47 |
| 2026-10-27 19:48 | TC-006 | 段② 测量层 `src/layout/measure.ts`（后端可注入、降级显式标记）+ `tests/layout/measure.test.ts` 落盘；font-loader 未做 | 文件落盘 |
| 2026-10-27 19:52 | TC-006 | 段② 首轮测 1 条失败：`CJK 逐字可断` 的期望值我手打错字（把「十」写两遍），代码正确。改期望值 + 补 `toHaveLength` 断言 | 门禁日志 19:51 |
| 2026-10-27 19:53 | TC-006 | 段② 四门通过：**138 tests passed（7 files）** / build 5.83s | 门禁日志 19:53 |
| 2026-10-27 19:54 | TC-006 | 段③ 字体加载器 `src/layout/font-loader.ts` + `tests/layout/font-loader.test.ts` + `docs/font-license.md`（选型与核验清单）落盘。**字体文件仍为空，待 Amor 拍板** | 文件落盘 |
| 2026-10-27 19:56 | TC-006 | 段③ 四门通过：**151 tests passed（8 files）** / build 6.09s | 门禁日志 19:56 |
| 2026-10-27 19:58 | TC-006 | **字体方案定为思源系列（SIL OFL 1.1，Amor 拍板）**；`docs/font-license.md` 写入 5 个字重清单与子集化步骤；`src/assets/fonts/README.md` 落盘。字体二进制文件仍待放入（沙箱无法下载） | 对话 + 文件落盘 |
| 2026-10-27 19:58 | — | `scripts/gate.ps1` 增加可选卡级验收参数：`gate.cmd src/layout/measure` 会在四门后追加一次 `pnpm test -- <filter>`，不把具体卡硬编码进通用脚本 | 文件改动 |
| 2026-10-27 20:02 | — | 门禁脚本新版验证通过：**151 tests / 8 files** / build 9.00s，RESULT 行已输出 "ALL GATES GREEN" | 门禁日志 20:02 |
| 2026-10-27 20:05 | TC-006 | `docs/verify/canvas-vs-dom.html` + `.md` 落盘。**实测 10 个样本，最大偏差 0.0156px，0 条不达标，PASS**（HeadlessChrome 156 / Windows 10.0.26200）。已注明 4 项未覆盖范围，字体到位后必须重跑 | 无头 Chrome 实跑 |
| 2026-10-27 20:15 | TC-006 | 补验 letter-spacing 语义并**修掉一个真 bug**：CSS 是 `n × spacing`，原实现按 `(n-1)` 每行少算一个。实测 (n-1) 偏差 1.0043px / n 偏差 0.0093px。`measure.ts` 已改，补 2 条回归测试 | `docs/verify/canvas-vs-dom.md` §7 |
| 2026-10-27 20:18 | — | **首次 git 提交成功**：`c57098e commit: feat: TC-016/003/004 交付 + TC-006 四段`（由 Amor 双击 `scripts/commit.cmd` 执行；沙箱下我读不了 `.git`，只能读 `.git/logs/HEAD` 验证） | `.git/logs/HEAD` 第 46 行 |
| 2026-10-27 20:19 | TC-006 | 四门 + 卡级验收全绿：**152 tests passed（8 files，measure 26）** / build 5.89s | 门禁日志 20:18 |
| 2026-10-27 20:20 | — | **发现卡级验收命令假过滤**：`pnpm test -- <路径>` 实际跑全量（`--` 后参数被忽略），已在台账顶部加勘误说明；正确写法 `pnpm exec vitest run <路径>` 待首次实测确认 | 门禁日志第 70–86 行 |
| 2026-10-27 20:29 | TC-007 | **Amor 采纳方案 A**：验收暂用 `pnpm exec vitest run src/layout` + 快照测试；`pnpm verify:layout` 仍是占位脚本，归属 TC-015，本卡不越界实现。TAPD 转 `developing` | 对话 + TAPD 回读 |
| 2026-10-27 20:31 | TC-007 | `src/layout/types.ts`（契约 §5 结构）+ `src/layout/report.ts`（排序/去重/分级/分组/几何指纹）+ `tests/layout/report.test.ts` 落盘 | 文件落盘 |
| 2026-10-27 20:31 | — | `scripts/check-fonts.cmd` 落盘：双击校验 5 woff2 + 5 ttf + OFL.txt 是否齐全并算 sha256，日志写 `docs/verify/font-check.log` | 文件落盘 |
| 2026-10-28 11:35 | — | **沙箱环境升级**：pnpm / git / vitest 均可直接执行（此前 HANDOFF §5 记录的限制已解除）。基线 249 tests 全绿 | 命令实测 |
| 2026-10-28 11:40 | TC-017 | **TAPD：planning → developing**（owner 郭涛）。派工程师实现 `src/storage/`（9 文件）+ `tests/storage/`（8 文件），走团队协作流程 | TAPD 回读 status=developing |
| 2026-10-28 12:11 | TC-017 | **四门全绿 → 全卡关闭**：lint 0 / vue-tsc 通过 / **333 tests passed（22 files）** / build 25.69s。新增 84 条存储测试（8 files），零回归 | 命令实测 |
| 2026-10-28 12:15 | TC-017 | **TAPD：developing → status_2 → status_3 → resolved**。CONTRACT §6 四接口逐字实现，不变量 1/3/4 均有测试锁定 | TAPD 回读 |
| 2026-10-28 12:16 | TC-017 | 工程师边界审查产出 9 条加固缺口（P0×4 / P1×2 / P2×3），卡级验收已达标，缺口记入此处待后续补：①file-access 权限 prompt 恢复路径 ②security unreadable 分支 ③idb-adapter 含宏导入 security-blocked ④idb io-error 兜底 ⑤autosave error→重试 ⑥importJSON 非法文本入口 ⑦idb open 失败 ⑧restoreHandle 边界 ⑨debounceMs=0 | 工程师审查报告 |

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
