# UI 组件库小样对比：Naive UI vs Element Plus

> 卡号：TC-002（A 段 8.5，Q4 决策）｜对应决策项：PRD 13.1#3、13.2#6
> 本文只提供对比事实与倾向性意见，**最终由 Amor 拍板**；拍板前不把它写回 PRD 13.1#3。
> 小样版本：vue 3.5.44、naive-ui 2.45.3、element-plus 2.14.7（2026-10-23 取 npm 最新发行版）

---

## 0. 怎么看小样

| 方式 | 操作 | 说明 |
|---|---|---|
| 直接双击 | `docs/ui-lib-compare/preview/naive.html`、`docs/ui-lib-compare/preview/element-plus.html` | 无需安装、无需构建，离线可打开（UMD 快照已放在 `preview/vendor/`） |
| 只看确认框 | 在地址后加 `#dialog`，如 `naive.html#dialog` | 预填演示数据并直接打开确认对话框 |
| 截图 | `preview/naive.png`、`preview/element-plus.png` | 无头 Chrome（900×1000）对 `#dialog` 状态的截图 |

> 两个 HTML 都通过 `file://` 打开验证过（Chrome headless 渲染 + DOM 文本核对），未安装进主工程 `package.json`。
> `vendor/` 内是 npm 官方发行包中的 UMD 构建快照，来源与 CDN 备选地址写在每个 HTML 的头部注释里。

---

## 1. 两个小样做了什么（内容严格一致）

| 维度 | 两个小样一致的实现 |
|---|---|
| 表单字段 | 姓名（必填、≥2 字符）、邮箱（必填、格式校验）、手机号（必填、`^1[3-9]\d{9}$`） |
| 布局 | `label` 置顶，卡片宽 560px，字段纵向排列 |
| 主操作 | 「保存基本信息」→ 校验通过后弹出确认对话框；「重置」清空并清除校验态 |
| 确认对话框 | 标题「确认保存」，正文 + 信息提示条，按钮「取消 / 确认保存」 |
| token 演示 | 页面统一使用 `--rc-color-primary: #2f6feb`、`--rc-radius: 6px`、`--rc-gap: 16px`，并把组件主色对齐到同一数值 |

---

## 2. 六维对比

### 2.1 token 定制成本

| 项 | Naive UI | Element Plus |
|---|---|---|
| 定制机制 | JS 对象 `themeOverrides`（`common.primaryColor` / `common.borderRadius`），通过 `NConfigProvider` 注入 | CSS 变量（`--el-color-primary`、`--el-border-radius-base` 等），在 `:root` 或容器上覆写 |
| 与 `tokens.css` 单一事实源的关系 | **需二次映射**：`tokens.css` 的值要再抄一份进 JS 对象，两处维护 | **同机制**：设计 token 直接写成 `--el-*` 的值，可在 `tokens.css` 内一次完成 |
| 组件外露 token 命名 | `--n-*` 系列由组件内部生成，不建议手写；定制入口是 JS | `--el-*` 是官方公开的定制接口 |
| 小样实测踩点 | 初版把 `NConfigProvider` 只包住表单，**teleport 到 body 的 `NModal` 拿不到主题**，按钮回落默认绿 `#18a058`；必须让 provider 包住整棵树（含弹窗） | 无此问题：`:root` 上的 CSS 变量对 teleport 出去的弹窗同样生效 |
| 局部换肤（如画布深色区） | 依赖 `NConfigProvider` 嵌套，可行但每层要传对象 | 在容器上覆写 CSS 变量即可，天然支持局部作用域 |
| 结论 | 灵活度高，但与「CSS 自定义属性为单一事实源」（PRD 13.1#4）存在机制错位 | 与 PRD 13.1#4 同一套机制，接入成本最低 |

### 2.2 表单 / 对话框实现差异

| 项 | Naive UI | Element Plus |
|---|---|---|
| 表单容器 | `NForm` + `NFormItem`（`path` 绑定字段） | `ElForm` + `ElFormItem`（`prop` 绑定字段） |
| 校验规则 | 内置规则对象 `{ required, min, pattern, trigger: ['input','blur'] }`，字段级触发 | `async-validator`，支持 `type: 'email'`、`transform`、异步 validator，生态更成熟 |
| 触发校验 | `formRef.validate(cb)`，回调拿 `errors`，也返回 Promise | `formRef.validate()` 返回 Promise，**校验失败会 reject**，必须 `catch`，否则控制台出现 unhandled rejection |
| 清除/重置 | `restoreValidation()` 清校验态 | `clearValidate()` / `resetFields()` 分开 |
| 对话框 | `NModal` + `preset="card"` + `title` + `footer` slot；宽度用 `style` | `ElDialog` + `title` + `footer` slot + `width`；支持 `before-close` 拦截 |
| 样式来源 | CSS-in-JS，运行时注入 `<style>`（截图里首屏已见 `cssr-id` 样式块） | 独立 CSS 文件（UMD 版需额外引 `index.css`） |
| 表单能力体感 | 够用，语义清晰，TS 提示好 | 更全（动态增减行、嵌套 prop、`validateField`），大型表单经验更多 |

### 2.3 包体积（UMD 全量包，实测同一台机器统计）

