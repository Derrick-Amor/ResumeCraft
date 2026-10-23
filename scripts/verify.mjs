#!/usr/bin/env node
/**
 * 卡级验证脚本占位实现（TC-002 建立，后续卡填充真实验证）。
 *
 * 设计原则：占位脚本必须把「未实现」打到 stdout，且退出码为 0。
 * 只打印一句「通过」或静默 exit 0 会让空跑被误判为真验收，这里刻意反过来。
 *
 * 用法：node scripts/verify.mjs <layout|export|import>
 * 由 package.json 的 verify:layout / verify:export / verify:import 调用。
 */

const PLACEHOLDERS = {
  layout: {
    cards: 'TC-006 / TC-007',
    owner: 'fe-layout',
    pending: '布局确定性快照、分页边界、三阶段溢出',
  },
  export: {
    cards: 'TC-010 / TC-011',
    owner: 'fe-io',
    pending: 'PDF / DOCX 导出、中文字体嵌入、回读冒烟',
  },
  import: {
    cards: 'TC-012',
    owner: 'fe-io',
    pending: 'DOCX / PDF 导入、分层承诺分派、失败保护',
  },
}

const key = process.argv[2]

if (!key || !Object.hasOwn(PLACEHOLDERS, key)) {
  console.error(`用法：node scripts/verify.mjs <${Object.keys(PLACEHOLDERS).join('|')}>`)
  process.exit(2)
}

const target = PLACEHOLDERS[key]

console.log(`PLACEHOLDER: ${target.cards} 未实现`)
console.log(`  verify:${key} 由 ${target.owner} 在对应卡实现，待验证内容：${target.pending}`)
console.log('  本次退出码 0 仅表示脚本链路可执行，不代表验证通过。')
process.exit(0)
