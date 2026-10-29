# UI 保真度审计清单（数值级 · 可判定）

> **状态：清单就绪，尚未执行审计。**
> 本文件当前只定义「什么叫完全按设计稿实现」以及「怎么量」。不含通过/不通过结论。
> 执行时机由主控在还原方案 A→D 段（及 E 段）完成后通知。
>
> 建立于：2026-10-29 · 建立人：QA 严过关
> 依据：Amor 裁决「产品 UI 必须与定版设计稿完全一致，PRD 界面文字描述降级为参考」

---

## 0. 事实源与判定口径

| 项 | 值 |
|---|---|
| 唯一事实源 | `docs/design/mockups/figma/tokens.css`（179 行）→ `app.css`（1414 行）→ `glass.css`（300 行） |
| 结构事实源 | `docs/design/mockups/figma/01-editor.html`（主编辑器屏 DOM） |
| **不是**事实源 | `src/ui/**`（自建骨架）、`docs/` 里的 PRD 界面文字描述（已降级为参考）、`src/design/app.css`（截至本文件建立时尚未落盘） |
| 视口口径 | 1440 × 900，`deviceScaleFactor = 1`（保证 1 CSS px = 1 图片 px，像素量测才成立） |
| 生效口径 | **三层叠加后的计算值**，不是「某一条声明」。`glass.css` 在 `app.css` 之后加载，大量属性是覆盖关系（见 §5 第 1、4 条） |

两条判定铁律：

1. **只认计算值。** 例：`.compcard` 在 `app.css:333-343` 是横向布局，在 `glass.css:199-206` 被改成纵向 + `min-height:104px`。若只读 `app.css` 会得出错误期望。
2. **不许写「风格一致」。** 本清单每一条都能被回答「是 / 否」。答不上来的，说明期望值没写清楚，回来改清单，不许放宽。

---

## 1. 取图命令（本文件所有「像素」类检查点的唯一取图方式）

脚本：`scripts/ui-shot.mjs`（已实测跑通，见 §1.1）

```bash
# ① 截设计稿主编辑器屏
node scripts/ui-shot.mjs \
  --url "file:///C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/design/mockups/figma/01-editor.html" \
  --out "$TEMP/mockup-01.png"

# ② 截应用（先把 vite dev server 起在 5199）
node scripts/ui-shot.mjs --url "http://localhost:5199" --out "$TEMP/app-01.png"
```

参数：`--url`（必填，`file://` 或本地路径都行）、`--out`（缺省 `$TEMP/ui-shot-<时间戳>.png`）、`--width`（默认 1440）、`--height`（默认 900）、`--budget`（默认 3000，virtual-time）、`--browser`（强制指定可执行文件）、`--help`。

脚本内已固定的三件关键事，改动前须同步本文件：

| 设置 | 为什么不能省 |
|---|---|
| `--headless=new` | 旧 headless 不支持 `backdrop-filter`，会把材质层渲染成不透明 → 材质类检查点全部假阴性 |
| `--virtual-time-budget=3000` | 设计稿靠 `icons.js` 在 `DOMContentLoaded` 注入 `data-ic` → SVG。不等就会截到空图标 |
| `--run-all-compositor-stages-before-draw` | 保证玻璃层合成完成后再落盘，避免偶发半成品 |
| `--force-device-scale-factor=1` | 否则 125% 缩放的 Windows 会出 1800×1125 图，像素量测全部错位 |

`body` 有 860px 的 `min-height` 兜底，1440×900 下不会出现纵向滚动条被 `--hide-scrollbars` 吃掉布局的偏差。

### 1.1 脚本实测记录（2026-10-29）

| 项 | 值 |
|---|---|
| 命令 | `node scripts/ui-shot.mjs --url "file:///C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/design/mockups/figma/01-editor.html" --out "$TEMP/mockup-01.png"` |
| 浏览器 | `C:/Program Files/Google/Chrome/Application/chrome.exe` |
| 输出绝对路径 | `C:\Users\DB712~1.AMO\AppData\Local\Temp\mockup-01.png` |
| 文件字节数 | **377,268 字节（368.4 KB）** |
| PNG 实际像素 | **1440 × 900**（读取 IHDR 校验，`--force-device-scale-factor=1` 生效） |
| 人工确认 | 图标已注入（顶栏文件/撤销/重做/下载图标齐全）；左栏组件卡为**两列网格**（`.compgrid` 生效）；白色 A4 纸面带完整文字；右栏表单与开关正常；状态栏左下「已保存于 10:42」、右下「● 3 处溢出」 |

> 这张图可作为「设计稿基准图」留档。后续 app 截图必须同口径（1440×900）才可比。

---

## 2. 判定标记与执行前置校验

### 2.1 判定标记约定

| 标记 | 含义 | 做法 |
|---|---|---|
| `静态` | 读声明即可判定 | 在 `src/design/{tokens,app,glass}.css` 里 grep 该声明，比对值是否一字不差 |
| `像素` | 必须量渲染结果 | 用 §1 的两张同尺寸截图，按条目写明的元素与量法测量；或 `getComputedStyle` / `getBoundingClientRect` |
| `采样` | 颜色判定 | 用吸管工具在条目写明的坐标取单像素 RGB，与期望值比对 |

### 2.2 容差

几何量 ±1px（抗锯齿/亚像素）；颜色 RGB 每通道 ±3（抗抖动与色彩管理）。超出即判不通过。

### 2.3 前置闸门（P 组 · 5 条 · 不做完不许开跑 §3）

这 5 条是**总闸**：几秒的 grep 就能跑完，但它们决定后面 43 条有没有意义。**任何一条不满足 → 整体判 `BLOCKED`，不要往下判。** 理由很直白：43 条里有大量期望值指向 `--rc-accent` / `--rc-s*` / `--rc-r-ctl` 这类**设计稿词表**的 token，若词表根本没换，这些条目会全部指向不存在的变量而"看起来通过"——那是最坏的一种假阳性。

| # | 闸门 | 判定命令 | 通过条件 | 不满足的后果 |
|---|---|---|---|---|
| P1 | `tokens.css` 已换设计稿词表 | `grep -c -- '--rc-accent' src/design/tokens.css` | **≥1**，且 `grep -n -- '--rc-accent:'` 得到 `#2f76d2` | 设计稿词表没进来 → A/B/E/F 四组的颜色与尺寸期望值全部指向不存在的 token，判定无效 |
| P2 | 旧词表只剩兼容别名 | **锚定行首声明**（不用裸通配）：<br>`grep -E '^\s*--rc-color-' src/design/tokens.css \| wc -l`<br>再逐个查悬空：`grep -oE -- '--rc-color-[a-z0-9-]+' src/design/element-plus-bridge.css \| sort -u`，逐个 `grep -q -- "$n:" tokens.css` | 声明数 **≥26**，且**覆盖桥接层引用的全部 26 个名字（零悬空）**；多出的声明不判缺陷 | 旧词表仍是主词表 → `src/ui/**` 引用的仍是旧名，产品 UI 永远读不到设计稿数值（这正是还原方案 §0 根因第 1 条） |
| P3 | `app.css` 已落盘 | `[ -f src/design/app.css ] && grep -c '\.topbar' src/design/app.css \|\| echo 0` | 输出**纯数字 ≥1**（文件缺失时输出 `0`，不报错，便于复跑与自动化） | 结构与组件样式整层缺失 → 43 条里全部「静态」类检查点无文件可读 |
| P4 | `glass.css` 已换成设计稿版 | `grep -c 'compgrid\|rcBreath' src/design/glass.css` | **≥2** | 旧 151 行分叉版这两个关键字都没有（见 §2.4 实测）。材质层缺失 → C3/C4/C5/G5 与 I1–I6 的期望值全部落空 |
| P5 | 三层引入顺序 | 读 `src/App.vue` 的 `@import` | 必须依次 `tokens → fonts → app → glass`（`ui-restore-plan.md` §2.4） | `glass.css` 靠覆盖 `app.css` 生效，放前面等于没写。**顺序错 → C4 / C5 / G5 / I3 直接判 FAIL**，不必再量 |

另有两条**同性质校验**，为避免重复不列进本表，各自落在正式判定项里：

- `.paper` 计算 `padding` 四边必须全为 `0px` → 见 **`D4`**（`ui-restore-plan.md` §5.3 + §8.3）
- `src/design/tokens.css` 不得残留 `@import url('https://fonts.googleapis.com/…')` → 见 **§4 偏差 3**（方案 §2.1 第 1 条明令删除）

**P2 补强（QA 追加，防空判）**：P2 原表述「命中全部落在桥接块内」在命中数为 **0** 时会**空判通过**——把旧名全删掉、桥接块却不加，P2 会显示 PASS，而 EP 组件此时已静默失效。症状是 `ElementProbe` **静默降级**、无任何报错，属契约 §11.4 明令禁止的情形，闸门必须拦住。

- **26 这个数由 QA 自行复验，不作为主控口径硬编码。** 复跑 `grep -oE -- '--rc-color-[a-z0-9-]+' src/design/element-plus-bridge.css | sort -u | wc -l`，**以实测为准**；若与 26 不符，改本行期望值并注明修订日期，不为凑数迁就。
- **计数一律锚定行首声明**：`grep -E '^\s*--rc-color-' src/design/tokens.css | wc -l`。**不要用裸通配** `grep -o -- '--rc-color-[a-z0-9-]*'` —— 注释里出现「`--rc-color-*`」这种文字会被算成一条空名，把 28 计成 29（实测踩过，见 §2.7）。
- **判据（2026-10-29 修订为「超集」口径，主控裁决）**：`tokens.css` 内 `--rc-color-*` 声明数 **≥ 26**，且**必须覆盖桥接层引用的全部 26 个名字（零悬空）**。**多出的声明不判缺陷——超集无害。**
- **真正要拦的两种**：① 声明数 < 26（桥接块漏建或漏项）；② 存在悬空名（桥接层引用但未定义）。
- **实测为 28 条**（22 条 `var()` 别名 + 6 条实算 hex），多出的 2 条是 `--rc-color-primary-hover` / `--rc-color-primary-active`，桥接层未引用但方案 §2.1 示例本身即列，属合法超集。详见 §2.4 快照 2 的「P2 明细」。
- **条数对得上但名字错位照样会静默失效**，所以「零悬空」是比条数更关键的硬条件。
- 6 条派生色的实算口径见 **§2.5**，可直接复算复核；判定规则（含反例）亦在 §2.5 末尾。

### 2.4 闸门实测状态（**记录即证据**）

> 铁律：凡"某文件已就位 / 已替换"这类**关于文件状态**的判断，一律先跑命令、把输出贴进来，**不许凭行数或印象下结论**。本节就是这条规矩的样板。

#### 快照 1 · 2026-10-29（A 段落盘前）→ **5 条全 FAIL**

| # | 命令 | 实测输出 | 判定 |
|---|---|---|---|
| P1 | `grep -c -- '--rc-accent' src/design/tokens.css` | **0** | **FAIL** |
| P2 | `grep -n -- '--rc-color-' src/design/tokens.css` | **65 处，分布在第 40–331 行**；其中 **63 处是行首声明**（形如 `--rc-color-bg-page: #edf1f7;`），另有 2 处在注释里。**文件中不存在「EP 桥接兼容别名」块** | **FAIL** |
| P3 | `[ -f src/design/app.css ] && grep -c '\.topbar' src/design/app.css \|\| echo 0` | **`0`**（文件不存在） | **FAIL** |
| P4 | `grep -c 'compgrid\|rcBreath' src/design/glass.css` | **0**（文件 151 行，仍是分叉旧版） | **FAIL** |
| P5 | `grep -nE "@import\|<style" src/App.vue` | 只有 `15:@import './design/tokens.css';` —— 仅引入 tokens，`fonts.css` / `app.css` / `glass.css` **均未引入** | **FAIL** |

**勘误（2026-10-29）**：本文件初版曾把 `tokens.css` 记为「335 行，新词表已进」。**该表述错误**——行数从旧版增加到 335 是因为期间往里补了几个缺失变量（`--rc-color-text-primary` 等），**词表并未更换**：文件头仍是 `版本：v3「蓝玻璃 + 白纸」`，`--rc-accent` 出现 **0** 次，`--rc-color-` 出现 **65** 次。行数变了不等于内容对了；此类判断今后一律以本节的命令输出为准。

#### 快照 2 · 2026-10-29（A 段落盘后）→ **5 条全 PASS**

| # | 命令 | 实测输出 | 判定 |
|---|---|---|---|
| P1 | `grep -c -- '--rc-accent' src/design/tokens.css`<br>`grep -n -- '--rc-accent:' src/design/tokens.css` | **13 次命中**；`41:--rc-accent: #2f76d2;` ✅ 值正确 | **PASS** |
| P2 | 见下方「P2 明细」 | 28 条声明全部位于 §18 块（行 183–218）；桥接层 26 个旧名**零悬空**；6 条派生色**逐值等于 §2.5 实算值** | **PASS** |
| P3 | `[ -f src/design/app.css ] && grep -c '\.topbar' src/design/app.css \|\| echo 0` | **`5`**（`app.css` 共 1341 行，已落盘） | **PASS** |
| P4 | `grep -c 'compgrid\|rcBreath' src/design/glass.css` | **`3`**（`glass.css` 共 300 行，已换设计稿版） | **PASS** |
| P5 | `grep -nE "@import" src/App.vue` | 行 24–27 依次 `tokens` → `fonts` → `app` → `glass` ✅ 顺序正确 | **PASS** |

**P2 明细（实测，含一处与预期不符已按实测修正）**：

