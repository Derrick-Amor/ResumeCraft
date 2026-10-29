/**
 * 组件拖拽排序（TC-008 / FR-EDT-004）
 * 拖拽排序（拖后跑布局校验）、插入位置提示线
 */

export interface DragItem {
  id: string
  order: number
}

export interface DropIndicator {
  visible: boolean
  top: number
  beforeId: string | null
}

import { ref, readonly } from 'vue'

const dragState = ref({
  draggingId: null as string | null,
  dragOverId: null as string | null,
  dropPosition: 'before' as 'before' | 'after',
})

const indicator = ref<DropIndicator>({
  visible: false,
  top: 0,
  beforeId: null,
})

export function useDragSort() {
  function onDragStart(id: string) {
    dragState.value.draggingId = id
  }

  function onDragOver(id: string, event: DragEvent, element: HTMLElement) {
    event.preventDefault()
    const rect = element.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    dragState.value.dragOverId = id
    dragState.value.dropPosition = event.clientY < midY ? 'before' : 'after'

    indicator.value = {
      visible: true,
      top: dragState.value.dropPosition === 'before' ? rect.top - 2 : rect.bottom + 2,
      beforeId: dragState.value.dropPosition === 'before' ? id : null,
    }
  }

  function onDrop(items: DragItem[]): DragItem[] | null {
    const { draggingId, dragOverId, dropPosition } = dragState.value
    if (!draggingId || !dragOverId || draggingId === dragOverId) {
      reset()
      return null
    }

    const fromIndex = items.findIndex((i) => i.id === draggingId)
    const toIndex = items.findIndex((i) => i.id === dragOverId)
    if (fromIndex === -1 || toIndex === -1) {
      reset()
      return null
    }

    // 重新排序
    const result = [...items]
    const [moved] = result.splice(fromIndex, 1)
    const insertIndex = dropPosition === 'before' ? toIndex : toIndex + 1
    result.splice(insertIndex > fromIndex ? insertIndex - 1 : insertIndex, 0, moved!)

    // 重算 order
    result.forEach((item, i) => {
      item.order = i
    })

    reset()
    return result
  }

  function reset() {
    dragState.value = { draggingId: null, dragOverId: null, dropPosition: 'before' }
    indicator.value = { visible: false, top: 0, beforeId: null }
  }

  return {
    dragState: readonly(dragState),
    indicator: readonly(indicator),
    onDragStart,
    onDragOver,
    onDrop,
    reset,
  }
}
