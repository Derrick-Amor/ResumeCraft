/**
 * 识别引擎接口（TC-012 / FR-IMP-010）
 * 统一 RecognitionProvider 接口，规则引擎（本卡）与 AI/RAG（P1/P2）可配置切换。
 *
 * 契约 §7：`RecognitionProvider → recognize(file) → ImportReport`
 */

/** 导入来源（契约 §7 不变量 4） */
export type SourceKind = 'self-docx' | 'third-party-docx' | 'pdf'

/** 识别出的语义块 */
export interface RecognizedBlock {
  /** 识别出的组件类型 */
  type: string
  /** 原始文本内容 */
  text: string
  /** 识别置信度 0~1 */
  confidence: number
  /** 来源位置（页码/段落索引） */
  sourceLocation: string
  /** 识别出的字段 */
  fields: Record<string, string>
}

/** 导入报告（契约 §7 原文） */
export interface ImportReport {
  /** 识别出的语义块 */
  blocks: RecognizedBlock[]
  /** 整体置信度 0~1 */
  confidence: number
  /** 未能识别、进待处理列表的原始内容 */
  pending: PendingItem[]
  /** 警告 */
  warnings: string[]
  /** 来源类型（分层承诺，FR-IMP-009） */
  sourceKind: SourceKind
}

/** 待处理项（FR-IMP-008：未识别块不静默丢弃） */
export interface PendingItem {
  /** 原始文本/内容 */
  raw: string
  /** 原因 */
  reason: string
  /** 建议的组件类型（如果可以猜） */
  suggestedType?: string
}

/** 识别引擎接口（可切换实现） */
export interface RecognitionProvider {
  /** 引擎名称 */
  name: string
  /** 识别文件内容 */
  recognize(data: ArrayBuffer | Uint8Array, filename: string): Promise<ImportReport>
}
