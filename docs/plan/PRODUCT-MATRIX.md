# 产品完成度矩阵（PRODUCT MATRIX）

> 作用：给"整个产品完整落地"一个**可枚举、可判定**的定义。
> 没有这张表，"还差多少"永远说不清，收尾也无法确认。
>
> 每格只有三种状态，且**必须能用命令判定**（不是"我觉得做完了"）：
> - `✅ 完成` —— 有实现，且有验收命令能跑出绿
> - `🟡 部分` —— 骨架在，功能缺；缺什么写在格子里
> - `⬜ 未做` —— DOM 都不存在
>
> 更新规则：改完一格，**先跑验收命令**，绿了才改状态。不允许先改状态再补实现。
>
> **2026-10-30 Amor 立铁律：UI 必须一比一复刻 Figma 设计稿**（几何/配色/文案/类名逐值一致）。
> 本表 §四「已知取舍」是唯一合法的偏差登记处——每条偏差都须 Amor 显式批准并记在这里；
> 未登记的偏差 = 缺陷，发现即整改。

维护：本表随实现更新，是收尾时的唯一验收清单。
依据：`docs/design/mockups/figma/`（设计稿唯一事实源）+ `docs/design/ui-restore-plan.md`。

---

## 一、屏级完成度（设计稿 9 个产品屏）

| 屏 | 设计稿 | 状态 | 验收命令 | 缺口 |
|---|---|---|---|---|
| **01 主编辑器** | `01-editor.html` | ✅ 完成 | `pnpm exec vitest run tests/design/fidelity.test.ts` | — |
| **02 模板库整屏** | `02-templates.html` | ✅ 完成 | `grep -c "tpl-grid\|tplcard\|searchbox\|filterbtn\|actionbar\|mini__" src/ui/templates/TemplatesView.vue`（2026-10-30 实测分项 2/15/2/3/8/113） | 四张 `.tplcard` + 纯 DOM `.mini` 缩略图 + 筛选 + 两段式动作条。显示名走 UI 侧常量（不改契约） |
| **03 导入向导** | `03-import.html` | ✅ 完成 | `grep -c "docpaper\|rcard" src/ui/import-wizard/ImportWizard.vue`（2026-10-30 实测 25） | `.importgrid` 左右对照重建：左 `.docpaper` 原文（含 pending 原文 + 低置信度行 `.doc-hl`）/ 右 `.rcard` 识别结果卡（已确认/待确认徽标 + 接受/修改/跳过）；确认导入门控（待确认含低置信度块，清空才放行）；stepper 收敛为设计稿 3 步；6 条测试（QA 审计 PASS） |
| **04 导出前检查** | `04-export-check.html` | ✅ 完成 | `grep -c "checkitem\|optcard" src/ui/shell/AppShell.vue` | 弹窗 + `.checkitem` + `.optcard`（radio 语义）齐 |
| **05 空状态/工作台** | `05-empty.html` | ✅ 完成 | `grep -c "entrycard\|rail__item\|progress3\|entrygrid" src/ui/workbench/Workbench.vue`（2026-10-30 实测 22/2/8/3） | 屏幕切换机制已加（`screen: 'workbench' \| 'editor'`，UI 态不落盘） |
| **06a 图层** | `06a-layers.html` | ✅ 完成 | `pnpm exec vitest run tests/ui/layer-lock.test.ts` | 树结构齐；**锁定按钮已补**（2026-10-30 Amor 裁决按 06b 模式渲染）：纯 UI 态（不进文档模型、不进 undo），锁定行禁拖拽 + 禁上下移；背景行恒锁定。容器类已对齐设计稿 `.layerrow__acts`（hover 显隐 + `iconbtn--lock` 配色规则生效） |
| **06b 背景层属性** | `06b-background.html` | ✅ 完成 | `grep -rc "bg-locked" src/ui/ \| grep -v ":0"`（2026-10-30 实测 PropertyPanel 3 处真实 DOM） | `.bg-locked` / `.bg-empty` + 解锁背景按钮（纯 UI 态，测试钉住不改 doc、不动 undo） |
| **07 溢出三方案** | `07-overflow.html` | ✅ 完成 | `grep -c "ovfpreview\|floorhint\|altcard\|p-ovf__tag\|is-over\|p-boundary\|paper-flag" src/ui/overflow-dialog/OverflowDialog.vue src/ui/canvas/CanvasView.vue`（2026-10-30 实测 12/8，全部渲染命中） | 弹窗 + 纸面行级标记齐。`LayoutWarning.overLines`（仅 overflow-page）已进契约，`LAYOUT_ENGINE_VERSION=layout-3` |
| **08 溢出角标浮层** | `08-badge.html` | ✅ 完成 | `grep -c "popover__head\|popover__item\|popover__foot\|逐项处理溢出" src/ui/canvas/CanvasView.vue`（2026-10-30 实测 4 处：580/588/604/611 行） | `.paper-flag` + `.popover` 壳 + 逐条清单（`v-for overflowDetails`）+「逐项处理溢出」→ 07 弹窗；徽标「超出 N 行」只在有 `overLines` 时渲染 |

> `09-spec` / `10-material` 是设计说明页，不属于产品，不计入。

---

## 二、跨屏能力完成度

