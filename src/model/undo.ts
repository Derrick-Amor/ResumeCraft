/**
 * Undo 栈（TC-003）
 * 契约 §2「undo 契约」：只暴露命令式接口 push / undo / redo / canUndo / canRedo。
 *
 * 四条不变量：
 *  1. UI 不得直接改 state 后不经过命令入栈 —— 本类里 `state` 是私有字段，
 *     只有 push / undo / redo / clear 能改，外部拿到的 `current` 是只读引用。
 *  2. 连续输入按「同一组件同一字段 + 时间窗」合并，不得逐字符入栈 —— 靠 mergeKey + mergeWindowMs。
 *  3. 栈有上限，超限丢最早 —— maxDepth，默认 100。
 *  4. 保存/重开后的历史策略必须明确 —— MVP：调用 clear() 清空（PRD FR-DOC-004）。
 *
 * 实现取舍：用「前后快照」而不是「可逆操作」。
 * 简历文档体积在几百 KB 量级，快照更简单也更不容易写错反向操作；
 * 真要省内存可换成补丁式，但那是性能优化，不是本卡目标。
 */

import { cloneDocument, documentsEqual } from './serialize'
import type { ResumeDocument } from './types'

export interface EditCommand {
  id: string
  /** 给撤销菜单显示的动作名，如「修改项目名称」 */
  label: string
  /** 合并键：同一 mergeKey 的连续编辑在时间窗内合成一步 */
  mergeKey?: string
  before: ResumeDocument
  after: ResumeDocument
  /** 最后一次写入的毫秒时间戳 */
  timestamp: number
}

export interface UndoStackOptions {
  /** 栈上限，默认 100 */
  maxDepth?: number
  /** 合并时间窗（毫秒），默认 800 */
  mergeWindowMs?: number
}

export interface PushOptions {
  label: string
  mergeKey?: string
  /** 注入当前时间，测试用；不传取 Date.now() */
  now?: number
}

const DEFAULT_MAX_DEPTH = 100
const DEFAULT_MERGE_WINDOW_MS = 800

export class UndoStack {
  private commands: EditCommand[] = []

  /** 已应用的命令条数，同时是 redo 的起点 */
  private cursor = 0

  private state: ResumeDocument

  private readonly maxDepth: number

  private readonly mergeWindowMs: number

  private sequence = 0

  constructor(initial: ResumeDocument, options: UndoStackOptions = {}) {
    this.state = initial
    this.maxDepth = Math.max(1, options.maxDepth ?? DEFAULT_MAX_DEPTH)
    this.mergeWindowMs = Math.max(0, options.mergeWindowMs ?? DEFAULT_MERGE_WINDOW_MS)
  }

  /** 当前文档。只读引用，不要原地改它。 */
  get current(): ResumeDocument {
    return this.state
  }

  /** 栈内命令总数（含已撤销未丢弃的） */
  get depth(): number {
    return this.commands.length
  }

  /** 已应用位置，0 表示回到初始状态 */
  get position(): number {
    return this.cursor
  }

  canUndo(): boolean {
    return this.cursor > 0
  }

  canRedo(): boolean {
    return this.cursor < this.commands.length
  }

  /** 当前可撤销的动作名，没有则 null。给 UI 的 tooltip 用。 */
  peekUndoLabel(): string | null {
    if (!this.canUndo()) return null
    return this.commands[this.cursor - 1]?.label ?? null
  }

  peekRedoLabel(): string | null {
    if (!this.canRedo()) return null
    return this.commands[this.cursor]?.label ?? null
  }

  /**
   * 入栈一步编辑。
   * next 与当前文档等价时**不入栈**（避免空操作把 redo 链冲掉）。
   */
  push(next: ResumeDocument, options: PushOptions): void {
    const now = options.now ?? Date.now()
    if (documentsEqual(this.state, next)) return

    // 新编辑发生时分叉：丢弃 redo 尾部
    if (this.cursor < this.commands.length) {
      this.commands.length = this.cursor
    }

    const top = this.cursor > 0 ? this.commands[this.cursor - 1] : undefined
    const canMerge =
      top !== undefined &&
      options.mergeKey !== undefined &&
      top.mergeKey === options.mergeKey &&
      now - top.timestamp <= this.mergeWindowMs

    if (canMerge && top !== undefined) {
      // 合并：保留最初的 before，只推进 after
      top.after = next
      top.timestamp = now
      this.state = next
      return
    }

    this.sequence += 1
    const command: EditCommand = {
      id: `cmd_${this.sequence}`,
      label: options.label,
      before: this.state,
      after: next,
      timestamp: now,
    }
    if (options.mergeKey !== undefined) command.mergeKey = options.mergeKey

    this.commands.push(command)
    this.cursor = this.commands.length

    // 超限丢最早
    while (this.commands.length > this.maxDepth) {
      this.commands.shift()
      this.cursor -= 1
    }

    this.state = next
  }

  /** 撤销一步，返回撤销后的文档；无可撤销返回 null。 */
  undo(): ResumeDocument | null {
    if (!this.canUndo()) return null
    this.cursor -= 1
    const command = this.commands[this.cursor]
    if (!command) return null
    this.state = command.before
    return this.state
  }

  /** 重做一步，返回重做后的文档；无可重做返回 null。 */
  redo(): ResumeDocument | null {
    if (!this.canRedo()) return null
    const command = this.commands[this.cursor]
    if (!command) return null
    this.state = command.after
    this.cursor += 1
    return this.state
  }

  /**
   * 清空历史。MVP 策略：保存成功或重新打开文档时清空（PRD FR-DOC-004）。
   * 可选传入新文档（如重开后加载的文档），此时同时替换 current。
   */
  clear(next?: ResumeDocument): void {
    this.commands = []
    this.cursor = 0
    this.sequence = 0
    if (next !== undefined) this.state = next
  }

  /** 只读快照，给撤销菜单渲染用。 */
  history(): ReadonlyArray<Readonly<EditCommand>> {
    return this.commands.map((c) => ({ ...c }))
  }
}

/** 兜底导出：有些调用方只需要一个深拷贝，不必自己引 serialize。 */
export function snapshot(document: ResumeDocument): ResumeDocument {
  return cloneDocument(document)
}
