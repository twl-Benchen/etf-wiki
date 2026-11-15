#!/usr/bin/env python3
"""ETF 入門 Wiki 機械式檢查 (AGENTS.md 5.3)。

用法: python3 scripts/lint.py
檢查: 死連結、index 漏列、孤立頁面、frontmatter 缺欄位、缺來源標註、來源編號不存在。
語意檢查 (矛盾、建議句、太難、缺日期) 不在這裡，由 AI 閱讀判斷。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIKI = ROOT / "wiki"
REQUIRED = ["title", "type", "summary", "aliases", "sources", "updated"]
# 這些段落不需要逐行標來源
EXEMPT_SECTIONS = {"例子", "相關頁面", "和哪些概念有關", "影響的頁面", "出處", "核對紀錄"}
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)#\s]+\.md)(?:#[^)]*)?\)")
SRC_RE = re.compile(r"\(來源: ([^)]+)\)")


def parse(path):
    text = path.read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---"):
        _, fm, body = text.split("---", 2)
        for line in fm.strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.split("#")[0].strip()
    return meta, body


def as_list(v):
    return [x.strip() for x in v.strip("[]").split(",") if x.strip()]


def main():
    pages = sorted(p for p in WIKI.rglob("*.md") if p.name not in ("index.md", "log.md"))
    problems = []
    data = {p: parse(p) for p in pages}

    valid_ids = set()
    for p, (meta, _) in data.items():
        if meta.get("type") == "source":
            valid_ids.update(as_list(meta.get("sources", "")))

    inbound = {p: 0 for p in pages}
    index_text = (WIKI / "index.md").read_text(encoding="utf-8")
    index_targets = {(WIKI / t).resolve() for t in LINK_RE.findall(index_text)}

    for t in index_targets:
        if not t.exists():
            problems.append(f"[死連結] index.md -> {t.relative_to(ROOT)}")

    for p, (meta, body) in data.items():
        rel = p.relative_to(ROOT)
        for k in REQUIRED:
            if not meta.get(k):
                problems.append(f"[frontmatter] {rel} 缺少 {k}")
        for target in LINK_RE.findall(body):
            dest = (p.parent / target).resolve()
            if not dest.exists():
                problems.append(f"[死連結] {rel} -> {target}")
            elif dest in inbound and dest != p:
                inbound[dest] += 1
        if p.resolve() not in index_targets:
            problems.append(f"[index 漏列] {rel}")

        if meta.get("type") == "source":
            continue
        section = ""
        prev_sourced = False  # 表格上一行有標來源時，整張表視為有來源 (AGENTS.md 3.4)
        for n, line in enumerate(body.splitlines(), 1):
            s = line.strip()
            if s.startswith("#"):
                section = s.lstrip("#").strip()
                prev_sourced = False  # 換段落就重算，表格不能借用上一段的來源
                continue
            if not s or section in EXEMPT_SECTIONS:
                continue
            if s.startswith("|"):
                if prev_sourced:
                    continue
            else:
                prev_sourced = bool(SRC_RE.search(s))
            if not re.search(r"[一-鿿]", s) or s.lstrip("-* ").startswith("假設"):
                continue
            ids = SRC_RE.findall(s)
            if not ids:
                problems.append(f"[缺來源] {rel}:{n} {s[:30]}")
            for group in ids:
                for i in as_list(group):
                    if i not in valid_ids:
                        problems.append(f"[來源編號不存在] {rel}:{n} {i}")

    for p, c in inbound.items():
        if c == 0 and data[p][0].get("type") != "source":
            problems.append(f"[孤立頁面] {p.relative_to(ROOT)}")

    print(f"檢查 {len(pages)} 頁，發現 {len(problems)} 個問題")
    for x in problems:
        print("  " + x)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
