#!/usr/bin/env node
/**
 * ui-shot.mjs —— ResumeCraft UI 保真度审计截图器
 * ============================================================
 * 用途：把「定版设计稿」与「运行中的应用」在同一视口尺寸下各截一张，
 *       供人工/像素级比对。这是 `docs/verify/ui-fidelity-audit.md`
 *       里所有「截图量像素」类检查点的取图工具。
 *
 * 为什么必须用 --headless=new：
 *   旧版 headless 不支持 backdrop-filter，会把 glass.css 的
 *   `blur(18px) saturate(140%)` 渲染成不透明 —— 材质类检查点会全部假阴性。
 *   `--run-all-compositor-stages-before-draw` 保证合成层落盘后再截，
 *   避免偶发截到玻璃层未上屏的半成品。
 *
 * 为什么必须等 virtual-time：
 *   设计稿用 icons.js 在 DOMContentLoaded 时把 `data-ic` 注入 SVG，
 *   默认 headless 会在注入完成前就截图，导致图标全空。
 *   `--virtual-time-budget` 让浏览器在「虚拟时间」里推进后再截，
 *   既保证注入完成，又不产生真实等待。
 *
 * 输出目录默认 $TEMP（Windows 上项目目录会被拒写）。
 *
 * ------------------------------------------------------------
 * 用法
 * ------------------------------------------------------------
 *   # 1) 截设计稿（主编辑器屏）
 *   node scripts/ui-shot.mjs \
 *     --url "file:///C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/design/mockups/figma/01-editor.html" \
 *     --out "$TEMP/mockup-01.png"
 *
 *   # 2) 截应用（先把 vite dev server 起在 5199）
 *   node scripts/ui-shot.mjs --url "http://localhost:5199" --out "$TEMP/app-01.png"
 *
 *   # 3) 全部走默认：--width 1440 --height 900，输出到 $TEMP/ui-shot-<时间戳>.png
 *   node scripts/ui-shot.mjs --url "http://localhost:5199"
 *
 * 参数
 *   --url     <url|本地路径>  必填。可传 file:// URL，也可直接传本地 .html 路径
 *                             （脚本自动转成 file:// 并做正斜杠归一化）
 *   --out     <path>          可选。输出图片路径；只给目录名则自动补文件名。
 *                             缺省 = <TEMP>/ui-shot-<yyyyMMdd-HHmmss>.png
 *   --width   <px>            可选，默认 1440
 *   --height  <px>            可选，默认 900
 *   --budget  <ms>            可选，默认 3000。virtual-time-budget，等图标与字体
 *   --browser <path>          可选。强制指定浏览器可执行文件
 *   --help                    打印本说明
 *
 * 退出码
 *   0 = 出图成功且文件存在（字节数 < 50KB 时只告警，不算失败）
 *   1 = 参数错误 / 找不到浏览器 / 出图失败（绝不静默成功）
 *
 * 约束
 *   - 只读页面，不注入脚本、不改 DOM、不点击
 *   - 不改项目目录内任何文件；chrome profile 建在临时目录，跑完即删
 * ============================================================
 */

import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

/** 视口与等待的默认值。改这里就等于改审计的取图口径，改前先同步审计文档。 */
const DEFAULTS = Object.freeze({
  width: 1440,
  height: 900,
  budget: 3000,
});

/** 出图小于这个尺寸大概率是白屏/报错页，只告警不拦，因为截图本身成功。 */
const MIN_REASONABLE_BYTES = 50 * 1024;

/**
 * 候选浏览器，按优先级排列。
 * 先用 Chrome（对 backdrop-filter / 字体渲染最稳），退而用 Edge（同内核）。
 */
function browserCandidates() {
  const list = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    list.push(path.join(localAppData, 'Google/Chrome/Application/chrome.exe'));
  }

  list.push(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  );

  return list;
}