| 项 | 判定要求 | 实测 | 结论 |
|---|---|---|---|
| `tokens.css` 内 `--rc-color-*` 声明数 | **≥ 26**（超集无害） | **28**（锚定行首声明计数；22 条 `var()` 别名 + 6 条实算 hex） | ✅ |
| 桥接层 26 个旧名覆盖 | **零悬空**（硬条件） | 全部有定义，悬空 **0** | ✅ |
| 声明是否都在 §18 块内 | 块外 0 条 | 行 **183–218**，全在块内；块外 **0** | ✅ |
| 多出的 2 条 | 不判缺陷 | `--rc-color-primary-hover`（184）、`--rc-color-primary-active`（185），值 `var(--rc-accent-hover)` / `var(--rc-accent-active)`，方案 §2.1 示例自带 | ✅ 合法超集 |
| 6 条派生色 | 逐值等于 §2.5 实算值 | 行 186–191 逐值相符，且每条带逐通道算式注释 | ✅ |
| 旧词表是否清干净 | 无散落 | 原 63 处旧声明已清空 | ✅ |

> **P2 计数命令修订（2026-10-29）**：初版用裸通配 `grep -o -- '--rc-color-[a-z0-9-]*' | sort -u | wc -l`，它会把**注释里的文字**（§18 块注释曾写「旧名 `--rc-color-*`」）算成一条空名 `--rc-color-`，把 28 计成 29。已改为锚定行首声明 `grep -E '^\s*--rc-color-' | wc -l`。
> 复跑现状：**锚定版 28、裸通配 28** —— 因为工程师已把那句注释改写掉了。**两者暂时相等不代表裸通配可用**：任何人以后写一句含 `--rc-color-` 的注释，裸通配就会再次漂移。判据必须锚定语法位置（§2.7）。

> **P2 判据修订（2026-10-29，主控裁决）**：初版写「应恰为 26 条」，按此判定会把合法的 28 条判成 FAIL —— **是判据错，不是实现错**。已改为「**≥26 且覆盖桥接层全部 26 个引用名（零悬空）；多出的声明不判缺陷**」。真正要拦的是：声明数 < 26（块漏建/漏项）、有悬空名（引用未定义）。

**桥接层全量覆盖（QA 复验，含非 color 名）**：`element-plus-bridge.css` 共引用 **49** 个旧名 —— `--rc-color-*` **26** + 非 color **23**（`--rc-duration` 2、`--rc-ease` 1、`--rc-font` 4、`--rc-radius` 5、`--rc-shadow` 4、`--rc-size` 2、`--rc-space` 5）。逐个比对 `tokens.css`：**悬空 0 个**。这 23 个非 color 旧名同样会静默失效，P2 判定时一并核。

**配套前置项（非 P 组闸门，但同属开跑前必查）**：

| 项 | 命令 | 实测 | 判定 |
|---|---|---|---|
| `.paper` 计算 `padding`（`D4`） | `grep -A12 '^\.paper {' src/design/app.css` | 行 558：`padding: 0;` ✅（并带注释说明为何不能用设计稿的 `54px 60px 44px`） | **PASS** |
| 无网络字体导入（§4 偏差 3） | `grep -n "fonts.googleapis" src/design/tokens.css` | 无 | **PASS** |
| 新词表已可用 | `grep -c -- '--rc-text-2:' / '--rc-s1:' / '--rc-r-ctl:' / '--rc-fz-sm:' / '--rc-left-w:' / '--rc-paper-accent:'` | 各 **1** 条，全部有定义 | **PASS** |

### 2.5 派生色验算表（P2 的 6 条 hex 怎么复核）

**算式（已由主控写死进方案 §2.1，本清单与方案口径必须一致）**：

```
light-N  = round(c + (255 - c) × N%)      // N = 30 / 50 / 70 / 80 / 90
dark-2   = round(c × (1 - 20%))           // 即 20% 混黑
round    = Math.round                     //  .5 进位（向上），不是银行家舍入
```

基准：`#2f76d2` = `rgb(47, 118, 210)`，逐通道独立计算。

> **舍入规则为什么必须写死**：本次派生色正好在 **3 处**落在 `.5` 上——`light-5` 的 G=`186.5`、B=`232.5`，`light-9` 的 B=`250.5`。用 `Math.round`（`.5` 进位）与用 Python `round()`（银行家舍入，`.5` 取偶）会得出**两个不同结果**：

| 档位 | `Math.round`（**采用**） | 银行家舍入（✗ 不用） |
|---|---|---|
| `light-3` | `#6d9fe0` | `#6d9fe0`（同） |
| **`light-5`** | **`#97bbe9`** | `#97bae8` ← 差 |
| `light-7` | `#c1d6f2` | `#c1d6f2`（同） |
| `light-8` | `#d5e4f6` | `#d5e4f6`（同） |
| **`light-9`** | **`#eaf1fb`** | `#eaf1fa` ← 差 |
| `dark-2` | `#265ea8` | `#265ea8`（同） |

实现是 TypeScript，**以 `Math.round` 为准**。主控独立复算时曾用 Python 得到 `#97bae8` / `#eaf1fa`，差异只出在这 3 处 `.5`，其余 4 档一致——这也是把规则写进方案的原因，避免出现第三个版本。

| 档位 | 混色 | 逐通道算式 | **实算期望值（Math.round）** |
|---|---|---|---|
| `light-3` | 30% 白 | `47+208×.3=109.4→109`；`118+137×.3=159.1→159`；`210+45×.3=223.5→224` | **`#6d9fe0`** |
| `light-5` | 50% 白 | `47+104=151`；`118+68.5→187`（.5 进位）；`210+22.5→233`（.5 进位） | **`#97bbe9`** |
| `light-7` | 70% 白 | `47+145.6→193`；`118+95.9→214`；`210+31.5→242` | **`#c1d6f2`** |
| `light-8` | 80% 白 | `47+166.4→213`；`118+109.6→228`；`210+36=246` | **`#d5e4f6`** |
| `light-9` | 90% 白 | `47+187.2→234`；`118+123.3→241`；`210+40.5→251`（.5 进位） | **`#eaf1fb`** |
| `dark-2` | 20% 黑 | `47×.8=37.6→38`；`118×.8=94.4→94`；`210×.8=168` | **`#265ea8`** |

**判定规则（§5.10 裁决 3 已生效，不再 BLOCKED）**

`src/design/tokens.css` 中这 6 条必须**逐值等于**上表实算值：

- **6 条全部等值 → P2 该子项 PASS。**
- **出现旧值中任一个 → FAIL**（旧值：`#5a92dc` / `#86aeda` / `#b2cbea` / `#c8dbf0` / `#dee9f6` / `#26609f`）。
- **出现第三种值（既非实算值也非旧值）→ FAIL**，并立即上报——说明有人用了第三个公式或手工调过色。

**⚠ 关于旧值**：`ui-restore-plan.md` §2.1 初版的示例块写的就是上面那 6 个旧值，**与实算值全部对不上**。该示例块已由主控于 2026-10-29 整体替换为本节的算式与实算表。**照抄旧示例值是「最守规矩」却违反方案同一条要求（"必须实算，不得目测"）的行为**，故明文列为反例。

**不依赖算式的证伪依据**（若有人质疑实算值，用这条即可，无需争论公式）：向白色混合时，混白比例越大，三通道必须**单调不减**。旧值的 B 通道为 `220 → 218 → 234 → 240 → 246`（light-3→light-9），**light-5 比 light-3 更暗**。任何"同一基色 + 递增混白"都不可能产生该序列，故旧值不可能由 `#2f76d2` 算出。

### 2.5.1 证伪性前置（**方法族第 0 条** · 2026-10-29 主控提为总规矩）

> 任何判定在写出来之前，先回答：**这个量法能不能证伪我要判的东西？**
> 不能证伪的，不是判据，是**旁证**。旁证可以出现在报告里，但**不能进 PASS/FAIL**。

**编号说明**：本节编号取 §2.6 之前，是因为它在方法链上**先于** §2.6/§2.7/§2.10；不整体重编号是为了不打断各章既有的交叉引用（`§2.6` `§2.7` 被引用了十余处）。

**三者是递进关系，不是并列**：

| 节 | 管什么 | 层级 |
|---|---|---|
| **§2.5.1（本节）** | 这个量法**配不配**当判据 | **前提** |
| §2.6 | 数据来源必须是直接证据 | 方法 |
| §2.7 | 判据必须锚定语法位置 | 方法 |
| §2.10 | 判据改了要做反向自检 | 校验 |

**当天两个实例（都进了本节，作为判例）**：

| 判据 | 想判的东西 | 能证伪吗 | 结论 |
|---|---|---|---|
| `getComputedStyle().fontFamily` | 字体**是否已加载** | **不能**——它返回声明值的解析结果，字体没下载时它也照样显示 `Inter` | **只能当"token 生效"的旁证**，判字体必须用 `document.fonts`（§2.6.0） |
| 裸通配 `grep -o '--rc-color-[a-z0-9-]*'` | **声明了几条** | **不能**——会把注释里的 `--rc-color-*` 也算一条，28 数成 29 | 必须锚行首声明 `grep -E '^\s*--rc-color-'` 才成立（§2.7） |

**推论：状态字段会撒谎，外部信号不会。**

`document.fonts[i].status` 是浏览器自己报的状态，它有说谎的余地；而「`.woff2` 发出过几个请求、状态码多少」是**网络层的客观事实**，撒不了谎。所以字体判定我用了两条独立证据交叉验证：`status === 'loaded'` **且** 有实际字体请求。

这条可推广：**凡能用外部可观测信号（网络请求、文件字节、渲染像素）交叉验证的，就不要只信对象自报的状态。**


### 2.6 数据来源规矩（**任何数字都受此约束**）

本清单、以及最终交付的审计报告里出现的**每一个数字**，只有两种合法来源：

1. **我在当次会话里亲手跑出的命令输出**（粘贴原文，不加工）；
2. **我在当次会话里亲手测量或实算的结果**（截图测量、`getComputedStyle`、逐通道算式）。

**除此以外一律不采信**，包括：主控转述的、工程师自报的、历史报告里写着的、方案文档里印着的。若因时效原因必须引用，须显式标注「**转述，未复验**」，且**不得作为判定依据**。

已发生的事例（立此存照）：

- **2026-10-29** 工程师两份报告分别写 `554` 与 `548` 条测试，两者相差 6 条，主控已要求当场跑 `pnpm test` 贴原始输出对账。这类漂移正是本规矩要防的。
- **2026-10-29** 本文件初版把 `tokens.css` 记为「新词表已进」，实为凭行数推断，见上方勘误。
- **2026-10-29** `ui-restore-plan.md` §2.1 的 6 个派生色与 `#2f76d2` 实算不符，见 §5.10——**文档里印着的数字同样可能是错的**。

配套动作：

- 收尾报告里的测试数、四门结果，**以我当次实测输出为准**，写法见 §7 的「四门原始输出」表。
- 判定类数字（尺寸、色值、对比度）必须能复算，算式或命令要随结论一起给出。

### 2.6.0 `getComputedStyle` 能证明什么、不能证明什么（2026-10-29 补 · **假阳性事故**）

| 能证明 | **不能证明** |
|---|---|
| token 被解析、层叠结果正确 | **字体文件是否已加载** |
| 元素最终计算出的尺寸/颜色/字族**声明** | **字体回退是否发生** |
| 类名是否命中、`display` 是否生效 | **元素是否真的可见**（还在视口内/未被遮挡） |

**事故实例（2026-10-29，我的假阳性）**：我用 `getComputedStyle(document.body).fontFamily` 判定"字体已生效"，读到 `Inter, "Noto Sans SC", …` 与 `--rc-font` 逐字一致 → **判 PASS**。

实际上：`fonts.css` 当时声明的族名是 `'Rc Sans'` / `'Rc Serif'`，**全项目无人引用 `'Rc Sans'`**，5 个 woff2（5.6MB）**一个都没被下载**；`Inter` / `Noto Sans SC` 在本地都不存在，浏览器实际回退到 Segoe UI / 微软雅黑。

→ **我验的是"声明被解析了"，不是"字体被加载了"。** 这比判错更危险：它给出的是一条 PASS。

**正确判法（字体类必须用 `document.fonts`）**：

```js
// ① 显式触发加载，再读真实 status
await document.fonts.load('16px "Rc Sans"', 'Aa中')
// ② 看每个 face 的真实状态
[...document.fonts].map(f => [f.family, f.weight, f.status])   // loaded / loading / unloaded / error
// ③ 该族是否可用
document.fonts.check('16px "Rc Sans"')
```

判定标准：目标族**每张 face 的 `status === 'loaded'`**；`unloaded` 说明"声明了但从未被使用"（正是那 5.6MB 死重）；`error` 说明文件缺失或 404。**再加一条独立证据**：CDP 侧统计 `.woff2` 请求数与状态码，`0 个请求` 即证实"没有元素真的用到这个族"。

### 2.7 硬规矩：静态校验只比源码字面形态，且必须锚定语法位置（2026-10-29 立）

> **① 静态校验一律比对源码声明的字面形态；只有运行时判定才看计算值。**
> **② 凡 grep 判据，必须锚定到真正的语法位置（行首声明 / 属性值 / 选择器），不得用裸通配。**

**今天出现两个同型错误，方向相反、同一个病——判据没锚定到语法位置：**

| 实例 | 错误做法 | 后果 | 正确做法 |
|---|---|---|---|
| D2 | 拿**解析后的值** `padding: 32px 24px 20px` 去 grep 源码（源码是 `padding: 32px var(--rc-s6) 20px`，`--rc-s6` = 24px） | **假阴性**（误报"声明缺失"） | 比对源码字面形态：`grep -E 'padding:\s*32px var\(--rc-s6\) 20px'` |
| P2 | 裸通配 `grep -o -- '--rc-color-[a-z0-9-]*'`，把**注释里的文字**「旧名 `--rc-color-*`」也算一条，匹配出空名 `--rc-color-` | **假阳性**（28 计成 29） | 锚定行首声明：`grep -E '^\s*--rc-color-' src/design/tokens.css \| wc -l` |

