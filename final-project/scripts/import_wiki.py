"""把 ETF 入門 Wiki (twl-Benchen/etf-wiki) 的概念頁轉成知識庫文件。用法: python scripts/import_wiki.py <etf-wiki 資料夾>"""
import re, sys
from pathlib import Path
W = Path(sys.argv[1]) / "wiki"; OUT = Path(__file__).resolve().parents[1] / "data" / "kb"
urls = {}
for p in (W / "sources").glob("*.md"):
    for m in re.finditer(r"^\|\s*(s\d+[a-z])\s*\|.*?\|\s*(https?://\S+)\s*\|", p.read_text(encoding="utf-8"), re.M):
        urls[m.group(1)] = m.group(2)
n = 0
for sub in ("concepts", "entities"):
    for p in sorted((W / sub).glob("*.md")):
        txt = p.read_text(encoding="utf-8"); _, fm, body = txt.split("---", 2)
        meta = dict(l.split(":", 1) for l in fm.strip().splitlines() if ":" in l)
        src = [x.strip() for x in meta.get("sources", "[]").strip()[1:-1].split(",") if x.strip()]
        body = re.sub(r"\[([^\]]+)\]\((?!http)[^)]+\)", r"\1", body)          # 站內連結改成純文字
        body = re.split(r"\n## 相關頁面", body)[0].strip()
        fmo = [f"title: {meta['title'].strip()}", f"summary: {meta.get('summary', '').strip()}", f"aliases: {meta.get('aliases', '[]').strip()}",
               "source_name: ETF 入門 Wiki (twl-Benchen/etf-wiki)", f"source_urls: [{', '.join(urls[s] for s in src if s in urls)}]", "status: 已核對來源"]
        (OUT / f"wiki-{p.stem}.md").write_text("---\n" + "\n".join(fmo) + "\n---\n\n" + body + "\n", encoding="utf-8"); n += 1
print("imported", n)
