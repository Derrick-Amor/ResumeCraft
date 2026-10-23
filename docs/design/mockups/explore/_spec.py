# -*- coding: utf-8 -*-
"""三版 UI 版图探索 —— 按设计师规格实现（结构不同，不是换色）。"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PAPER = (ROOT / "_paper.html").read_text(encoding="utf-8")

NAV = """<div class="mock-nav">
  <a href="compare.html">三版对比</a><a href="v1.html">V1 极简</a><a href="v2.html">V2 圆润</a><a href="v3.html">V3 工具</a>
</div>"""


def page(title, css, body):
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../../../src/design/tokens.css">
<link rel="stylesheet" href="../mockup.css">
<style>{css}</style>
</head>
<body>
{NAV}
{body.replace("{{PAPER}}", PAPER)}
</body>
</html>
"""


V1_CSS = """
:root{--rc-color-primary:#0b5c6b;--rc-color-primary-subtle:#e8eff0;--rc-color-primary-light-5:#b6cccf}
body{background:#f4f4f3;color:#1a1a1a}
.shell{height:calc(100vh - 36px);position:relative}
.top{height:48px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 24px}
.brand{width:24px;height:24px;border-radius:7px;background:#0b5c6b;display:grid;place-items:center;color:#fff}
.fname{font-size:14px;font-weight:500;letter-spacing:-.01em;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.top .r{justify-self:end;display:flex;align-items:center;gap:16px}
.saved{font-size:12px;color:#8a8a85}
.export{font-size:13px;font-weight:500;color:#1a1a1a;background:none;border:0;cursor:pointer;font-family:inherit;padding:0;border-bottom:1px solid transparent}
.export:hover{color:#0b5c6b;border-bottom-color:#0b5c6b}
.rail{position:absolute;left:0;top:56px;width:56px;display:flex;flex-direction:column;align-items:center;gap:24px}
.rail button{width:36px;height:36px;border:0;background:transparent;border-radius:6px;color:#8a8a85;cursor:pointer;display:grid;place-items:center;position:relative}
.rail button:hover{color:#4a4a47;background:#efefed}
.rail button.on{color:#1a1a1a}
.rail button.on::after{content:'';position:absolute;bottom:-7px;width:4px;height:4px;border-radius:50%;background:#0b5c6b}
.stage{position:absolute;left:56px;right:0;top:48px;bottom:0;overflow:auto;display:flex;justify-content:center;padding:72px 24px 96px}
.paper-wrap{position:relative}
.pageno{text-align:center;font-size:12px;color:#8a8a85;margin-top:12px}
.panel{position:absolute;left:calc(100% + 24px);top:48px;width:320px;max-height:calc(100vh - 220px);overflow:auto;
  background:#fff;border:1px solid #ececea;border-radius:12px;box-shadow:0 24px 48px -16px rgba(20,20,20,.14);padding:20px}
.grp{font-size:12px;font-weight:500;color:#5f5f5a;letter-spacing:.02em;margin:22px 0 8px}
.grp:first-child{margin-top:0}
.row{display:grid;grid-template-columns:88px 1fr;align-items:center;height:32px;font-size:13px;color:#5f5f5a}
.row b{font-weight:400;color:#1a1a1a;text-align:right}
.zoompill{position:absolute;right:24px;bottom:24px;height:32px;display:flex;align-items:center;gap:2px;
  background:#fff;border-radius:999px;box-shadow:0 1px 2px rgba(20,20,20,.05),0 8px 20px -8px rgba(20,20,20,.12);padding:0 6px;font-size:12px;color:#5f5f5a}
.zoompill button{width:24px;height:24px;border:0;background:transparent;border-radius:999px;cursor:pointer;color:#5f5f5a;display:grid;place-items:center}
"""

