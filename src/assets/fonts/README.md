# src/assets/fonts/ —— 字体资产

> 本目录当前**为空**。字体文件是二进制，需按 `docs/font-license.md` §4 的步骤子集化后放入。
> 在文件到位之前，`src/layout/font-loader.ts` 会把所有字体报告为 `failed`，
> 界面按契约 §4 提示「将使用替代字体」——这是正确的降级，不是缺陷。

## 放什么

```
src/assets/fonts/
├── woff2/          # 浏览器加载（子集化，体积小）
│   ├── rc-sans-400.woff2
│   ├── rc-sans-500.woff2
│   ├── rc-sans-700.woff2
│   ├── rc-serif-400.woff2
│   └── rc-serif-600.woff2
├── ttf/            # PDF 嵌入（pdf-lib 对 TTF 支持最稳）
│   └── 同名 5 个 .ttf
└── OFL.txt         # 思源系列许可证原文，必须随包分发
```

## 三条纪律

1. **不许放系统字体**（PingFang SC / 微软雅黑 / 宋体）——不可分发、不能嵌入 PDF。
2. **不许放未子集化的全量 CJK 字体**——单字重 4MB 以上，首屏扛不住。
3. **不许改字形**。只允许子集化；改名或改轮廓可能触发 OFL 的衍生作品命名限制（见 `docs/font-license.md` §3.2，待核验）。

## 找谁要清单

`docs/font-license.md` §5 是唯一登记表。放文件的人负责把 sha256 与子集范围填进去，
`font-loader.ts` 的 `license` 字段与这张表必须一致。
