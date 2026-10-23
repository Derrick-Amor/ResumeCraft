# -*- coding: utf-8 -*-
"""从 01-editor.html 生成多主色版本主页。
派生色按 Element Plus 约定现算，避免手抄出错：
  hover  = 8% 黑, active = 16% 黑, dark-2 = 20% 黑
  subtle = 92% 白, light-N = N*10% 白
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT.parent / "01-editor.html"

PALETTES = [
    ("royal",       "宝蓝", "#1f5fa8", "正蓝。和 Word 蓝同族但不撞，最“简历”。"),
    ("navy",        "藏蓝", "#1c4a72", "更深的正蓝。银行、国企、法务这类场合最稳。"),
    ("ultramarine", "群青", "#3b4d9e", "蓝里掺紫。比宝蓝年轻，记忆点更强。"),
    ("violet",      "墨紫", "#5a4b8f", "克制的紫，不甜不艳。差异化最明显的一支。"),
    ("graphite",    "石墨", "#37505c", "近中性的深蓝灰。最安静，纸面独占注意力。"),
    ("cocoa",       "深咖", "#6b4a2f", "暖褐，像纸与墨。气质温和，和简历的纸质感呼应。"),
]


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(c))) for c in rgb)


def mix_white(rgb, pct):
    return rgb2hex(tuple(c * (1 - pct) + 255 * pct for c in rgb))


def mix_black(rgb, pct):
    return rgb2hex(tuple(c * (1 - pct) for c in rgb))


def lumin(rgb):
    out = []
    for c in rgb:
        c = c / 255
        out.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]


def contrast_white(hexv):
    return 1.05 / (lumin(hex2rgb(hexv)) + 0.05)


def block(name, primary):
    rgb = hex2rgb(primary)
    r, g, b = rgb
    return f""":root[data-palette="{name}"] {{
  --rc-color-primary: {primary};
  --rc-color-primary-hover: {mix_black(rgb, 0.08)};
  --rc-color-primary-active: {mix_black(rgb, 0.16)};
  --rc-color-primary-subtle: {mix_white(rgb, 0.92)};
  --rc-color-primary-light-3: {mix_white(rgb, 0.30)};
  --rc-color-primary-light-5: {mix_white(rgb, 0.50)};
  --rc-color-primary-light-7: {mix_white(rgb, 0.70)};
  --rc-color-primary-light-8: {mix_white(rgb, 0.80)};
  --rc-color-primary-light-9: {mix_white(rgb, 0.90)};
  --rc-color-primary-dark-2: {mix_black(rgb, 0.20)};
  --rc-focus-ring-color: rgba({r}, {g}, {b}, 0.45);
  --rc-focus-ring: 0 0 0 2px rgba({r}, {g}, {b}, 0.45);
}}
"""


def palette_css():
    head = """/*
 * 主色候选色板（TC-016 视觉评审用，非生产 token）
 * ------------------------------------------------------------------
 * 这里是全项目第二处、也是唯一一处允许出现裸 hex 的探索性文件。
 * 目的：让 6 个版本共用同一份 HTML，只换 --rc-color-primary 一族。
 * 一旦选定，选定值写回 src/design/tokens.css，本目录整体删除。
 *
 * 派生规则与 tokens.css §5 完全一致（EP 约定）：
 *   hover = 8% 黑 / active = 16% 黑 / dark-2 = 20% 黑
 *   subtle = 92% 白 / light-N = N×10% 白
 */
