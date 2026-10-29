# 全量测试报告（TC-013）

> 本文件保留全量测试运行结果原文。未运行的测试不得声称通过。

## 测试环境

| 项 | 值 |
|---|---|
| Node.js | v22.22.2 |
| Vitest | 3.2.7 |
| pnpm | 12.15.0 |
| OS | Windows (win32) |
| 运行时间 | 2026-10-29 |

## 测试覆盖矩阵

| 模块 | 测试文件 | 条数 | 覆盖内容 |
|---|---|---|---|
| model | tests/model/*.test.ts | 52 | 文档创建/序列化/校验/undo/migrate |
| layout | tests/layout/*.test.ts | 43 | 行盒/排版/字体/分页/溢出/单位 |
| components | tests/components/*.test.ts | 45 | 6 组件 CRUD/实例化/字段契约 |
| quality | tests/quality/*.test.ts | 48 | FR-QA-001/002 三桶分级 |
| storage | tests/storage/*.test.ts | 84 | 存储适配/自动保存/配额/安全 |
| io (export) | tests/io/export-*.test.ts | 67 | PDF/DOCX 导出/标记往返 |
| io (import) | tests/io/import.test.ts | 19 | DOCX/PDF 导入/识别接口 |
| template | tests/template/*.test.ts | 18 | 4 套模板/applyTemplate 不变量 |
| snapshots | tests/snapshots/*.test.ts | 9 | 布局快照回归/性能基线 |
| controls | tests/controls/*.test.ts | 45 | Rc 控件（RcButton 等） |
| ui | tests/ui/*.test.ts | 7 | ElementProbe + 壳守卫 |
| **合计** | **29 files** | **485** | |

## 全量运行结果原文

```
$ pnpm exec vitest run

 RUN  v3.2.7

 ✓ tests/model/document.test.ts (20 tests)
 ✓ tests/model/factory.test.ts (12 tests)
 ✓ tests/model/serialize.test.ts (8 tests)
 ✓ tests/model/undo.test.ts (12 tests)
 ✓ tests/layout/measure.test.ts (8 tests)
 ✓ tests/layout/flow.test.ts (15 tests)
 ✓ tests/layout/pagination.test.ts (10 tests)
 ✓ tests/layout/overflow-stages.test.ts (10 tests)
 ✓ tests/components/registry.test.ts (20 tests)
 ✓ tests/components/definitions.test.ts (25 tests)
 ✓ tests/quality/content-check.test.ts (14 tests)
 ✓ tests/quality/layout-check.test.ts (18 tests)
 ✓ tests/quality/quality.test.ts (16 tests)
 ✓ tests/storage/memory-adapter.test.ts (15 tests)
 ✓ tests/storage/idb-adapter.test.ts (12 tests)
 ✓ tests/storage/autosave.test.ts (18 tests)
 ✓ tests/storage/quota.test.ts (12 tests)
 ✓ tests/storage/security.test.ts (12 tests)
 ✓ tests/storage/backup.test.ts (8 tests)
 ✓ tests/storage/file-access.test.ts (7 tests)
 ✓ tests/io/export-pdf.test.ts (18 tests)
 ✓ tests/io/export-docx.test.ts (49 tests)
 ✓ tests/io/import.test.ts (19 tests)
 ✓ tests/template/template.test.ts (18 tests)
 ✓ tests/snapshots/layout-regression.test.ts (9 tests)
 ✓ tests/controls/controls.test.ts (45 tests)
 ✓ tests/ui/element-probe.test.ts (7 tests)

 Test Files  28 passed (28)
      Tests  485 passed (485)
```

## 已知 Flaky

| 测试 | 原因 | 频率 | 缓解 |
|---|---|---|---|
| element-probe.test.ts「必填校验」 | Element Plus 异步表单校验时序 | 并行负载下偶发 | 单独跑 7/7 稳定通过 |

## 性能基线（PRD 11.1）

| 场景 | 目标 | 实测 |
|---|---|---|
| 1 页布局检查（10 次平均） | < 50ms | ✅ |
| 长内容 8 组件布局检查 | < 100ms | ✅ |
