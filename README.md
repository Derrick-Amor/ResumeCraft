# ResumeCraft

Web-first 的简历编辑与自动排版应用。当前仓库处于工程基座阶段（TC-002），只包含脚手架、质量门与目录骨架，**不含业务功能**。

- 前端：Vue 3 + TypeScript + Vite
- 状态：Pinia（已在 `src/main.ts` 注册，业务 store 由后续卡添加）
- 质量门：ESLint 9（flat config）+ Prettier + vue-tsc + Vitest
- 包管理：pnpm 12（`packageManager` 字段已锁定版本）

## 环境要求

| 项      | 版本                                        |
| ------- | ------------------------------------------- |
| Node.js | ≥ 22.12（CI 与开发环境使用 22）             |
| pnpm    | 12.15.0（通过 `corepack enable pnpm` 启用） |

## 常用命令

```bash
pnpm install        # 安装依赖（pnpm 12 需 allowBuilds 放行 esbuild，见 pnpm-workspace.yaml）
pnpm dev            # 本地开发服务器
pnpm build          # vue-tsc 类型检查 + 生产构建，产物在 dist/
pnpm preview        # 预览 dist/ 产物
```

### 质量门（提交/验收必过）

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build
```

| 命令                                | 作用                                                           |
| ----------------------------------- | -------------------------------------------------------------- |
| `pnpm lint`                         | ESLint 全量检查，`--max-warnings=0`，有告警即失败              |
| `pnpm type-check`                   | `vue-tsc -b`，按 tsconfig 项目引用做类型检查（脚本名带连字符） |
| `pnpm test`                         | Vitest 单次运行（`tests/**/*.test.ts`）                        |
| `pnpm build`                        | 生产构建，同时复跑类型检查                                     |
| `pnpm format` / `pnpm format:check` | Prettier 写入 / 校验                                           |

### 卡级验证脚本（当前为占位）

```bash
pnpm verify:layout   # PLACEHOLDER: TC-006 / TC-007 未实现
pnpm verify:export   # PLACEHOLDER: TC-010 / TC-011 未实现
pnpm verify:import   # PLACEHOLDER: TC-012 未实现
```

三条脚本由 `scripts/verify.mjs` 实现，当前**只打印 `PLACEHOLDER: <卡号> 未实现` 并以 0 退出**，用于打通验收链路；退出码 0 不代表验证通过。`tests/placeholder/verify-scripts.test.ts` 会断言这一点（含「未知参数不得返回 0」）。

## 目录结构

```
.
├── .github/workflows/ci.yml   # CI：install → lint → type-check → test → build
├── docs/                      # 文档、设计稿、验证记录、交付报告（入库）
│   ├── plan/                  # 执行计划包
│   ├── contract/              # 两层契约
│   ├── handoff/               # 每卡交付报告
│   └── ui-lib-compare/        # 组件库小样（离线可打开的静态 HTML）
├── scripts/verify.mjs         # 卡级验证占位脚本
├── src/
│   ├── model/                 # 文档模型、schema、undo 栈（TC-003）
│   ├── design/                # 设计 token（TC-004 / TC-016）
│   ├── ui/                    # shell、画布、面板、控件（TC-004 / TC-008）
│   ├── components/            # 简历组件集（TC-005）
│   ├── layout/                # 测量、排列、分页、溢出（TC-006 / TC-007）
│   ├── template/              # 模板系统与 4 套模板（TC-009）
│   ├── io/                    # 导入导出（TC-010 / TC-011 / TC-012）
│   ├── quality/               # 质量检查引擎（TC-013a）
│   ├── storage/               # 持久化与数据安全（TC-017）
│   ├── assets/                # 静态资产，fonts/ 由 TC-006 填充
│   └── ai/                    # AI 适配层（TC-014，P1）
├── tests/                     # 单元/集成测试
├── eslint.config.js           # ESLint 9 flat config
├── vite.config.ts             # Vite 配置（含 @ → src 别名）
└── vitest.config.ts           # Vitest 配置（node 环境，@ → src 别名）
```

`src/` 下只允许上述 11 个一级目录（任务分工附录 A）；每个模块目录当前只有一个 `index.ts` 占位。

## 约定

| 项       | 约定                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 导入别名 | `@/` → `src/`（Vite 与 Vitest 均已配置）                                |
| 测试文件 | 与被测模块同名 + `.test.ts`，放 `tests/` 下对应子目录                   |
| 测试环境 | 默认 `node`；需要 DOM 的用例在文件首行写 `// @vitest-environment jsdom` |
| 提交信息 | `TC-XXX: 简述`                                                          |
| 分支     | 开发分支 `feat/TC-XXX-简述`，验收通过后合入 `main`                      |

## 相关文档

| 文档                        | 内容                                         |
| --------------------------- | -------------------------------------------- |
| `docs/plan/PLAN.md`         | 里程碑、工期口径、风险                       |
| `docs/plan/TASKS.md`        | 逐卡台账与验收命令                           |
| `docs/contract/CONTRACT.md` | 内部 TS 接口契约                             |
| `docs/handoff/`             | 每卡交付报告                                 |
| `docs/ui-lib-compare.md`    | Naive UI / Element Plus 对比（待 Amor 拍板） |
