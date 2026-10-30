/**
 * 导入结果 → 文档组件（[数据丢失风险] 数据落盘桥）
 *
 * 背景：`ImportWizard` 的 `import` 事件只带 `RecognizedBlock[]`，此前**没有任何代码**
 * 把它写进文档 —— 用户导入的内容静默丢失，违反「一个字节都不能丢」。
 * 本模块是那座桥：识别块 → `AnyComponent[]`，由调用方一次 commit 写入（单步可撤销）。
 *
 * 四条纪律：
 *  1. **类型过别名归一**：识别块给的是语义名（work / project / custom…），
 *     注册表登记的是真实类型（experience / projects / awards）。与模板槽位同一个坑。
 *  2. **不编造**：识别不到的字段留 `''` / `[]`（defaultFields 的原值），绝不猜值。
 *  3. **一个字节不丢**：识别出但不在 schema 里的键原样留在 fields；
 *     完全不认识的块类型进 `UnknownComponent`，`raw` 保留全部原文。
 *  4. **往返可验**：`documentTextBlocks` 产出的文本 包含于 识别块原文（测试钉住）。
 *
 * 与 `src/io/import-map.ts` 的关系：那份是 TC-012 的启发式粗映射（识别管线内部用，
 * 供 import-docx / import-pdf 判类型）；本模块是**进文档**的唯一入口，语义更严
 * （别名归一 + defaultFields 打底 + 未知块兜底）。两份并存是历史遗留，收敛要单独立项。
 */

import { defaultFields } from '../components/registry'
import type { FieldSpec } from '../components/registry'
import { componentRegistry } from '../components/runtime'
import { createComponent, createId } from '../model/factory'
import type { AnyComponent, LanguageTrack, UnknownComponent } from '../model/types'
import type { PendingItem, RecognizedBlock } from './recognition-provider'

/**
 * 识别块类型 → 注册表真实类型。
 * 与 template/apply.ts 的 SLOT_ALIASES 同源（work→experience 等），
 * 那边没导出这份映射，所以这里各留一份；E 段统一导出后删掉副本。
 */
const TYPE_ALIASES: Record<string, string> = {
  work: 'experience',
  job: 'experience',
  internship: 'experience',
  project: 'projects',
  portfolio: 'projects',
  custom: 'awards',
  award: 'awards',
  honor: 'awards',
}

export function canonicalType(type: string): string {
  return TYPE_ALIASES[type] ?? type
}

/** 列表字段按行拆；空行丢掉（不编造条目） */
function toListValue(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

/**
 * 识别块 → 组件。
 * @param blocks 识别块（顺序即文档顺序）
 * @param orderStart 新组件的起始 order（调用方按现有组件数传入）
 * @param track 语言轨，决定字段裁剪与默认值
 */
export function recognizedBlocksToComponents(
  blocks: readonly RecognizedBlock[],
  orderStart: number,
  track: LanguageTrack = 'zh',
): AnyComponent[] {
  const out: AnyComponent[] = []

  blocks.forEach((block, index) => {
    const type = canonicalType(block.type)
    const definition = componentRegistry.get(type)

    if (definition === undefined) {
      // 未知类型：整个块进 UnknownComponent，原文一字不丢
      const unknown: UnknownComponent = {
        id: createId('cmp'),
        type,
        order: orderStart + index,
        visible: true,
        unknown: true,
        originalType: block.type,
        raw: {
          ...block.fields,
          text: block.text,
          sourceLocation: block.sourceLocation,
          confidence: block.confidence,
        },
      }
      out.push(unknown)
      return
    }

    // 已知类型：defaultFields 打底（'' / []，不编造），再填识别出的值
    const fields = defaultFields(definition, track)
    const specs = componentRegistry.fieldsFor(type, track)
    const specByKey = new Map<string, FieldSpec>(specs.map((spec) => [spec.key, spec]))

    for (const [key, raw] of Object.entries(block.fields)) {
      if (typeof raw !== 'string') continue
      const spec = specByKey.get(key)
      if (spec === undefined) {
        // 识别出但不在 schema 里：原样保留（不丢字节），将来升级 schema 能回填
        fields[key] = raw
        continue
      }
      fields[key] = spec.kind === 'list' ? toListValue(raw) : raw
    }

    out.push(
      createComponent({
        type,
        order: orderStart + index,
        fields,
      }),
    )
  })

  return out
}

/**
 * 待处理项 → `UnknownComponent`（**一个字节不丢**的另一半）。
 *
 * `PendingItem` 是"没识别出结构"的内容（FR-IMP-008：不静默丢弃）。
 * 它不该被硬塞进某个 schema 组件 —— 那是编造结构；进 UnknownComponent、
 * `raw` 保留原文与原因，将来人工归类时字还在。
 */
export function pendingItemsToComponents(
  items: readonly PendingItem[],
  orderStart: number,
): UnknownComponent[] {
  return items.map((item, index) => ({
    id: createId('cmp'),
    type: item.suggestedType !== undefined ? canonicalType(item.suggestedType) : 'pending',
    order: orderStart + index,
    visible: true,
    unknown: true,
    originalType: item.suggestedType ?? 'pending',
    raw: {
      text: item.raw,
      reason: item.reason,
    },
  }))
}
