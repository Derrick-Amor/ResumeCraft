/**
 * 布局引擎对外入口（TC-006 / TC-007）
 * 契约 §4（测量）、§5（排列 / 分页 / 布局结果）是本目录的定义方。
 *
 * 模块边界：
 *   types.ts           布局结果契约（ComponentBox / PageBox / LayoutWarning / LayoutResult）
 *   units.ts           pt / px / mm / 半磅 四向换算，**唯一换算层**
 *   measure.ts         文本测量（可注入后端、显式降级标记）
 *   text-runs.ts       组件 → 文本段提取（画布、测量、导出三方共用）
 *   flow.ts            单页纵向排列（不负责翻页）
 *   pagination.ts      分页（keep-together / 可拆 / 标题不孤立）
 *   overflow-stages.ts 溢出三阶段候选（只出方案，不直接改版面）
 *   compose.ts         **合成入口**：`composeLayout(doc) → LayoutResult`
 *   report.ts          警告排序 / 去重 / 摘要 / 几何指纹
 *   font-loader.ts     内置字体加载与降级报告
 *
 * 不变量：本目录全部模块是纯函数，不读 store / DOM（font-loader 是唯一例外，它必须碰 DOM API）。
 * 旧的深层导入路径（如 `from '../layout/types'`）继续可用 —— 这里只是加了一层门面。
 */

export * from './types'

export * from './compose'
export * from './text-runs'

export * from './measure'
export * from './pagination'
export * from './report'