**通用写法**：

- 数「声明了几条」→ 锚行首：`grep -E '^\s*--rc-xxx-' file`
- 判「属性值对不对」→ 连同属性名一起匹配：`grep -E 'padding:\s*32px var\(--rc-s6\) 20px'`
- 判「选择器是否存在」→ 锚行首并带 `{`：`grep -E '^\.topbar\s*\{'`
- 只有「文件里有没有这个字符串」这种弱问题才可以裸通配，**且这类结果不得作为判定依据**

若确实要判解析后的数值，那属于**运行时判定**，须用 `getComputedStyle`（见 §7.3 的探针），**不许用 grep 源码代替**。

### 2.8 每次段落盘后必跑：色值双向 diff（2026-10-29 提为常设）

> 30 秒一次，能一次性抓出"手抄时抄错一位 hex"这类问题，比逐条查 selector 高效得多。**A→D 每段完成后都要跑。**

```bash
D=docs/design/mockups/figma ; S=src/design
# ① app.css / glass.css 的色值集合必须完全一致（双向 diff 都为空）
grep -oiE "#[0-9a-f]{3,8}\b|rgba?\([^)]*\)" $D/app.css   | tr -d ' ' | tr 'A-Z' 'a-z' | sort -u > /tmp/d1
grep -oiE "#[0-9a-f]{3,8}\b|rgba?\([^)]*\)" $S/app.css   | tr -d ' ' | tr 'A-Z' 'a-z' | sort -u > /tmp/s1
comm -13 /tmp/d1 /tmp/s1   # src 新增（应为空）
comm -23 /tmp/d1 /tmp/s1   # src 缺失（应为空）

grep -oiE "#[0-9a-f]{3,8}\b|rgba?\([^)]*\)" $D/glass.css | tr -d ' ' | tr 'A-Z' 'a-z' | sort -u > /tmp/d2
grep -oiE "#[0-9a-f]{3,8}\b|rgba?\([^)]*\)" $S/glass.css | tr -d ' ' | tr 'A-Z' 'a-z' | sort -u > /tmp/s2
comm -13 /tmp/d2 /tmp/s2 ; comm -23 /tmp/d2 /tmp/s2

# ② tokens.css：只允许多出 6 条实算派生色
grep -oiE "#[0-9a-f]{6}\b" $D/tokens.css | tr 'A-Z' 'a-z' | sort -u > /tmp/d3
grep -oiE "#[0-9a-f]{6}\b" $S/tokens.css | tr 'A-Z' 'a-z' | sort -u > /tmp/s3
comm -13 /tmp/d3 /tmp/s3   # 必须恰为 6 条：见 §2.5 实算表
comm -23 /tmp/d3 /tmp/s3   # 必须为空

# ③ 旧 v3 调色板零残留
grep -ic "0b7298" $S/tokens.css    # 必须 0
```

**判定标准（写死，`A` 段实测为基准）**：

| 比对 | 通过条件 |
|---|---|
| `app.css` 色值集合 | 双向 diff **全空**（实测基准：设计稿 4 种 = src 4 种） |
| `glass.css` 色值集合 | 双向 diff **全空**（实测基准：设计稿 25 种 = src 25 种） |
| `tokens.css` 新增 | **恰为 6 条**派生色（`#6d9fe0` `#97bbe9` `#c1d6f2` `#d5e4f6` `#eaf1fb` `#265ea8`），**多一条即 FAIL** |
| `tokens.css` 缺失 | **空** |
| 旧 v3 调色板 `#0b7298` | 命中 **0** |

> 这条对应 §5.3 裁决的实质要求「不得引入设计稿以外的色值」。它比"人眼看一遍 CSS"可靠，因为它不依赖任何人记住哪些色值是合法的。

### 2.9 设计稿存档是基线，任何情况下不得改动（2026-10-29 补）

`docs/design/mockups/figma/` 下的 `tokens.css` / `app.css` / `glass.css` / `*.html` / `icons.js` 是**审计基线本身**。若有人为了"让审计通过"去改存档，整个审计失去基准，所有结论作废。

> **改尺子去量身高** —— 这是审计里最容易被"好心"破坏的东西，所以它排在所有动作之前。

**每轮审计第一步加一条基线校验**：

```bash
git status --porcelain docs/design/mockups/figma/   # 必须为空
grep -n 'padding: 54px 60px 44px' docs/design/mockups/figma/app.css   # 必须命中（产品侧是 0，两者不同才正确）
```

实测（2026-10-29）：存档目录 **零改动**；`docs/design/mockups/figma/app.css:556` 仍为 `padding: 54px 60px 44px` ✅（产品侧 `src/design/app.css` 是 `padding: 0`，两者**必须不同**）

### 2.10 判据必须做反向自检（2026-10-29 补 · 主控实践）

> **改了判据，必须反过来验证它真能拦住错误。** 否则只是"换了个看起来更严的写法"，拦不拦得住完全未知。

做法：**变异自检（mutation check）** —— 故意把被测文件改成错误形态，跑断言，**必须变红**；然后还原。

实例（2026-10-29，主控做 `.paper padding` 判据收紧时）：把 `padding: 0;` 临时改成 `padding: 0 8px;`，确认测试变红，再还原。这一步比"看起来更严"重要得多。

**变异自检的两条硬要求**：

1. **必须用精确锚点**，不能靠"第一次出现"去替换。主控第一次做时用脚本替换了文件里**第一处** `padding: 0;`，结果动到了别处的规则——虽然最后还原，但这次差点污染基线。
   → 正确做法：定位到**具体选择器块内**的那一条（如 `ruleBody('.paper')` 范围内），或替换带唯一上下文的片段。
2. **还原后要复跑一次**，确认回到全绿。否则可能留下半改状态。

这条与 §2.6「用直接证据」、§2.7「判据锚定语法位置」是同一个族：**判据本身也是被测对象**，也需要证据说明它有效。

**推论：警示要贴在作案现场。** 同一条提醒写在审计文档里，做变异自检的人不会去翻；写在他动手的那一行旁边才会被看到。

实例（2026-10-29 主控落实）：把「必须改 `ruleBody(css,'.paper')` 范围内的那一条，不能用全局替换第一处 `padding: 0;`」写进 `tests/design/fidelity.test.ts` 的 `ruleBody` JSDoc —— 因为做变异自检的人一定会经过那个函数。已复验该注释在文件第 27–29 行。


---

## 3. 检查清单（43 条 / 9 组）

### 3.1 外壳（A · 4 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| A1 | `.app` 容器 | `display:flex` + `flex-direction:column` + `height:100vh` + `min-height:860px` + `overflow:hidden` | `app.css:42-48` | `静态`：读 `src/design/app.css` 的 `.app` 块，五条声明全在 |
| A2 | `.side` 宽度 | 计算后 `offsetWidth = 296px`（`width:var(--rc-left-w)`；`--rc-left-w:296px`；`border-right:1px`，`box-sizing:border-box` 故含边框） | `app.css:302`、`app.css:305`、`tokens.css:162`、`app.css:9` | `像素`：在 app 截图上量 `.side` 左边缘 x=0 到右边缘；或量左栏与画布的分界线 x 坐标 = 296 |
| A3 | `.inspector` 宽度 | 计算后 `offsetWidth = 292px`（`width:var(--rc-right-w)`；`--rc-right-w:292px`） | `app.css:454`、`tokens.css:163` | `像素`：右栏左边缘 x = 1440 − 292 = **1148** |
| A4 | `.canvas` 宽度 | `1440 − 296 − 292 = 852px`（`flex:1; min-width:0`） | `app.css:510-514` | `像素`：量右侧栏左边缘 1148 减去左侧栏右边缘 296 = 852 |

### 3.2 顶栏（B · 5 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| B1 | `.topbar` 高度 | **48px**（`height:var(--rc-topbar-h)`；`--rc-topbar-h:48px`；`flex:none`） | `app.css:52-53`、`tokens.css:160` | `像素`：顶栏下边框线 y 坐标 = 48（含 1px `border-bottom`） |
| B2 | `.topbar` 内距与分界 | `padding:0 16px`（`--rc-s4`）、子项 `gap:12px`（`--rc-s3`）、`border-bottom:1px solid #c3d8f2`、`z-index:30` | `app.css:56-61`、`tokens.css:88-90,37` | `像素`：量 `.brand__mark` 左边缘 x = 16；`.brand` 与 `.topbar__divider` 间距 = 12 |
| B3 | 品牌块 | `.brand__mark` 26×26px + `border-radius:7px`；`.topbar__divider` 1×20px、背景 `#c3d8f2`；`.avatar` 26×26px + `border-radius:50%` | `app.css:65-71`、`app.css:77`、`app.css:192-199` | `像素`：分别量三个盒子外接宽高；圆角判定看 26×26 方块四角是否被切 |
| B4 | 顶栏排版 | `.brand__name` 13px/600/`letter-spacing:-0.01em`；`.docmeta__name` 13px/500；`.docmeta__sub` **11px** 且色 `#66788f`；`span.docmeta__sub` 单行省略 | `app.css:72-76`、`app.css:80-83`、`app.css:84-87`、`tokens.css:102,32` | `静态`：四条 `font-size`/`color` 声明逐条比对；`像素`：`.docmeta__sub` 文本高度 ≈ 11px×1.5 |
| B5 | 顶栏按钮组 | `.topbar__right` `gap:4px`（`--rc-s1`）；其中 `.btn` 高度 **30px**、`padding:0 12px`、圆角 **7px**、字号 **12px**/500 | `app.css:93`、`app.css:120-131`、`tokens.css:87` | `像素`：量「导出前检查」「导出」两按钮的 `offsetHeight = 30`；两按钮水平间隙 = 4 |

### 3.3 左栏（C · 5 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| C1 | `.side__tab` 排版 | `padding:11px 10px 10px`、字号 12px/500、默认色 `#66788f`、`--on` 色 `#1b2430`；`.side__tabs` `padding:0 12px` + `border-bottom:1px solid #c3d8f2` | `app.css:308-320`、`tokens.css:100,32,30` | `像素`：量「组件」tab 文本基线到 tabs 容器下边框；`.side__tabs` 高 = 11+行高+10+1 |
| C2 | 左栏激活下划线 | `.side__tab--on::after`：`height:2px`、`left:8px`、`right:8px`（左右各内缩 **8px**）、`bottom:-1px`、背景 `#2f76d2`、圆角 `2px 2px 0 0` | `app.css:323-326`、`tokens.css:43`；裁决见 §5.5 | `像素`：量蓝条宽度 = tab 内容宽 − 16；蓝条右端 x 与 tab 右边缘差 = 8；蓝条厚度 = 2；吸管采蓝条颜色 = `rgb(47,118,210)`。**易错点**：右栏同类蓝条内缩是 **6px**（E2），两处**必须不同**；若发现两处被改成同一个值 → 本条或 E2 判 **FAIL**（"顺手优化"证据） |
| C3 | 组件网格 | `.compgrid`：`display:grid` + `grid-template-columns:1fr 1fr` + `gap:8px`（`--rc-s2`） | `glass.css:194-198`、`tokens.css:88` | `像素`：左栏内应见**两列**卡片；同一行两张卡的左右边缘间距 = 8；单列宽 = (296 − 1 边框 − 12×2 内距 − 8 间距) / 2 = **131.5px**（含卡片 1px 边框） |
| C4 | `.compcard` 尺寸 | `min-height:104px`、`flex-direction:column`、`align-items:flex-start`、`padding:11px 10px 10px`；`border-radius:10px`（`--rc-r-card`） | `glass.css:199-206`、`glass.css:147`、`tokens.css:82` | `像素`：量任一普通组件卡（非末张）`offsetHeight ≥ 104`；卡内图标与文字为**上下**排布而非左右 |
| C5 | 奇数末卡跨列 + 卡内图标 | `.compcard:last-child:nth-child(odd)`：`grid-column:1/-1` + `flex-direction:row` + `min-height:0` + `padding:10px`；`.compcard__ico` 28×28px + 圆角 7px | `glass.css:228-234`、`app.css:350-357` | `像素`：01 屏共 5 张卡 → 末张「自我评价」应**横跨两列**且内容横向排列，高度明显低于 104；图标方块 = 28×28 |