/** 打印用法，供 --help 与参数错误两条路径共用。 */
function printUsage() {
  process.stdout.write(
    [
      'ResumeCraft UI 截图器',
      '',
      '用法：',
      '  node scripts/ui-shot.mjs --url <url|本地路径> [--out <path>]',
      '                           [--width 1440] [--height 900] [--budget 3000]',
      '',
      '示例：',
      '  node scripts/ui-shot.mjs --url "file:///C:/Users/D.Amor/WorkBuddy/简历项目开发/docs/design/mockups/figma/01-editor.html" --out "$TEMP/mockup-01.png"',
      '  node scripts/ui-shot.mjs --url "http://localhost:5199" --out "$TEMP/app-01.png"',
      '',
      '未给 --out 时输出到 $TEMP/ui-shot-<时间戳>.png',
      '',
    ].join('\n'),
  );
}

/**
 * 极简参数解析：只认 --key value 与 --flag。
 * 不用第三方库，避免给项目引入依赖。
 */
function parseArgs(argv) {
  const opts = {
    url: null,
    out: null,
    width: DEFAULTS.width,
    height: DEFAULTS.height,
    budget: DEFAULTS.budget,
    browser: null,
    help: false,
  };

  const needValue = ['--url', '--out', '--width', '--height', '--budget', '--browser'];
  const numeric = new Set(['--width', '--height', '--budget']);

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      opts.help = true;
      continue;
    }

    if (!needValue.includes(token)) {
      throw new Error(`未知参数：${token}`);
    }

    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`参数 ${token} 缺少取值`);
    }
    i += 1;

    if (numeric.has(token)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`参数 ${token} 需要正整数，收到：${value}`);
      }
      opts[token.slice(2)] = Math.round(n);
      continue;
    }

    opts[token.slice(2)] = value;
  }

  return opts;
}

/** 截图可写入的目录：优先 $TEMP，其次 $TMP，最后 os.tmpdir()。 */
function tempRoot() {
  return process.env.TEMP || process.env.TMP || tmpdir();
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}`;
}

/**
 * 把用户给的 --out 归一化成绝对路径。
 * 只给目录（已存在或是以 / 结尾）时，自动补一个文件名。
 */
function resolveOutPath(rawOut) {
  if (!rawOut) {
    return path.join(tempRoot(), `ui-shot-${timestamp()}.png`);
  }

  const abs = path.resolve(rawOut);
  const looksLikeDir = rawOut.endsWith('/') || rawOut.endsWith('\\') || (existsSync(abs) && statSync(abs).isDirectory());

  if (looksLikeDir) {
    return path.join(abs, `ui-shot-${timestamp()}.png`);
  }

  return abs;
}

/**
 * 页面地址归一化：
 *   - http(s):// 原样返回
 *   - file:// 把反斜杠换成正斜杠（Chrome 在 Windows 上也认正斜杠）
 *   - 其他当作本地文件路径，补 file:/// 前缀
 */
function resolveUrl(rawUrl) {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  if (/^file:\/\//i.test(rawUrl)) {
    return rawUrl.replace(/\\/g, '/');
  }

  const abs = path.resolve(rawUrl).replace(/\\/g, '/');
  if (!existsSync(abs)) {
    throw new Error(`页面不存在：${abs}`);
  }
  return `file:///${abs.replace(/^\/+/, '')}`;
}

/** 找到可用的浏览器；找不到就抛错（绝不静默跳过）。 */
function findBrowser(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`--browser 指定的文件不存在：${explicit}`);
    }
    return explicit;
  }

  for (const candidate of browserCandidates()) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    [
      '找不到本机 Chrome / Edge，无法截图。',
      '已尝试以下路径：',
      ...browserCandidates().map((p) => `  - ${p}`),
      '请安装 Chrome，或用 --browser <可执行文件绝对路径> 指定。',
    ].join('\n'),
  );
}

