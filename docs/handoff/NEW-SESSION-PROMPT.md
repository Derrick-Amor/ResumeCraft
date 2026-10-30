# 新对话启动提示词（复制下面整段到新对话）

---

我是 Amor，你是 ResumeCraft 项目的主控。**先读 `docs/handoff/HANDOFF-2026-10-30.md`**，那是完整交接（铁律、工程结构、已完成/未完成、团队协作方式、今天踩过的坑）。读完再动手，不要凭猜测开工。

## 项目一句话

ResumeCraft：Web-first 简历编辑与自动排版（Vue3 + TS + Vite + Pinia）。工程根 `C:/Users/D.Amor/WorkBuddy/简历项目开发/`。

## 三条最重要，先记住

1. **UI 必须一比一复刻 Figma 设计稿**（`docs/design/mockups/figma/`，现 15 文件）。PRD 的界面描述只是参考，收尾时按实现回写；偏差只允许我显式批准并登记在矩阵 §四。
2. **完成度以 `docs/plan/PRODUCT-MATRIX.md` 为准**，每格带验收命令。跑出绿才改状态，不允许先改状态再补实现。
3. **每条"已完成"必须附可复跑命令与输出**。自述不可作为证据（本项目已发生 5 次"自述与实测不符"）。

## 接手第一件事（按顺序）

1. 跑四门：`pnpm lint && pnpm type-check && pnpm test && pnpm build`。当前基线 **646 tests / 44 files**，全绿。**注意**：字体子集守卫 `tests/guards/font-charset.test.ts` 会在新增中文文本（含 emoji、⊆ 之类符号）时变红——那不是 bug，跑 `python scripts/subset-fonts.py` 补字集再跑。
2. `git status` 确认工作区干净。当前 HEAD `6b4ce32`（已推送远端）。上一轮的 6 屏实现 + 4 屏补稿全部已收尾，不是“在途”。
3. 读矩阵 §五 的排队表，确认从哪一格开工（下面列了）。

## 当前排队的活（按优先级，见矩阵 §五）

| 优先级 | 项 | 设计稿 | 备注 |
|---|---|---|---|
| P2-1 | **素材库** | `11-material-library.html` | 左栏「素材」Tab + 右栏素材详情；不牵布局引擎，建议先做 |
| P2-2 | **画板编辑态** | `12-board.html` | 画板工具条（沿用 06b）+ 背景可编辑右栏 + 装饰元素自由摆放 |
| P2-3 | **多文档管理** | `13-documents.html` | 文档列表（打开/重命名/复制/删除）+ 本机存储提示；**需先定数据层**，动 `src/state/` |
| P2-4 | **语言轨英轨排版档** | `14-english-track.html` | 无照片位 / Mon YYYY 日期 / 动词开头 bullet / Portfolio 字段 |
| 收尾 | 09-spec 设计说明页同步 | — | 11-14 补稿后，09-spec 的屏清单/组件清单未更新 |
| 收尾 | 保真审计扩项 | — | `docs/verify/ui-fidelity-audit.md`（43 条）未覆盖 11-14 |

**实现四格前必读**：13 屏引入 7 个新类（`doclist`/`docrow`/`docrow__thumb`/`docrow__main`/`docrow__name`/`docrow__meta`/`docrow__acts`），设计稿页面 style 块首有移植注释清单——先移植进 `src/design/app.css`，并登记 `docs/design/ui-restore-plan.md` §2.2 的允许新增类表。

## 团队怎么用

派 `software-engineer`（写代码）、`software-qa-engineer`（审计把关）、`tapd-recorder`（TAPD 记档）。**每格落完都派 QA 审计**，不要只用 grep 自验。

派工规格：自包含、附 `file:line` 与可复跑命令、明确"不要做什么"（禁改文件 / 禁自造类 / 禁转述文案）、验收写成命令。**派工里每个"不存在/已有"的断言，派工前先 grep 一次**（今天我错判过一次，工程师验证后拦下）。

## git 提交约定

覆盖版 `69ab806` 已 force-with-lease 推送（替换了货不对板的 `c23cde4`），之后是正常提交推进，**不要再 amend 远端**；只有远端再次出现货不对板时才用 `git commit --amend` + `git push --force-with-lease`。本地代理偶发 502，重试即可（今天多次验证，重试 4 次内成功）。

## 几个容易踩的坑（细节见交接文档 §八）

- **假状态**：任何"决策"类交互，门控与载荷必须一起改（今天块级「跳过」只做了视觉，点了仍导入）。
- **矮视口裁切**：设计稿 `.app` 有 `min-height: 860px`，而预览面板 iframe 约 600px 高 → 应用底部会被裁。补稿已按"关键元素底边 ≤600"适配；新增内容时同样量一下（`scripts/ui-shot.mjs --width 1440 --height 600` 截图核对）。
- **设计稿缺屏不凭印象造 UI**：先查稿，缺屏就问我。

## 遇到不确定时

- 界面问题 → 看设计稿 HTML 原文，**不要凭印象**
- 契约问题 → 看 `docs/contract/CONTRACT.md`，要改必须显式裁决并升 `LAYOUT_ENGINE_VERSION`
- 判据问题 → 看 `docs/verify/ui-fidelity-audit.md` §2.5.1-2.10（证伪性前置 / 直接证据 / 锚定语法位置 / 反向自检）
- 产品范围问题 → 看 `docs/plan/PRODUCT-MATRIX.md`
- 基线文档（PRD / 任务分工 / 后端文档）→ 只在 Obsidian `D:/ObsidianDepository/AI学习/简历项目开发/` 改，再传资料库（资料库永远最后）

现在开始，先读交接文档。