### 3.4 画布（D · 5 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| D1 | `.canvas__bar` | `height:36px`、`padding:0 12px 0 16px`、`border-bottom:1px solid #c3d8f2`、字号 11px、色 `#66788f` | `app.css:515-523` | `像素`：量画布顶条高度 = 36；左内距 = 16、右内距 = 12 |
| D2 | `.canvas__scroll` 内距 | `padding:32px 24px 20px`、`gap:20px`（`--rc-s5`）、`flex-direction:column` + `align-items:center`；`.canvas__pct` `min-width:38px` | `app.css:536-541`、`app.css:529-533`、`tokens.css:91` | `像素`：量纸面顶端到 `.canvas__bar` 下边缘 = 32；纸面水平居中（左右留白差 ≤1px） |
| D3 | `.paper-slot` 占位尺寸 | **476.4 × 673.8px** = `calc(794 × 0.6)` × `calc(1123 × 0.6)`（`--rc-paper-w:794px`、`--rc-paper-h:1123px`、`--rc-zoom:0.6`） | `tokens.css:164-168`、`tokens.css:176-179` | `像素`：量 `.paper-slot` 的 `offsetWidth/offsetHeight` = 476/674（±1）。截图里量白色纸面外接框（扣掉 1px 描边）同值 |
| D4 | `.paper` 几何与内距 | `position:absolute; top:0; left:0`；`width:794px; height:1123px`；`transform:scale(0.6)`；`transform-origin:top left`；**`padding:0`（四边全 0，本方案的刻意改动，不是设计稿的 `54px 60px 44px`）** | `app.css:548-553`、`tokens.css:168`；`padding:0` 来自 `ui-restore-plan.md` §5.3 + §8.3 | `像素`：`getBoundingClientRect()` 得 794×1123（transform 不改 border box），视觉占位 476.4×673.8；`getComputedStyle(.paper).transform` = `matrix(0.6, 0, 0, 0.6, 0, 0)`。**`padding` 四项必须逐边单独读**：`paddingTop`/`paddingRight`/`paddingBottom`/`paddingLeft` 全等 `'0px'`；读到 `'54px'`/`'60px'`/`'44px'` 任一即判 **FAIL**（说明按"一字不改"照抄了设计稿，页边距会被算两遍，纸面内容整体偏移） |
| D5 | `.paper` 底色与描边 | 背景 `#ffffff`（`--rc-paper`，与导出 PDF 同色）、`backdrop-filter:none`、`box-shadow: 0 0 0 1px #dce8f8, 0 10px 30px -18px rgba(16,38,72,0.25)` | `tokens.css:27`、`glass.css:273`、`app.css:555`（被覆盖） | `采样`：纸面中心取点 = `rgb(255,255,255)`；纸面外缘应有 1px `rgb(220,232,248)` 环；`getComputedStyle` 的 `backdropFilter` 必须为 `none` |

### 3.5 右栏（E · 5 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| E1 | `.inspector__head` | `height:42px`、`padding:0 10px 0 12px`、`border-bottom:1px solid #c3d8f2`；`.inspector__title` 13px/600 | `app.css:460-467` | `像素`：量右栏标题行高度 = 42；左内距 12、右内距 10 |
| E2 | 右栏激活下划线（**与左栏不同**） | `.inspector__tab`：`padding:9px 9px 8px`；`.inspector__tab--on::after`：`height:2px`、`left:6px`、`right:6px`（左右各内缩 **6px**，不是 8px） | `app.css:474-483`；裁决见 §5.5 | `像素`：量右栏「内容」tab 蓝条宽度 = tab 宽 − **12**；与左栏 C2 的 8px 内缩并列对比，两者**必须不同**。若被统一成 8 或 6 → 判 **FAIL**（设计稿是唯一事实源，"看起来不齐"不构成修改依据） |
| E3 | `.inspector__body` | `padding:12px 12px 22px`、`gap:10px`、`overflow-y:auto`、`flex-direction:column`；`.inspector__divider` 高 1px + `margin:2px 0` | `app.css:484-489` | `像素`：量两个相邻 `.field` 的垂直间距 = 10；右栏第一个 `.field__label` 顶边 x = 1148+12 = 1160 |
| E4 | 输入控件尺寸 | `.input`/`.select`：`height:30px`、`padding:0 9px`、圆角 **7px**、字号 **12px**、`border:1px solid #c3d8f2`；`.textarea`：`height:auto` + **`min-height:74px`** + `padding:7px 9px` + `line-height:1.55`；`.textarea--tall` `min-height:96px`；`.select` `padding-right:26px` 且箭头由两组 `linear-gradient` 绘制（`background-position: calc(100%-14px) 13px, calc(100%-9px) 13px`、`background-size:5px 5px`） | `app.css:209-237` | `像素`：量第一个 `.input`「项目名称」`offsetHeight = 30`；量 `.textarea--tall`「项目成果」`offsetHeight ≥ 96`；`静态`：`.select` 的四条 `background-*` 声明在 |
| E5 | 表单栅格与开关 | `.field` `gap:6px`；`.field__label` 11px/500/`#5a6879`；`.field-row` `grid-template-columns:1fr 1fr` + `gap:8px`，`.field-row--tight` `gap:6px`；`.switch` 34×20px 圆角 pill，滑块 16×16px 位于 `top:2px; left:2px`，`--on` 时 `translateX(14px)` 且底色 `#2f76d2` | `app.css:204-208`、`app.css:252-253`、`app.css:262-274`、`tokens.css:84,43` | `像素`：量「开始时间 / 结束时间」两个 `.input` 之间的水平间距 = 8；量开关外框 34×20；量开启态滑块左移量 = 14（滑块右边缘距外框右边缘 = 2） |

### 3.6 状态栏（F · 4 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| F1 | `.statusbar` 高度 | **28px**（`height:var(--rc-statusbar-h)`；`--rc-statusbar-h:28px`；`flex:none`） | `app.css:100-101`、`tokens.css:161` | `像素`：量状态栏上边框线 y = 900 − 28 = **872**，高度 = 28 |
| F2 | `.statusbar` 排版 | `padding:0 16px`、`border-top:1px solid #c3d8f2`、字号 **11px**（`--rc-fz-xs`）、色 `#66788f`、`justify-content:space-between` | `app.css:102-108`、`tokens.css:102,32` | `像素`：量左组文本左边缘 x = 16、右组文本右边缘距视口右 = 16；两组合计间距差 ≤1px 说明 space-between 生效 |
| F3 | 溢出警示 | `.statusbar__dot` 6×6px `border-radius:50%`、背景 `#b6544f`；`.statusbar__item--warn` 文字色 `#8e3d39`、`font-weight:500`；`.statusbar__item` 内 `gap:5px` | `app.css:110-115`、`tokens.css:65-66` | `像素`：量圆点外接 6×6；`采样`：圆点中心 = `rgb(182,84,79)`，「3 处溢出」文字取笔画内部 = `rgb(142,61,57)` |
| F4 | 状态栏定位 | 位于 `.workspace` 之下、`.app` 底部；顶边 y = 872，底边 y = 900；不覆盖、不浮动、不 `position:fixed` | `app.css:42-48`、`app.css:96` | `像素`：截图上量状态栏上边框 y 坐标；`静态`：`.statusbar` 块内无 `position` 声明（默认 static） |

### 3.7 纸面（G · 5 条）

> 纸面全部尺寸是 **1:1 印刷真值**，不参与画布缩放思维。截图上量到的要除以 0.6。

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| G1 | `.p-name` 姓名 | `font-size:30px`（`--rc-p-fz-name`）、`font-weight:600`、`letter-spacing:0.05em`、`line-height:1.15`、`margin:0 0 12px`；`.p-header` `justify-content:space-between` + `gap:24px` | `app.css:642-648`、`tokens.css:106` | `像素`：`getComputedStyle(.p-name).fontSize` = `30px`、`letterSpacing` = `1.5px`（0.05em）、`lineHeight` = `34.5px`；量「张明」底边到「求职意向 · 前端开发工程师」顶边 ≈ 12×0.6 = 7.2px（截图上） |
| G2 | 小节标题 | `.p-sec__title`：`font-size:17px`（`--rc-p-fz-sec`）、600、`gap:7px`、`margin:0 0 10px`；`::before` 竖条 **3×15px**、`border-radius:1px`、背景 `#4b7168`；`.p-sec` `margin-top:32px` | `app.css:664-674`、`glass.css:280`、`tokens.css:58,109` | `像素`：量竖条外接 = 3×15（截图上 1.8×9）；`采样`：竖条中心 = `rgb(75,113,104)`；量本节顶部与上一节末行间距 = 32×0.6 = 19.2px |
| G3 | 条目行 | `.p-item__name` **14px**/600；`.p-item__date` **11.5px**/`#5a6879`/`tabular-nums`/`nowrap`/`flex:none`；`.p-item__role` **11.5px**/`#5a6879`/`margin-top:2px`；`.p-item__head` `justify-content:space-between` + `baseline` + `gap:12px`；`.p-item` `margin-bottom:16px` | `app.css:677-685`、`tokens.css:110,112,31` | `像素`：`getComputedStyle` 分别读 `.p-item__name` = `14px`、`.p-item__date` = `11.5px`、`.p-item__role` = `11.5px`；量「华南理工大学 · 软件工程」与「2022.09-2026.06」两条文本的**基线是否对齐**（底边差 ≤1px），且分列左右两端（两端留白差 ≤1px） |
| G4 | 要点列表 | `.p-bullets li`：**14px**、**`line-height:1.62`**、`padding-left:12px`；`::before` 圆点 **3×3px**、`left:3px`、`top:0.62em`、背景 `#5a6879`；`.p-bullets` `margin:4px 0 0`、`list-style:none`；`.p-plain` 14px/1.62 | `app.css:686-699`、`tokens.css:111,113` | `像素`：量同一条要点的行距 = 14×1.62 = 22.68px（截图上 13.6px）；量圆点 = 3×3（截图上 1.8×1.8）；量文本左内距 = 12px（截图上 7.2px）；**不出现默认 `•` 字符** |
| G5 | 纸面不被界面蓝污染 | `.p-intent` 色 `#4b7168`（不是 `#2f76d2`）；`.p-em` 色 `#4b7168`；`.p-sec__rule` 背景 `#d9dee2`（中性灰）；`.p-photo` `border-color:#d9dee2` + `background:#f2f4f5` | `glass.css:279-281`、`glass.css:288-293`、`tokens.css:58,61,62` | `采样`：求职意向文字「求职意向 · 前端开发工程师」= `rgb(75,113,104)`；小节分隔线 = `rgb(217,222,226)`；照片占位框底 = `rgb(242,244,245)`。**任一处出现偏蓝即判不通过**（`app.css:649/673/675` 用的是 `var(--rc-accent)`，必须被 `glass.css` 覆盖） |

### 3.8 弹窗（H · 4 条）

| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| H1 | `.scrim` 遮罩 | `position:fixed; inset:0`、背景 `rgba(12,20,34,0.66)`（`--rc-scrim`）、`backdrop-filter:blur(3px)`、`padding:32px`、`z-index:90`、`place-items:center`；`.scrim--top` `padding-top:74px` | `app.css:748-755`、`glass.css:253`、`tokens.css:26` | `像素`：打开任一弹窗截图，`采样` 视口角点 = 遮罩与极光混合色但**明显暗于**无弹窗态；`getComputedStyle` 的 `backdropFilter` 含 `blur(3px)` |
| H2 | `.dialog` 容器 | 圆角 **14px**（`--rc-r-dlg`）；`max-height:calc(100vh - 120px)`；`.dialog--md` `max-width:620px`、`.dialog--lg` `max-width:780px`；材质 `background:rgba(255,255,255,0.86)` + `backdrop-filter:blur(20px) saturate(140%)` + `box-shadow:0 24px 60px -20px rgba(16,38,72,0.4)` | `app.css:756-766`、`glass.css:238-245`、`tokens.css:83` | `像素`：量弹窗宽度 = 620（md）或 780（lg）（视口 1440 足够容纳，不触顶）；量四角圆角半径 ≈14；`静态`：材质三件套齐全 |
| H3 | 弹窗三段内距 | `.dialog__head` `padding:20px 24px 12px`；`.dialog__title` **18px**/600/`letter-spacing:-0.01em`；`.dialog__body` `padding:0 24px`；`.dialog__foot` `padding:16px 24px` + `border-top:1px solid #dce8f8` + `margin-top:16px`；`.dialog__actions` `gap:8px` + `margin-left:auto` | `app.css:767-783`、`tokens.css:98` | `像素`：量标题左边缘距弹窗左边缘 = 24；量页脚上边框 y 与按钮底边距离 = 16；量两个动作按钮间隙 = 8 |
| H4 | 检查项与选项卡 | `.checkitem` 最终形态为 **`display:block`**（`app.css:1145-1150` §14 覆盖 `app.css:795-815` §8 的 `flex`）、`border-left:2px solid`、`padding:12px 0 12px 12px`、`border-bottom:1px solid #dce8f8`；`.checkitem--block` 左边框 `#b6544f`、`--warn` `#eddcb6`、`--tip` `#c3d8f2`。`.optcard` 圆角 **10px**、`padding:12px`、`margin-bottom:8px`；`--on` 时 `background:rgba(47,118,210,0.1)` + `border-color:#2f76d2` | `app.css:1145-1155`、`app.css:1189-1201`、`glass.css:191`、`tokens.css:82` | `像素`：`.checkitem` 内「徽标 / 标题 / 描述」应为**上下堆叠**（若左右并排说明用的是 §8 的 flex 版，不通过）；量左竖线宽 = 2；`采样` 选中态 `.optcard` 底色偏蓝（≈`rgb(236,243,251)` 混白后） |

> **`display:block` 一条务必单独确认**：`app.css` 里 `.checkitem` 被定义了两次（795 行 flex 版与 1145 行 block 版）。若工程师只搬了前一版，弹窗检查项会变成两栏。

### 3.9 材质与动效（I · 6 条）