/** 组装 chrome 命令行参数。 */
function buildChromeArgs({ browser, url, outPath, width, height, budget, profileDir }) {
  const argv = [
    // 新版 headless：唯一支持 backdrop-filter 的 headless 模式
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    // 固定 1x，保证 1 CSS px = 1 图片 px，像素量测才有意义
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    // 等图标注入 / 字体加载：虚拟时间推进，不产生真实等待
    `--virtual-time-budget=${budget}`,
    // 合成层落盘后再截，避免玻璃层未上屏
    '--run-all-compositor-stages-before-draw',
    `--screenshot=${outPath}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter',
    url,
  ];

  if (process.platform === 'win32') {
    // Windows 上 headless 偶发被沙箱策略拦住临时 profile，关掉更稳
    argv.splice(1, 0, '--no-sandbox');
  }

  return { browser, argv };
}

/**
 * 等文件出现并稳定。spawnSync 返回后 chrome 可能还没把 PNG 刷完，
 * 最多等 1500ms；不满足就交给上层判失败。
 */
function waitForFile(filePath, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath) && statSync(filePath).size > 0) {
      return statSync(filePath).size;
    }
    // 阻塞式微等待，避免引入异步噪声
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  return existsSync(filePath) ? statSync(filePath).size : 0;
}

function formatBytes(bytes) {
  const kb = bytes / 1024;
  return `${bytes} 字节 (${kb.toFixed(1)} KB)`;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`参数错误：${err.message}\n\n`);
    printUsage();
    return 1;
  }

  if (opts.help) {
    printUsage();
    return 0;
  }

  if (!opts.url) {
    process.stderr.write('缺少必填参数 --url\n\n');
    printUsage();
    return 1;
  }

  let url;
  let outPath;
  let browser;
  try {
    url = resolveUrl(opts.url);
    outPath = path.resolve(resolveOutPath(opts.out));
    browser = findBrowser(opts.browser);
  } catch (err) {
    process.stderr.write(`准备阶段失败：${err.message}\n`);
    return 1;
  }

  const outDir = path.dirname(outPath);
  if (!existsSync(outDir)) {
    try {
      mkdirSync(outDir, { recursive: true });
    } catch (err) {
      process.stderr.write(`无法创建输出目录 ${outDir}：${err.message}\n`);
      return 1;
    }
  }

  // 上一轮同名文件先删掉，否则可能把旧图当新图报成功
  if (existsSync(outPath)) {
    try {
      rmSync(outPath, { force: true });
    } catch (err) {
      process.stderr.write(`无法覆盖旧截图 ${outPath}：${err.message}\n`);
      return 1;
    }
  }

  const profileDir = path.join(tempRoot(), `ui-shot-profile-${process.pid}-${Date.now()}`);
  const { argv } = buildChromeArgs({
    browser,
    url,
    outPath,
    width: opts.width,
    height: opts.height,
    budget: opts.budget,
    profileDir,
  });

  process.stdout.write(`浏览器：${browser}\n`);
  process.stdout.write(`地址  ：${url}\n`);
  process.stdout.write(`视口  ：${opts.width} × ${opts.height}（deviceScaleFactor=1）\n`);
  process.stdout.write(`虚拟时间：${opts.budget}ms\n`);

  const result = spawnSync(browser, argv, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: Math.max(60000, opts.budget * 10),
  });

  // profile 是临时的，无论成败都清掉
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    /* 清理失败不影响出图结果，忽略 */
  }

  if (result.error) {
    process.stderr.write(`启动浏览器失败：${result.error.message}\n`);
    return 1;
  }

  const bytes = waitForFile(outPath);
  if (bytes === 0) {
    process.stderr.write('截图失败：没有生成文件。\n');
    const stderrTail = (result.stderr || '').trim().split('\n').slice(-12).join('\n');
    if (stderrTail) {
      process.stderr.write(`浏览器输出（末 12 行）：\n${stderrTail}\n`);
    }
    return 1;
  }

  process.stdout.write(`\n截图完成：${outPath}\n`);
  process.stdout.write(`文件大小：${formatBytes(bytes)}\n`);

  if (bytes < MIN_REASONABLE_BYTES) {
    process.stdout.write(
      `警告：图片仅 ${bytes} 字节（< 50KB），可能是白屏或加载失败。请人工打开确认。\n`,
    );
  }

  return 0;
}

process.exit(main());
