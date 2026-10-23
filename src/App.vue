<!--
  临时验证页（TC-002 B 段）：整页只挂 ElementProbe，用于证明 Element Plus 可在
  `pnpm dev` 里真实点选。TC-008 会用真实业务布局替换本文件内容。
-->
<script setup lang="ts">
import { APP_VERSION } from './version'
import ElementProbe from './ui/controls/ElementProbe.vue'
</script>

<template>
  <main>
    <h1>ResumeCraft</h1>
    <p>工程骨架（TC-002）。界面与业务逻辑由后续任务卡实现。</p>
    <p>版本：{{ APP_VERSION }}</p>
    <ElementProbe />
  </main>
</template>