V1_BODY = """
<div class="shell">
  <header class="top">
    <span class="brand"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg></span>
    <span class="fname">张明 — 后端开发工程师 · 2026 届</span>
    <span class="r"><span class="saved">已保存 14:32</span><button class="export">导出</button></span>
  </header>

  <nav class="rail">
    <button class="on"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M9.5 10v9.5"/></svg></button>
    <button><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9"/><circle cx="18.5" cy="16" r="2.5"/></svg></button>
    <button><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/></svg></button>
    <button><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12"/><path d="m7.5 11.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/></svg></button>
    <button><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg></button>
  </nav>

  <main class="stage">
    <div>
      <div class="paper-wrap">{{PAPER}}
        <aside class="panel">
          <div class="grp">文字</div>
          <div class="row"><span>字号</span><b>12.5 pt</b></div>
          <div class="row"><span>行高</span><b>1.65 倍</b></div>
          <div class="row"><span>字重</span><b>中黑</b></div>
          <div class="row"><span>字距</span><b>0</b></div>
          <div class="grp">间距</div>
          <div class="row"><span>段前</span><b>12 pt</b></div>
          <div class="row"><span>段后</span><b>4 pt</b></div>
          <div class="grp">分页</div>
          <div class="row"><span>标题不孤行</span><b>开</b></div>
          <div class="row"><span>允许拆分</span><b>开</b></div>
        </aside>
      </div>
      <div class="pageno">第 1 页 / 共 1 页</div>
    </div>
  </main>

  <div class="zoompill"><button>−</button><span style="padding:0 8px">100%</span><button>+</button></div>
</div>
"""

V2_CSS = """
:root{--rc-color-primary:#b4471e;--rc-color-primary-subtle:#f8ece7;--rc-color-primary-light-5:#dda593}
body{background:#fbfaf8;color:#1c1917}
.shell{height:calc(100vh - 36px);position:relative}
.top{height:64px;background:#fcefe7;display:flex;align-items:center;padding:0 20px;gap:12px}
.logo{width:32px;height:32px;border-radius:10px;background:#fff;display:grid;place-items:center;color:#b4471e}
.fname{font-size:15px;font-weight:600;letter-spacing:-.01em;margin:0 auto}
.saved{font-size:12px;color:#8a6a5a}
.cta{height:36px;padding:0 20px;border:0;border-radius:999px;background:#b4471e;color:#fff;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
.cta:hover{background:#a03f1a}
.panelL{position:absolute;left:12px;top:76px;bottom:12px;width:288px;background:#fff;border-radius:20px;
  box-shadow:0 2px 8px rgba(28,25,23,.05);padding:16px;overflow:auto}
.panelR{position:absolute;right:12px;top:76px;bottom:12px;width:320px;background:#fff;border-radius:20px;
  box-shadow:0 2px 8px rgba(28,25,23,.05);padding:20px;overflow:auto}
.stage{position:absolute;left:312px;right:344px;top:76px;bottom:12px;background:#efefec;border-radius:20px;overflow:auto;
  display:flex;justify-content:center;padding:88px 24px 120px}
.seg{display:flex;background:#f4f1ed;border-radius:999px;height:40px;padding:4px;gap:4px;margin-bottom:14px}
.seg button{flex:1;border:0;background:transparent;border-radius:999px;font-size:13px;font-weight:500;color:#6b645d;font-family:inherit;cursor:pointer}
.seg button.on{background:#fff;color:#1c1917;font-weight:600;box-shadow:0 1px 2px rgba(28,25,23,.10)}
.grp{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#a8a29e;margin:14px 0 8px}
.grp i{width:8px;height:8px;border-radius:50%;background:#b4471e;display:block}
.card{display:flex;align-items:center;gap:10px;height:56px;padding:0 12px;border-radius:14px;background:#fbf9f7;
  margin-bottom:6px;font-size:13px;font-weight:500;cursor:grab;transition:transform .18s cubic-bezier(.32,.72,0,1),box-shadow .18s,background .18s}
.card:hover{transform:translateY(-1px);background:#fff;box-shadow:0 2px 8px rgba(28,25,23,.07)}
.card .ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:#fbe9e1;color:#b4471e;flex:none}
.card .ic.alt{background:#e3f0ee;color:#0f6e63}
.sec{background:#faf7f4;border-radius:14px;padding:12px;margin-bottom:12px}
.sec h4{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between}
.f{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.f label{display:flex;align-items:center;height:36px;border:1px solid #eae4de;border-radius:10px;background:#fff;padding:0 10px;font-size:13px;color:#1c1917}
.dock{position:absolute;left:50%;transform:translateX(-50%);bottom:24px;height:56px;display:flex;align-items:center;gap:4px;
  background:#fff;border:1px solid #eae7e3;border-radius:28px;padding:0 12px;box-shadow:0 12px 32px -8px rgba(28,25,23,.16);font-size:12px;color:#6b645d}
.dock button{width:32px;height:32px;border:0;background:transparent;border-radius:999px;cursor:pointer;color:#6b645d;display:grid;place-items:center}
.dock button:hover{background:#f4f1ed}
.sep{width:1px;height:20px;background:#efebe6;margin:0 6px}
"""

