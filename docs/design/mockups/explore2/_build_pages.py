# -*- coding: utf-8 -*-
"""方案 A（纸上有尺）· 其余界面 1:1 —— 模板库 / 导入向导 / 空状态"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PAPER = (pathlib.Path(__file__).resolve().parent.parent / "explore" / "_paper.html").read_text(encoding="utf-8")

CSS = """
:root{--p:#191a1c;--bg:#f4f3ef;--line:#d8d6cf;--line2:#b4b1a8;--meta:#6e747c;--mark:#b02a20;--ok:#1f6b45}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--p);font-family:"Inter","Noto Sans SC",sans-serif}
.frame{width:1440px;height:900px;display:flex;flex-direction:column;background:var(--bg);position:relative}
.bar{height:44px;flex:none;display:flex;align-items:center;gap:14px;padding:0 18px;border-bottom:1px solid var(--line)}
.serif{font-family:"Noto Serif SC","Source Serif 4",serif;font-weight:600;letter-spacing:-.01em}
.mono{font-family:"JetBrains Mono",Consolas,monospace;font-variant-numeric:tabular-nums}
.sp{flex:1}
.muted{color:var(--meta);font-size:12px}
.btn{height:28px;padding:0 10px;border:1px solid var(--line2);background:#fff;border-radius:2px;font-size:12px;font-family:inherit;cursor:pointer}
.solid{height:28px;padding:0 14px;border:0;background:var(--p);color:#fff;border-radius:2px;font-size:12px;font-family:inherit;cursor:pointer}
.body{flex:1;display:flex;min-height:0}
.tl{width:280px;flex:none;border-right:1px solid var(--line);background:#fff;overflow:auto}
.tl .h{height:34px;display:flex;align-items:center;padding:0 16px;font-size:11px;letter-spacing:.06em;color:var(--meta);border-bottom:1px solid var(--line)}
.trow{display:flex;align-items:baseline;gap:8px;padding:12px 16px;border-bottom:1px solid #efece6;cursor:pointer}
.trow.on{background:#faf9f6;box-shadow:inset 2px 0 0 var(--p)}
.trow .no{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--meta);width:18px}
.trow .nm{font-family:"Noto Serif SC",serif;font-size:20px;line-height:32px;font-weight:600}
.trow .ld{flex:1;border-bottom:1px dotted var(--line2);transform:translateY(-4px)}
.trow .pg{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--meta)}
.stage{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:28px 24px 20px}
.paperwrap{position:relative;transform:scale(.62);transform-origin:top center;margin-bottom:-430px}
.spec{margin-top:18px;display:flex;gap:18px;font-size:12px;color:var(--meta);font-family:"JetBrains Mono",monospace}
.foot{height:40px;flex:none;border-top:1px solid var(--line);display:flex;align-items:center;gap:16px;padding:0 18px;font-size:11px;color:var(--meta);font-family:"JetBrains Mono",monospace}
/* 导入向导 */
.colL{flex:1;background:#fff;border-right:1px solid var(--line);overflow:auto;padding:18px 20px}
.colR{width:432px;flex:none;background:#fff;overflow:auto}
.proofline{width:1px;background:var(--mark);flex:none}
.doc{font-size:12.5px;line-height:1.9;color:#2b2b2b}
.doc h3{font-family:"Noto Serif SC",serif;font-size:17px;margin:0 0 6px}
.doc .ln{display:flex;gap:10px}
.doc .ln i{font-family:"JetBrains Mono",monospace;font-style:normal;font-size:10px;color:#b8b4ac;width:22px;flex:none;text-align:right}
.block{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid #efece6}
.block .idx{width:16px;height:16px;flex:none;border:1px solid var(--mark);color:var(--mark);font-size:10px;display:grid;place-items:center;font-family:"JetBrains Mono",monospace;margin-top:2px}
.block.done .idx{border-color:var(--line2);color:var(--line2)}
.block .txt{font-size:12.5px;line-height:1.6}
.block .meta2{font-family:"JetBrains Mono",monospace;font-size:10.5px;color:var(--meta);margin-top:4px}
/* 空状态 */
.emptywrap{flex:1;display:flex;align-items:center;justify-content:center;gap:64px}
.blank{width:794px;height:1123px;background:#fff;box-shadow:0 1px 2px rgba(25,26,28,.06),0 12px 24px -12px rgba(25,26,28,.10);
  position:relative;transform:scale(.62);transform-origin:center}
.blank .guide{position:absolute;inset:76px;border:1px dashed #e6e3dc}
.blank .hint{position:absolute;left:76px;top:150px;font-family:"Noto Serif SC",serif;font-size:22px;color:#c9c5bc}
.entries{width:320px;display:flex;flex-direction:column;gap:0}
.entry{display:flex;gap:12px;padding:16px 0;border-bottom:1px solid var(--line);cursor:pointer}
.entry .k{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--meta);width:18px}
.entry .t{font-size:14px;font-weight:500}
.entry .d{font-size:12px;color:var(--meta);line-height:1.6;margin-top:3px}
"""

NAV = """<div style="position:fixed;left:0;right:0;bottom:0;height:36px;background:#fff;border-top:1px solid #d8d6cf;display:flex;align-items:center;gap:18px;padding:0 16px;font-size:12px;font-family:Inter,'Noto Sans SC',sans-serif;z-index:99">
<a href="index.html" style="color:#191a1c;text-decoration:none">← 三套对比</a>
<a href="a.html" style="color:#191a1c;text-decoration:none">A · 编辑器</a>
<a href="a-pages.html#tpl" style="color:#191a1c;text-decoration:none">A · 模板库</a>
<a href="a-pages.html#import" style="color:#191a1c;text-decoration:none">A · 导入向导</a>
<a href="a-pages.html#empty" style="color:#191a1c;text-decoration:none">A · 空状态</a>
</div>"""


def frame(anchor, label, inner):
    return f"""
<section id="{anchor}" style="margin-bottom:24px">
  <div style="font-size:12px;color:#6e747c;font-family:'JetBrains Mono',monospace;margin:0 0 6px 2px">{label}</div>
  <div class="frame">{inner}</div>
</section>"""


TPL = frame("tpl", "02 · 模板库 / 样张抽屉", """
  <div class="bar">
    <span class="serif" style="font-size:15px">ResumeCraft</span>
    <span class="muted mono">模板库 · 4 套</span>
    <span class="sp"></span>
    <span class="muted mono">按 ↑↓ 换样张 · Enter 应用</span>
    <button class="btn">返回编辑器</button>
  </div>
  <div class="body">
    <aside class="tl">
      <div class="h">内置模板</div>
      <div class="trow on"><span class="no">01</span><span class="nm">松烟</span><span class="ld"></span><span class="pg">1–2 页</span></div>
      <div class="trow"><span class="no">02</span><span class="nm">竹青</span><span class="ld"></span><span class="pg">1 页</span></div>
      <div class="trow"><span class="no">03</span><span class="nm">素纸</span><span class="ld"></span><span class="pg">1–2 页</span></div>
      <div class="trow"><span class="no">04</span><span class="nm">朱墨</span><span class="ld"></span><span class="pg">1 页</span></div>
    </aside>
    <main class="stage">
      <div class="paperwrap">__PAPER__</div>
      <div class="spec"><span>单栏</span><span>无照片位</span><span>1–2 页</span><span>ATS 友好</span><span>中英双轨</span></div>
    </main>
  </div>
  <div class="foot"><span>样张按 62% 展示，与导出同比例</span><span class="sp" style="flex:1"></span><span>当前：01 松烟</span></div>
""")

IMP = frame("import", "03 · 导入向导 / 全屏对照台", """
  <div class="bar">
    <span class="serif" style="font-size:15px">ResumeCraft</span>
    <span class="muted mono">导入 · 第 3 步 确认</span>
    <span class="sp"></span>
    <span class="mono" style="font-size:11px;color:#6e747c">① 选文件　② 解析　<span style="color:#191a1c">③ 确认</span>　④ 生成</span>
  </div>
  <div class="body">
    <div class="colL">
      <div class="muted mono" style="margin-bottom:12px">原始文件 · 张明-简历.docx（只读）</div>
      <div class="doc">
        <h3>张　明</h3>
        <div class="ln"><i>1</i><span>求职意向：后端开发工程师（2026 届）· 深圳</span></div>
        <div class="ln"><i>2</i><span>138-0013-8000 · zhangming@example.com</span></div>
        <div style="height:14px"></div>
        <div class="ln"><i>3</i><span><b>教育经历</b></span></div>
        <div class="ln"><i>4</i><span>华南理工大学　软件工程　本科　2022.09–2026.06</span></div>
        <div class="ln"><i>5</i><span>GPA 3.7/4.0（专业前 12%）</span></div>
        <div style="height:14px"></div>
        <div class="ln"><i>6</i><span><b>实习经历</b></span></div>
        <div class="ln"><i>7</i><span>腾讯 · 微信事业群　后台开发实习生</span></div>
        <div class="ln"><i>8</i><span>维护日活 30 万的校园招聘投递服务……</span></div>
      </div>
    </div>
    <div class="proofline"></div>
    <aside class="colR">
      <div style="height:34px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.06em;color:#6e747c">识别结果 · 24 块</div>
      <div class="block done"><span class="idx">①</span><div><div class="txt">张　明</div><div class="meta2">标题 · 置信度高</div></div></div>
      <div class="block done"><span class="idx">②</span><div><div class="txt">求职意向：后端开发工程师（2026 届）· 深圳</div><div class="meta2">段落 · 置信度高</div></div></div>
      <div class="block"><span class="idx">③</span><div><div class="txt">华南理工大学　软件工程　本科　2022.09–2026.06</div><div class="meta2">教育经历 · 置信度中 · 待确认日期格式</div></div></div>
      <div class="block"><span class="idx">④</span><div><div class="txt">GPA 3.7/4.0（专业前 12%）</div><div class="meta2">段落 · 置信度中</div></div></div>
      <div class="block done"><span class="idx">⑤</span><div><div class="txt">腾讯 · 微信事业群　后台开发实习生</div><div class="meta2">工作经历 · 置信度高</div></div></div>
    </aside>
  </div>
  <div class="foot"><span>已确认 <b style="color:#191a1c">19</b> / 24</span><span>待确认 5</span><span class="sp" style="flex:1"></span><button class="btn">取消</button><button class="solid" style="margin-left:8px">生成文档</button></div>
""")

EMP = frame("empty", "05 · 空状态 / 空的是纸，不是屏幕", """
  <div class="bar">
    <span class="serif" style="font-size:15px">ResumeCraft</span>
    <span class="muted mono">未命名简历</span>
    <span class="sp"></span>
    <span class="muted mono">0 页 · 未保存 · 未导出</span>
    <button class="solid" disabled style="opacity:.4;cursor:not-allowed">导出</button>
  </div>
  <div class="emptywrap" style="padding-right:24px">
    <div style="width:494px;display:flex;justify-content:center">
      <div class="blank"><div class="guide"></div><div class="hint">从这里开始</div></div>
    </div>
    <div class="entries">
      <div style="font-size:11px;letter-spacing:.06em;color:#6e747c;margin-bottom:8px">起稿方式</div>
      <div class="entry"><span class="k">A</span><div><div class="t">从模板开始</div><div class="d">4 套内置模板，选一套再改文字。适合第一次写，或想换个体例重排。</div></div></div>
      <div class="entry"><span class="k">B</span><div><div class="t">导入已有简历</div><div class="d">支持 DOCX 与 PDF。DOCX 保留结构；PDF 只取文字，需要你对照一遍。</div></div></div>
      <div class="entry" style="border-bottom:0"><span class="k">C</span><div><div class="t">空白画板</div><div class="d">A4 空白页 + 页边距参考线，自己拖组件搭版式。</div></div></div>
    </div>
  </div>
  <div class="foot"><span>提示：直接在纸上输入姓名即可开始</span><span class="sp" style="flex:1"></span><span>A4 · 20mm 页边距</span></div>
""")

html = f"""<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>A · 其余界面 · ResumeCraft</title>
<link rel="stylesheet" href="../../../src/design/tokens.css">
<link rel="stylesheet" href="../mockup.css">
<style>{CSS}
body{{padding:20px 20px 56px}}
</style></head>
<body>
<h1 style="font-family:'Noto Serif SC',serif;font-size:20px;font-weight:600;margin:0 0 4px">方案 A · 其余界面（1:1）</h1>
<p style="font-size:13px;color:#6e747c;margin:0 0 20px;font-family:Inter,'Noto Sans SC',sans-serif">三屏都是 1440×900 原尺寸，向下滚动查看。纸恒 794，纸外只有左右各一条 24 与底部的校样条。</p>
{TPL.replace("__PAPER__", PAPER)}
{IMP}
{EMP}
</body></html>
"""

(ROOT / "a-pages.html").write_text(html, encoding="utf-8")
print("built a-pages.html")