| # | 检查点 | 期望值（硬指标） | 来源 | 怎么验 |
|---|---|---|---|---|
| I1 | 极光底 | `body::before` 存在且 `content:''`、`position:fixed; inset:0`、`z-index:0`、`pointer-events:none`、`background:var(--rc-aurora)`；`--rc-aurora` 必须是**四层** `radial-gradient`，参数逐字为 `780px 540px at 6% 2%, rgba(94,152,238,0.24), transparent 62%` / `700px 520px at 96% 8%, rgba(96,204,214,0.2), transparent 64%` / `860px 580px at 56% 98%, rgba(128,124,236,0.17), transparent 66%` / `520px 420px at 34% 62%, rgba(47,118,210,0.08), transparent 70%` | `glass.css:18-22`、`tokens.css:145-149` | `静态`：数 `radial-gradient(` 出现 **4** 次且四个 rgba 值一字不差；`采样`：截图四角与中心取点颜色互不相同（左上有蓝紫、右下有紫），且整体不能是纯 `#edf1f7` |
| I2 | 外壳玻璃材质（**含禁令校验**） | `.topbar` / `.statusbar` / `.actionbar` / `.side` / `.inspector` **五个**选择器共用：`background:rgba(255,255,255,0.62)` + `-webkit-backdrop-filter:blur(18px) saturate(140%)` + `backdrop-filter:blur(18px) saturate(140%)`。**硬禁令**：不得改写成 `blur(var(--rc-glass-blur))`（22px/180%）或 `var(--rc-glow-ring)` 等零引用 token —— 那是"优化"出来的回归（§5.2 裁决） | `glass.css:28-32`；裁决见 §5.2 | `静态`：读 `src/design/glass.css` 确认这一条规则里五个类名齐全、三行声明齐全（`-webkit-` 前缀不能省），且数值就是字面量 `18px`/`140%`/`0.62`。**禁令校验**：grep `glass.css` 是否出现 `blur(var(--rc-glass`、`var(--rc-glow-ring)`、`var(--rc-glass-edge)`；**命中即直接 FAIL，无需看截图**。`像素`：`getComputedStyle(.side).backdropFilter` = `blur(18px) saturate(140%)`，且 `.side` 上能看到极光透出的偏蓝底色（采样值 ≠ `rgb(255,255,255)`） |
| I3 | `.btn` 基础材质与尺寸 | `height:30px`、`padding:0 12px`、`border-radius:7px`、`font-size:12px`、`font-weight:500`、`gap:6px`；材质 `background:rgba(255,255,255,0.42)` + `backdrop-filter:blur(12px) saturate(140%)` + `border:1px solid #c3d8f2` + `box-shadow:none`；`--sm` 26px / `--lg` 36px / `--xl` 40px / `--icon` 宽 30px | `app.css:120-148`、`glass.css:62-74` | `像素`：量「导出前检查」按钮 `offsetHeight = 30`；`静态`：五档高度声明（30/26/36/40）全在，且 `--icon` 宽度 30px |
| I4 | `.btn--primary` 材质 | `background:rgba(47,118,210,0.14)` + 同款 `blur(12px) saturate(140%)` + `border:1px solid rgba(47,118,210,0.42)` + `color:#1b4f94`（`--rc-accent-ink`，不是 `#fff`）+ `box-shadow:none` | `glass.css:82-89`、`tokens.css:49` | `采样`：截图上「导出」按钮底色应是**淡蓝半透明**（透出极光），不是实心 `#2f76d2`；按钮文字「导出」取笔画内部 = `rgb(27,79,148)` |
| I5 | 卡片悬停位移 | `.compcard:hover` / `.tplcard:hover` / `.entrycard:hover` / `.idxcard:hover`：`transform:translateY(-6px) scale(1.008)`、`background:rgba(255,255,255,0.72)`、`border-color:transparent`、`z-index:5`；过渡为 `transform var(--rc-dur-slow) var(--rc-ease-spring)`（280ms + `cubic-bezier(0.34,1.42,0.64,1)`）。**例外**：`.tplcard:hover`/`.idxcard:hover` 覆盖为 `translateY(-8px) scale(1.012)` | `glass.css:149-152`、`glass.css:166-172`、`tokens.css:154,156` | `静态`：三条声明逐字比对（`-6px`/`1.008`/`slide`）；`像素`：截图时用 CDP 强制 `:hover` 后重截，量卡片顶边相对原位上移 6px、两侧各外扩 0.4px |
| I6 | 呼吸环 + 圆角四档 | 呼吸环：`.compcard::after`（及 `.tplcard`/`.entrycard`/`.idxcard`）`content:''`、`position:absolute`、`inset:-1px`、`border-radius:inherit`、`border:1px solid #2f76d2`、`opacity:0`；hover 时 `animation:rcBreath var(--rc-breathe) ease-in-out infinite`（= **2.6s**）；`@keyframes rcBreath` 为 `0%,100%{opacity:.45}` / `50%{opacity:1}`。圆角四档：`--rc-r-tag:4px` / `--rc-r-ctl:7px` / `--rc-r-card:10px` / `--rc-r-dlg:14px`（+ `--rc-r-pill:999px`） | `glass.css:155-182`、`tokens.css:80-84,157` | `静态`：`inset:-1px`、`animation` 时长变量、keyframes 两个 stop 的 opacity 值逐条比对；四个圆角 token 数值 4/7/10/14 一字不差；`像素`：hover 态连截两帧（间隔 1.3s），环的亮度应不同（证明在呼吸） |

**I 组附加判据（2026-10-29 主控补，实测已核）**：`.badge--ok` 必须**只由 `glass.css` 提供**，不得出现在 `app.css`。
实测：`src/design/app.css` 命中 **0**；`src/design/glass.css:257` 有 `.badge--ok { background: var(--rc-ok-soft); color: var(--rc-ok); border: 1px solid var(--rc-ok-border); }`，与设计稿 `glass.css:257` 逐字一致 ✅。
→ **若在 `app.css` 里看到 `.badge--ok`，判 FAIL**（说明有人重复添加，违反方案 §2.2「其余一律不许自创类名」）。

---

## 4. 已知允许的偏差（**不作为缺陷**）

以下三条来自 `docs/design/ui-restore-plan.md` §7，已由 Amor 知情。审计时逐条核销，**不得记为不通过**：

| # | 偏差 | 设计稿真值 | 产品取值 | 来源 | 审计处理 |
|---|---|---|---|---|---|
| 1 | **纸面页边距** | `.paper` `padding:54px 60px 44px`（≈14.3 / 15.9 / 11.6 mm）—— `app.css:556` | 文档默认 **20mm**；且 `.paper` 的 `padding` 必须改为 **`0`**，边距由 `LayoutResult.boxes` 的 mm 坐标承担（`ui-restore-plan.md` §5.3） | `ui-restore-plan.md` §7.1、§5.3 | 核销即通过。视觉上四周宽约 4mm。**反向要求已合并进 `D4` 的验法**：逐边读 `getComputedStyle(.paper).paddingTop/Right/Bottom/Left`，四项必须全为 `'0px'`；读到 `54px`/`60px`/`44px` 任一即判 **FAIL**——那是"照抄设计稿"而非"按方案实现"。另见 §2.3 末尾同性质校验说明（`.paper` padding 判定即为 `D4` 本身，不重复列闸） |
| 2 | **EP 主色对比度（`light-7` 为最差档）** | 按 WCAG 相对亮度实算，`--rc-accent:#2f76d2` 在各档浅色底上：<br>`#2f76d2` on 白 → **4.52:1** ✅ 通过<br>`#2f76d2` on light-9 `#eaf1fb` → **3.98:1** ❌ 不通过<br>`#2f76d2` on light-7 `#c1d6f2` → **3.05:1** ❌ 不通过，**本组最差档** | 保持 `#2f76d2` 不动。EP 组件在 P0 只服务 `ElementProbe` 开发探针，产品界面全部走自研类名，不出现该组合 | `ui-restore-plan.md` §7.2 / §2.1；对比度按 QA 2026-10-29 实算（§5.10 裁决 2） | 核销即通过。审计不测 EP 对比度。**必须登记最差档 light-7（3.05:1），不能只写 light-9**——只写 light-9 会让人以为"只差一点"，而 light-7 才是 EP plain 按钮 / hover 项最常用的底色。**触发条件**：若产品界面将来引入 EP 表单组件，本偏差作废，须回到 `#2867c4`（4.78:1）并重审 |
| 3 | **字体替代** | `Inter` + `Noto Sans SC`，经 `tokens.css:17` 的 `@import` 从 Google Fonts 加载 | 本地方案 `Rc Sans`（Noto Sans SC 子集）承担中文，西文回退系统栈 | `ui-restore-plan.md` §7.3（方案 §2.1 第 1 条要求删除该 `@import`） | 核销即通过。**连带影响**：字形宽度有差异 → G1/G3/G4 的字号判定只量 `font-size` 计算值，**不比对字宽与换行位置**。另：`src/design/tokens.css` 若仍留着 `@import url('https://fonts.googleapis.com/…')`，判**不通过**（离线会退字体，且方案明令删除） |

---

## 5. 设计稿内部矛盾与裁决记录（**不许自行脑补**）

本节 11 条：**全部已裁决/确认，无 `待裁决`、无 `BLOCKED`**（5.11 为「裁决为延后清理」，不阻塞判定）。审计时按这里的口径执行，遇到与本节冲突的现场情况，报上来，不要自行改判。

状态标记：`已裁决` = 主控给了明确口径，按裁决执行；`已确认` = 主控确认了我的处理方式，口径不变；`已裁决 · 延后清理` = 裁决为"保留、不判缺陷、收尾再动"。

| 小节 | 议题 | 状态 | 一句话口径 |
|---|---|---|---|
| 5.1 | 三层加载顺序依赖 | `已确认` | 顺序错 → C4/C5/G5/I3 直接 FAIL（已正式化为闸门 `P5`） |
| 5.2 | 材质 token 零引用 | `已裁决` | 以 `glass.css` 字面量 18px/140%/0.62 为准，token 不动 |
| 5.3 | rgba 字面量违规 | `已裁决` | 设计稿自带的 rgba **允许保留**，规则收窄为「不得引入设计稿以外的色值」 |
| 5.4 | `.paper` padding 方案自相矛盾 | `已确认` | 计算值必须 `0px`（§5.3 + §8.3 优先），已并入 `D4` |
| 5.5 | 左 8px / 右 6px 内缩不一致 | `已裁决` | 按设计稿现状分列，C2 判 8、E2 判 6，不统一 |
| 5.6 | `.checkitem` 定义两次 | `已确认` | H4 单列 `display:block` 独立确认项 |
| 5.7 | 87% 注释残留 | `已确认` | 允许工程师顺手修注释，不计入判定 |
| 5.8 | Google Fonts 离线噪声 | `已确认` | 只比计算值，不比字宽与换行位置 |
| 5.9 | `--rc-fz-*` 与 `--rc-p-fz-*` 易混 | `已确认` | 单列为易错点，期望值不变 |
| **5.10** | 方案 §2.1 示例派生色不能由 `#2f76d2` 算出；偏差 2 对比度登记不全 | **`已裁决` 2026-10-29** | 派生色以 §2.5 实算值为准（`Math.round`，`.5` 进位）；方案示例块已整体替换；P2 该子项**可判不再 BLOCKED**；偏差 2 补登 light-7 最差档 |
| **5.11** | `glass.css` 保留 `.idxcard` 死选择器（**LOW**） | **`已裁决` 2026-10-29 · 延后清理** | **保留、不判缺陷、不阻塞**。收尾时与文档同步一起清。理由：匹配不到任何元素，零风险；`glass.css` 刚过色值 diff（25 vs 25 零差异），现在动 7 处选择器要重跑基线，收益不抵成本 |

### 5.1 三层加载顺序依赖（`已确认` · **最容易翻车**）

设计稿的正确外观只有在 `tokens.css → app.css → glass.css` 全部加载、顺序不乱时才成立。以下属性是 `glass.css` **覆盖** `app.css` 的关系，任一环节出问题就退化：

| 属性 | `app.css`（被覆盖） | `glass.css`（生效） |
|---|---|---|
| `.p-intent` 颜色 | `var(--rc-accent)` 蓝（649 行） | `var(--rc-paper-accent)` 墨绿（279 行） |
| `.p-sec__title::before` 竖条 | `var(--rc-accent)` 蓝（673 行） | `var(--rc-paper-accent)` 墨绿（280 行） |
| `.p-em` 强调词 | `var(--rc-accent)` 蓝（701 行） | `var(--rc-paper-accent)` 墨绿（281 行） |
| `.p-sec__rule` 分隔线 | `var(--rc-border-soft)` 蓝（675 行） | `var(--rc-paper-border)` 灰（293 行） |
| `.p-photo` 边框/底色 | 蓝 `--rc-border` / 蓝 `--rc-surface-sunk`（656-657 行） | 灰 `--rc-paper-border` / `--rc-paper-neutral`（288-291 行） |
| `.compcard` 布局 | `row` + `padding:9px 8px 9px 9px`，无 `min-height`（333-343 行） | `column` + `padding:11px 10px 10px` + `min-height:104px`（199-206 行） |
| `.paper` 阴影 | `var(--rc-sh-paper)`（555 行） | 1px 描边 + 自定义阴影（273 行） |
| `.paper` 背景 | `var(--rc-paper)`（554 行） | 未覆盖（同值） |
| `.btn` 背景/边框 | `var(--rc-surface)` 实白（125-126 行） | `rgba(255,255,255,0.42)` 半透明（64 行） |
| `.checkitem` 布局 | `flex`（795 行 §8） | 未覆盖，但 `app.css:1145` §14 同文件内覆盖为 `block` |

→ **C4 / C5 / G5 / I3 四条检查点的期望值全部依赖这条顺序**。判定前先确认 `src/App.vue` 的 `@import` 顺序是 `tokens → fonts → app → glass`（`ui-restore-plan.md` §2.4）。**该项已正式化为闸门 `P5`（见 §2.3）：顺序错则上述四条直接 FAIL，不必再量。**

### 5.2 `tokens.css` 定义了材质 token 却无人使用（`已裁决` 2026-10-29）