V2_BODY = """
<div class="shell">
  <header class="top">
    <span class="logo"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg></span>
    <span class="fname">张明 — 后端开发工程师</span>
    <span class="saved">已自动保存</span>
    <button class="cta">导出 PDF</button>
  </header>

  <aside class="panelL">
    <div class="seg"><button class="on">内容</button><button>模板</button><button>素材</button><button>页面</button></div>
    <div class="grp"><i></i>基础内容</div>
    <div class="card"><span class="ic"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7V5h14v2"/><path d="M12 5v14M9 19h6"/></svg></span>标题</div>
    <div class="card"><span class="ic"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg></span>段落</div>
    <div class="card"><span class="ic"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1"/><rect x="13.5" y="5" width="7" height="14" rx="1"/></svg></span>分栏容器</div>
    <div class="grp"><i style="background:#0f6e63"></i>常用组合</div>
    <div class="card"><span class="ic alt"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9"/><circle cx="18.5" cy="16" r="2.5"/></svg></span>教育经历</div>
    <div class="card"><span class="ic alt"><svg class="i i-md" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg></span>项目经历</div>
  </aside>

  <main class="stage">
    {{PAPER}}
  </main>

  <aside class="panelR">
    <div class="sec"><h4>文字</h4>
      <div class="f"><label>12.5 pt</label><label>1.65 倍</label></div>
      <div class="f"><label>中黑</label><label>0 字距</label></div>
    </div>
    <div class="sec"><h4>间距</h4>
      <div class="f"><label>段前 12</label><label>段后 4</label></div>
    </div>
    <div class="sec"><h4>分页</h4>
      <div class="f"><label>标题不孤行</label><label>允许拆分</label></div>
    </div>
  </aside>

  <div class="dock">
    <button><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3"/></svg></button>
    <button><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a5.5 5.5 0 0 0 0 11h3"/></svg></button>
    <span class="sep"></span>
    <button>−</button><span>100%</span><button>+</button>
    <span class="sep"></span>
    <button><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    <button style="width:auto;padding:0 12px;background:#fbe9e1;color:#b4471e;font-weight:600">导出检查</button>
  </div>
</div>
"""

