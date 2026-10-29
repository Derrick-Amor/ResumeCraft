/**
 * 图层树里的"非组件行"标识。
 *
 * 背景层不是文档组件（契约 §10.4：锁定/选中属 UI 态，不进文档模型），
 * 但用户要在图层树里点它、右栏要看它的属性 —— 所以给它一个**永远不会与
 * 组件 id 冲突**的哨兵值，选中态仍走 store.selectedId。
 */
export const BACKGROUND_LAYER_ID = '__background__'