- `tokens.css:122` `--rc-glass: rgba(255,255,255,0.58)`、`tokens.css:127` `--rc-glass-blur: blur(22px) saturate(180%)`、`128` `--rc-glass-blur-sm: blur(12px) saturate(160%)`、`130-136` 的 `--rc-glass-edge/-shadow/-shadow-hover`、`138-142` 的 `--rc-glow-ring/-soft`——**在 `app.css` 与 `glass.css` 里全部零引用**（已 grep 确认）。
- 实际生效的材质值是 `glass.css:29-31` 里的**字面量** `rgba(255, 255, 255, 0.62)` 与 `blur(18px) saturate(140%)`，与 `--rc-glass-blur`（22px/180%）**不是同一组数值**。

**裁决（主控 2026-10-29）——以渲染真值为准，token 不动：**

1. **I2 期望值维持 `glass.css:29-31` 的字面量**：`rgba(255,255,255,0.62)` + `blur(18px) saturate(140%)`。理由：浏览器实际渲染的是字面量，token 是上一代材质的残留；审计只认渲染真值。
2. **对工程师的硬禁令**：**不许**把 `glass.css` 的字面量改写成 `blur(var(--rc-glass-blur))` 之类的"优化"。那会把渲染从 18px/140% 变成 22px/180%，是优化出来的回归。
3. **审计动作**：I2 判定时，除了核对 `glass.css` 声明，还要顺手 grep `glass.css` 里是否出现 `blur(var(--rc-glass-blur))` 或 `var(--rc-glow-ring)`。**发现禁令被违反 → I2 直接判 FAIL**，不需要看截图。
4. `tokens.css` 里那批零引用 token（`--rc-glass*` / `--rc-glow*`）**保留不删**，定位改为「设计资产预留」。此项不在本卡处理，已记入收尾文档同步清单。审计**不得**把"零引用 token"当缺陷报。

### 5.3 `glass.css` 自带 rgba 字面量（`已裁决` 2026-10-29 · 规则已收窄）

- `tokens.css:13-14` 自述：「本目录内所有文件只允许引用本文件的 `var(--rc-*)`，组件文件里出现十六进制色值即视为违规」。
- 原 `ui-restore-plan.md` §1 第 3 条曾表述为：「`src/design/tokens.css` 之外任何文件不得出现 **hex / rgb()** 字面量」。
- 但 `glass.css` 有 **31 处** `rgba(...)`（实测 `grep -o "rgba(" glass.css | wc -l` = 31；行号：29, 34, 48, 64, 76, 79, 83, 86, 91, 94, 104, 107, 114, 120, 129, 132, 133, 143, 168, 191, 225, 226, 239, 244, 247, 251, 256, 262, 265, 268, 273）；`app.css` 有 **5 处**（行号 285, 760, 949, 1351 —— 均为 `rgba(37,43,40,*)` 阴影色）。

**裁决（主控 2026-10-29）——原规则表述有误，已收窄：**

1. `ui-restore-plan.md` §1 第 3 条已改写，准确表述为：**不得引入设计稿以外的色值**。
2. 设计稿已有的 **31 处 `glass.css` rgba + 5 处 `app.css` rgba 原样搬**，不改造、不提升成 token。
3. 移植过程中**不得新增**设计稿没有的色值；§2.2 的产品增补类（`.field__req` / `.card__media` / `.hintbar--ok/--warn/--danger`）若需颜色，一律引既有 token。
4. → **I1/I2/I3/I4/I5 的期望值全部维持字面量口径，不改。** 原先"若提成 token 期望值要跟着改"的风险不再存在。

审计动作：色值判定只核对"渲染出来的颜色对不对"，**不再把设计稿自带的 `rgba()` 字面量本身计为违规**。若在 `src/design/` 里发现**设计稿中不存在的新色值**（如某个 `#xxxxxx` 在 tokens/app/glass 三份设计稿里都搜不到），判 FAIL。

### 5.4 `.paper` 的 `padding` 存在方案内自相矛盾（`已确认`）

- `app.css:556`：`padding: 54px 60px 44px`
- `ui-restore-plan.md` §2.2：搬到 `src/design/app.css` 时「规则声明**一字不改**」
- `ui-restore-plan.md` §5.3：`.paper` 的 **`padding` 必须改成 `0`**（boxes 已含页边距，保留会二次偏移）
- `ui-restore-plan.md` §8.3：保真守卫测试断言 `.paper` 含 `padding: 0`（"防回退"）

→ 「一字不改」与「改成 0」直接冲突。**口径已确认（主控 2026-10-29）：以 §5.3 + §8.3 为准，`.paper` 四边计算 padding 必须全为 `0px`。** 与 §4 偏差 1 是同一件事的两面，已合并进 **`D4` 的验法**（§2.3 末尾也把它列为同性质校验，不重复列闸），两处口径一致。

### 5.5 `.side__tab--on::after` 与 `.inspector__tab--on::after` 内缩量不同（`已裁决` 2026-10-29）

- `app.css:324`：`left:8px; right:8px`
- `app.css:481`：`left:6px; right:6px`

两者都是 2px 高、`bottom:-1px`、`#2f76d2` 底、圆角 `2px 2px 0 0`，只有内缩量差 2px。

**裁决（主控 2026-10-29）——按设计稿现状分列，不统一：** `app.css:324` 与 `app.css:481` **各自照抄**，**C2 判 8px、E2 判 6px**。理由：设计稿是唯一事实源，"看起来不齐"不构成修改依据，这正是 Amor 说的"不许顺手优化"。若日后 Amor 要求统一，那属于改设计稿，届时再改本清单。

→ 审计注意：**发现两处被改成同一个值（都是 8 或都是 6）→ C2 或 E2 判 FAIL**（说明有人"顺手优化"了）。

### 5.6 `.checkitem` 在同文件内被定义两次（`已确认`）

- `app.css:795-815`（§8）：`display:flex`，两栏（`.checkitem__side` 窄列 + `.checkitem__main` 主列）
- `app.css:1145-1155`（§14）：`display:block`，单栏

后者在同文件位置更靠后，**同特异性下后者胜出**，所以最终是单栏。但若移植时按"节"裁剪（只搬 §8 不搬 §14），会得到两栏。→ H4 已把 `display:block` 列为独立确认项。

### 5.7 `app.css` 注释里的 87% 是残留，与 `--rc-zoom` 冲突（`已确认`）

- `tokens.css:166-168` 注释：「Figma 稿标 87%，但稿内纸面按 0.6 缩放绘制 —— 这里取 60%」
- `app.css:543` 注释：「纸面容器：对外按 87%/63% 缩放」

→ 实际唯一生效值 `--rc-zoom: 0.6`。D3/D4 期望值按 **0.6** 判。`app.css:543` 的注释是过期文字，若被带入 `src/design/app.css`，建议顺手修掉（不构成不通过，但会误导后人）。

### 5.8 设计稿 `@import` Google Fonts 与离线截图的可复现性（`已确认`）

- `tokens.css:17` 从 `fonts.googleapis.com` 拉 Inter + Noto Sans SC。
- 本机若离线，headless 截图会回退系统字体 → 顶栏与纸面的字宽、换行位置与"理想渲染"不同，导致「并排比对」出现**非实现问题**的视觉差异。

→ 已确认（主控 2026-10-29）：**字号判定只量计算值，不比字宽与换行位置**（§4 偏差 3）。做整体并排比对时需知道这层噪声存在，不要把换行差异当缺陷报。另：产品侧必须删掉这个 `@import`，判定口径见 §4 偏差 3 与 §2.3 末尾的同性质校验。

### 5.9 `--rc-fz-*` 与 `--rc-p-fz-*` 两套字号易混（`已确认`）

界面层用 `--rc-fz-body:13px`、`--rc-fz-sm:12px`、`--rc-fz-xs:11px`、`--rc-fz-2xs:10px`（`tokens.css:97-103`）；纸面层用 `--rc-p-fz-body:14px`、`--rc-p-fz-sec:17px`、`--rc-p-fz-item:14px`、`--rc-p-fz-meta:11.5px`（`tokens.css:106-113`）。两套的 `body` 分别是 **13px** 和 **14px**，`p-fz` 多一档 `11.5px` 半像素值。

→ G1/G3/G4 只能引 `--rc-p-fz-*`，E4/I3 只能引 `--rc-fz-*`。若出现"纸面正文 13px"或"输入框 11.5px"，是引错了档，判不通过。这不是矛盾，是易错点，单列以防审错。

### 5.10 方案 §2.1 示例派生色不能由 `#2f76d2` 算出（`已裁决` 2026-10-29 · QA 提出）

**（A）数值不符，可用"单通道单调性"证伪，与混色公式无关**

`ui-restore-plan.md` §2.1 的示例代码块给出 6 个派生色并注明混白比例。按同一条要求「派生色必须由 `--rc-accent: #2f76d2` 实算，不得目测」逐档实算（算式见 §2.5），**6 个值全部对不上**：

| 档位 | 方案示例 | §2.5 实算 | 差 |
|---|---|---|---|
| `light-3`（30% 白） | `#5a92dc` | `#6d9fe0` | R −19、G −13、B −4 |
| `light-5`（50% 白） | `#86aeda` | `#97bbe9` | R −17、G −15、B −15 |
| `light-7`（70% 白） | `#b2cbea` | `#c1d6f2` | R −15、G −11、B −8 |
| `light-8`（80% 白） | `#c8dbf0` | `#d5e4f6` | R −13、G −9、B −6 |
| `light-9`（90% 白） | `#dee9f6` | `#eaf1fb` | R −12、G −8、B −5 |
| `dark-2`（20% 黑） | `#26609f` | `#265ea8` | R 0、G +2、B −9 |

**与公式无关的证伪**：向白色混合时混白比例越大，三个通道必须**单调不减**。而示例值的 **B 通道**是 `220 → 218 → 234 → 240 → 246`（light-3 → light-9）——**light-5 比 light-3 更暗**。任何"同一基色 + 递增混白"的方案都不可能产生这个序列，因此这 6 个值不是从 `#2f76d2` 算出来的（更像是从上一代调色板抄来的）。

→ **判定口径（已写入 §2.5）**：以 §2.5 实算值为准；**工程师照抄方案示例值 → P2 判 FAIL**。这也是"照抄文档反而违规"的一个陷阱，与 `.paper` padding 同类。

**（B）连带影响：§4 偏差 2 的对比度登记范围不全**

偏差 2 只登记了「`#2f76d2` 压在 light-9 上不达 AA」。实测（WCAG 相对亮度公式）：

| 组合 | 对比度 | AA 4.5:1 |
|---|---|---|
| `#2f76d2` on 白 `#ffffff` | **4.52:1** | 通过（与 `tokens.css:43` 注释一致） |
| `#2f76d2` on 方案示例 light-9 `#dee9f6` | **3.68:1** | 不通过（方案正文写「3.8:1」，与实测 3.68 有 0.12 偏差） |
| `#2f76d2` on 实算 light-9 `#eaf1fb` | **3.98:1** | 不通过 |
| `#2f76d2` on 实算 light-7 `#c1d6f2` | **3.05:1** | 不通过，且**比 light-9 更差** |
| `#2f76d2` on 方案示例 light-7 `#b2cbea` | **2.72:1** | 更差 |

问题在于：EP 的 plain 按钮 / hover 项常用 **light-7 / light-8** 作底，而 `light-7` 的对比度（3.05:1）比被登记的 `light-9` 更低。偏差 2 的结论（"EP 只服务探针，产品不用，因此接受"）**不受影响**，但**登记范围只覆盖了最不严重的那一档**。

**裁决结果（主控 2026-10-29，两问均已批复）**：

1. **派生色以实算为准** ✅ 主控独立复算，6 个值逐通道对上。方案 §2.1 示例块**已整体替换**，并补入：算式与舍入规则（`Math.round`，`.5` 进位）、逐通道实算表（标出 `186.5`/`232.5`/`250.5` 三处进位）、反例判定（出现旧 6 值中任一即 FAIL）。舍入规则写死的原因：主控首次复算用 Python 银行家舍入得 `#97bae8` / `#eaf1fa`，与 `Math.round` 差 2 值——差异只出在那 3 处 `.5` 上，见 §2.5。
2. **偏差 2 按实测改并补全登记** ✅ 方案偏差段已重写为三行表：白底 `4.52:1` 通过 / light-9 `3.98:1` 不通过 / **light-7 `3.05:1` 本组最差**。关键修正是「登记的是最不严重的那一档」——原方案只写 light-9（3.8:1），而 light-7 才是 EP plain 按钮最常用底色。
3. **P2 的 6 条派生色校验由 `BLOCKED` 转为可判** ✅ 判定规则见 §2.5 末尾：逐值等于实算值则 PASS；命中旧值或第三种值均 FAIL。**A 段落盘后实测：6 条逐值相符，已 PASS**（§2.4 快照 2）。

### 5.11 `glass.css` 保留了 `.idxcard` 死选择器（`已裁决` 2026-10-29 · **延后清理**）

**事实（实测）**：`.idxcard` 在 `src/design/app.css` 内 **0 定义**（索引页 §19 已按方案 §2.2 删除），在 `src/ui/**` 内 **0 使用**，但 `src/design/glass.css` 仍引用 **7 处**：行 141、155、166、172、175、298、299。

**为什么它还在（不是抄漏）**：方案 §2.3 要求 `glass.css` **整体替换**设计稿版本，且「只改一处」——即只删 `.idx` / `.specwrap`。按字面执行，`.idxcard` 就该保留。所以工程师**是照方案做的**，不是疏漏。

**矛盾点**：方案 §8.4 验收又要求「**无死代码**」。两条要求在此处冲突。

**影响评估**：**无视觉影响**（选择器不匹配任何元素即不生效），**不影响 43 条任何一项**，不产生渲染差异，体积可忽略（7 处选择器约 200 字节）。

**待裁决 → 已裁决（主控 2026-10-29）**：**保留，收尾时与文档同步一起清**。**不判缺陷、不阻塞 43 条。**

