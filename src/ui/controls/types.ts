/**
 * 基础控件公共类型（TC-004）
 * 定义方：src/ui/controls。契约 §10：UI 只读 schema、只发命令、只渲染 LayoutResult。
 *
 * 约定：控件只吃 token（`var(--rc-*)`），**不写任何色值**。
 *       材质按 v3 定稿：一层透明色 + backdrop-filter，不画高光/色散/多重阴影。
 */

/** 按钮类型。主按钮每屏只允许一个（PRD 6.4）。 */
export type RcButtonVariant = 'primary' | 'default' | 'ghost' | 'danger'

/** 按钮高度只有 28 / 32 两档（PRD 6.4），不给中间值。 */
export type RcButtonSize = 'md' | 'sm'

/** 标签语气。success 与 accent 分开：前者表示「已确认」，后者是品牌色。 */
export type RcBadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

export type RcBadgeSize = 'md' | 'sm'

/** 提示条语气。契约 §10.3：界面提示只允许「警告条 / 角标」两种载体。 */
export type RcNoticeTone = 'info' | 'success' | 'warning' | 'danger'

/** 卡片内边距档位。带 media 插槽（缩略图）时用 none，由媒体区自己撑满。 */
export type RcCardPadding = 'none' | 'sm' | 'md'

/** Tab 项。count 用于「组件 5」这类计数。 */
export interface RcTabItem {
  key: string
  label: string
  count?: number
  disabled?: boolean
}
