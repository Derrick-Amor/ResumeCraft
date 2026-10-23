# 新会话续接简报（ResumeCraft）

> 用途：当你新开一个对话、重新选上「MVP 开发专家团」（或任何专家）时，把本文件内容整段粘进去，新会话即可无损接手。
> 维护：每次换会话前由主控更新；内容以文件系统为准，不依赖任何聊天记录。

---

## 一、一句话现状（2026-10-23 22:20）

ResumeCraft（Web-first 简历编辑与自动排版应用）已完成 **M0（需求 + 脚手架）**，正在做 **M1 第一张卡 TC-016（UI 视觉设计）**：产物已全部落盘，**卡在收尾**（四门未跑、代码未提交、TAPD 未转待验收）。

## 二、先读这 4 个文件（绝对路径，按序）

1. `C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/plan/PROGRESS.md` —— 当前位置与卡点
2. `C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/plan/TASKS.md` —— 18 张卡的清单、验收命令、TAPD 需求 ID
3. `C:/Users/D.Amor/WorkBuddy/简历项目开发/.workbuddy/memory/MEMORY.md` —— 项目长期约定（归档规则、选型定案、执行模式）
4. `C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/handoff/TC-016.md` —— 当前卡的交付状态（主控代整理）

需要背景时再读：PRD（`D:/ObsidianDepository/AI学习/简历项目开发/ResumeCraft 产品需求文档（PRD）.md`）、任务分工（同目录 `ResumeCraft 开发任务分工.md`，V1.2a）。

## 三、项目铁律（别问，照做）

> ⚠️ **如果你是带着「MVP 开发专家团」之类的专家进来的：不要重跑它的 Phase 0 需求澄清、Phase 1 调研、三文档流程。** 本项目已经走完需求阶段（PRD V1.3b 已终审、任务分工 V1.2a、18 张卡已切分、TAPD 已建账）。专家的 SOP 在这里只需要借用"Phase 3 开发 + Phase 4 测试"的思路，**不要推翻既有流程重来**。
>
> ⚠️ **并发禁令**：同一时间只允许一个会话操作本项目。开新会话前，旧会话必须停手，否则 TAPD 会重复建卡、文档会互相覆盖。
>
> ⚠️ **文档同步顺序**：工作区落稿 → `cp` 到 Obsidian（`D:/ObsidianDepository/AI学习/简历项目开发/`）→ **最后**上传资料库。旧版当场改名 `【待删除】…`。**资料库永远放最后，禁止只改资料库。**

| 项 | 规则 |
|---|---|
| 节奏 | **一次一卡**，卡内可拆 A/B 段；一张卡没验收不派下一张 |
| 验收 | 主控（阿U）逐卡验收：跑卡级命令 + 对照 FR 编号 + 看七段式报告；不认子 Agent 自述 |
| 记账 | TAPD 空间 `ResumeCraft`（workspace_id `33059095`）；流转链路 `planning → developing → status_2（待验收）→ status_3（中转）→ resolved`，**developing 不能直达 status_3**；转 developing 时 `owner` 必填 |
| 技术栈 | Vue3 + TS + Vite 7.3.7 + Pinia + Zod + Vitest + **Element Plus 2.14.7（按需引入）**；工程根 `C:/Users/D.Amor/WorkBuddy/简历项目开发/` |
| 样式 | **CSS 自定义属性是唯一样式事实源**；除 `src/design/tokens.css` 外禁止任何 hex/rgb |
| 图标 | 内联 SVG，stroke 1.5，尺寸只用 16/20/24；**禁 emoji、禁第三方图标库** |
| 文档同步 | 改动任何文档 → 工作区 + Obsidian（`D:/ObsidianDepository/AI学习/简历项目开发/`）+ 资料库（三个子文件夹：项目规范和方案文档 / 主控文件 / 子agent文件）；旧版务必改名 `【待删除】原名（旧版 MM-DD HH:MM）` |
| 网络 | GitHub 推送偶发代理 502，**重试即可**，不是权限问题 |

## 四、当前待办（按序）

1. **补跑 TC-016 收尾检查**：`pnpm lint && pnpm type-check && pnpm test && pnpm build`，再做 emoji 扫描（正则见下），结果回填 `docs/handoff/TC-016.md` §3。
2. **提交**：`TC-016: token 数值 + 8 张视觉稿 + 组件规格`，推送 `main`。
3. **TAPD**：TC-016（`1133059095001000019`）`developing → status_2`，评论贴证据。
4. **等 Amor 审稿**：`docs/design/mockups/index.html`（8 张视觉稿入口）。主色 `#1f6e8c` 是否认可，决定 TC-004 的落地。
5. 通过后 `status_2 → status_3 → resolved`，再派 **TC-003（文档模型）**。

emoji 扫描：`grep -rlP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" docs/design/ || echo "no emoji"`

## 五、不要做什么

- 不要重写计划包（PLAN/TASKS/CONTRACT 已确认）；要改先出变更单
- 不要让子 Agent 改 PRD / 任务分工 / 执行规范
- 不要跳过 TAPD 记账；不要把"没跑过的检查"写成通过
- 不要删 `docs/`、`.workbuddy/`；不要 `git push --force`
- 不要一次派多张卡（"并行"标签只是可选顺序，不是授权）
