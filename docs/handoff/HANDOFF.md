# ResumeCraft 交接文档（2026-10-28 12:20）

> **新会话请从这里开始读。** 本文是当前唯一的权威状态入口。
> 读完再看 `docs/plan/TASKS.md` §1 状态列，**不要凭印象**。

---

## 1. 项目一句话

**ResumeCraft**：Web-first 简历编辑与自动排版工具。
工程根 `C:/Users/D.Amor/WorkBuddy/简历项目开发/`｜远端 `github.com/Derrick-Amor/ResumeCraft`

---

## 2. 当前状态（截至 2026-10-28 12:16）

**测试：333 条 / 22 文件｜四门全绿｜build 25.69s**

| 卡 | 状态 | 产出 |
|---|---|---|
| TC-016 UI 视觉设计 | ✅ resolved | v3 蓝玻璃+白纸、11 张稿、token 回灌 |
| TC-003 文档模型 + undo | ✅ resolved | `src/model/` 7 文件、33 条契约测试 |
| TC-004 token + 基础控件 | ✅ resolved | `src/ui/controls/` 8 件、45 条测试 |
| TC-006 测量与单位 + 字体 | ✅ resolved | units / measure / font-loader + 思源子集 |
| TC-007 布局引擎 | ✅ resolved | flow / pagination / overflow-stages / report |
| TC-005 简历组件集 | ✅ resolved | 注册表 + 6 个双轨组件、27 条测试 |
| TC-017 持久化与数据安全 | ✅ resolved | `src/storage/` 9 文件、84 条测试 |
| TC-013a / TC-010 / TC-011 / TC-008 / TC-009 | ⬜ 未开始 | M3-M4，按序 |

**M1 三卡全关。M2 四卡全关。**

---

## 3. 下一步做什么

### 立刻（TC-013a 质量检查引擎）

- 范围：`src/quality/`、`tests/quality/`
- 验收：`pnpm exec vitest run tests/quality`
- 依据：契约 §8「MVP-7 质量检查」、FR-QA-001/002、FR-EXP-003 接口

### 之后按顺序

M3：`013a → 010 → 011 → 008 → 009`（TC-010 PDF 导出是最难的）

---

## 4. 关键约定（违反会被打回）

1. **一次一卡，严格串行。** 卡级验收通过才算完成。
2. **四门检查**：`pnpm lint / type-check / test / build`，全绿才能收卡。
3. **契约不变量优先**：`docs/contract/CONTRACT.md` 是技术边界事实源。
4. **语言轨差异写在组件声明里**，UI 层禁止 `if (languageTrack === 'en')`。
5. **测量层不得依赖 DOM 布局**，只用 Canvas2D `measureText`。
6. **溢出不自动删内容**（数据完整性 > 布局合法性）。
7. **TAPD 流转**：`planning → developing → status_2 → status_3 → resolved`，
   `developing` 不可直达 `status_3`；转 `developing` 时 `owner` 必填。
   评论里**不要写 `verify:*`**（markdown 吃星号），逐个列命令。

---

## 5. 环境（2026-10-28 更新）

| 项目 | 状态 |
|---|---|
| **pnpm / git / vitest** | ✅ 可直接执行（沙箱限制已解除） |
| **四门检查** | ✅ 可自行验证 |
| **github.com** | ⚠️ 被拦（api.github.com 通），不能下载二进制 |
| **无 zod 依赖** | 沿用 TC-003 的零依赖 Result 校验器 |
| **长对话会折叠轮次** | 「我不记得写过」≠「不是我写的」，先查 mtime |

---

## 6. 已踩过的坑（可复用教训，别再踩）

1. **JS 保留字做 prop 名** —— `for` 导致模板解析失败。改 `htmlFor`。
2. **手写中文字符串做期望值** —— 数错字。必须配 `toHaveLength` 断言。
3. **`letter-spacing` 按 `(n-1)` 累加** —— CSS 是按字符数含行尾。
4. **`clamp(min > max)` 会反向放宽** —— 加 `shrinkTo`。
5. **`document.fonts.ready` 鸡生蛋** —— 必须显式 `font.load()`。
6. **稀疏数组 + `Array.map`** —— map 跳过空洞。
7. **`pnpm test -- <filter>` 是假过滤** —— 用 `pnpm exec vitest run <路径>`。
8. **`erasableSyntaxOnly` 禁 constructor 参数属性** —— 用 `private x: T` 显式声明 + 构造函数赋值。
9. **`expect().endsWith()` 不可用** —— 用 `expect(s.endsWith('.x')).toBe(true)`。

---

## 7. 文件地图

| 用途 | 路径 |
|---|---|
| **卡表 / 状态** | `docs/plan/TASKS.md` |
| **进度速览** | `docs/plan/PROGRESS.md` |
| **技术边界** | `docs/contract/CONTRACT.md` |
| **布局常量** | `docs/layout-rules.md` |
| **字体登记** | `docs/font-license.md` |
| **验证记录** | `docs/verify/` |

---

## 8. 已定的技术决策（不要再讨论）

- **前端**：Vue 3 + TS + Vite 7.3.7 + Pinia 4.1.0 + Vitest 3.2.7 + ESLint 9
- **UI 库**：Element Plus 2.14.7（EP 管复杂交互，Rc 管材质语义）
- **PDF**：pdf-lib（中文必须 TTF）
- **DOCX**：docx 库；导入 mammoth + pdfjs-dist
- **存储**：IndexedDB（零依赖封装）；**简历不云存**
- **字体**：思源黑体/宋体（SIL OFL 1.1），5 字重已子集化
- **设计主色**：墨青蓝 `#1f6e8c`；v3 蓝玻璃 + 白纸
- **暗色主题**：不进 P0