| 能力 | 状态 | 验收命令 | 缺口 |
|---|---|---|---|
| **自动排版 / 分页** | ✅ | `pnpm exec vitest run tests/layout/compose.test.ts` | `composeLayout` + 8 角色 + trailing 日期，26 条测试 |
| **撤销 / 重做** | ✅ | `pnpm exec vitest run tests/state/editor-store.test.ts` | 含 mergeKey 合并、空操作不入栈、跨文档可撤销 |
| **自动保存 + 降级** | ✅ | 同上 | IndexedDB，降级必须显式提示（契约 §11.4） |
| **PDF 导出** | ✅ | `pnpm exec vitest run tests/io/` | 嵌入子集 TTF；质量关卡可放行 |
| **DOCX 导出** | ✅ | 同上 | 与屏幕同源（`componentTextBlock`） |
| **模板应用** | ✅ | `pnpm exec vitest run tests/template/` | 含 `template.styles` 映射（字号/行高/间距） |
| **组件增删排序** | ✅ | `tests/state/editor-store.test.ts` | 注册表驱动，6 种组件 |
| **语言轨（中/英）** | 🟡 | — | 切换在（`segmented`），但英轨只有字段裁剪，无独立排版档 |
| **组件拖拽排序** | ✅ | `pnpm exec vitest run tests/ui/drag-drop.test.ts` | `.compcard` 拖入添加 + `.layerrow` 排序 + `.p-piece` 画布排序；走 `moveComponentTo`（undo 栈），零新增 CSS 类 |
| **素材库** | ⬜ | — | Tab 在，内容是"规划在 P2"占位 |
| **画板模式** | ⬜ | — | `NewDocDialog` 有入口，`BoardToolbar` 全 disabled |
| **多文档管理** | ⬜ | — | 无文档列表；新建/切换靠左栏「页面」Tab 的单文档 |
| **导入结果落盘** 🔴 | ✅ | `grep -rc "RecognizedBlock\|toComponent" src/io/ \| grep -v ":0"`（2026-10-30 实测 6 处：import-bridge 3 / import-map 1 / recognition-provider 2） | `src/io/import-bridge.ts`：识别块 → `AnyComponent[]`（别名归一 + defaultFields 打底 + 未知块进 `UnknownComponent` 保 raw），`store.importComponents()` 一次 commit；P1 收敛后 import-docx/pdf 的 *ToDocument 也全走 bridge，12 条既有测试重验（QA 审计 PASS） |

---

## 三、工程质量（守卫）

| 守卫 | 状态 | 命令 |
|---|---|---|
| 设计稿声明保真（17 条） | ✅ | `pnpm exec vitest run tests/design/fidelity.test.ts` |
| 字体子集覆盖（防豆腐块） | ✅ | `pnpm exec vitest run tests/guards/font-charset.test.ts` |
| 图层锁定纯 UI 态（契约 §10.4） | ✅ | `pnpm exec vitest run tests/ui/layer-lock.test.ts` |
| 43 条数值级审计 | ✅ | `docs/verify/ui-fidelity-audit.md` |
| 四门 | ✅ | `pnpm lint && pnpm type-check && pnpm test && pnpm build` |
| 布局回归快照 | ✅ | `tests/snapshots/layout-regression.test.ts` |

---

## 四、已知取舍（需产品拍板，不是缺陷）

> 2026-10-30 起本节是**唯一合法偏差登记处**（Amor 1:1 铁律）。已关闭条目：
> ~~#1 纸面页边距 20mm~~ → **已解决**（2026-10-30，改设计稿 54/60/44px 换算值 14.28/15.87/11.64/15.87，保真测试钉住）；
> ~~#4 图层锁定未实现~~ → **已解决**（2026-10-30，按 06b 模式补渲染，纯 UI 态）；
> ~~#5 行级溢出数据契约缺~~ → **已解决**（`LayoutWarning.overLines` 已进契约，`LAYOUT_ENGINE_VERSION=layout-3`）；
> ~~#6 拖拽排序~~ → **已完成**（2026-10-29）。

| # | 取舍 | 现状 | 影响 | 何时改 |
|---|---|---|---|---|
| 1 | **字体子集 = GB2312 一二级** | 6807 字形，首载 2.97MB | 已裁决（2026-10-29 Amor）：取一二级，覆盖姓名/地名生僻字，**宁可体积大也不做豆腐块**。原始字库本就是一二级子集，子集脚本对一二级是空操作；真正收益来自「Rc Serif 不预热」（省 1.4MB，它 DOM 里无人用） | 已定案，不再改 |
| 2 | **Rc Serif 不预热** | 仅按需加载 | 正文未用衬线，省 1.4MB | 正文要用衬线时自动加载 |

---

## 五、剩余落地顺序（2026-10-30 更新，Amor 裁决：设计先行）

**2026-10-30 Amor 裁决**：素材库 / 画板编辑态 / 多文档管理 / 语言轨英轨**暂停**——这四项在设计稿里没有专属屏（素材 Tab 内容 01 未画、画板只有 05 入口卡、多文档与英轨无稿），按 1:1 铁律不凭印象造 UI，**等 Amor 在 Figma 补稿后再按 1:1 实现**。矩阵状态保持现状（未做/部分），不作为缺陷。

前置纪律：每格开工前先读对应设计稿 HTML 原文（`docs/design/mockups/figma/`），1:1 铁律下不做"差不多"。

1. **收尾：PRD 与实际对版**（TAPD TC-019）：PRD 界面描述按实现回写（含已暂停项的「待设计稿」状态说明）
2. 素材库（⬜ 暂停，待设计稿）
3. 画板编辑态（⬜ 暂停：05 入口卡已实现，编辑态待设计稿）
4. 多文档管理（⬜ 暂停，待设计稿）
5. 语言轨英轨独立排版档（🟡 暂停，待设计稿）

每完成一格，跑对应验收命令 → 绿了才改本表状态。
