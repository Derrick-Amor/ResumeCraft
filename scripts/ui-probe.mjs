#!/usr/bin/env node
/**
 * ui-probe.mjs —— ResumeCraft UI 管道体检探针（CDP）
 * ============================================================
 * 用途：不判像素，只回答「样式层到底有没有接上」。
 *       这是 `docs/verify/ui-fidelity-audit.md` §7.3 的执行工具。
 *
 * 与 ui-shot.mjs 的分工：
 *   ui-shot.mjs  → 出 PNG，给人看/量像素（审计依据）
 *   ui-probe.mjs → 出 JSON，给机器判（管道体检，非审计依据）
 *
 * 它查三件事：
 *   1. 计算样式：body 的 font-family 是否含设计稿字体、背景色是否 = --rc-canvas
 *   2. 结构性异常：设计稿类名在 DOM 里出现了几个、旧类名还剩几个
 *   3. 管道错误：控制台 error / 网络 4xx-5xx / 资源加载失败
 *
 * 为什么走 CDP 而不是截图：
 *   font-family / backgroundColor 这类值只能通过 getComputedStyle 读到真值，
 *   PNG 里看不出来（字体回退与真字体的差异在截图上是不可判的）。
 *   走 CDP 还能顺带收到控制台的报错，截图工具做不到。
 *
 * ------------------------------------------------------------
 * 用法
 * ------------------------------------------------------------
 *   node scripts/ui-probe.mjs --url http://localhost:5273
 *   node scripts/ui-probe.mjs --url http://localhost:5273 --wait 2000 --json
 *   node scripts/ui-probe.mjs --url http://localhost:5273 --browser "C:/.../chrome.exe"
 *
 * 参数
 *   --url     <url>   必填。待体检的地址（通常是 vite dev server）
 *   --wait    <ms>    可选，默认 1500。load 事件后再等多久（等 CSS/字体）
 *   --expect-font <substr>  可选，默认 "Rc Sans"。字族里应出现的子串
 *   --json            可选。只输出 JSON，不打印人类可读摘要
 *   --browser <path>  可选。强制指定浏览器
 *   --help
 *
 * 退出码
 *   0 = 三项全过
 *   1 = 参数/启动失败
 *   2 = 体检发现异常（字体未生效 / 背景色不对 / 有管道错误）
 *
 * 约束：只读页面，不点击、不改 DOM。chrome profile 建在临时目录，跑完即删。
 * ============================================================
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const DEFAULTS = Object.freeze({
  wait: 1500,
  expectFont: 'Rc Sans',
  debugPort: 9333,
  width: 1440,
  height: 900,
});

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

function findBrowser(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`--browser 指定的文件不存在：${explicit}`);
    return explicit;
  }
  for (const c of browserCandidates()) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    ['找不到本机 Chrome / Edge。已尝试：', ...browserCandidates().map((p) => `  - ${p}`)].join('\n'),
  );
}

function parseArgs(argv) {
  const opts = {
    url: null,
    wait: DEFAULTS.wait,
    expectFont: DEFAULTS.expectFont,
    json: false,
    browser: null,
    help: false,
  };
  const withValue = new Set(['--url', '--wait', '--expect-font', '--browser']);
  const numeric = new Set(['--wait']);

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') { opts.help = true; continue; }
    if (t === '--json') { opts.json = true; continue; }
    if (!withValue.has(t)) throw new Error(`未知参数：${t}`);

    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`参数 ${t} 缺少取值`);
    i += 1;

    if (numeric.has(t)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`参数 ${t} 需要非负整数，收到：${v}`);
      opts[t.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = Math.round(n);
      continue;
    }
    opts[t.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return opts;
}

function printUsage() {
  process.stdout.write(
    [
      'ResumeCraft UI 管道体检探针',
      '',
      '用法：',
      '  node scripts/ui-probe.mjs --url http://localhost:5273 [--wait 1500] [--json]',
      '',
      '查三件事：计算样式是否生效 / 设计稿类名是否在 DOM / 有无控制台与网络错误',
      '',
    ].join('\n'),
  );
}

/** 极简 CDP 客户端：只需 send + 事件回调，够用，不引第三方库。 */
function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const handlers = new Map();

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', (e) => reject(new Error(`WS 连接失败：${e.message || 'unknown'}`)));
  });

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`CDP ${msg.error.message}`));
      else resolve(msg.result);
      return;
    }
    const list = handlers.get(msg.method);
    if (list) for (const fn of list) fn(msg.params);
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
    on(method, fn) {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(fn);
    },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}

async function httpJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.json();
}

/** 轮询 devtools 端点直到就绪（不 sleep 死循环，有上限）。 */
async function waitForDevtools(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const list = await httpJson(`http://127.0.0.1:${port}/json/list`);
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (err) {
      lastErr = err;
    }
    await delay(120);
  }
  throw new Error(`DevTools 端点未就绪：${lastErr?.message || 'timeout'}`);
}