"""
    body = "\n".join(block(n, p) for n, _, p, _ in PALETTES)
    swatches = "\n".join(f'.sw-{n} {{ background: {p}; }}' for n, _, p, _ in PALETTES)
    return head + body + "\n/* 对比页上的色块，避免在 HTML 里写 hex */\n" + swatches + "\n"


def nav(current):
    items = ['<a href="compare.html">六色对比</a>']
    for n, label, hexv, _ in PALETTES:
        cls = " is-current" if n == current else ""
        items.append(f'<a href="{n}.html"{cls}>{label}</a>')
    return '<div class="mock-nav">' + "".join(items) + "</div>"


def build():
    html = SRC.read_text(encoding="utf-8")

    # 只保留 .app，去掉原导航（由色板导航替代）
    html = re.sub(r'<div class="mock-nav">[\s\S]*?</div>\n', "", html, count=1)
    # 路径深了一层
    html = html.replace('href="../../../src/design/tokens.css"', 'href="../../../../src/design/tokens.css"')
    html = html.replace('href="mockup.css"', 'href="../mockup.css"')
    # 挂色板
    html = html.replace('<link rel="stylesheet" href="../mockup.css">',
                        '<link rel="stylesheet" href="../mockup.css">\n<link rel="stylesheet" href="palettes.css">')
    # data-palette 占位
    for name, label, hexv, desc in PALETTES:
        page = html.replace('<html lang="zh-CN">', f'<html lang="zh-CN" data-palette="{name}">')
        page = page.replace("<body>", "<body>\n" + nav(name))
        page = page.replace(
            "<title>01 主编辑器五区域 · ResumeCraft 视觉稿</title>",
            f"<title>{label}候选版 · ResumeCraft 主编辑器</title>")
        (ROOT / f"{name}.html").write_text(page, encoding="utf-8")

    (ROOT / "palettes.css").write_text(palette_css(), encoding="utf-8")


def compare():
    cards = []
    for name, label, hexv, desc in PALETTES:
        cr = contrast_white(hexv)
        cards.append(f"""
    <section class="card">
      <header>
        <span class="dot sw-{name}"></span>
        <b>{label}</b>
        <code>{hexv[1:].upper()}</code>
        <span class="cr">白字 {cr:.2f}:1</span>
        <a class="open" href="{name}.html" target="_blank">单独打开</a>
      </header>
      <p>{desc}</p>
      <div class="shot"><iframe src="{name}.html" scrolling="no" title="{label} 主编辑器"></iframe></div>
    </section>""")

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>主色候选 · 六版主页对比</title>
<style>
  body {{ margin:0; padding:24px; background:#f1f3f4; color:#2b2b2b;
         font-family: -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif; }}
  h1 {{ font-size:20px; font-weight:600; margin:0 0 6px; }}
  .sub {{ font-size:13px; color:#5b636b; margin:0 0 20px; line-height:1.7; }}
  .grid {{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:18px; }}
  .card {{ background:#fff; border:1px solid #e4e7ea; border-radius:10px; padding:12px 14px 14px;
           box-shadow:0 1px 2px rgba(43,43,43,.06); }}
  header {{ display:flex; align-items:center; gap:8px; font-size:13px; }}
  .dot {{ width:14px; height:14px; border-radius:4px; display:inline-block; }}
  code {{ font-size:12px; color:#5b636b; }}
  .cr {{ margin-left:auto; font-size:12px; color:#5b636b; }}
  .open {{ font-size:12px; color:#107093; text-decoration:none; border-left:1px solid #e4e7ea; padding-left:8px; }}
  p {{ font-size:12px; color:#5b636b; margin:8px 0 10px; line-height:1.6; }}
  .shot {{ position:relative; height:356px; overflow:hidden; border:1px solid #e4e7ea; border-radius:8px; background:#f9f9f9; }}
  .shot iframe {{ width:1440px; height:900px; border:0; transform:scale(.395); transform-origin:top left; }}
</style>
</head>
<body>
<h1>主色候选 · 六版主页对比</h1>
<p class="sub">同一份 HTML、同一套组件，只换 <code>--rc-color-primary</code> 一族（派生色按 EP 约定现算，白字对比度均 &ge; 4.5）。
缩略图看不清时点「单独打开」，或直接用顶部色板条在六版之间来回切。</p>
<div class="grid">{''.join(cards)}
</div>
</body>
</html>
"""


if __name__ == "__main__":
    build()
    (ROOT / "compare.html").write_text(compare(), encoding="utf-8")
    print("built:", ", ".join(n for n, *_ in PALETTES))
