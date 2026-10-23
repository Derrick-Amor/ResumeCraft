# PROGRESS — ResumeCraft 主控进度快照

> 更新时机：每卡闭环时；出现遗忘信号时立即更新
> 最近更新：2026-10-23 16:40

## 1. 当前位置

- 里程碑：**M0 已完成**（TC-001、TC-002 均 resolved），即将进 M1
- 当前卡：无（TC-002 于 16:37:39 关闭）
- 下一张卡：**TC-016 UI 视觉设计专题**（M1 第一张，视觉先行）
- 当前 git 分支：`main`（远端 `cdd4956`）
- 卡点：无。**TC-016 交付后必须 Amor 亲自看视觉稿**（token 数值 + 8 张界面 HTML）

## 2. 当前卡进度

- 已完成：
  - 执行计划包 v0.1（PLAN/TASKS/CONTRACT/PROGRESS + handoff/README）**已确认**
  - 三处文档矛盾已修：任务分工 V1.2→V1.2a（附录 A 补 `src/assets/`，目录 10→11）；TAPD 规范 §4 清单 6→8 项、「只排工期不设截止」§5.4、附录 A 归档闸门合并
  - TAPD：4 个示例迭代关闭；6 个里程碑迭代建立（估算窗口）；18 条需求建立并挂迭代；回读 count=18 全为 TC-*
- 未完成项：TC-001 派单；资料库同步（两份改动文档）
- 已跑命令与结论：
  - `git ls-remote` 远端可达，main=`d8a61c3`，仅 LICENSE
  - `pnpm -v` 未安装；node 22.22.2 / npm 10.9.7 / corepack 0.34.6 可用
  - TAPD `update_story_or_task` 对新建需求正常；对模板自带示例需求 404（示例需求已随迭代关闭从列表消失）
- 阻塞：无

## 3. 本轮新增决策（尚未进基线文档的，逐条）

| # | 决策 | 来源 | 状态 |
|---|---|---|---|
| D1 | 不设里程碑截止日期，只排工期，按实际滚动更新；迭代日期为估算锚点 | Amor Q1 | 已写 PLAN.md + 规范 §5.4 |
| D2 | 验收脚本名统一 `type-check` | 阿U 裁决 | 已写 TASKS.md §0 |
| D3 | TC-002 git 用 `init -b main` + `fetch origin main` + `reset --mixed FETCH_HEAD` | 阿U（实测远端已有 LICENSE 提交） | 待写入 TC-002 派单 |
| D4 | 组件库：TC-002 小样出来后暂停给 Amor 看，拍板后收尾，结论由我回写 PRD 13.1#3 | Amor Q4 | 待写入 TC-002 派单 |
| D5 | 导入样本由 Amor 提供，M2 结束前一周收 | Amor Q5 | 已写 TASKS.md §3 |
| D6 | push 已获授权，每卡验收通过后推送 | Amor Q3 | 待写入 TC-002 派单 |
| D7 | 首次回复验收清单升级到 v1.1（8 项 + 限定只适用首轮） | 阿U 自检 + Amor 要求 | 已写规范 §4 |
| D8 | TAPD 迭代只有 open/done 两态，"只有 M0 开启"无法精确表达，6 个迭代均建为 open，以"迭代内需求状态"区分实际启动 | 阿U 裁决 | 已记录，若 Amor 不接受可改 done |
| D9 | **A12 采纳方案①**：项目内独立建仓 + 家目录 `.gitignore` 排除 `WorkBuddy/简历项目开发/`。已实测 `git check-ignore` 命中、父仓库 status 不再列出本项目 | Amor 2026-10-23 | 已执行，`.gitignore` 已建 |
| D10 | pnpm 12.15.0 经 `corepack enable` 启用（不污染全局 npm） | 阿U（环境修复） | 已执行，`pnpm -v` 通过 |
| D11 | TC-002 拆 A/B 两段：A 段（脚手架+四门+目录+CI+git+小样）现在做；B 段（装组件库+结论）等 Amor 拍板 | Amor Q4 | A 段执行中 |

## 4. 待 Amor 确认

- 4 套模板是否全部自设计（PRD 9.2 已写"全部自设计"，TC-009 授权登记直接按此填，若无异议我不再问）
- 资料库旧版清理（API 无删除接口，需界面手工）
- TAPD 迭代状态口径（D8）是否接受

## 5. 恢复动作清单

1. 读本文件
2. `git log --oneline -5 && git status`（M0 期间预期：无 git 仓库）
3. 回读 TAPD 当前迭代下各需求状态
4. 三行报告 Amor：现在在哪 / 待确认什么 / 下一步动作