理由：① 匹配不到任何元素，零风险；② `glass.css` 刚通过色值双向 diff（25 vs 25 零差异），此刻动 7 处选择器就得重跑一遍基线，收益不抵成本。

审计处理：**不判缺陷**。收尾清理时一并处理，届时删除动作本身也不构成回归风险（无匹配元素）。

---

## 6. 当前状态：A 段已过闸门，但尚不可做全量审计

1. **A 段（设计系统落位）已于 2026-10-29 落地并通过全部 5 条闸门**——见 §2.4 快照 2：`tokens.css` 已换设计稿词表（`--rc-accent: #2f76d2`）、`app.css` 1341 行已落盘、`glass.css` 已换成 300 行设计稿版、`App.vue` 四层引入顺序正确、`.paper` 的 `padding: 0` 已落实。
2. **但 `src/ui/**` 尚未跟上**（实测）：`topbar` 在 `src/ui/` 命中 **0**、`compgrid` **0**、`p-name` **0**，而 `side__tab` 3、`inspector__tab` 3、`statusbar` 2、`compcard` 1 —— 说明 **D 段（外壳组件按设计稿 DOM 重写）尚未开始**，C 段（控件换类名）部分完成。
3. 后果：**43 条里依赖渲染的「像素」类暂时无法判**——应用此刻渲染出来的仍是旧骨架，截图量出来的数不代表设计稿，量了就是假阴性。**只有 10 条以「静态」为主的条目现在可判**（读 `src/design/{tokens,app,glass}.css` 的声明即可）。
4. 因此**本轮仍不出全量通过/不通过结论**。可立即执行的是「静态子集」的预检，用于在 D 段动手前发现"三层移植是否踩线"；「像素」子集待 D 段（及 B 段图标）落盘后，用 §1 的两张同尺寸截图比对。
5. 全量审计的触发条件不变：主控通知「UI 已定稿」（A→D，及 E 段）。触发后顺序：重跑 P1–P5 → 静态子集 → 起服务截 app 图 → 像素子集 → 核销 §4 的 3 条偏差 → §5 按已裁决口径执行。

---

## 7. 审计执行记录（预留）

> 审计开始时复制此表逐条填写。结论只允许 `PASS` / `FAIL` / `BLOCKED` / `N/A(偏差核销)`。
> §5 的 11 条**已全部裁决/确认**（5.11 判为「延后清理」，不阻塞）。**不应再出现 `BLOCKED`**；若出现，说明现场与裁决冲突，须立即上报主控。
> **43 条分两批执行，见下表「批次」列**：第一批（D 段）38 条，第二批（E 段）5 条。

**批次划分（2026-10-29 主控定）**

| 批次 | 时机 | 可判条数 | 组 |
|---|---|---|---|
| **第一批** | **D 段落盘** | **38** | A(4) B(5) C(5) D(5) E(5) F(4) H(4) I(6) |
| **第二批** | **E 段落盘** | **5** | G 纸面（G1–G5） |

**G 组为什么延后（不是漏做，是依赖引擎升级）**：D 段对 `CanvasView` 的约束是「只搭骨架，不排纸面结构」。因为 G 组要判的 `.p-sec__title` / `.p-item__head` / `.p-bullets` 依赖 `text-runs` 的**角色化行**（`section` / `item-title` 带 `trailing` / `item-role`），而现在是 v1 扁平三角色（title/body/bullet），**产不出分节结构**。升级 `text-runs` 属 E 段。故 G 组在 E 段落盘前无法判。

**第一批里 D 组 5 条仍可判**：它们纯几何（`canvas__bar` 36px、`scroll` padding、`paper-slot` 476.4×673.8、`paper` 794×1123 + `scale(.6)`、纸面底色），**不依赖文字排版**。

| 组 | 批次 | 条数 | PASS | FAIL | BLOCKED | 备注 |
|---|---|---|---|---|---|---|
| **P 组前置闸门** | 每批前 | **5** | **5** | **0** | — | **A 段落盘后全 PASS**，见 §2.4 快照 2。P2 判据：≥26 且覆盖桥接层全部 26 名（零悬空），超集不判缺陷，实测 28 条合法 |
| A 外壳 | 一 | 4 | | | | A2/A3 依赖 P1（`--rc-left-w` / `--rc-right-w`） |
| B 顶栏 | 一 | 5 | | | | 依赖 P1、P3 |
| C 左栏 | 一 | 5 | | | | 依赖 P1、P3、P4、P5 |
| D 画布 | 一 | 5 | | | | D4 含 `.paper padding=0` 校验；纯几何，不依赖文字排版 |
| E 右栏 | 一 | 5 | | | | 依赖 P1 |
| F 状态栏 | 一 | 4 | | | | 依赖 P1 |
| H 弹窗 | 一 | 4 | | | | 依赖 P4（`.dialog` 材质在 `glass.css`） |
| I 材质与动效 | 一 | 6 | | | | 依赖 P4、P5 与禁令 5.2-2 |
| **第一批小计** | — | **38** | | | | |
| G 纸面 | **二** | 5 | | | | **延后至 E 段**：依赖 `text-runs` 角色化行（v1 扁平三角色产不出分节） |
| **合计** | — | **43**（P 组另计 5） | | | | |

**第一批开跑前必须重跑的一项（2026-10-29 主控提醒）**：D 段之后 `src/ui/**` 会全部换成设计稿类名，之前实测的 `topbar 0 命中 / compgrid 0 / p-name 0` 会**全部翻转**。判之前先重跑类名命中统计，**确认 D 段真的落地了再展开 38 条**——否则就是在"类名还是旧的"状态下量像素，等于又一次"用间接指标替代直接证据"。

**⚠ 量法必须是运行时 DOM，不能是 grep 源码（2026-10-29 修正 · 第三次同型错误）**

我先写的命令是 `grep -rl "$c" src/ui/ | wc -l`，**这个判据不成立**，实测两个方向都会错：

| 错误方向 | 实例 | 后果 |
|---|---|---|
| **吃注释（假阳性）** | `AppShell.vue:4` 注释里写「旧版 `.rc-shell` 两层壳已废弃」→ 裸 grep 报「`rc-shell` 残留 1 个文件」 | 误判 D 段未完成 |
| **看不见动态拼接（假阴性）** | `RcTabList.vue:73/80` 用 `` :class="`${prefix}__tabs`" `` / `` `${prefix}__tab` `` **模板拼接**；源码里根本没有 `inspector__tab` 这个字面量，只有注释里有（3 个文件全是注释） | 误判「`.inspector__tab` 缺失」→ 按 §7.5 反而要报主控，而它其实可能完全正常 |

→ **类名覆盖率这类判定，量法只有一种合格：运行时 DOM。** 用 §7.3 的探针（它数的是 `document.querySelectorAll`），源码 grep 只可作粗筛且必须排除注释行：

```bash
# 唯一合格量法：运行时 DOM（探针输出 designCounts / legacyCounts）
npx vite --port 5273 --strictPort &
node scripts/ui-probe.mjs --url http://localhost:5273

# 粗筛（仅供定位，不得作为判定依据）：token 匹配 + 排除注释行
for c in rc-shell rc-toolbar rc-canvas__page; do
  printf "%-18s %s\n" "$c" "$(grep -rn --include=*.vue "$c" src/ui/ | grep -vE ':[0-9]+:[[:space:]]*(\*|//|/\*)' | wc -l)"
done
```

**判定标准（探针输出）**：

| 指标 | 通过条件 |
|---|---|
| `legacyCounts` 三项（`.rc-shell` / `.rc-toolbar` / `.rc-canvas__page`） | **全部为 0**（探针数的是真实 DOM，注释不会进来） |
| `designCounts` 中 D 段应负责的类名（`.topbar` `.side` `.canvas` `.canvas__bar` `.inspector` `.statusbar` `.side__tabs` `.side__tab` `.compgrid` `.compcard` `.pagerow` `.inspector__tabs` `.inspector__tab` `.field` `.input` `.paper`） | **全部 >0** |
| `.p-name` | **允许为 0**（归 G 组，等 E 段） |

截图留档（执行时填）：

| 名称 | 路径 | 字节数 | 像素 |
|---|---|---|---|
| 设计稿基准 | `%TEMP%/mockup-01.png` | 377,268（368.4 KB，已实测 2026-10-29） | 1440 × 900 |
| 应用当期 | 待填 | 待填 | 待填 |

四门原始输出（**收尾必填，只填我当次亲手跑的结果**）：

| 门 | 命令 | 原始输出（末几行） | 退出码 | 实测时间 |
|---|---|---|---|---|
| lint | `pnpm lint` | 待填 | 待填 | 待填 |
| type-check | `pnpm type-check` | 待填 | 待填 | 待填 |
| test | `pnpm test` | 待填（**必须含 `Tests` 汇总行的原文，测试条数以这行为准**） | 待填 | 待填 |
| build | `pnpm build` | 待填 | 待填 | 待填 |

> **测试条数口径（§2.6）**：只认上表 `pnpm test` 汇总行的原文。2026-10-29 曾出现工程师两份报告写 `554` 与 `548` 的情形，差 6 条；转述数字一律不采信，包括主控转述的。

### 7.1 静态子集预检结果（2026-10-29 · A 段落盘后 · **仅供预警，不是审计结论**）

`src/ui/**` 尚未跟上（D 段未做），33 条「像素」项不可判。先把 43 条中依赖**声明**的部分读了一遍——10 条静态主导项（A1 / B4 / E4 / F4 / H2 / I1 / I2 / I3 / I5 / I6）的声明侧**全部命中**：

| 条 | 校验点 | 实测 |
|---|---|---|
| A1 | `.app` | `flex-direction: column` + `height: 100vh` + `min-height: 860px` ✅ |
| B4 | `.brand__name` / `.docmeta__name` / `.docmeta__sub` | 三条选择器均在（行 72 / 80 / 84）✅ |
| E4 | 输入控件尺寸 | `.input,.textarea,.select { height: 30px }` ✅；`.textarea` `min-height:74px` ✅；`.textarea--tall` `96px` ✅ |
| F4 | `.statusbar` 不得有 `position` | 块内 `position` 命中 **0** ✅（默认 static） |
| H2 | `.dialog` | `max-height: calc(100vh - 120px)` ✅、`--md 620px` ✅、`--lg 780px` ✅ |
| I1 | 极光底 | `radial-gradient` **4** 处 ✅ |
| I2 | 外壳五选择器材质 | `.topbar, .statusbar, .actionbar, .side, .inspector` + `rgba(255,255,255,0.62)` + `blur(18px) saturate(140%)` ✅（`-webkit-` 前缀在） |
| I3 | `.btn` 尺寸五档 | `30` / `sm 26` / `lg 36` / `xl 40` / `icon 30` ✅ |
| I5 | 卡片悬停两组 | `translateY(-6px) scale(1.008)` ✅ 与 `translateY(-8px) scale(1.012)`（tpl/idx 例外）✅ |
| I6 | 圆角四档 + 呼吸环 | `4px / 7px / 10px / 14px` ✅；`inset: -1px` + `animation: rcBreath var(--rc-breathe)` ✅ |

**顺带做的两项全量比对（这两件 43 条里没有，但比单条更有说服力）**：

| 比对 | 方法 | 结果 |
|---|---|---|
| 色值集合一致性 | 双向 `comm` 比对 `docs/design/mockups/figma/` 与 `src/design/` 的 hex+rgba 集合 | `app.css` 4 vs 4、`glass.css` 25 vs 25，**零新增零缺失**；`tokens.css` 设计稿 30 种 → src 36 种，**多出的恰为 6 条实算派生色**，无其他新增，也无缺失。旧 v3 调色板 `#0b7298` 残留 **0** ✅ |
| 两处「必须不同」的内缩 | `.side__tab--on::after` vs `.inspector__tab--on::after` | `left/right: 8px` vs `left/right: 6px` ✅ **保持不同**（§5.5 裁决要求，未被"顺手统一"） |

**一个自查纠正（已升级为硬规矩 §2.7）**：我最初用字面量 `grep "padding: 32px 24px 20px"` 判 D2，得到 0 命中、误报"缺失"。读原文后发现设计稿写的是 `padding: 32px var(--rc-s6) 20px`（`--rc-s6` 解析为 24px），**声明是对的，是我的匹配模式错了**。教训已写死在 **§2.7**：**静态校验一律比对源码声明的字面形态，只有运行时判定才看计算值**。这不是 D2 一处的特例——拿解析值 grep 源码，碰上任何 `var()` 都会假阴性。

> 本节只是"移植有没有漏声明"的预警，**不构成 43 条的通过结论**。像素项待 D 段落盘后按 §1 口径截图判定。

### 7.2 死选择器扫描（2026-10-29 · A 段后 · LOW）

方法：提取 `glass.css` 全部类名，与 `app.css` 定义集做 `comm -23`，再查 `src/ui` 是否有使用。

| 潜在死选择器 | 实测 | 结论 |
|---|---|---|
| `.compgrid` | `app.css` 无定义，但 `glass.css:194` 自有完整定义（两列网格） | **非死**——设计稿本就在 glass 层新增此类 |
| `.dot` | 来自 `.dot-paper` / `.dot-border-strong` / `.dot-accent-soft`，`src` 内 3 处使用 | **非死**——`.dot-paper` 供属性面板「强调色」色块（`01-editor.html:313` 的 `.colorfield__chip dot-paper`），产品需要 |
| **`.idxcard`** | `app.css` 无定义；`src/ui` **0 处使用**；`glass.css` 仍有 **7 处**引用（行 141 / 155 / 166 / 172 / 175 / 298 / 299） | **死选择器**，源于已删除的索引页（§19）。**不影响视觉、不影响 43 条任何一项**。已裁决 **保留、不判缺陷、收尾清理**，详见 §5.11 |