V3_CSS = """
:root{--rc-color-primary:#1e3a8a;--rc-color-primary-subtle:#e8ecf7;--rc-color-primary-light-5:#a9b7dc}
body{background:#fafafb;color:#101318}
.shell{height:calc(100vh - 36px);display:grid;grid-template-columns:240px 1fr 320px;
  grid-template-rows:40px 1fr 24px;grid-template-areas:'top top top' 'left stage right' 'status status status'}
.top{grid-area:top;background:#fff;display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid rgba(16,18,24,.06)}
.logo{width:24px;height:24px;border-radius:6px;background:#101318;color:#fff;display:grid;place-items:center}
.ib{width:24px;height:24px;border:0;background:transparent;border-radius:6px;color:#5c6472;cursor:pointer;display:grid;place-items:center}
.ib:hover{background:#f4f5f7}
.fname{font-size:13px;font-weight:600;margin:0 auto}
.state{font-size:12px;color:#6b7280}
.sp{flex:1}
.kbd{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 8px;border-radius:8px;background:#f4f5f7;border:0;font-size:11px;color:#5c6472;font-family:inherit;cursor:pointer}
.cta{height:28px;padding:0 11px;border:0;border-radius:8px;background:#1e3a8a;color:#fff;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer}
.left{grid-area:left;background:#f7f8f9;border-right:1px solid rgba(16,18,24,.06);padding:12px 10px;overflow:auto}
.seg{display:flex;height:28px;background:#eceef1;border-radius:8px;padding:2px;gap:2px;margin-bottom:10px}
.seg button{flex:1;border:0;background:transparent;border-radius:6px;font-size:12px;font-weight:500;color:#5c6472;font-family:inherit;cursor:pointer}
.seg button.on{background:#fff;color:#101318;font-weight:600;box-shadow:0 1px 2px rgba(16,18,24,.10)}
.grp{font-size:11px;font-weight:600;color:#8b93a1;letter-spacing:.04em;padding:8px 8px 4px}
.li{display:flex;align-items:center;gap:8px;height:28px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:500;color:#2a2f38;cursor:grab}
.li:hover{background:rgba(16,18,24,.045)}
.li .m{margin-left:auto;font-size:11px;color:#8b93a1;font-family:ui-monospace,Consolas,monospace}
.stage{grid-area:stage;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:56px 16px 72px;background:#fafafb;position:relative}
.paper-wrap{position:relative;box-shadow:0 0 0 1px rgba(16,18,24,.05),0 16px 40px -12px rgba(16,18,24,.12)}
.right{grid-area:right;background:#fff;border-left:1px solid rgba(16,18,24,.06);overflow:auto}
.rhead{height:36px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid rgba(16,18,24,.06);font-size:12px;font-weight:500}
.rhead .tag{margin-left:auto;font-size:11px;color:#1e3a8a;background:#e8ecf7;border-radius:4px;padding:1px 6px}
.sec{padding:12px 16px;border-bottom:1px solid rgba(16,18,24,.06)}
.sec h4{margin:0 0 10px;font-size:11px;font-weight:600;color:#8b93a1;letter-spacing:.04em}
.f{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.f label{height:26px;border:1px solid rgba(16,18,24,.10);border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;
  font-size:12px;font-family:ui-monospace,Consolas,monospace;color:#101318;background:#fff}
.status{grid-area:status;background:#fff;border-top:1px solid rgba(16,18,24,.06);display:flex;align-items:center;gap:14px;padding:0 12px;
  font-size:11px;color:#6b7280;font-family:ui-monospace,Consolas,monospace}
.dot{width:5px;height:5px;border-radius:50%;background:#1e7a4c;display:inline-block;margin-right:5px}
.warn{color:#a86400}
.zoom{position:fixed;right:344px;bottom:36px;height:28px;display:flex;align-items:center;background:#fff;border:1px solid rgba(16,18,24,.06);border-radius:8px;font-size:11px;color:#5c6472}
.zoom button{width:26px;height:26px;border:0;background:transparent;cursor:pointer;color:#5c6472;display:grid;place-items:center}
"""

V3_BODY = """
<div class="shell">
  <header class="top">
    <span class="logo"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg></span>
    <button class="ib"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3"/></svg></button>
    <button class="ib"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a5.5 5.5 0 0 0 0 11h3"/></svg></button>
    <span class="fname">张明-后端开发工程师-2026届</span>
    <span class="state">已保存</span>
    <span class="sp"></span>
    <button class="kbd">⌘K 命令</button>
    <button class="cta">导出</button>
  </header>

  <aside class="left">
    <div class="seg"><button>内容</button><button class="on">组件</button><button>模板</button><button>页面</button></div>
    <div class="grp">基础</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7V5h14v2"/><path d="M12 5v14M9 19h6"/></svg>标题<span class="m">H1</span></div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>段落</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1"/><rect x="13.5" y="5" width="7" height="14" rx="1"/></svg>分栏</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M8 6v3M16 6v3"/><path d="M4 12h16M4 16.5h16M4 19h9"/></svg>列表</div>
    <div class="grp">组合</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h9"/><circle cx="18.5" cy="16" r="2.5"/></svg>教育经历</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>项目经历</div>
    <div class="li"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 9.5h16M4 14h6M14 14h6"/></svg>技能矩阵</div>
  </aside>

  <main class="stage">
    <div class="paper-wrap">{{PAPER}}</div>
    <div class="zoom"><button>−</button><span style="padding:0 6px">100%</span><button>+</button><button><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5.5h16V8"/><path d="M4 16v2.5h16V16"/><path d="M8 12h8"/></svg></button></div>
  </main>

  <aside class="right">
    <div class="rhead">文本框 · 教育经历<span class="tag">已锁定</span></div>
    <div class="sec"><h4>文字</h4><div class="f"><label>12.5</label><label>1.65</label></div>
      <div class="f" style="margin-top:8px"><label>500</label><label>0</label></div></div>
    <div class="sec"><h4>间距</h4><div class="f"><label>12</label><label>4</label></div></div>
    <div class="sec"><h4>分页</h4><div class="f"><label>不孤行</label><label>可拆</label></div></div>
  </aside>

  <footer class="status">
    <span>页 1/1</span><span>20mm · A4</span><span><i class="dot"></i>已保存</span><span class="warn">2 提示</span>
  </footer>
</div>
"""

