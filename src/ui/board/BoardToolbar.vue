/**
 * 画板模式工具栏（TC-008 / FR-EDT-003）
 * 背景上传/背景色/纹理、插图添加、背景模板保存与选用
 */

<script setup lang="ts">
import { ref } from 'vue'
import { RcButton, RcField } from '../controls'

const bgColor = ref('#ffffff')
const bgTexture = ref('none')
const emit = defineEmits<{
  uploadBackground: []
  addIllustration: []
  saveTemplate: []
  bgColorChange: [color: string]
  textureChange: [texture: string]
}>()

const textures = [
  { value: 'none', label: '无纹理' },
  { value: 'linen', label: '亚麻布' },
  { value: 'paper', label: '纸张' },
  { value: 'grid', label: '网格' },
  { value: 'dots', label: '点阵' },
]
</script>

<template>
  <div class="rc-board-toolbar">
    <div class="rc-board-toolbar__section">
      <span class="rc-board-toolbar__label">画板工具</span>
    </div>

    <div class="rc-board-toolbar__divider" />

    <!-- 背景设置 -->
    <RcField label="背景色" compact>
      <input
        v-model="bgColor"
        type="color"
        class="rc-board-toolbar__color"
        @change="emit('bgColorChange', bgColor)"
      />
    </RcField>

    <RcField label="纹理" compact>
      <select
        v-model="bgTexture"
        class="rc-board-toolbar__select"
        @change="emit('textureChange', bgTexture)"
      >
        <option v-for="t in textures" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
    </RcField>

    <div class="rc-board-toolbar__divider" />

    <!-- 操作 -->
    <RcButton variant="ghost" size="sm" @click="emit('uploadBackground')">上传背景</RcButton>
    <RcButton variant="ghost" size="sm" @click="emit('addIllustration')">添加插图</RcButton>
    <RcButton variant="ghost" size="sm" @click="emit('saveTemplate')">保存为背景模板</RcButton>
  </div>
</template>

<style scoped>
.rc-board-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--rc-color-bg-subtle);
  border-bottom: 1px solid var(--rc-color-border);
}

.rc-board-toolbar__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--rc-color-text-secondary);
  white-space: nowrap;
}

.rc-board-toolbar__divider {
  width: 1px;
  height: 20px;
  background: var(--rc-color-border);
}

.rc-board-toolbar__color {
  width: 32px;
  height: 28px;
  border: 1px solid var(--rc-color-border);
  border-radius: 4px;
  cursor: pointer;
  padding: 2px;
}

.rc-board-toolbar__select {
  padding: 4px 8px;
  border: 1px solid var(--rc-color-border);
  border-radius: 4px;
  font-size: 12px;
  background: var(--rc-color-bg);
}
</style>
