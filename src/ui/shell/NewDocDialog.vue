<script setup lang="ts">
/**
 * 新建简历入口（TC-008 / FR-DOC-001）
 * 空白简历 / 基于模板 / 空白画板
 * 示例内容与用户内容明确区分
 *
 * 注意：文件头注释必须写在 `<script setup>` 内部。
 * 写在 SFC 顶层会被 Prettier 按 HTML 注释重排，压成一行并断在句子中间（已被压坏过一次）。
 */
import { RcButton } from '../controls'

export type NewDocType = 'blank' | 'template' | 'board'

const emit = defineEmits<{
  create: [type: NewDocType]
  close: []
}>()

const options = [
  {
    type: 'blank' as const,
    icon: '📄',
    title: '空白简历',
    desc: '从空白开始，手动添加组件',
  },
  {
    type: 'template' as const,
    icon: '📋',
    title: '基于模板',
    desc: '选择预设模板，快速开始',
  },
  {
    type: 'board' as const,
    icon: '🎨',
    title: '空白画板',
    desc: '自由排版，自定义背景',
  },
]
</script>

<template>
  <Teleport to="body">
    <div class="rc-new-dialog__overlay" @click.self="emit('close')">
      <div class="rc-new-dialog">
        <h3 class="rc-new-dialog__title">新建简历</h3>
        <p class="rc-new-dialog__desc">选择一种方式开始创建你的简历</p>

        <div class="rc-new-dialog__options">
          <button
            v-for="opt in options"
            :key="opt.type"
            class="rc-new-dialog__option"
            @click="emit('create', opt.type)"
          >
            <span class="rc-new-dialog__option-icon">{{ opt.icon }}</span>
            <div>
              <div class="rc-new-dialog__option-title">{{ opt.title }}</div>
              <div class="rc-new-dialog__option-desc">{{ opt.desc }}</div>
            </div>
          </button>
        </div>

        <div class="rc-new-dialog__footer">
          <RcButton variant="ghost" size="sm" @click="emit('close')">取消</RcButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rc-new-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--rc-color-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.rc-new-dialog {
  background: var(--rc-color-bg-elevated);
  border-radius: 12px;
  padding: 28px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
}

.rc-new-dialog__title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--rc-color-text-primary);
}

.rc-new-dialog__desc {
  font-size: 13px;
  color: var(--rc-color-text-secondary);
  margin-bottom: 20px;
}

.rc-new-dialog__options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rc-new-dialog__option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--rc-color-border);
  border-radius: 10px;
  background: var(--rc-color-bg);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.rc-new-dialog__option:hover {
  border-color: var(--rc-color-primary);
  background: var(--rc-color-bg-hover);
  transform: translateY(-1px);
}

.rc-new-dialog__option-icon {
  font-size: 28px;
  width: 36px;
  text-align: center;
}

.rc-new-dialog__option-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--rc-color-text-primary);
}

.rc-new-dialog__option-desc {
  font-size: 12px;
  color: var(--rc-color-text-secondary);
  margin-top: 2px;
}

.rc-new-dialog__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
