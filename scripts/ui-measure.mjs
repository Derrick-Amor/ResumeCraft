#!/usr/bin/env node
/**
 * ui-measure.mjs —— 43 条检查点的运行时测量器（CDP）
 * ============================================================
 * 用途：把 docs/verify/ui-fidelity-audit.md §3 的检查点，
 *       一次性从真实渲染里量出来，输出 JSON + 人类可读表。
 *
 * 为什么不用截图量像素：
 *   getBoundingClientRect / getComputedStyle 给的是精确值，
 *   截图量像素受抗锯齿与缩放影响，只能用来看"有没有明显错位"。
 *   审计文档 §1 已允许二者之一（「像素」= 截图量 或 getComputedStyle）。
 *
 * 为什么不用 grep 源码：
 *   Vue 模板会拼接类名（`:class="`${prefix}__tab`"`），
 *   grep 对拼接类名完全失效；注释里的类名又会被误算。
 *   类名覆盖率只有运行时 DOM 能判。
 *
 * ------------------------------------------------------------
 * 用法
 *   node scripts/ui-measure.mjs --url http://localhost:5273
 *   node scripts/ui-measure.mjs --url http://localhost:5273 --json
 *
 * 退出码 0 = 量完了（不代表全部 PASS，判定由人看表）
 * ============================================================
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const DEBUG_PORT = 9334;
const VIEWPORT = { width: 1440, height: 900 };

function browserCandidates() {
  const list = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  if (process.env.LOCALAPPDATA) {
    list.push(path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'));
  }
  list.push(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  );
  return list;
}

function findBrowser() {
  for (const c of browserCandidates()) if (existsSync(c)) return c;
  throw new Error('找不到 Chrome / Edge');
}

function parseArgs(argv) {
  const o = {
    url: null, json: false, help: false,
    selectFirst: false, openDialog: false,
    selectText: null, tab: null, clickText: null, fillTextarea: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') o.help = true;
    else if (t === '--json') o.json = true;
    else if (t === '--select-first') o.selectFirst = true;
    else if (t === '--open-dialog') o.openDialog = true;
    else if (t === '--select-text') o.selectText = argv[(i += 1)];
    else if (t === '--tab') o.tab = argv[(i += 1)];
    else if (t === '--click-text') o.clickText = argv[(i += 1)];
    else if (t === '--click-selector') o.clickSelector = argv[(i += 1)];
    else if (t === '--fill-textarea') o.fillTextarea = Number(argv[(i += 1)]) || 0;
    else if (t === '--dump-paper') o.dumpPaper = true;
    else if (t === '--fill-inputs') o.fillInputs = Number(argv[(i += 1)]) || 0;
    else if (t === '--fill-all') o.fillAll = true;
    else if (t === '--url') o.url = argv[(i += 1)];
    else throw new Error(`未知参数：${t}`);
  }
  return o;
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const handlers = new Map();
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', (e) => rej(new Error(`WS 失败：${e.message || ''}`)));
  });
  ws.addEventListener('message', (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id !== undefined && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
      return;
    }
    const hs = handlers.get(m.method);
    if (hs) for (const fn of hs) fn(m.params);
  });
  return {
    ready,
    send(method, params = {}) {
      seq += 1;
      const id = seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(m, fn) {
      if (!handlers.has(m)) handlers.set(m, []);
      handlers.get(m).push(fn);
    },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}

async function httpJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function waitDevtools(port, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try {
      const list = await httpJson(`http://127.0.0.1:${port}/json/list`);
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch (e) { last = e; }
    await delay(120);
  }
  throw new Error(`DevTools 未就绪：${last?.message || 'timeout'}`);
}

/** 页面内测量脚本：返回 43 条所需的所有原始值。 */
const MEASURE = `(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));
  const cs = (el, pseudo) => (el ? getComputedStyle(el, pseudo || null) : null);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10,
             w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; };
  const pick = (el, props, pseudo) => {
    const st = cs(el, pseudo);
    if (!st) return null;
    const o = {};
    for (const p of props) o[p] = st[p];
    return o;
  };

  const out = {};

  // ---- A 外壳 ----
  const app = q('.app');
  out.A1 = { found: !!app, box: box(app), style: pick(app,
    ['display','flexDirection','height','minHeight','overflow']) };
  const side = q('.side');
  out.A2 = { found: !!side, box: box(side), width: pick(side, ['width','borderRightWidth','boxSizing']) };
  const insp = q('.inspector');
  out.A3 = { found: !!insp, box: box(insp), width: pick(insp, ['width','borderLeftWidth','boxSizing']) };
  const canvas = q('.canvas');
  out.A4 = { found: !!canvas, box: box(canvas), style: pick(canvas, ['flex','minWidth']) };

  // ---- B 顶栏 ----
  const topbar = q('.topbar');
  out.B1 = { found: !!topbar, box: box(topbar), style: pick(topbar, ['height','flex']) };
  out.B2 = { style: pick(topbar, ['paddingLeft','paddingRight','gap','borderBottomWidth','borderBottomColor','zIndex']) };
  out.B3 = {
    mark: { box: box(q('.brand__mark')), style: pick(q('.brand__mark'), ['borderRadius','width','height']) },
    divider: { box: box(q('.topbar__divider')) },
    avatar: { box: box(q('.avatar')), style: pick(q('.avatar'), ['borderRadius']) },
  };
  out.B4 = {
    brandName: pick(q('.brand__name'), ['fontSize','fontWeight','letterSpacing']),
    docName: pick(q('.docmeta__name'), ['fontSize','fontWeight']),
    docSub: pick(q('.docmeta__sub'), ['fontSize','color','overflow','textOverflow','whiteSpace']),
  };
  const rightBox = q('.topbar__right');
  const btns = qa('.topbar__right .btn');
  out.B5 = {
    gap: rightBox ? cs(rightBox).gap : null,
    btn0: btns[0] ? { box: box(btns[0]), style: pick(btns[0], ['height','paddingLeft','paddingRight','borderRadius','fontSize','fontWeight']) } : null,
    btnCount: btns.length,
    btnGap: btns.length >= 2 ? Math.round((btns[1].getBoundingClientRect().left - btns[0].getBoundingClientRect().right) * 10) / 10 : null,
  };

  // ---- C 左栏 ----
  const tab = q('.side__tab');
  const tabsBox = q('.side__tabs');
  out.C1 = {
    tab: pick(tab, ['paddingTop','paddingRight','paddingBottom','paddingLeft','fontSize','fontWeight','color']),
    tabOn: pick(q('.side__tab--on'), ['color']),
    tabs: pick(tabsBox, ['paddingLeft','paddingRight','borderBottomWidth']),
  };
  const tabOn = q('.side__tab--on');
  out.C2 = {
    box: box(tabOn),
    after: pick(tabOn, ['height','left','right','bottom','backgroundColor','borderTopLeftRadius','borderTopRightRadius'], '::after'),
    afterWidth: tabOn ? (() => { const w = tabOn.getBoundingClientRect().width; return Math.round(w * 10) / 10; })() : null,
  };
  const grid = q('.compgrid');
  const cards = qa('.compgrid .compcard');
  const cardBoxes = cards.map(box);
  out.C3 = {
    style: pick(grid, ['display','gridTemplateColumns','gap','columnGap','rowGap']),
    cardCount: cards.length,
    cardWidths: cardBoxes.map((b) => b && b.w),
    cardGaps: cardBoxes.length >= 2 ? Math.round((cardBoxes[1].x - (cardBoxes[0].x + cardBoxes[0].w)) * 10) / 10 : null,
  };
  const c0 = cards[0];
  out.C4 = { box: cardBoxes[0] || null, style: pick(c0, ['minHeight','flexDirection','alignItems','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius']) };
  const last = cards[cards.length - 1];
  out.C5 = {
    lastBox: box(last),
    isOddLastSpan: last ? Math.round(last.getBoundingClientRect().width * 10) / 10 : null,
    gridWidth: grid ? box(grid).w : null,
    ico: { box: box(q('.compcard__ico')), style: pick(q('.compcard__ico'), ['width','height','borderRadius']) },
  };

  // ---- D 画布 ----
  const bar = q('.canvas__bar');
  out.D1 = { found: !!bar, box: box(bar), style: pick(bar, ['height','paddingLeft','paddingRight','borderBottomWidth','fontSize','color']) };
  const scroll = q('.canvas__scroll');
  out.D2 = { style: pick(scroll, ['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','alignItems','flexDirection']), box: box(scroll) };
  const slot = q('.paper-slot');
  out.D3 = { found: !!slot, box: box(slot) };
  const paper = q('.paper');
  out.D4 = {
    found: !!paper, box: box(paper),
    style: pick(paper, ['width','height','transform','transformOrigin','position','top','left',
      'paddingTop','paddingRight','paddingBottom','paddingLeft']),
  };
  out.D5 = {
    style: pick(paper, ['backgroundColor','backdropFilter','boxShadow','filter']),
  };

  // ---- E 右栏 ----
  const head = q('.inspector__head');
  out.E1 = { box: box(head), style: pick(head, ['height','paddingLeft','paddingRight','borderBottomWidth']),
    title: pick(q('.inspector__title'), ['fontSize','fontWeight']) };
  const itab = q('.inspector__tab');
  const itabOn = q('.inspector__tab--on');
  out.E2 = {
    tab: pick(itab, ['paddingTop','paddingRight','paddingBottom','paddingLeft']),
    tabCount: qa('.inspector__tab').length,
    onBox: box(itabOn),
    after: pick(itabOn, ['height','left','right','bottom'], '::after'),
  };
  const ibody = q('.inspector__body');
  out.E3 = { style: pick(ibody, ['paddingTop','paddingRight','paddingBottom','paddingLeft','rowGap','overflowY','flexDirection']) };
  const inp = q('.inspector .input');
  const ta = q('.inspector .textarea');
  const tat = q('.inspector .textarea--tall');
  const sel = q('.inspector .select');
  out.E4 = {
    input: { box: box(inp), style: pick(inp, ['height','paddingLeft','paddingRight','borderRadius','fontSize','borderTopWidth','borderTopColor']) },
    textarea: { box: box(ta), style: pick(ta, ['minHeight','paddingTop','paddingLeft','lineHeight','height']) },
    textareaTall: { box: box(tat), style: pick(tat, ['minHeight']) },
    select: { box: box(sel), style: sel ? {
      paddingRight: cs(sel).paddingRight,
      bgImage: cs(sel).backgroundImage.slice(0, 160),
      bgPosition: cs(sel).backgroundPosition,
      bgSize: cs(sel).backgroundSize,
    } : null },
  };
  const field = q('.field');
  const frow = q('.field-row');
  out.E5 = {
    field: pick(field, ['rowGap']),
    label: pick(q('.field__label'), ['fontSize','fontWeight','color']),
    row: pick(frow, ['display','gridTemplateColumns','columnGap']),
    rowTight: pick(q('.field-row--tight'), ['columnGap']),
  };
  const sw = q('.switch');
  out.E5.switch = { box: box(sw), style: pick(sw, ['width','height','borderRadius']) };
  out.E5.switchAfter = pick(sw, ['width','height','transform','backgroundColor'], '::after');
  const chip = q('.colorfield__chip');
  out.E5.chip = { box: box(chip), style: pick(chip, ['width','height','borderRadius','backgroundColor']) };
  out.E5.colorfield = pick(q('.colorfield'), ['height','fontSize']);

  // ---- I1 / I2 ----
  out.I1 = {
    before: pick(document.body, ['content','position','top','right','bottom','left','zIndex','pointerEvents','backgroundImage'], '::before'),
    auroraVar: (cs(document.documentElement).getPropertyValue('--rc-aurora') || '').trim(),
  };
  out.I2 = {
    topbar: pick(topbar, ['backgroundColor','backdropFilter','webkitBackdropFilter']),
    side: pick(side, ['backgroundColor','backdropFilter']),
    inspector: pick(insp, ['backgroundColor','backdropFilter']),
    statusbar: pick(q('.statusbar'), ['backgroundColor','backdropFilter']),
    actionbar: q('.actionbar') ? pick(q('.actionbar'), ['backgroundColor','backdropFilter']) : 'NOT_IN_DOM',
  };
  const btn = q('.btn');
  out.I3 = { box: box(btn), style: pick(btn, ['height','paddingLeft','borderRadius','fontSize','fontWeight','gap','backgroundColor','backdropFilter','borderTopWidth','boxShadow']) };
  const primary = q('.btn--primary');
  out.I4 = { found: !!primary, style: pick(primary, ['backgroundColor','backdropFilter','borderTopColor','color','boxShadow']) };
  out.I5 = {
    hoverDecl: '见 src/design/glass.css（静态）',
    compcardAfter: pick(c0, ['content','position','top','left','right','bottom','borderTopWidth','borderTopColor','opacity','borderRadius'], '::after'),
  };
  out.I6 = {
    afterAnimation: (() => {
      const st = cs(c0, '::after');
      return st ? st.animation : null;
    })(),
    radiusTokens: {
      tag: cs(document.documentElement).getPropertyValue('--rc-r-tag').trim(),
      ctl: cs(document.documentElement).getPropertyValue('--rc-r-ctl').trim(),
      card: cs(document.documentElement).getPropertyValue('--rc-r-card').trim(),
      dlg: cs(document.documentElement).getPropertyValue('--rc-r-dlg').trim(),
    },
  };

  // ---- H 弹窗（DOM 里可能不存在，先探测）----
  out.H = {
    scrim: q('.scrim') ? { box: box(q('.scrim')), style: pick(q('.scrim'), ['position','backgroundColor','backdropFilter','zIndex','padding']) } : 'NOT_IN_DOM',
    dialog: q('.dialog') ? { box: box(q('.dialog')), style: pick(q('.dialog'), ['borderRadius','maxHeight','background','backdropFilter','boxShadow']) } : 'NOT_IN_DOM',
    checkitem: q('.checkitem') ? pick(q('.checkitem'), ['display','borderLeftWidth','paddingTop','paddingLeft','borderBottomWidth']) : 'NOT_IN_DOM',
    head: q('.dialog__head') ? pick(q('.dialog__head'), ['paddingTop','paddingRight','paddingBottom','paddingLeft']) : 'NOT_IN_DOM',
    title: q('.dialog__title') ? pick(q('.dialog__title'), ['fontSize','fontWeight','letterSpacing']) : 'NOT_IN_DOM',
    body: q('.dialog__body') ? pick(q('.dialog__body'), ['paddingTop','paddingRight','paddingBottom','paddingLeft']) : 'NOT_IN_DOM',
    foot: q('.dialog__foot') ? pick(q('.dialog__foot'), ['paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','marginTop']) : 'NOT_IN_DOM',
    optcard: q('.optcard') ? pick(q('.optcard'), ['borderRadius','paddingTop','paddingLeft']) : 'NOT_IN_DOM',
    optcardOn: q('.optcard--on') ? pick(q('.optcard--on'), ['backgroundColor','borderTopColor','borderRadius','paddingTop']) : 'NOT_IN_DOM',
    optcardCount: qa('.optcard').length,
    optcardRoles: qa('.optcard').map((el) => ({
      role: el.getAttribute('role'), aria: el.getAttribute('aria-checked'),
      cls: String(el.className), text: (el.textContent || '').trim().slice(0, 12),
    })),
    dialogMdWidth: q('.dialog--md') ? cs(q('.dialog--md')).maxWidth : 'NOT_IN_DOM',
  };

  // ---- F 状态栏 ----
  const sb = q('.statusbar');
  out.F1 = { found: !!sb, box: box(sb), style: pick(sb, ['height','flex']) };
  out.F2 = { style: pick(sb, ['paddingLeft','paddingRight','borderTopWidth','fontSize','color','justifyContent']) };
  out.F3 = {
    dot: { box: box(q('.statusbar__dot')), style: pick(q('.statusbar__dot'), ['borderRadius','backgroundColor']) },
    warn: pick(q('.statusbar__item--warn'), ['color','fontWeight']),
    itemGap: pick(q('.statusbar__item'), ['gap']),
  };
  out.F4 = { position: pick(sb, ['position']) };

  // ---- G 纸面（只判排版/结构/颜色，不判 margin —— §4 偏差1）----
  const pname = q('.p-name');
  const pintent = q('.p-intent');
  const ptitle = q('.p-sec__title');
  const pitem = q('.p-item');
  const iname = q('.p-item__name');
  const idate = q('.p-item__date');
  const irole = q('.p-item__role');
  const li = q('.p-bullets li');
  const plain = q('.p-plain');
  out.G = {
    name: { box: box(pname), style: pick(pname, ['fontSize','fontWeight','letterSpacing','lineHeight','marginBottom']) },
    header: pick(q('.p-header'), ['justifyContent','columnGap','flexDirection']),
    intent: pick(pintent, ['fontSize','color','marginBottom']),
    sec: pick(q('.p-sec'), ['marginTop']),
    secTitle: { style: pick(ptitle, ['fontSize','fontWeight','columnGap','marginBottom']),
      before: pick(ptitle, ['width','height','borderRadius','backgroundColor'], '::before') },
    secRule: pick(q('.p-sec__rule'), ['height','backgroundColor']),
    itemHead: pick(q('.p-item__head'), ['justifyContent','alignItems','columnGap']),
    itemName: pick(iname, ['fontSize','fontWeight','color']),
    itemDate: pick(idate, ['fontSize','color','fontVariantNumeric','whiteSpace','flex']),
    itemRole: pick(irole, ['fontSize','color','marginTop']),
    bulletsLi: { box: box(li), style: pick(li, ['fontSize','lineHeight','paddingLeft','listStyleType','marginBottom']) },
    bulletsBefore: pick(li, ['width','height','left','top','backgroundColor','borderRadius'], '::before'),
    bulletsUl: pick(q('.p-bullets'), ['listStyleType','marginTop']),
    plain: pick(plain, ['fontSize','lineHeight']),
    em: pick(q('.p-em'), ['color','fontWeight']),
    photo: pick(q('.p-photo'), ['width','height','borderTopWidth','borderTopColor','backgroundColor','borderRadius']),
    paperCssFont: pick(pname, ['fontFamily']),
    paperSize: pick(q('.paper'), ['width','height']),
  };

  // ---- 字体（供 §7.3，不进 38 条）----
  out.fonts = Array.from(document.fonts).map((f) => ({
    family: String(f.family || '').replace(/["']/g, ''), weight: String(f.weight), status: String(f.status),
  }));

  out.meta = { vw: window.innerWidth, vh: window.innerHeight, elements: document.querySelectorAll('*').length };
  return out;
})()`;

