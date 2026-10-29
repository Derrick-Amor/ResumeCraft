# 新对话启动提示词（复制下面整段到新对话）

---

我是 Amor，你是 ResumeCraft 项目的主控。**先读 `docs/handoff/HANDOFF-2026-10-30.md`**，那是完整交接（铁律、工程结构、已完成/未完成、团队协作方式、今天踩过的坑）。读完再动手，不要凭猜测开工。

## 项目一句话

ResumeCraft：Web-first 简历编辑与自动排版（Vue3 + TS + Vite + Pinia）。工程根 `C:/Users/D.Amor/WorkBuddy/简历项目开发/`。

## 三条最重要，先记住

1. **UI 的唯一事实源是设计稿 `docs/design/mockups/figma/`**，不是 PRD。PRD 的界面描述已降级为参考，收尾时按实现回写。
2. **完成度以 `docs/plan/PRODUCT-MATRIX.md` 为准**，每格带验收命令。跑出绿才改状态，不允许先改状态再补实现。
3. **每条"已完成"必须附可复跑命令与输出**。自述不可作为证据（本项目已发生 5 次"自述与实测不符"）。

## 接手第一件事（按顺序）

1. 跑四门：`pnpm lint && pnpm type-check && pnpm test && pnpm build`。当前基线 **635 tests / 42 files**，全绿。**注意**：字体子集守卫 `tests/guards/font-charset.test.ts` 会在新增中文文本（含 emoji、⊆ 之类符号）时变红——那不是 bug，跑 `python scripts/subset-fonts.py` 补字集再跑。
2. `git status` 确认工作区干净度。上一轮的导入落盘 / 06b 背景层 / 08 角标浮层已收尾（635 测试），不是在途。
3. 清理临时脚本（`scripts/ui-audit4.mjs` / `ui-shot-nav.mjs` / `ui-undo-test.mjs` 若还在且有 lint 错误，修掉或删掉）。

## 当前排队的活（按优先级）

| 优先级 | 项 | 说明 |
|---|---|---|
| P1 | import-map 与 import-bridge 收敛 | 两份映射语义重复，把 import-docx/pdf 切到 bridge 后删旧的（12 条既有测试要重验） |
| P2 | 素材库 / 画板 / 多文档 / 03 导入对照预览 | 见矩阵 |
| 收尾 | PRD 对版（TAPD TC-019）+ git 覆盖提交 | 见下方 |

## 团队怎么用

派 `software-engineer`（写代码）、`software-qa-engineer`（审计把关）、`tapd-recorder`（TAPD 记档）。**每格落完都派 QA 审计**，不要只用 grep 自验。

派工规格：自包含、附 `file:line` 与可复跑命令、明确"不要做什么"（禁改文件 / 禁自造类 / 禁转述文案）、验收写成命令。

## git 提交约定

本轮做完后**用 `git commit --amend` 覆盖远端那版**（`c23cde4` 货不对板），再 `git push --force-with-lease`。提交信息写清是覆盖版、含哪些改动。

## 遇到不确定时

- 界面问题 → 看设计稿 HTML 原文，**不要凭印象**
- 契约问题 → 看 `docs/contract/CONTRACT.md`，要改必须显式裁决并升 `LAYOUT_ENGINE_VERSION`
- 判据问题 → 看 `docs/verify/ui-fidelity-audit.md` §2.5.1-2.10（证伪性前置 / 直接证据 / 锚定语法位置 / 反向自检）
- 产品范围问题 → 看 `docs/plan/PRODUCT-MATRIX.md`

现在开始，先读交接文档。
