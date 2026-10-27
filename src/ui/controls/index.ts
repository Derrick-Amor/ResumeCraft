/**
 * 基础控件对外入口（TC-004）
 *
 * 分工（写进代码，避免以后反复讨论）：
 *   Element Plus 管「行为复杂」的件：对话框、下拉选择、日期、表单校验。
 *   Rc 管「材质与语义特殊」的件：按钮、标签、Tab、卡片、开关、提示条、字段外壳、溢出角标。
 *
 * 两边共用同一套 token —— 桥接层 element-plus-bridge.css 已把 `--el-*` 指到 `--rc-*`，
 * 所以不存在「EP 一套颜色、自研控件另一套」的问题。
 */

export { default as RcBadge } from './RcBadge.vue'
export { default as RcButton } from './RcButton.vue'
export { default as RcCard } from './RcCard.vue'
export { default as RcField } from './RcField.vue'
export { default as RcNotice } from './RcNotice.vue'
export { default as RcOverflowBadge } from './RcOverflowBadge.vue'
export { default as RcSwitch } from './RcSwitch.vue'
export { default as RcTabs } from './RcTabs.vue'

export type {
  RcBadgeSize,
  RcBadgeTone,
  RcButtonSize,
  RcButtonVariant,
  RcCardPadding,
  RcNoticeTone,
  RcTabItem,
} from './types'
