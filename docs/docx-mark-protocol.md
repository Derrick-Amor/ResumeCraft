# DOCX 结构标记协议（TC-011）

> 契约：`docs/contract/CONTRACT.md` §7 不变量 5 —— **DOCX 结构标记的具体命名与版本规则以本文件为准，
> 协议变更必须升版本号**。
> 实现：`src/io/docx-marks.ts`（埋入与解析）、`src/io/export-docx.ts`（导出接线）。
> 需求：FR-EXP-005 —— 文件内部埋入结构标记（组件 UUID、样式映射、版本号），支持反向无损导入。

---

## 1. 目的

DOCX 是「可编辑副本」（FR-EXP-002）：正文与格式由 Word 承载，模型的组件边界、样式与身份信息会随排版丢失。
为支持**反向导入时无损还原文档模型**，导出时在 DOCX 包内埋入结构标记；导入侧读取标记即可
把「一段 Word 文本」重新关联回「某个组件的某个样式档」。

标记受损（Word 保存/第三方工具编辑导致丢失或改写）时，导入侧**降级为第三方导入路径**
（FR-IMP-009 / 契约 §7 不变量 4：`sourceKind = 'third-party-docx'`），不得报错、不得丢文本。

---

## 2. 版本规则

| 规则 | 说明 |
|---|---|
| 当前版本 | **`1`**（`MARK_VERSION = 1`，导出与解析两侧同源引用 `src/io/docx-marks.ts`） |
| 版本存放 | ①自定义属性 `data-rc-mark-version`；②每个组件标记的 `data-rc-mark-version` 字段 |
| 版本嗅探 | 书签名前缀 `rc1_` 中的数字即协议版本，用于无自定义属性时的快速判别 |
| **升版条件** | 标记的**命名、语义、存放位置**任一变更 → 必须升版本号（+1），并在本文件新增一节记录差异 |
| 解析方约定 | 版本号**不等于**自身实现版本 → 视为不可信，整体降级为第三方导入路径（宁可降级不可错解） |
| 兼容策略 | v1 无历史版本；未来版本若需兼容读取旧版，必须显式实现该版本的解析器，不允许「猜测」 |

---

## 3. 载体（双通道冗余）

标记同时写入两个位置，互为校验；**自定义属性是权威数据，书签是定位锚点**。

### 3.1 载体一：`docProps/custom.xml`（自定义文档属性）

| 属性名 | 值 | 含义 |
|---|---|---|
| `data-rc-mark-version` | `"1"` | 协议版本号（字符串化整数） |
| `data-rc-marks` | JSON 字符串 | **MarkManifest**（权威标记清单，结构见 §4） |

属性名即协议规定的标记名 `data-rc-mark-version`。JSON 里的键名即
`data-rc-component-id` / `data-rc-style` / `data-rc-mark-version` 三个标记名（§4）。

### 3.2 载体二：`word/document.xml` 书签（Bookmark）

- 每个**可见**组件的渲染范围（首段到末段）由一对 `w:bookmarkStart` / `w:bookmarkEnd` 包住。
- 书签名规则（v1）：

```
bookmarkName = "rc" + MARK_VERSION + "_" + safe(componentId)
safe(id)     = id 中非 [A-Za-z0-9_] 的字符替换为 "_"；
               若替换后超过 24 字符，截断至 24 并追加 "_" + FNV1a32(componentId)（8 位 hex）
```

  前缀 `rc1_` 兼作版本嗅探；Word 书签名上限 40 字符、字母开头、无空格，故有截断+哈希规则。
- 不可见组件不渲染、不写书签（其标记仍在 §3.1 清单里，`bookmark` 为空串）。

---

## 4. MarkManifest 结构（`data-rc-marks` 的 JSON）

```jsonc
{
  "data-rc-mark-version": 1,
  "components": [
    {
      "data-rc-component-id": "cmp_067e6162-…",   // 组件 UUID（必有，缺失即降级）
      "data-rc-style": { "titleSizePt": 12 },      // 模型 style 字段原文（无样式为 {}）
      "data-rc-mark-version": 1,                   // 写入该组件时的协议版本
      "bookmark": "rc1_cmp_067e6162-…",            // 对应书签名（不可见组件为 ""）
      "order": 3,                                   // 模型 order
      "type": "experience",                         // 组件类型
      "visible": true
    }
  ]
}
```

三个协议标记名的落点：

| 标记名 | 落点 |
|---|---|
| `data-rc-component-id` | MarkManifest 组件条目 + 书签名可反解（哈希截断时以清单为准） |
| `data-rc-style` | MarkManifest 组件条目（style 原文，供导入时还原样式档） |
| `data-rc-mark-version` | `docProps/custom.xml` 属性 + MarkManifest 根与每个组件条目 |

组件顺序按 `order` 升序写入，保证同输入同输出（便于往返测试逐字节比对）。

---

## 5. 受损降级规则（FR-IMP-009）

解析入口：`readMarks({ customPropertiesXml, documentXml })` → `MarksReadResult`。

| 症状 | 判定 | 结果 |
|---|---|---|
| 缺 `docProps/custom.xml` | 标记载体整体缺失 | `mode='third-party'`，`ok=false` |
| 缺 `data-rc-mark-version` 属性 | 无法判定版本 | 降级第三方 |
| 版本号非法（非整数） | 损坏 | 降级第三方 |
| 版本号 ≠ 实现版本 | 不可信 | 降级第三方 |
| 缺 `data-rc-marks` 属性 / 非法 JSON / 缺 `components` / 条目缺 id 或 style 非对象 | 清单不可用 | 降级第三方 |
| 个别书签缺失（Word 编辑删除） | 清单仍可信 | `mode='self-docx'` 保留，该组件记 warning，导入时按文本顺序匹配 |
| 书签名前缀不是 `rc{实现版本}_` | 疑似被改写 | 该组件按书签缺失处理 |

降级语义：**降级 ≠ 失败**。文件仍可导入，走第三方识别路径（`sourceKind='third-party-docx'`），
文本一字不丢；只是组件结构/样式不能无损还原。

---

## 6. 导出侧约定（FR-EXP-003 / FR-EXP-005）

1. 导出前必须 `runQualityChecks({ doc, layout })`；`blocking` 非空默认拦截，`forceExport=true` 才放行。
2. `includeMarks=false` 可关闭埋入（仅供测试/调试）；正常导出路径必须开启。
3. 标记内容禁止包含简历正文之外的敏感信息（FR-SEC-004 同源约束）；`data-rc-style` 只存样式键值。

---

## 7. 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| 1 | 2026-10-28 | 初始协议：自定义属性（`data-rc-mark-version` / `data-rc-marks`）+ 书签 `rc1_{safeId}` |
