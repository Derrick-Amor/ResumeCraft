# DOCX 实开验证记录（TC-011）

> 本文件记录 DOCX 导出后在 Word/WPS 中实际打开的验证结果。
> 每次验证后更新状态。验证方法见 `docs/docx-mark-protocol.md` 与 `src/io/docx-style-map.md`。
> 导出命令：应用内「导出 DOCX」（内部 `exportDocx(doc, opts)`，契约 §7）。

## 验证清单

| 项 | 验证方法 | 期望结果 | 状态 |
|---|---|---|---|
| 中文 DOCX 可打开 | Word 2019/WPS 打开 | 无错误提示，内容完整 | ⬜ 待验证 |
| 英文 DOCX 可打开 | Word 2019/WPS 打开 | 无错误提示，内容完整 | ⬜ 待验证 |
| 页面设置保留 | 查看页面布局 | A4/页边距正确（对照 PageSettings） | ⬜ 待验证 |
| 格式保留 | 对照 `src/io/docx-style-map.md` | 粗体/斜体/字号/行距正确 | ⬜ 待验证 |
| 可编辑副本边界明示 | 导出前弹窗/提示 | 出现 `EDITABLE_COPY_NOTICE` 文案 | ⬜ 待验证 |
| 结构标记存在 | 解压 DOCX 查 `docProps/custom.xml` | 含 `data-rc-mark-version=1` 与 `data-rc-marks` JSON | ⬜ 待验证 |
| 书签存在 | 解压 DOCX 查 `word/document.xml` | 每个可见组件有 `rc1_*` 书签对 | ⬜ 待验证 |
| 标记往返一致 | 导出→重新导入→比对 | 组件结构/内容/样式一致（readMarks 比对 MarkManifest） | ⬜ 待验证 |
| 标记受损降级 | 用第三方工具另存后再导入 | 降级为第三方路径，无报错，文本不丢 | ⬜ 待验证 |

## 验证记录

### 2026-10-28（待 Amor 实开验证）

- 环境：待填（Word 版本 / WPS 版本）
- 样本：待填（导出的文件名）
- 结果：待填
- 备注：待填

---

> ⚠️ 此项验收需要**真人用 Word/WPS 实开检查**，AI 无法完成。Amor 请抽时间验证后更新本文件。