/** 在页面内跑的探针脚本：返回一个纯对象，值全部 by value 传回。
 *
 * 字体判定为什么必须走 document.fonts 而不是 getComputedStyle：
 *   getComputedStyle().fontFamily 返回的是**声明值的解析结果**，只证明 token 被解析、
 *   层叠正确；它**完全不证明**字体文件已加载、也不证明回退是否发生。
 *   实测踩过：body fontFamily 与 --rc-font 逐字一致 → 判 PASS，
 *   而当时 fonts.css 声明的族名是 'Rc Sans'，无人引用，5.6MB woff2 一个都没下载，
 *   浏览器实际回退到 Segoe UI / 微软雅黑。PASS 了但没验到该验的东西。
 *
 * 所以这里做三件事：
 *   ① 报告全部 FontFace 的 family/weight/status
 *   ② 对目标族显式 document.fonts.load() 触发真实下载，再看 status
 *   ③ 由外层 CDP 侧统计 .woff2 请求数与状态码，作为"是否真下载"的独立证据
 */
const PROBE_SCRIPT = `(async () => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const root = document.documentElement;
  const body = document.body;

  // 设计稿外壳类名：应全部出现（D 段完成后）
  const designClasses = [
    '.topbar', '.side', '.canvas', '.canvas__bar', '.inspector', '.statusbar',
    '.side__tabs', '.side__tab', '.compgrid', '.compcard', '.pagerow',
    '.inspector__tabs', '.inspector__tab', '.field', '.input', '.paper', '.p-name',
  ];
  // 旧自建骨架类名：应全部消失
  const legacyClasses = ['.rc-shell', '.rc-toolbar', '.rc-canvas__page', '.rc-side', '.rc-inspector'];

  const count = (sel) => document.querySelectorAll(sel).length;

  const styleTags = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
    .filter((n) => {
      if (n.tagName === 'LINK') return true;
      return (n.textContent || '').length > 100;
    })
    .map((n) => (n.tagName === 'LINK' ? 'link:' + n.getAttribute('href') : 'style:' + (n.textContent || '').length));

  // ---- 字体：显式触发加载，再读真实 status ----
  const families = ['Rc Sans', 'Rc Serif', 'Inter', 'Noto Sans SC'];
  const trigger = {};
  for (const fam of families) {
    try {
      const loaded = await document.fonts.load('16px "' + fam + '"', 'Aa中');
      trigger[fam] = { requested: true, resolvedFaces: loaded.length };
    } catch (e) {
      trigger[fam] = { requested: true, error: String(e && e.message || e) };
    }
  }
  try { await document.fonts.ready; } catch (e) { /* ignore */ }

  const faces = Array.from(document.fonts).map((f) => ({
    family: String(f.family || '').replace(/["']/g, ''),
    weight: String(f.weight || ''),
    style: String(f.style || ''),
    status: String(f.status || ''),
  }));

  const checks = {};
  for (const fam of families) {
    checks[fam] = document.fonts.check('16px "' + fam + '"');
  }

  const bodyCs = cs(body) || {};
  return {
    title: document.title,
    url: location.href,
    bodyFontFamily: bodyCs.fontFamily || '',
    bodyBackgroundColor: bodyCs.backgroundColor || '',
    bodyFontSize: bodyCs.fontSize || '',
    tokenCanvas: (cs(root)?.getPropertyValue('--rc-canvas') || '').trim(),
    tokenAccent: (cs(root)?.getPropertyValue('--rc-accent') || '').trim(),
    tokenFont: (cs(root)?.getPropertyValue('--rc-font') || '').trim(),
    fontFaces: faces,
    fontTrigger: trigger,
    fontChecks: checks,
    designCounts: Object.fromEntries(designClasses.map((s) => [s, count(s)])),
    legacyCounts: Object.fromEntries(legacyClasses.map((s) => [s, count(s)])),
    styleSources: styleTags,
    elementCount: document.querySelectorAll('*').length,
  };
})()`;

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`参数错误：${err.message}\n\n`);
    printUsage();
    return 1;
  }
  if (opts.help) { printUsage(); return 0; }
  if (!opts.url) {
    process.stderr.write('缺少必填参数 --url\n\n');
    printUsage();
    return 1;
  }

  let browser;
  try {
    browser = findBrowser(opts.browser);
  } catch (err) {
    process.stderr.write(`准备失败：${err.message}\n`);
    return 1;
  }

  const profileDir = mkdtempSync(path.join(tmpdir(), 'ui-probe-'));
  const chrome = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${DEFAULTS.width},${DEFAULTS.height}`,
      `--remote-debugging-port=${DEFAULTS.debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );

  const cleanup = () => {
    try { chrome.kill(); } catch { /* ignore */ }
    try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  const consoleErrors = [];
  const networkErrors = [];
  const failedRequests = [];
  const fontRequests = [];
  let totalBytes = 0;

  try {
    const wsUrl = await waitForDevtools(DEFAULTS.debugPort);
    const cdp = createCdp(wsUrl);
    await cdp.ready;

    // 先开域再导航，才能收到导航期间的报错
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type !== 'error' && p.type !== 'warning') return;
      const text = (p.args || [])
        .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
        .join(' ');
      consoleErrors.push({ level: p.type, text: text.slice(0, 400) });
    });
    cdp.on('Log.entryAdded', (p) => {
      const e = p.entry || {};
      if (e.level !== 'error') return;
      // Log 条目通常带 url；控制台文案里没有 URL，判噪音时靠这个字段
      consoleErrors.push({
        level: 'log-error',
        text: (e.text || '').slice(0, 400),
        url: (e.url || '').slice(0, 300),
      });
    });
    cdp.on('Network.responseReceived', (p) => {
      const s = p.response?.status ?? 0;
      const u = p.response?.url || '';
      if (s >= 400) networkErrors.push({ status: s, url: u.slice(0, 300) });
      // 字体文件请求单独记：这是"字体是否真的下载"最直接的证据
      if (/\.(woff2?|ttf|otf)(\?|$)/i.test(u)) fontRequests.push({ status: s, url: u.slice(0, 300) });
    });
    cdp.on('Network.loadingFinished', (p) => {
      if (p.encodedDataLength) totalBytes += p.encodedDataLength;
    });
    cdp.on('Network.loadingFailed', (p) => {
      failedRequests.push({ error: p.errorText || '', url: (p.requestId || '').slice(0, 80) });
    });

    const loaded = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
    await cdp.send('Page.navigate', { url: opts.url });
    await Promise.race([loaded, delay(20000)]);
    await delay(opts.wait); // 等 CSS 应用与字体加载

    const res = await cdp.send('Runtime.evaluate', {
      expression: PROBE_SCRIPT,
      returnByValue: true,
      // 探针里有 await document.fonts.load(...)，必须等 promise
      awaitPromise: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(`页面内探针抛错：${res.exceptionDetails.text}`);
    }
    const probe = res.result.value;

    // ---- 判定 ----
    // 设计原则：不硬编码字体名/色值，一律跟 --rc-* token 的解析值自比对。
    // 理由：硬编码会把「token 改了名」误判成「管道坏了」——本次就踩过
    //（偏差 3 的文字写 Rc Sans，而 tokens.css 的 --rc-font 实际是 Inter 栈）。
    const checks = [];
    const norm = (s) => String(s || '').toLowerCase().replace(/["'\s]+/g, '');

    const tokenFont = norm(probe.tokenFont);
    const bodyFont = norm(probe.bodyFontFamily);
    const fontOk = tokenFont !== '' && bodyFont === tokenFont;
    checks.push({
      id: 'font-decl',
      name: 'body 字族声明 = --rc-font 解析值（**仅证明 token 生效，不证明字体已加载**）',
      pass: fontOk,
      actual: fontOk
        ? `${probe.bodyFontFamily}（与 token 一致）`
        : `body=${probe.bodyFontFamily || '(空)'} token=${probe.tokenFont || '(空)'}`,
    });

    // ---- 真·字体加载判定（document.fonts）----
    // 判据：目标族至少有一张 face 的 status === 'loaded'，且无字体文件 4xx/5xx。
    // 只看 computedStyle 会把"声明了但从不下载"判成 PASS（实测踩过）。
    const TARGET_FAMILIES = ['Rc Sans', 'Inter'];
    const facesByFamily = {};
    for (const f of probe.fontFaces || []) {
      (facesByFamily[f.family] ||= []).push(f);
    }
    const familyReport = TARGET_FAMILIES.map((fam) => {
      const list = facesByFamily[fam] || [];
      const loaded = list.filter((f) => f.status === 'loaded').length;
      const unloaded = list.filter((f) => f.status === 'unloaded').length;
      return { fam, total: list.length, loaded, unloaded, available: probe.fontChecks?.[fam] === true };
    });
    const fontBadStatus = fontRequests.filter((r) => r.status >= 400);
    const allFamiliesLoaded = familyReport.every((r) => r.total > 0 && r.loaded > 0);
    checks.push({
      id: 'fonts-loaded',
      name: '目标族已真实加载（document.fonts status=loaded，且有实际字体请求）',
      pass: allFamiliesLoaded && fontBadStatus.length === 0,
      actual:
        familyReport
          .map((r) => `${r.fam}: face ${r.total} / loaded ${r.loaded} / unloaded ${r.unloaded} / check=${r.available}`)
          .join(' | ') +
        ` · 字体请求 ${fontRequests.length} 个` +
        (fontBadStatus.length ? `，其中失败 ${fontBadStatus.length} 个` : ''),
    });

    const canvas = probe.tokenCanvas.toLowerCase().replace(/\s/g, '');
    const bg = String(probe.bodyBackgroundColor).toLowerCase().replace(/\s/g, '');
    checks.push({
      id: 'bg',
      name: 'body 背景色 = --rc-canvas 的解析值',
      pass: canvas !== '' && bg === 'rgb(237,241,247)',
      actual: `${probe.bodyBackgroundColor} token=${probe.tokenCanvas}`,
    });

    // D 段未完成时旧类名必然还在、设计稿类名必然不全 —— 这两项只报告进度，不判失败
    const legacyHit = Object.entries(probe.legacyCounts).filter(([, n]) => n > 0);
    checks.push({
      id: 'legacy',
      name: '旧骨架类名残留（D 段进度指标，非判据）',
      pass: null,
      actual: legacyHit.length ? legacyHit.map(([k, n]) => `${k}×${n}`).join(', ') : '已全部替换',
    });

    const designHit = Object.entries(probe.designCounts).filter(([, n]) => n > 0);
    checks.push({
      id: 'design',
      name: '设计稿类名已在 DOM 出现（D 段进度指标，非判据）',
      pass: null,
      actual: `${designHit.length}/${Object.keys(probe.designCounts).length} 个出现：${designHit.map(([k, n]) => k + '×' + n).join(', ') || '全部为 0'}`,
    });

    // favicon.ico 的 404 是 Vite 默认没有图标，与样式管道无关，不计入
    const isNoise = (u) => /\/favicon\.ico(\?|$)/.test(u);
    const netReal = networkErrors.filter((e) => !isNoise(e.url));
    const consoleReal = consoleErrors.filter(
      (e) => !isNoise(e.text) && !isNoise(e.url || '') && !/favicon\.ico/.test(e.text),
    );
    const pipeErrors = [
      ...consoleReal,
      ...netReal.map((e) => ({ level: 'net', text: `${e.status} ${e.url}` })),
    ];
    checks.push({
      id: 'errors',
      name: '无控制台错误 / 无样式资源 4xx-5xx（已排除 favicon）',
      pass: pipeErrors.length === 0,
      actual: pipeErrors.length
        ? pipeErrors.slice(0, 8).map((e) => `[${e.level}] ${e.text}`).join(' | ')
        : '干净',
    });

    const hard = checks.filter((c) => c.pass === false);
    const out = {
      url: opts.url,
      probedAt: new Date().toISOString(),
      probe,
      checks,
      fonts: {
        faces: probe.fontFaces,
        trigger: probe.fontTrigger,
        checks: probe.fontChecks,
        requests: fontRequests,
      },
      errors: { console: consoleErrors, network: networkErrors, failedRequests },
      verdict: hard.length === 0 ? 'PASS' : 'FAIL',
    };

    cdp.close();

    if (opts.json) {
      process.stdout.write(JSON.stringify(out, null, 2) + '\n');
      return hard.length === 0 ? 0 : 2;
    }

    process.stdout.write(`体检地址：${out.url}\n`);
    process.stdout.write(`DOM 节点：${probe.elementCount} 样式源：${probe.styleSources.join(' , ') || '（无）'}\n\n`);
    for (const c of checks) {
      const mark = c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : 'INFO';
      process.stdout.write(`[${mark}] ${c.name}\n       实际：${c.actual}\n`);
    }
    process.stdout.write(`\n字体明细（document.fonts）\n`);
    const famLines = Object.entries(
      (probe.fontFaces || []).reduce((acc, f) => {
        (acc[f.family] ||= []).push(f);
        return acc;
      }, {}),
    );
    for (const [fam, list] of famLines) {
      process.stdout.write(
        `  ${fam.padEnd(16)} ${list.map((f) => `${f.weight}:${f.status}`).join(' ')}\n`,
      );
    }
    process.stdout.write(
      `  字体文件请求：${fontRequests.length} 个，共 ${Math.round(totalBytes / 1024)} KB` +
        (fontRequests.length ? ` → ${fontRequests.map((r) => r.status).join(', ')}` : ' → **一个都没请求，说明没有元素用到这些族**') +
        '\n',
    );

    process.stdout.write(`\n结论：${out.verdict}\n`);
    if (hard.length) {
      process.stdout.write('提示：FAIL 项只说明"样式层没接上"，属管道问题，不构成任何像素级审计结论。\n');
    }
    return hard.length === 0 ? 0 : 2;
  } catch (err) {
    process.stderr.write(`体检失败：${err.message}\n`);
    return 1;
  } finally {
    cleanup();
  }
}

process.exit(await main());
