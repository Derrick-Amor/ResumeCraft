# -*- coding: utf-8 -*-
"""三套语言 · 编辑器屏 1:1（不做缩放，纸恒 794）"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PAPER = (pathlib.Path(__file__).resolve().parent.parent / "explore" / "_paper.html").read_text(encoding="utf-8")

A_CSS = """
:root{--p:#191a1c;--bg:#f4f3ef;--line:#d8d6cf;--line2:#b4b1a8;--meta:#6e747c;--mark:#b02a20}
body{background:var(--bg);color:var(--p);font-family:"Inter","Noto Sans SC",sans-serif}
.shell{height:100vh;display:grid;grid-template-columns:56px 1fr 272px;grid-template-rows:44px 1fr 26px;
  grid-template-areas:'top top top' 'rail stage panel' 'rail foot foot'}
.top{grid-area:top;display:flex;align-items:center;gap:14px;padding:0 18px;border-bottom:1px solid var(--line)}
.serif{font-family:"Noto Serif SC","Source Serif 4",serif;font-weight:600;letter-spacing:-.01em}
.fname{font-size:14px}
.mono{font-family:"JetBrains Mono",Consolas,monospace;font-variant-numeric:tabular-nums}
.sp{flex:1}
.tb{height:28px;padding:0 10px;border:1px solid var(--line2);background:#fff;border-radius:2px;font-size:12px;font-family:inherit;cursor:pointer}
.solid{height:28px;padding:0 14px;border:0;background:var(--p);color:#fff;border-radius:2px;font-size:12px;font-family:inherit;cursor:pointer}
.rail{grid-area:rail;border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding-top:10px;gap:2px}
.rail b{width:36px;height:36px;display:grid;place-items:center;color:#8b8b86;border-radius:2px;cursor:pointer;font-weight:400}
.rail b.on{color:var(--p);border:1px solid var(--p)}
.stage{grid-area:stage;overflow:auto;display:flex;justify-content:center;padding:34px 24px 48px}
.paper-wrap{position:relative}
.ruler{position:absolute;top:-20px;left:0;right:0;height:16px;border-bottom:1px solid var(--line2);display:flex;justify-content:space-between;font-size:9px;color:var(--meta);font-family:"JetBrains Mono",monospace}
.crop{position:absolute;inset:-10px;pointer-events:none}
.crop i{position:absolute;width:10px;height:10px;border:1px solid var(--mark)}
.crop i:nth-child(1){top:0;left:0;border-right:0;border-bottom:0}
.crop i:nth-child(2){top:0;right:0;border-left:0;border-bottom:0}
.crop i:nth-child(3){bottom:0;left:0;border-right:0;border-top:0}
.crop i:nth-child(4){bottom:0;right:0;border-left:0;border-top:0}
.note{margin-top:14px;font-size:11px;color:var(--meta);display:flex;gap:10px;align-items:center}
.note b{color:var(--mark);font-weight:400;font-family:"JetBrains Mono",monospace}
.panel{grid-area:panel;border-left:1px solid var(--line);background:#fff;overflow:auto}
.ph{height:34px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid var(--line);
  font-size:12px;letter-spacing:.06em;text-transform:none;color:var(--meta)}
.pr{display:grid;grid-template-columns:1fr auto;align-items:center;height:28px;padding:0 14px;border-bottom:1px solid #efece6;font-size:12px}
.pr b{font-weight:400;font-family:"JetBrains Mono",monospace;font-size:11px}
.foot{grid-area:foot;display:flex;align-items:center;gap:16px;padding:0 14px;border-top:1px solid var(--line);
  font-size:11px;color:var(--meta);font-family:"JetBrains Mono",monospace}
"""

A_BODY = """
<div class="shell">
  <header class="top">
    <span class="serif" style="font-size:15px">ResumeCraft</span>
    <span class="fname">张明 — 后端开发工程师</span>
    <span class="sp"></span>
    <span class="mono" style="font-size:11px;color:var(--meta)">已保存 14:32</span>
    <button class="tb">预览</button>
    <button class="solid">导出</button>
  </header>
  <nav class="rail">
    <b class="on"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M9.5 10v9.5"/></svg></b>
    <b><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/></svg></b>
    <b><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9"/></svg></b>
    <b><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/></svg></b>
  </nav>
  <main class="stage">
    <div>
      <div class="paper-wrap">
        <div class="ruler"><span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span><span>70mm</span></div>
        <div class="crop"><i></i><i></i><i></i><i></i></div>
        PAPER
      </div>
      <div class="note"><b>01</b> 教育经历 · 12.5pt / 1.65 / 段前 12pt　<b style="color:var(--mark)">↑ 2 处溢出</b></div>
    </div>
  </main>
  <aside class="panel">
    <div class="ph">规格 · 文本</div>
    <div class="pr"><span>字号</span><b>12.5 pt</b></div>
    <div class="pr"><span>行高</span><b>1.65</b></div>
    <div class="pr"><span>字重</span><b>500</b></div>
    <div class="pr"><span>段前</span><b>12 pt</b></div>
    <div class="pr"><span>段后</span><b>4 pt</b></div>
    <div class="pr"><span>对齐</span><b>左</b></div>
    <div class="ph">分页</div>
    <div class="pr"><span>标题不孤行</span><b>开</b></div>
    <div class="pr"><span>允许拆分</span><b>开</b></div>
  </aside>
  <footer class="foot"><span>第 1 / 2 页</span><span>100%</span><span>1,286 字</span><span>A4 · 20mm</span></footer>
</div>
"""

B_CSS = """
:root{--p:#146b45;--bg:#f6f7f6;--line:#e2e5e3;--fg:#14181a;--muted:#5a6360;--meta:#6b7472;--dark:#151a1d}
body{background:var(--bg);color:var(--fg);font-family:"Inter","Noto Sans SC",sans-serif}
.shell{height:100vh;display:grid;grid-template-columns:240px 1fr 320px;grid-template-rows:40px 32px 1fr 28px;
  grid-template-areas:'top top top' 'tab tab tab' 'left stage right' 'status status status'}
.top{grid-area:top;display:flex;align-items:center;gap:10px;padding:0 12px;background:#fff;border-bottom:1px solid var(--line)}
.tab{grid-area:tab;display:flex;align-items:center;gap:2px;padding:0 12px;background:#fff;border-bottom:1px solid var(--line)}
.pg{height:24px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:5px;font-size:12px;color:var(--muted);cursor:pointer}
.pg.on{background:#eef4f0;color:var(--p);font-weight:500}
.dot{width:5px;height:5px;border-radius:50%;background:#c9d1cd;display:inline-block}
.dot.w{background:#965b00}
.left{grid-area:left;background:#fff;border-right:1px solid var(--line);overflow:auto}
.grp{font-size:11px;color:var(--meta);padding:10px 12px 4px;letter-spacing:.06em}
.li{display:flex;align-items:center;gap:8px;height:28px;padding:0 12px;font-size:12px;color:var(--fg);cursor:grab}
.li:hover{background:#f3f5f4}
.stage{grid-area:stage;overflow:auto;display:flex;justify-content:center;padding:28px 24px 40px}
.paper-wrap{position:relative}
.right{grid-area:right;background:#fff;border-left:1px solid var(--line);overflow:auto}
.rhead{height:36px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid var(--line);font-size:12px;font-weight:500}
.f{display:flex;align-items:center;justify-content:space-between;height:30px;padding:0 14px;font-size:12px;color:var(--muted)}
.f b{font-weight:400;color:var(--fg);font-family:"Inter",sans-serif}
.slot{width:40px;height:24px;background:#f2f4f3;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:var(--meta)}
.status{grid-area:status;background:var(--dark);color:#c9d1cd;display:flex;align-items:center;gap:18px;padding:0 12px;font-size:11px}
.status .warn{color:#ffb27a}
.status .ok{color:#3ddc84}
"""

B_BODY = """
<div class="shell">
  <header class="top">
    <span style="font-size:13px;font-weight:590">ResumeCraft</span>
    <span class="sp" style="flex:1"></span>
    <span style="font-size:12px;color:var(--muted)">张明-后端开发工程师-2026届</span>
    <span class="sp" style="flex:1"></span>
    <button style="height:28px;padding:0 12px;border:1px solid var(--line);background:#fff;border-radius:5px;font-size:12px;font-family:inherit">预览</button>
    <button style="height:28px;padding:0 14px;border:0;background:var(--p);color:#fff;border-radius:5px;font-size:12px;font-family:inherit">运行导出</button>
  </header>
  <nav class="tab">
    <span class="pg on"><span class="dot"></span>第 1 页</span>
    <span class="pg"><span class="dot w"></span>第 2 页</span>
    <span class="sp" style="flex:1"></span>
    <span style="font-size:11px;color:var(--meta)">页签随滚动同步</span>
  </nav>
  <aside class="left">
    <div class="grp">基础</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7V5h14v2"/><path d="M12 5v14M9 19h6"/></svg>标题</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>段落</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1"/><rect x="13.5" y="5" width="7" height="14" rx="1"/></svg>分栏</div>
    <div class="grp">组合</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9"/><circle cx="18.5" cy="16" r="2.5"/></svg>教育经历</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>项目经历</div>
  </aside>
  <main class="stage"><div class="paper-wrap">PAPER</div></main>
  <aside class="right">
    <div class="rhead">文本框 · 教育经历</div>
    <div class="f"><span>字号</span><span><b>12.5</b> <i class="slot">pt</i></span></div>
    <div class="f"><span>行高</span><span><b>1.65</b> <i class="slot">倍</i></span></div>
    <div class="f"><span>段前</span><span><b>12</b> <i class="slot">pt</i></span></div>
    <div class="f"><span>段后</span><span><b>4</b> <i class="slot">pt</i></span></div>
  </aside>
  <footer class="status">
    <span>第 1/2 页</span><span>100%</span><span class="ok">已保存 14:32</span>
    <span class="warn">2 条提示</span><span>1,286 字</span><span>未导出</span>
  </footer>
</div>
"""

C_CSS = """
:root{--p:#0e6e5e;--bg:#f1f4f2;--fg:#1c1917;--muted:#57534e;--card:#fff}
body{background:var(--bg);color:var(--fg);font-family:"Manrope","Noto Sans SC",sans-serif}
.shell{height:100vh;display:grid;grid-template-rows:56px 1fr 240px;grid-template-areas:'top' 'stage' 'dock'}
.top{grid-area:top;display:flex;align-items:center;gap:12px;padding:0 16px}
.back{width:32px;height:32px;border:0;background:#fff;border-radius:999px;display:grid;place-items:center;cursor:pointer;color:var(--muted)}
.fname{font-size:15px;font-weight:600}
.sp{flex:1}
.ghost{height:36px;padding:0 16px;border:1px solid #e4e7e5;background:#fff;border-radius:999px;font-size:14px;font-family:inherit;cursor:pointer}
.cta{height:36px;padding:0 20px;border:0;background:var(--p);color:#fff;border-radius:999px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
.stage{grid-area:stage;overflow:auto;display:flex;justify-content:center;padding:24px 24px 0}
.paper-wrap{position:relative}
.dock{grid-area:dock;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -8px 28px -12px rgba(28,25,23,.14);padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.dockh{display:flex;align-items:center;gap:6px}
.tab{height:32px;padding:0 14px;border:0;background:transparent;border-radius:999px;font-size:13px;font-weight:600;color:var(--muted);font-family:inherit;cursor:pointer}
.tab.on{background:#e6f2ef;color:var(--p)}
.cards{display:flex;gap:12px;overflow:auto;padding-bottom:4px}
.c{width:96px;display:flex;flex-direction:column;align-items:center;gap:6px;flex:none}
.c i{width:96px;height:64px;background:#f7f8f7;border-radius:14px;display:grid;place-items:center;color:var(--p);border:1px solid #eaeeec}
.c span{font-size:12px;color:var(--muted)}
.c.on i{border:2px solid var(--p);background:#fff}
.props{display:flex;align-items:center;gap:8px;border-top:1px solid #eef1ef;padding-top:10px}
.pill{height:32px;padding:0 12px;border:0;background:#f4f6f5;border-radius:10px;font-size:13px;font-family:inherit;color:var(--fg)}
.pill.b{background:#fff;border:1px solid #e4e7e5}
"""

C_BODY = """
<div class="shell">
  <header class="top">
    <button class="back"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>
    <span class="fname">张明 — 后端开发工程师</span>
    <span class="sp"></span>
    <span style="font-size:12px;color:var(--muted)">已自动保存</span>
    <button class="ghost">预览</button>
    <button class="cta">导出 PDF</button>
  </header>
  <main class="stage"><div class="paper-wrap">PAPER</div></main>
  <section class="dock">
    <div class="dockh">
      <button class="tab on">内容块</button><button class="tab">模板</button><button class="tab">素材</button><button class="tab">页面</button>
      <span class="sp"></span><span style="font-size:12px;color:var(--muted)">选中对象时，这里换成属性</span>
    </div>
    <div class="cards">
      <div class="c"><i><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7V5h14v2"/><path d="M12 5v14M9 19h6"/></svg></i><span>标题</span></div>
      <div class="c on"><i><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg></i><span>段落</span></div>
      <div class="c"><i><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1"/><rect x="13.5" y="5" width="7" height="14" rx="1"/></svg></i><span>分栏</span></div>
      <div class="c"><i><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9"/><circle cx="18.5" cy="16" r="2.5"/></svg></i><span>教育</span></div>
      <div class="c"><i><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M8 9h8M8 12.5h8"/></svg></i><span>项目</span></div>
    </div>
    <div class="props">
      <span style="font-size:12px;color:var(--muted);width:44px">字号</span><span class="pill b">12.5 pt</span>
      <span style="font-size:12px;color:var(--muted);width:44px">行高</span><span class="pill b">1.65</span>
      <span class="sp"></span><span class="pill">加粗</span><span class="pill">左对齐</span>
    </div>
  </section>
</div>
"""

INDEX = """<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>三套语言 · 1:1 实尺</title>
<style>
body{margin:0;background:#e9ecef;color:#1b1f23;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
header{padding:20px 24px 0}
h1{font-size:19px;font-weight:600;margin:0 0 6px}
p{font-size:13px;color:#5b636b;margin:0 0 16px;line-height:1.7;max-width:900px}
.row{display:flex;gap:16px;padding:0 24px 24px;overflow-x:auto}
.card{flex:none;background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 3px rgba(30,40,60,.1)}
.card h2{font-size:13px;margin:2px 0 2px;font-weight:600}
.card .m{font-size:12px;color:#5b636b;margin:0 0 8px}
.win{width:1440px;height:900px;border:1px solid #d8dcdf;border-radius:8px;overflow:hidden;background:#fff}
.win iframe{width:1440px;height:900px;border:0}
a{color:#1f5fa8;text-decoration:none;font-size:12px}
</style></head>
<body>
<header>
<h1>三套语言 · 编辑器屏 1:1</h1>
<p>这里是 <b>100% 真实尺寸</b>，不是缩略图。三张并排横向滚动，每张都是 1440×900 的原尺寸窗口——上一轮你看到的是缩到 33.5% 的图，纸被压掉的比例在那种尺寸下根本看不出来。</p>
</header>
<div class="row">
  <div class="card"><h2>A 纸上有尺</h2><p class="m">墨黑 + 衬线标题 + 等宽数字 + 四角 Crop mark。右侧是"规格表"。</p><a href="a.html" target="_blank">单独打开</a><div class="win"><iframe src="a.html" title="A"></iframe></div></div>
  <div class="card"><h2>B 工作台</h2><p class="m">左库右属性 + 页签条 + 深色状态轨。像 IDE。</p><a href="b.html" target="_blank">单独打开</a><div class="win"><iframe src="b.html" title="B"></iframe></div></div>
  <div class="card"><h2>C 稿件墙</h2><p class="m">无侧栏，底部 240px 内容抽屉，选中即原地变属性。像 Canva。</p><a href="c.html" target="_blank">单独打开</a><div class="win"><iframe src="c.html" title="C"></iframe></div></div>
</div>
</body></html>
"""

if __name__ == "__main__":
    for name, css, body in (("a", A_CSS, A_BODY), ("b", B_CSS, B_BODY), ("c", C_CSS, C_BODY)):
        html = f"""<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{name.upper()} · ResumeCraft</title>
<link rel="stylesheet" href="../../../src/design/tokens.css">
<link rel="stylesheet" href="../mockup.css">
<style>{css}</style></head>
<body>
{body.replace("PAPER", PAPER)}
</body></html>
"""
        (ROOT / f"{name}.html").write_text(html, encoding="utf-8")
    (ROOT / "index.html").write_text(INDEX, encoding="utf-8")
    print("built a b c index")
