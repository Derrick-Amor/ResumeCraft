<!--
  ResumeCraft 主入口
  三层样式按「值 → 结构 → 材质」引入；外壳结构按设计稿 DOM（.app > .topbar / .main / .statusbar）。
-->
<script setup lang="ts">
import AppShell from './ui/shell/AppShell.vue'
</script>

<template>
  <AppShell />
</template>

<style>
/*
 * 引入顺序不可换：
 *   tokens  给值（唯一事实源）
 *   fonts   给字形（本地 @font-face，不依赖网络）
 *   app     给结构（设计稿 1414 行的逐条移植）
 *   glass   给材质（靠覆盖 app.css 的 background 生效 —— 放前面等于没写）
 *
 * 基底重置（box-sizing / body 字体与底色）已由 app.css §0 提供，这里不再重复，
 * 否则两处 reset 会在排查样式时互相甩锅。
 */
@import './design/tokens.css';
@import './design/fonts.css';
@import './design/app.css';
@import './design/glass.css';

#app {
  height: 100%;
}
</style>
