#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
字体子集化（2026-10-29）

为什么要做：5 个 woff2 合计 5.4MB、5 个 TTF 12.4MB，首屏全部下载不可接受。
目标：在**不产生豆腐块**的前提下把字形集收到最小。

字形集的构成（三部分并集，缺一不可）：
  1. GB2312 一级汉字（3755 字）—— 覆盖日常中文 99% 以上，是"用户可能输入"的安全边界
  2. 全角标点 / 中文符号 / 全角字母数字 / ASCII 可打印字符
  3. 项目自有文本（src/** 与内置模板里出现的每一个字符）—— 保证代码里写死的
     中文（组件名、字段标签、按钮文案、模板示例）一个都不缺

第 3 部分是关键：光按"常用字表"子集化，代码里出现的生僻字（比如姓名用字、
学校简称）会掉，界面直接出豆腐。所以子集化脚本会**先扫源码**再定字符集，
并且产出一份 `font-charset.json` 供守卫测试核对 —— 源码新增生僻字时
守卫测试会红，提示重跑本脚本。

用法：
    python scripts/subset-fonts.py            # 子集化 + 打印前后体积
    python scripts/subset-fonts.py --check    # 只检查覆盖，不写文件

依赖：pip install fonttools brotli
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_FONTS = ROOT / "src" / "assets" / "fonts"
CHARSET_OUT = ROOT / "scripts" / "font-charset.json"

# 要处理的 5 个字重（与 src/design/fonts.css 的 @font-face 一一对应）
WEIGHTS = [
    ("rc-sans-400", "Rc Sans 400"),
    ("rc-sans-500", "Rc Sans 500"),
    ("rc-sans-700", "Rc Sans 700"),
    ("rc-serif-400", "Rc Serif 400"),
    ("rc-serif-600", "Rc Serif 600"),
]


def gb2312_level1() -> str:
    """
    GB2312 **一二级全部**汉字（区码 16–87，共 6763 字）。

    2026-10-29 Amor 裁决：取一二级而不是只取一级。
    理由：一级只覆盖日常用字，二级含姓名/地名常用生僻字（弢、湉、彧…）；
    简历是"姓名 + 学校 + 公司"的场景，缺一个字就是 PDF 豆腐块，
    事后补字集等于重复劳动。宁可首载体积大一点，也要一次做对。
    """
    chars: list[str] = []
    for qu in range(16, 88):          # 16–55 一级，56–87 二级
        for wei in range(1, 95):
            try:
                raw = bytes([qu + 0xA0, wei + 0xA0])
                chars.append(raw.decode("gb2312"))
            except UnicodeDecodeError:
                continue
    return "".join(chars)


def punctuation_and_ascii() -> str:
    """ASCII 可打印 + 全角标点 / 全角字母数字 / 中文常用符号。"""
    ascii_printable = "".join(chr(c) for c in range(0x20, 0x7F))
    fullwidth = "".join(chr(c) for c in range(0xFF01, 0xFF5F))   # ！～ ￥
    cjk_punct = "".join(chr(c) for c in range(0x3000, 0x303F))   # 、。〈〉《》
    general = "‐-―‘’“”…‰′″※→←↑↓±×÷≤≥≠∞√"
    return ascii_printable + fullwidth + cjk_punct + general


def project_chars() -> str:
    """扫 src/** 与内置模板，收集代码里出现的每一个非 ASCII 字符。"""
    found: set[str] = set()
    pattern = re.compile(r"[^\x00-\x7F]")
    for base in (ROOT / "src",):
        for path in base.rglob("*"):
            if path.suffix not in {".ts", ".vue", ".css", ".json", ".md"}:
                continue
            if "assets" in path.parts:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            found.update(pattern.findall(text))
    return "".join(sorted(found))


def build_charset() -> str:
    merged = set(gb2312_level1())
    merged.update(punctuation_and_ascii())
    merged.update(project_chars())
    merged.discard("\n")
    merged.discard("\r")
    merged.discard("\t")
    return "".join(sorted(merged))


def subset_one(stem: str, ext: str, charset: str) -> tuple[int, int]:
    """返回 (原始字节, 子集后字节)。"""
    src = SRC_FONTS / ext / f"{stem}.{ext}"
    dst = SRC_FONTS / ext / f"{stem}.subset.{ext}"
    if not src.exists():
        raise SystemExit(f"缺源文件：{src}")
    before = src.stat().st_size

    cmd = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(src),
        f"--text-file={CHARSET_OUT.with_suffix('.txt')}",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
        f"--output-file={dst}",
    ]
    if ext == "woff2":
        cmd.append("--flavor=woff2")
    subprocess.run(cmd, check=True, capture_output=True)

    after = dst.stat().st_size
    return before, after


def main() -> int:
    charset = build_charset()

    # pyftsubset 的 --text-file 需要一个纯文本文件
    text_file = CHARSET_OUT.with_suffix(".txt")
    text_file.write_text(charset, encoding="utf-8")
    CHARSET_OUT.write_text(
        json.dumps(
            {
                "description": "字体子集字符集（scripts/subset-fonts.py 生成）",
                "charCount": len(charset),
                "note": "新增生僻中文后必须重跑 subset-fonts.py，否则守卫测试会红",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"字符集：{len(charset)} 个字符")
    print(f"  GB2312 一级 {len(gb2312_level1())} + 标点/ASCII {len(punctuation_and_ascii())}"
          f" + 项目文本 {len(project_chars())}")

    if "--check" in sys.argv:
        print("（--check 模式，不写文件）")
        return 0

    total_before = total_after = 0
    for stem, label in WEIGHTS:
        for ext in ("woff2", "ttf"):
            path = SRC_FONTS / ext / f"{stem}.{ext}"
            if not path.exists():
                continue
            before, after = subset_one(stem, ext, charset)
            total_before += before
            total_after += after
            print(f"  {label:14s} {ext:5s} {before/1024:8.0f} KB → {after/1024:6.0f} KB")

    print(f"\n合计 {total_before/1024:.0f} KB → {total_after/1024:.0f} KB"
          f"（{100 * total_after / total_before:.0f}%）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
