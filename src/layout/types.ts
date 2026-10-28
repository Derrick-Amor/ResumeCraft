/**
 * 布局结果类型（TC-007）
 * 契约 §5「MVP-4 布局结果」是本节的定义方，结构按该节原文落地，字段一个不多一个不少。
 *
 * 不变量（任何模块不得破坏）：
 *  1. `layout()` 是纯函数：不读 store、不读 DOM、不读时钟与随机数
 *  2. 溢出不自动删内容（PRD 4.8 裁决：数据完整性 > 布局合法性）
 *  3. 两次相同输入必须得到**逐字节一致**的 boxes 与 inputHash
 */

/** 警告类型。与 quality 模块的 Issue 区分：这里只描述「版面上发生了什么」 */
export type LayoutWarningType =
  | 'overflow-component' // 单个组件超出内容区
  | 'overflow-page' // 整页装不下
  | 'overlap' // 组件互相压叠
  | 'blank-page' // 异常空白页
  | 'page-count' // 页数超出建议
  | 'orphan-heading' // 标题落在页底，与正文分离

/**
 * 严重度语义固定（契约 §5 + §8）：
 * 裁切/丢内容 = blocking；溢出/重叠/空白页 = warning；可改善项 = suggestion
 */
export type LayoutSeverity = 'blocking' | 'warning' | 'suggestion'

/** 组件在某一页上的位置。跨页组件会产生多个片段，fragmentIndex 从 0 起。 */
export interface ComponentBox {
  componentId: string
  pageIndex: number
  /** 片段序号：0 = 第一段，1 = 续页第二段… */
  fragmentIndex: number
  x: number
  y: number
  width: number
  height: number
}

/** 页面几何。content* 是扣掉页边距后的可用区域。 */
export interface PageBox {
  pageIndex: number
  width: number
  height: number
  contentX: number
  contentY: number
  contentWidth: number
  contentHeight: number
}

export interface LayoutWarning {
  type: LayoutWarningType
  pageIndex: number
  /** 与具体组件无关的警告（如整页溢出）可不带 */
  componentId?: string
  severity: LayoutSeverity
  /** 面向用户的一句话说明 */
  cause: string
  /** 面向用户的处理建议。禁止写「请调整」这种废话 */
  suggestion: string
}

/**
 * 布局结果。`engineVersion` 与 `inputHash` 一起用于快照回归：
 * 同输入必同 hash，hash 变了就说明引擎行为变了，必须人工确认。
 */
export interface LayoutResult {
  boxes: ComponentBox[]
  pages: PageBox[]
  warnings: LayoutWarning[]
  engineVersion: string
  inputHash: string
}