**附带确认（正确删除的部分）**：`app.css` 内 `.dot-*` 工具类为 **0**；`glass.css` 内 `.idx` / `.specwrap` 已去净（仅剩 `.idxcard`），`.app { position: relative; z-index: 1; }` 与 `.canvas, .sheet, .page` 保留正确。

**桥接层全量覆盖复核**（含非 color 旧名，比方案只提 color 更全）：`element-plus-bridge.css` 引用 **49** 个旧名（26 color + 23 非 color），逐个比对 `tokens.css`：**悬空 0 个**。方案 §2.1 原文只提到 color 一类，非 color 的 23 个同样会静默失效，已一并纳入 §2.4 的 P2 判定说明。


### 7.3 管道体检结果（2026-10-29 · A 段后 · **用途仅限「管道通不通」，不是审计依据**）

**动机**：`App.vue` 的 4 层 `@import` 是否真被 Vite 解析、路径有无 404，是 D 段重写 6 个组件的前置条件。管道坏 → D 段全部白干。此检查 5 分钟可排除，等 D 段做完才发现就是半天。

**工具**：`scripts/ui-probe.mjs`（新增，走 CDP）。与 `ui-shot.mjs` 分工：shot 出 PNG 供量像素（审计依据），probe 出 JSON 供机器判（体检，非审计依据）。

为什么必须走 CDP 而不是看截图：`font-family` / `backgroundColor` 的真值只能靠 `getComputedStyle` 读到；字体回退与真字体的差异在 PNG 上是不可判的。CDP 还能顺带收到控制台报错。

**命令与结果**：

```bash
npx vite --port 5273 --strictPort        # 用独立端口，不碰工程师可能占用的 5199
node scripts/ui-probe.mjs --url http://localhost:5273
```

| 检查 | 期望 | 实测 | 判定 |
|---|---|---|---|
| body 字族**声明** | = `--rc-font` 解析值 | `Inter, "Noto Sans SC", -apple-system, "Segoe UI", sans-serif` —— 与 token 逐字一致 | PASS（但**本条不足以证明字体加载**，见下） |
| **字体真实加载** | `document.fonts` 各面 `status=loaded` | **A 段当时不成立**（假阳性，见下）；**主控修复后实测成立**：`Rc Sans` 3 面全 loaded、`Inter` 3 面全 loaded、`Rc Serif` 2 面 loaded，**5 个 woff2 请求全 200** | 修复后 **PASS** |
| body 背景色 | = `--rc-canvas` | `rgb(237, 241, 247)` ↔ token `#edf1f7` **一致** | **PASS** |
| 控制台 / 资源 | 无样式类错误 | 干净（唯一 404 是 `favicon.ico`，Vite 默认无图标，与管道无关，已排除） | **PASS** |
| 样式是否内联 | 4 层都在 | `App.vue` style 模块 **85,495 字节**，内含 `--rc-accent: #2f76d2`、`@font-face`、`.topbar`、`canvas__scroll`、`compgrid`、`rcBreath` 全部指纹；4 个 CSS 端点均 **HTTP 200** | **PASS** |
| 旧骨架类名残留（进度） | D 段后应为 0 | `.rc-shell`×1、`.rc-toolbar`×1、`.rc-canvas__page`×1 | INFO |
| 设计稿类名出现（进度） | D 段后半应 | **3/17**：`.side__tabs`×1、`.side__tab`×3、`.field`×6 | INFO |

**结论：管道通。** `tokens.css` 的两条基底（字族、画布底色）已在运行中的页面上生效，说明 `tokens → fonts → app → glass` 四层被 Vite 正确解析并内联，无路径错误、无 404。

### 7.3.1 假阳性更正 + 字体三处断层（2026-10-29 · 主控发现）

**我的错误**：上面那一行「body 字族 = `--rc-font` 解析值 → PASS」**是假阳性**。`getComputedStyle().fontFamily` 返回的是**声明值的解析结果**，不证明字体文件被加载。详见 §2.6.0。

**主控顺着这条查出的三处断层**（本人已复验）：

| 环节 | 声明的族名 | 当时实际生效 |
|---|---|---|
| `fonts.css` | `'Rc Sans'` / `'Rc Serif'` | **全项目无人引用**，5 个 woff2（5.6MB）**从不下载** |
| `--rc-font`（外壳） | `'Inter', 'Noto Sans SC', …` | 系统回退（Segoe UI / 微软雅黑） |
| `RESUME_FONT_FAMILY`（测量/纸面） | `'Noto Sans SC', 'Source Sans 3', …` | 系统回退（另一个栈） |
| PDF 嵌入 | `rc-sans-400.ttf` | 真实 Noto Sans SC 子集 |

→ **预览、测量、导出用的是三个不同字体**，"预览即所得"不成立；且 `fonts-ready.ts` 在等 `'Rc Sans'` 就绪，而该族恰好是唯一没人用的。

**修复（主控改，本人复验通过）**：

| 文件 | 改动 | 我的复验 |
|---|---|---|
| `src/design/fonts.css` | 补 3 条 `@font-face`，把设计稿族名 `'Inter'` **别名到本地 rc-sans 文件**（400/500/700）；文件内诚实声明「叫 Inter 的那份不是 Inter，是 Noto Sans SC 子集西文部分」 | `grep` 到 3 条 `font-family: 'Inter'`，src 分别指向 `rc-sans-400/500/700.woff2` ✅ |
| `src/layout/compose.ts` | `RESUME_FONT_FAMILY` 首项改为 `'Rc Sans'`，回退链保留 `'Inter'` | 实测为 `"'Rc Sans', 'Inter', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"` ✅ |

**修复后实测（`document.fonts`）**：

| 族 | 各字重 status | 字体请求 |
|---|---|---|
| `Rc Sans` | 400:loaded　500:loaded　700:loaded | 全 200 |
| `Inter`（别名） | 400:loaded　500:loaded　700:loaded | 全 200 |
| `Rc Serif` | 400:loaded　600:loaded | 全 200 |

合计 **5 个 woff2 请求，状态全 200** —— 5.6MB 终于真的被下载并使用。

**工具已升级**：`scripts/ui-probe.mjs` 增加 `document.fonts` 判据（显式 `load()` 触发 + 读 `status` + CDP 侧统计 `.woff2` 请求数），并把原「font」检查改名为「**font-decl**」并标注"仅证明 token 生效，不证明字体已加载"。**这是本次事故留下的永久防线。**


**结构性观察（对主控检查 2 的精确回答）**：截图（`$TEMP/app-skeleton-2026-10-29.png`，536,899 字节，1440×900）显示的是**旧骨架**，但它**既不是"裸 DOM 堆叠"，也不是"有材质无结构"**，而是第三种状态：

- 旧包裹层 `.rc-shell` / `.rc-toolbar` / `.rc-canvas__page` 在新样式层下**确实无任何样式**（`app.css`/`glass.css` 里没有 `.rc-*`），但这些包裹层是**纯容器**，塌了不影响子元素排布；
- 子组件已部分换用设计稿类名（`.side__tab`、`.field`、`.statusbar` 等 C 段已做），所以整体仍成形；
- 顶栏/左栏/纸面/右栏/状态栏五区都在，无错误遮罩、无红色报错、无空白块。

→ **不存在"部分类名撞车导致材质有但结构崩"的情形**。D 段要换的是外壳 DOM 结构，不是修管道，风险可控。

**D 段后复核项（2026-10-29 记，主控要求）**

| # | 复核项 | 当前状态 | D 段后动作 |
|---|---|---|---|
| 1 | **状态栏「缩放 87%」硬编码** | 旧组件里写死 `87%`，而 `--rc-zoom` 是 `0.6`。旧组件硬编码不在 43 条范围，故当前不判缺陷 | 落盘后跑 `grep -rn "87%" src/ui/`。**应为 0 命中**；若仍有，说明 `StatusBar.vue` / `CanvasView.vue` 没真正重写，判 D 段未完成 |
| 2 | `.idxcard` 7 处死选择器 | 见 §5.11，已裁决延后清理 | 收尾清理，非 D 段义务 |
| 3 | 设计稿类名 3/17 → 应 17/17 | 见 §7.5 | 见 §7.5 命令块 |


> **本节任何数据都不构成 43 条的判定依据。** 视觉差异一律不记录、不判 FAIL。

### 7.4 B 段图标核对（2026-10-29 · 实测）

主控更正：方案原文写「60 个图标」是笔误，实测 **52**。本清单 §3 未引用过「60」，无需修改；此处记录实测基准，供 B 段验收用。

| 项 | 命令 | 实测 |
|---|---|---|
| 设计稿键数 | 解析 `icons.js` 的 `P` 对象 | **52** |
| 产品键数 | 解析 `src/ui/controls/icons.ts` 的 `ICON_PATHS` | **52**（23 个带引号键 + 29 个无引号键） |
| 键集合差异 | 双向比对 | **零差异**（仅 js 有：无；仅 ts 有：无） |

**判定口径**：B 段验收要求 **52 条、键集合与设计稿完全一致**。少一条 → 等于有图标渲染为空 svg；多一条 → 自创图标。两者都判 FAIL。
（图标本身不在 43 条内——43 条是样式与几何；图标属 B 段功能性验收，此处仅固化数字基准。）

### 7.5 D 段落地确认（第一批开跑前的强制前置）

见 §7 「批次划分」下的命令块。**三个数不达标就不展开 38 条**：设计稿类名命中应全部 >0、旧外壳类名应全部归零。

这条是防"用间接指标替代直接证据"的第五次提醒：D 段后类名会翻转，不重跑就在旧状态量像素，等于假阴性。

**已确认的进度信号（2026-10-29 探针实测 14/17，主控确认不是缺陷）**：

| 缺失类名 | 原因 | 处理 |
|---|---|---|
| `.p-name` | **预期缺失**。D 段 `CanvasView` 只搭骨架，纸面按 role 渲染（v1 只有 title/body/bullet），不做 `displayName → .p-sec__title`、也不拼 `.p-header` | 归 G 组，等 E 段 |
| `.inspector__tabs` / `.inspector__tab` | `PropertyPanel` 还没换完，在 ③ 段范围 | **见下方分叉处理** |

> **⚠ `.inspector__tab` 为 0 时不能直接判"D 段未完成"**。它有两种可能，处理方式不同：
> 1. **③ 段还没轮到** → 正常，继续等；
> 2. **D 段漏了** → 必须退回返工。
> **两种情形在类名统计上看起来完全一样**，所以我方无法自行区分——**必须先报主控确认，不得自行判 FAIL 后收工**。

### 7.6 第一批执行顺序（2026-10-29 主控定 · **按序执行，前一步不过不进下一步**）

| 步 | 动作 | 依据 | 不过怎么办 |
|---|---|---|---|
| 0 | **基线校验**：存档零改动 + `app.css:556` 仍为 `padding: 54px 60px 44px` | §2.9 | **立即停手报主控**——基线被动过，后面全部无意义 |
| 1 | 闸门 **P1–P5** | §2.3 / §2.4 | 任一不过 → 整体 `BLOCKED`，报告并停 |
| 2 | **类名翻转确认**：设计稿类名全部 >0、旧外壳类名归零 | §7.5 | 旧类名未归零 → 判 D 段未落地；**`.inspector__tab` 单独为 0 → 先报主控**（可能是 ③ 段未轮到，也可能是漏了，两者统计上无法区分），不自行判 FAIL |
| 3 | **色值双向 diff** | §2.8 | 有新增/缺失 → 判 FAIL 并定位到具体 file:line |
| 4 | **管道体检**（含 `document.fonts` 字体真实加载） | §7.3 / §2.6.0 | 引入顺序错 / 字体未加载 → 停手，38 条会全盘失真 |
| 5 | **`grep -rn "87%" src/ui/`** | §7.3 复核项 | 仍有命中 → 判 `StatusBar`/`CanvasView` 未真重写 |
| 6 | **38 条**（A B C D E F H I） | §3 | 逐条 PASS / FAIL |
| 7 | 核销 §4 的 3 条偏差 | §4 | 只核销，不判缺陷 |
| 8 | 出报告 + 填 §7 的四门原始输出表 | §2.6 | — |

G 组（5 条）不进第一批，等 E 段（见 §7 批次划分）。

**体检放在 38 条之前的原因**（主控定）：D 段会动 `App.vue` 附近结构，若四层引入顺序被动过，38 条会全盘失真；而体检 5 分钟就能排除，不该留到跑完 38 条再回头查。

### 7.7 测试基线（2026-10-29 实测，供收尾对账）

| 项 | 命令 | 原始输出 |
|---|---|---|
| 设计保真测试 | `npx vitest run tests/design/fidelity.test.ts` | `Test Files 1 passed (1)` / **`Tests 17 passed (17)`** / 1.67s |

**当前 fidelity.test.ts 已覆盖的守卫（我复验过断言原文）**：

| 守卫 | 断言形态 |
|---|---|
| `.paper` padding 必须 0 | `toMatch(/padding:\s*0\s*;/)` —— **正则，不是 `toContain`**，`padding: 0 8px` / `padding: 0px` 都会被拦 |
| `@font-face` 面数 | `toHaveLength(8)`（`Rc Sans`×3 + `Rc Serif`×2 + `Inter` 别名×3） |
| `'Inter'` 是别名不是真 Inter | 恰好 3 条，且每条 `src` 含 `rc-sans-`；**防"被删后静默回退而 computedStyle 仍显示 Inter"** |
| `ICON_PATHS` 条数 | `toHaveLength(52)` |