COMPARE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>三版 UI 版图对比</title>
<style>
body{margin:0;padding:22px;background:#eceff1;color:#1a1a1a;font-family:-apple-system,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif}
h1{font-size:19px;font-weight:600;margin:0 0 6px}
.sub{font-size:13px;color:#5b636b;margin:0 0 18px;line-height:1.7;max-width:1040px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.card{background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 3px rgba(30,40,60,.1)}
.card h2{font-size:13px;margin:2px 0 4px;font-weight:600}
.card p{font-size:12px;color:#5b636b;margin:0 0 8px;line-height:1.55;min-height:76px}
.shot{height:392px;overflow:hidden;border-radius:8px;border:1px solid #e4e7ea}
.shot iframe{width:1440px;height:900px;border:0;transform:scale(.335);transform-origin:top left}
a{font-size:12px;color:#1e58a9;text-decoration:none;float:right}
</style>
</head>
<body>
<h1>三版 UI 版图</h1>
<p class="sub">同一份简历、同一个产品，三种<b>结构</b>：V1 去掉常驻面板，屏幕上只剩纸；V2 把面板变成浮起的大圆角卡片、把组件项放大到 56px；V3 压密度、收窄到 240px、主色只占 0.8%。<b>三版的区别在面板的存在方式与密度，不在颜色。</b></p>
<div class="grid">
  <section class="card"><h2>V1 极简</h2><a href="v1.html" target="_blank">单独打开</a>
  <p>56px 图标轨道 + 48px 透明顶带；属性面板改成召之即来的浮卡，没有状态栏。屏幕上唯一有边界的东西是那张纸。</p>
  <div class="shot"><iframe src="v1.html" scrolling="no" title="V1"></iframe></div></section>
  <section class="card"><h2>V2 圆润</h2><a href="v2.html" target="_blank">单独打开</a>
  <p>顶栏整条上暖色，左右面板变成 20px 圆角浮卡，组件项从 32px 抬到 56px 并配 tint 方块——把"能拖"写进形状里。</p>
  <div class="shot"><iframe src="v2.html" scrolling="no" title="V2"></iframe></div></section>
  <section class="card"><h2>V3 工具</h2><a href="v3.html" target="_blank">单独打开</a>
  <p>240px 窄栏 + 28px 行高 + 单一 hairline，主色只占 0.8%，靠灰阶与字重分层。给每天用的人。</p>
  <div class="shot"><iframe src="v3.html" scrolling="no" title="V3"></iframe></div></section>
</div>
</body>
</html>
"""


if __name__ == "__main__":
    (ROOT / "v1.html").write_text(page("V1 极简 · ResumeCraft", V1_CSS, V1_BODY), encoding="utf-8")
    (ROOT / "v2.html").write_text(page("V2 圆润 · ResumeCraft", V2_CSS, V2_BODY), encoding="utf-8")
    (ROOT / "v3.html").write_text(page("V3 工具 · ResumeCraft", V3_CSS, V3_BODY), encoding="utf-8")
    (ROOT / "compare.html").write_text(COMPARE, encoding="utf-8")
    print("rebuilt per designer spec: v1 v2 v3 compare")
