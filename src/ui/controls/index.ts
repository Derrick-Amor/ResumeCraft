/**
 * 基础控件对外入口（C 段：类名已换成设计稿词表）
 *
 * 分工（写进代码，避免以后反复讨论）：
 *   Element Plus 管「行为复杂」的件：对话框、下拉选择、日期、表单校验。
 *   Rc 管「设计稿特有」的件：按钮、标签、Tab、卡片、开关、提示条、字段外壳、溢出角标、图标。
 *
 * 两条纪律：
 *  1. 控件**不自带 scoped 样式**，视觉一律由 `src/design/app.css` 的设计稿类名提供。
 *     否则对稿时永远说不清"到底是设计稿写的还是控件自己加的"。
 *  2. Tab 拆成两个：左栏 `.side__tab` 与右栏 `.inspector__tab` 形态不同，
 *     共享实现放在内部件 `RcTabList`（不导出）。
 */

export { default as RcBadge } from './RcBadge.vue'
export { default as RcButton } from './RcButton.vue'
export { default as RcCard } from './RcCard.vue'
export { default as RcField } from './RcField.vue'
export { default as RcIcon } from './RcIcon.vue'
export { default as RcInspectorTabs } from './RcInspectorTabs.vue'
export { default as RcNotice } from './RcNotice.vue'
export { default as RcOverflowBadge } from './RcOverflowBadge.vue'
export { default as RcSideTabs } from './RcSideTabs.vue'
export { default as RcSwitch } from './RcSwitch.vue'

export { ICON_PATHS, ICON_SIZES, iconMarkup } from './icons'
export type { IconName, IconSize } from './icons'

export type {
  RcBadgeSize,
  RcBadgeTone,
  RcButtonSize,
  RcButtonVariant,
  RcCardPadding,
  RcNoticeTone,
  RcTabItem,
} from './types'