| 产物 | 原始 | gzip |
|---|---|---|
| element-plus 2.14.7 `index.full.min.js` | 1057.6 KB | 293.4 KB |
| element-plus 2.14.7 `index.css` | 361.4 KB | 48.2 KB |
| **Element Plus 合计** | **1419.0 KB** | **341.6 KB** |
| naive-ui 2.45.3 `index.prod.js`（样式在 JS 内） | 2236.7 KB | 516.6 KB |
| **Naive UI 合计** | **2236.7 KB** | **516.6 KB** |
| vue 3.5.44 `vue.global.prod.js`（两者共用） | 170.6 KB | 62.1 KB |

> 口径说明：这是「UMD 全量包」，用于小样演示，**不代表生产体积**。正式接入走 ESM 按需引入 + tree-shaking，两个库都会显著小于上表；但相对关系（Naive 的 CSS-in-JS 需要运行时 + 样式序列化）在按需场景下仍存在。最终体积应在 TC-004 落地后以真实构建产物复测。

### 2.4 中文文档与生态

| 项 | Naive UI | Element Plus |
|---|---|---|
| 中文文档 | 原生中文，示例质量高，API 说明偏简洁 | 原生中文，文档结构完整，示例 + API 表更细 |
| 社区规模 | 中等，issue 响应较快，周边模板少 | 大（Vue3 生态最主流之一），教程、问答、第三方模板多 |
| TypeScript | 全量 TS 编写，类型推导强 | 全量 TS，类型完整 |
| 无障碍 / 键盘操作 | 基础支持 | 表单与弹窗的键盘/焦点管理更细（如 `focus-trap`） |
| 版本活跃度 | 稳定迭代 | 稳定迭代，2.x 长期维护 |
| 风险 | 遇到冷门问题可查资料少 | 定制过深时容易被默认样式细节缠住 |

### 2.5 与 CSS 变量 token 的融合方式（结论性归纳）

| 场景 | Naive UI 做法 | Element Plus 做法 |
|---|---|---|
| 全局主色 | `themeOverrides.common.primaryColor` = 读取 token 后的常量 | `:root { --el-color-primary: var(--rc-color-primary) }` |
| 派生色（hover/pressed） | 手写 `primaryColorHover` / `primaryColorPressed` | `--el-color-primary-light-3` 等，也可用官方生成函数 |
| 局部主题（画布内深色工具条） | 嵌套 `NConfigProvider` 传对象 | 容器上覆写 `--el-*` |
| 与 Tailwind 共存 | 互不干扰 | 互不干扰 |
| token 变更时的同步点 | `tokens.css` + 一份 JS 映射表（2 处） | `tokens.css`（1 处） |

### 2.6 暗色主题支持

| 项 | Naive UI | Element Plus |
|---|---|---|
| 切换方式 | `darkTheme` + `themeOverrides`，纯 JS 状态驱动 | `html.dark` 类 + 官方 dark CSS 变量文件，纯 CSS 切换 |
| 与自研 token 的关系 | 深色值写在 JS 覆盖对象里 | 深色值写在 CSS 变量层，可与 `tokens.css` 的 `[data-theme=dark]` 合并 |
| 局部暗色区域 | 靠嵌套 provider | 靠容器类名 |
| 本项目相关性 | 编辑器画布需要「纸白」，周边 shell 可能走暗色；两者都要能局部化 | 同 |

---

## 3. 倾向性意见（**非裁决，最终由 Amor 拍板**）

**倾向 Element Plus**，理由按权重排序：

1. **与已锁定的样式方案同机制**：PRD 13.1#4 定的是「CSS custom properties（tokens.css 单一事实源）」。Element Plus 的定制入口就是 CSS 变量，`--el-*` 可以直接以 `var(--rc-*)` 赋值，token 只有一处真相；Naive UI 需要在 `tokens.css` 之外再维护一份 JS `themeOverrides`，天然有漂移风险。
2. **表单/校验生态更成熟**：本项目对话框与表单密度高（新建、导入确认、导出设置、模板参数），`async-validator` 的规则表达力和社区经验更足。
3. **包体积更小**：同为 UMD 全量包，gzip 后 341.6 KB vs 516.6 KB；虽然生产按需后差距会收窄，但差距方向明确。
4. **团队与资料成本更低**：中文文档 + 大量可参考实现，出问题更容易查。

**若 Amor 更看重以下两点，可以反转选择 Naive UI**：

- 更统一的视觉气质与更「现代」的默认观感（TC-016 视觉基调若是克制、扁平、少边框，Naive 的默认样式更接近）；
- 更强的 JS 侧主题编排能力（同一套主题对象可以精确控制每个组件的每个状态）。

反转的代价需要明确接受：`tokens.css` 与 `themeOverrides` 双写，且 TC-016 定稿 token 后要同步两份。

---

## 4. 请 Amor 确认的三件事

| # | 待确认 | 影响 |
|---|---|---|
| 1 | 选 Naive UI 还是 Element Plus | TC-004 及后续所有控件实现 |
| 2 | 若选 Naive UI，是否接受 token 双写（`tokens.css` + `themeOverrides`） | TC-016 token 定稿的落地方式 |
| 3 | 暗色主题是否进 P0（当前 PRD 未把暗色列为 MVP 必做） | 组件库选型权重、TC-016 交付范围 |

---

## 5. 未纳入本次对比的部分

- 未做真实业务组件（画布、图层、属性面板）的适配试验——按任务边界归 TC-004/TC-008。
- 未做性能压测（长表单、批量渲染）——UMD 全量包下的体感不具参考性，留待 TC-004 用真实构建复测。
- 未验证 SSR/SSG 兼容性——本项目为纯静态 SPA，不涉及。
