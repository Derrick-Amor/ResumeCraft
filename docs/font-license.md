# 字体资产与许可证登记（TC-006）

> 用途：满足 FR-TPL-005「`license` 字段不可为空」。`src/layout/font-loader.ts` 会把 license 为空的
> 字体直接判为加载失败，所以这份登记表是代码的前置条件，不是文档摆设。
>
> **当前状态：`src/assets/fonts/` 为空，尚未纳入任何字体文件。** 本文是选型与核验清单，等 Amor 拍板后填实。

---

## 1. 硬性约束（不满足就不选）

| # | 约束 | 来源 |
|---|---|---|
| 1 | 可商用、可嵌入文档 | 商业产品，侵权风险不可接受 |
| 2 | 允许**嵌入 PDF 子集** | PDF 导出要嵌字体，部分商业字体明确禁止嵌入 |
| 3 | 同时具备 **TTF/OTF 两种可获取形态** | 见下方第 2 节 |
| 4 | 覆盖 GB2312 常用字 | 中文简历正文，缺字会出豆腐块 |
| 5 | 许可证文本可随包分发 | SIL OFL 要求保留版权与许可声明 |

## 2. 一个容易踩的技术约束

PDF 层用 `pdf-lib`，它对 **TrueType（.ttf）** 支持最好；而浏览器侧（Canvas 测量 / `@font-face`）
对 woff2 体积最友好。

**已知风险**：OTF（CFF 轮廓）在部分 Chrome 版本下 `@font-face` 渲染异常，PDF 嵌入支持也弱于 TTF。

> ⚠️ 上述两条属于**经验性结论，须在 TC-010 实测确认**【待核验】。
> 在实测之前，字体资产按「**TTF 为主、woff2 为网络分发形态**」准备，两条路都能走。

## 3. 已定方案：思源系列（2026-10-27 Amor 拍板）

**选定：思源黑体 / 思源宋体（Adobe Source Han = Google Noto CJK 同源），许可证 SIL OFL 1.1，免费商用、允许嵌入。**

不再考虑系统字体（PingFang SC / 微软雅黑）：它们**不可分发、不能嵌入 PDF**，跨机器渲染也不一致，
做模板字体等于埋雷。

### 3.1 P0 纳入的字重（刻意压到 5 个，控制体积）

| family | 文件形态 | 字重 | 用途 |
|---|---|---|---|
| `RcSans`（思源黑体 SC） | woff2 + ttf | 400 Regular | 简历正文 |
| `RcSans` | woff2 + ttf | 500 Medium | 姓名、小节标题 |
| `RcSans` | woff2 + ttf | 700 Bold | 强调、公司/项目名 |
| `RcSerif`（思源宋体 SC） | woff2 + ttf | 400 Regular | 「秩序 / 留白」类模板正文 |
| `RcSerif` | woff2 + ttf | 600 SemiBold | 同上的标题 |

> 共享同一个 `family` 名、用不同 `weight` 区分，是为了让 `@font-face` 的 `font-weight` 正常回退，
> 避免一屏出现两次网络请求。**不要给每个字重起不同 family 名**。

### 3.2 许可证注意事项【待核验】

OFL 1.1 有两条容易被忽略的要求，正式纳入前需读原文确认并登记：

1. **保留版权声明与许可文本**——随包分发时必须带 `OFL.txt`
2. **衍生作品命名限制**——若对字体做了子集化以外的修改，可能不能用原保留名称

> 仅做**子集化（subsetting）**通常被视为允许的行为，但这一判断**未经法律核验**，按【待核验】处理。
> 保险做法：子集化后仍保留原名与 OFL.txt，不做任何字形修改。

## 4. 落地清单（文件我自己下不了，命令给全）

> **为什么我没直接下**：当前环境里 shell 进程无法写项目目录（ACL 拒绝），只能通过编辑器工具写文本。
> 二进制字体文件必须由你（或放权后的一次运行）下载。下面命令按顺序执行即可。

### 4.1 取字体源文件

```bash
# 思源黑体 / 思源宋体（Adobe 官方发布，OFL）
# 从 https://github.com/adobe-fonts/source-han-sans/releases
#     https://github.com/adobe-fonts/source-han-serif/releases
# 下 SC（简体）子集的 OTF 或 TTF，放一份到临时目录
```

### 4.2 子集化（体积从 ~9MB 压到 ~1MB 量级）

```bash
pip install fonttools brotli
# 只保留 GB2312 常用字 + 简历里会用到的标点与西文
pyftsubset SourceHanSansSC-Regular.otf \
  --text-file=charset.txt \
  --flavor=woff2 \
  --output-file=rc-sans-400.woff2
```

`charset.txt` 建议直接用项目里的真实简历样本 + GB2312 一级字表合并，**不要全量 2 万+ 汉字**，
否则单字重仍在 4MB 以上。

### 4.3 落到项目

```
src/assets/fonts/
├── woff2/  rc-sans-400.woff2  rc-sans-500.woff2  rc-sans-700.woff2
│           rc-serif-400.woff2 rc-serif-600.woff2
├── ttf/    同名 .ttf（PDF 嵌入用，pdf-lib 对 TTF 支持最稳）
└── OFL.txt 思源系列的许可证原文
```

- [ ] 放入 5 个 woff2 + 5 个 ttf
- [ ] 放 `OFL.txt`
- [ ] 在本文 §5 登记：文件名、字重、子集范围、sha256、许可证
- [ ] `font-loader.ts` 的 `FontDescriptor.license` 填 `SIL OFL 1.1`
- [ ] 首屏只加载**当前模板用到**的字重，不做全量预加载

---

## 5. 已纳入字体登记表

| family | 文件 | 字重 | 子集范围 | sha256 | 许可证 | 核验状态 |
|---|---|---|---|---|---|---|
| RcSans | 待放入 | 400 | — | — | SIL OFL 1.1 | **待纳入** |
| RcSans | 待放入 | 500 | — | — | SIL OFL 1.1 | **待纳入** |
| RcSans | 待放入 | 700 | — | — | SIL OFL 1.1 | **待纳入** |
| RcSerif | 待放入 | 400 | — | — | SIL OFL 1.1 | **待纳入** |
| RcSerif | 待放入 | 600 | — | — | SIL OFL 1.1 | **待纳入** |

---

## 6. 为什么现在就可以写代码

`font-loader.ts` 不依赖字体文件存在：它接收 `FontDescriptor[]`，按条加载并逐条报告
`loaded / failed / unsupported`。没有文件时就是全部 `failed`，界面会按契约 §4 显示
「字体加载失败，预览与导出将使用替代字体」——**这是正确行为，不是缺陷**。

真正的门槛在「选哪套字体、许可证怎么登记」，那需要 Amor 决定，我不替你选。
