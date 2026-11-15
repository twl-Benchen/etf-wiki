#!/usr/bin/env python3
"""檢查 slides/index.html：每頁 data-source 的路徑都存在，結構頁另外列出 (AGENTS.md 5.5)。"""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "slides/index.html").read_text(encoding="utf-8")
slides = re.findall(r'<section class="slide" data-source="([^"]*)">(.*?)</section>', html, re.S)
bad = 0
for n, (src, body) in enumerate(slides, 1):
    title = re.search(r"<h[12]>(.*?)</h[12]>", body, re.S)
    title = re.sub(r"<[^>]+>", "", title.group(1)) if title else "?"
    if not src.strip():
        print(f"{n:2d} [結構頁] {title}")
        continue
    missing = [s for s in src.split() if not (ROOT / s).exists()]
    bad += len(missing)
    print(f"{n:2d} {'[缺檔] ' + ','.join(missing) if missing else 'OK'} {title}  <- {src}")
print(f"共 {len(slides)} 頁，{bad} 個來源路徑不存在")
sys.exit(1 if bad else 0)
