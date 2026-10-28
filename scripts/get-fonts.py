# -*- coding: utf-8 -*-
"""
思源/Noto 中文字体：下载 → 实例化 → 子集化 → 落位
用法：双击同目录的 get-fonts.cmd（会自动找 python 并调本脚本）

为什么这么设计：
  1. 只下载**一个可变字体文件**（Noto Sans SC / Noto Serif SC 的 wght 可变 TTF），
     再用 fontTools 实例化出 5 个字重。比下载全量 OTF 小得多（约 10MB vs 80MB+）。
  2. 字符集用 GB2312 一级 + 二级字自动生成，不用你准备 txt。
  3. 每一步失败都打印**你能照着做的下一步**，不甩一堆 traceback。

依赖：Python 3.9+、fonttools、brotli（后两个由本脚本自动安装）
"""
from __future__ import annotations

import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "src" / "assets" / "fonts"
RAW_DIR = FONT_DIR / "_raw"
WOFF2_DIR = FONT_DIR / "woff2"
TTF_DIR = FONT_DIR / "ttf"
LOG = ROOT / "docs" / "verify" / "font-fetch.log"

# family 后缀 -> [(字重, 下载源)]
FAMILIES = {
    "sans": {
        "label": "思源黑体 / Noto Sans SC",
        "url": "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
        "weights": [400, 500, 700],
    },
    "serif": {
        "label": "思源宋体 / Noto Serif SC",
        "url": "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
        "weights": [400, 600],
    },
}


def log(msg: str = "") -> None:
    print(msg)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(msg + "\n")


def step(title: str) -> None:
    log()
    log("=" * 60)
    log(title)
    log("=" * 60)


def die(msg: str, hint: str) -> None:
    log()
    log("[失败] " + msg)
    log("[建议] " + hint)
    sys.exit(1)


def ensure_dirs() -> None:
    for d in (FONT_DIR, RAW_DIR, WOFF2_DIR, TTF_DIR, LOG.parent):
        d.mkdir(parents=True, exist_ok=True)


def ensure_deps() -> None:
    step("第 1 步 / 5：检查依赖（fonttools、brotli）")
    try:
        import fontTools  # noqa: F401
        log("  fonttools 已安装")
    except ImportError:
        log("  正在安装 fonttools ...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "fonttools"])
    try:
        import brotli  # noqa: F401
        log("  brotli 已安装")
    except ImportError:
        log("  正在安装 brotli（woff2 编码必需）...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "brotli"])


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1_000_000:
        log(f"  已存在，跳过下载：{dest.name}（{dest.stat().st_size // 1024} KB）")
        return
    log(f"  下载中：{url}")
    try:
        with urllib.request.urlopen(url, timeout=120) as resp, dest.open("wb") as out:
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)
    except Exception as exc:  # noqa: BLE001
        die(
            f"下载失败：{dest.name}（{exc}）",
            "把下面这个地址粘到浏览器里手动下载，放到 " + str(RAW_DIR) + "\n      " + url,
        )
    log(f"  完成：{dest.name}（{dest.stat().st_size // 1024} KB）")


def build_charset() -> str:
    """GB2312 一级 + 二级汉字 + 常用标点 + ASCII，约 6800 字。"""
    chars: list[str] = []
    for b1 in range(0xB0, 0xF8):
        for b2 in range(0xA1, 0xFE):
            try:
                chars.append(bytes([b1, b2]).decode("gb2312"))
            except UnicodeDecodeError:
                continue
    # ASCII 可打印
    chars.extend(chr(c) for c in range(0x20, 0x7F))
    # 常用中文标点
    chars.extend("，。、；：？！“”‘’（）《》【】—…·￥")
    return "".join(dict.fromkeys(chars))


def instance_and_subset(src: Path, family: str, label: str) -> None:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    charset = build_charset()
    log(f"  字符集：{len(charset)} 字（GB2312 一二级 + ASCII + 常用标点）")

    for weight in FAMILIES[family]["weights"]:
        ttf_out = TTF_DIR / f"rc-{family}-{weight}.ttf"
        woff2_out = WOFF2_DIR / f"rc-{family}-{weight}.woff2"

        log(f"  [{label}] 实例化 wght={weight} ...")
        font = TTFont(str(src))
        instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)

        log(f"  [{label}] 子集化 → {ttf_out.name}")
        options = subset.Options()
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=charset)
        subsetter.subset(font)
        font.save(str(ttf_out))

        log(f"  [{label}] 编码 woff2 → {woff2_out.name}")
        font2 = TTFont(str(ttf_out))
        font2.flavor = "woff2"
        font2.save(str(woff2_out))

        log(f"    {ttf_out.name} {ttf_out.stat().st_size // 1024} KB / {woff2_out.name} {woff2_out.stat().st_size // 1024} KB")


def main() -> None:
    if LOG.exists():
        LOG.unlink()
    ensure_dirs()
    log("ResumeCraft 字体资产准备")
    log("时间：" + __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log("目标目录：" + str(FONT_DIR))

    ensure_deps()

    step("第 2 步 / 5：下载可变字体（每个约 10MB，只需一次）")
    for family, meta in FAMILIES.items():
        download(meta["url"], RAW_DIR / f"{family}-variable.ttf")

    step("第 3 步 / 5：实例化 + 子集化")
    for family, meta in FAMILIES.items():
        instance_and_subset(RAW_DIR / f"{family}-variable.ttf", family, meta["label"])

    step("第 4 步 / 5：许可证")
    ofl = FONT_DIR / "OFL.txt"
    if not ofl.exists():
        ofl.write_text(
            "SIL Open Font License 1.1\n"
            "本目录下的字体为 Google Noto / Adobe Source Han 系列，采用 SIL OFL 1.1 授权。\n"
            "完整许可文本见：https://scripts.sil.org/OFL\n"
            "字体名称与版本信息由 fontTools 保留于 name 表。\n",
            encoding="utf-8",
        )
    log("  OFL.txt 已就位")

    step("第 5 步 / 5：结果")
    log("woff2/:")
    for p in sorted(WOFF2_DIR.glob("*.woff2")):
        log(f"  {p.name}  {p.stat().st_size // 1024} KB")
    log("ttf/:")
    for p in sorted(TTF_DIR.glob("*.ttf")):
        log(f"  {p.name}  {p.stat().st_size // 1024} KB")
    log()
    log("下一步：双击 scripts\\check-fonts.cmd 校验，然后告诉阿U「字体好了」。")
    log("注意：字体换掉后必须重跑 docs/verify/canvas-vs-dom.html。")


if __name__ == "__main__":
    main()