function fmt(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.url) {
    process.stdout.write('用法：node scripts/ui-measure.mjs --url http://localhost:5273 [--json]\n');
    return opts.help ? 0 : 1;
  }

  const browser = findBrowser();
  const profile = mkdtempSync(path.join(tmpdir(), 'ui-measure-'));
  const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter',
    'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });

  const cleanup = () => {
    try { chrome.kill(); } catch { /* ignore */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  try {
    const wsUrl = await waitDevtools(DEBUG_PORT);
    const cdp = createCdp(wsUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    // 强制视口为 1440×900：--window-size 含浏览器装饰，实测只有 1422×804，
    // 会让 A4（canvas = 视口 − 588）等几何口径全部偏移。
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const loaded = new Promise((res) => cdp.on('Page.loadEventFired', res));
    await cdp.send('Page.navigate', { url: opts.url });
    await Promise.race([loaded, delay(20000)]);
    await delay(1500);
    // 设计稿 01 屏展示的是「已选中项目组件」的状态；不选中时右栏只渲染页面设置，
    // E2/E4/E5 的 tab / textarea / switch / colorfield 都不会出现在 DOM 里。
    // --select-first 让状态对齐设计稿，否则这三条只能判 BLOCKED。
    if (opts.selectFirst) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => { const c = document.querySelector('.compcard'); if (c) c.click(); return !!c; })()`,
        returnByValue: true,
      });
      await delay(600);
    }
    if (opts.openDialog) {
      // 点「导出前检查」打开弹窗，否则 .scrim/.dialog/.checkitem 都不在 DOM 里，
      // H1–H4 只能判 BLOCKED。设计稿 01 屏本身也没弹窗，无法用设计稿侧对照。
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('.topbar__right .btn'));
          const b = btns.find((x) => (x.textContent || '').includes('检查')) || btns[0];
          if (b) b.click();
          return !!b;
        })()`,
        returnByValue: true,
      });
      await delay(900);
    }
    if (opts.selectText) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const cs = Array.from(document.querySelectorAll('.compcard'));
          const c = cs.find((x) => (x.textContent || '').includes(${JSON.stringify(opts.selectText)}));
          if (c) c.click();
          return !!c;
        })()`,
        returnByValue: true,
      });
      await delay(600);
    }
    if (opts.tab) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const ts = Array.from(document.querySelectorAll('.inspector__tab'));
          const t = ts.find((x) => (x.textContent || '').includes(${JSON.stringify(opts.tab)}));
          if (t) t.click();
          return !!t;
        })()`,
        returnByValue: true,
      });
      await delay(500);
    }
    if (opts.fillTextarea > 0) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const ta = document.querySelector('.textarea--tall') || document.querySelector('.textarea');
          if (!ta) return false;
          const lines = [];
          for (let i = 0; i < ${opts.fillTextarea}; i += 1) lines.push('测试要点 ' + (i + 1) + '：一段足够长的中文内容用于制造溢出，方便验证溢出计数与警示点。');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(ta, lines.join('\\n'));
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`,
        returnByValue: true,
      });
      await delay(900);
    }
    if (opts.clickText) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const cands = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          const want = ${JSON.stringify(opts.clickText)};
          // 先精确匹配文本，再退回包含匹配：否则 '导出' 会命中 '导出前检查'
          const b = cands.find((x) => (x.textContent || '').trim() === want)
            || cands.find((x) => (x.textContent || '').includes(want));
          if (b) b.click();
          return !!b;
        })()`,
        returnByValue: true,
      });
      await delay(900);
    }
    if (opts.clickSelector) {
      const cr = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(opts.clickSelector)});
          if (!el) return { clicked: false };
          el.click();
          // 同步立刻读：选中态可能是瞬时的（点完即进入下一步）
          const after = document.querySelector(${JSON.stringify(opts.clickSelector)});
          const on = document.querySelector('.optcard--on');
          const st = (target) => {
            if (!target) return null;
            const cs = getComputedStyle(target);
            return {
              cls: String(target.className),
              backgroundColor: cs.backgroundColor,
              borderTopColor: cs.borderTopColor,
              borderRadius: cs.borderRadius,
              paddingTop: cs.paddingTop,
            };
          };
          return {
            clicked: true,
            clickedAfter: st(after),
            onEl: st(on),
            optcardCount: document.querySelectorAll('.optcard').length,
          };
        })()`,
        returnByValue: true,
      });
      await delay(300);
      process.stderr.write(`clickSelector: ${JSON.stringify(cr.result.value)}\n`);
    }
    if (opts.fillAll) {
      // 遍历左侧每个组件卡：点击选中 → 填该组件的 input / textarea。
      // 单独的 --select-text 只能生效一次（参数被覆盖），所以这里一次跑完所有组件。
      const fr = await cdp.send('Runtime.evaluate', {
        expression: `(async () => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          const areaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          const cards = Array.from(document.querySelectorAll('.compcard'));
          let filled = 0;
          for (let i = 0; i < cards.length; i += 1) {
            cards[i].click();
            await sleep(350);
            const inputs = Array.from(document.querySelectorAll('.inspector .input'));
            inputs.forEach((el, j) => {
              inputSetter.call(el, '样例内容' + (i + 1) + '-' + (j + 1) + ' 测试文本');
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            const areas = Array.from(document.querySelectorAll('.inspector .textarea'));
            areas.forEach((el, j) => {
              const lines = [];
              for (let k = 0; k < 3; k += 1) {
                lines.push('要点' + (j + 1) + '-' + (k + 1) + '：用于制造溢出与要点列表的样例内容，长度足够触发分页。');
              }
              areaSetter.call(el, lines.join('\\n'));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            filled += inputs.length + areas.length;
            await sleep(250);
          }
          return { cards: cards.length, filled };
        })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      await delay(500);
      process.stderr.write(`fillAll: ${JSON.stringify(fr.result.value)}\n`);
    }
    if (opts.fillInputs > 0) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const inputs = Array.from(document.querySelectorAll('.inspector .input')).slice(0, ${opts.fillInputs});
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          inputs.forEach((el, i) => {
            setter.call(el, '样例内容' + (i + 1) + ' 测试文本');
            el.dispatchEvent(new Event('input', { bubbles: true }));
          });
          return inputs.length;
        })()`,
        returnByValue: true,
      });
      await delay(700);
    }
    if (opts.dumpPaper) {
      const dr = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const p = document.querySelector('.paper');
          if (!p) return { found: false };
          const kids = Array.from(p.children).map((c) => ({
            cls: String(c.className), tag: c.tagName,
            text: (c.textContent || '').trim().slice(0, 60),
          }));
          const all = Array.from(p.querySelectorAll('*'))
            .map((e) => String(e.className || ''))
            .filter(Boolean);
          return {
            found: true, childCount: p.children.length, kids,
            uniqueClasses: Array.from(new Set(all)).slice(0, 40),
          };
        })()`,
        returnByValue: true,
      });
      process.stdout.write(JSON.stringify(dr.result.value, null, 2) + '\n');
      cdp.close();
      return 0;
    }
    const r = await cdp.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(`页面内测量抛错：${r.exceptionDetails.text}`);
    const data = r.result.value;
    cdp.close();

    if (opts.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
      return 0;
    }

    process.stdout.write(`测量地址：${opts.url}\n视口：${data.meta.vw}×${data.meta.vh}  DOM 节点：${data.meta.elements}\n\n`);
    for (const [k, v] of Object.entries(data)) {
      if (k === 'meta') continue;
      process.stdout.write(`--- ${k} ---\n`);
      if (typeof v !== 'object' || v === null) { process.stdout.write(`  ${fmt(v)}\n`); continue; }
      for (const [kk, vv] of Object.entries(v)) {
        process.stdout.write(`  ${kk}: ${fmt(vv)}\n`);
      }
    }
    return 0;
  } catch (e) {
    process.stderr.write(`测量失败：${e.message}\n`);
    return 1;
  } finally {
    cleanup();
  }
}

process.exit(await main());
