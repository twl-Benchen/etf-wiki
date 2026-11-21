"""把後端資料整理成前端用的單一檔案 web/data/city.json (GitHub Pages 的離線模式也靠它)。
用法：python scripts/build_site_data.py"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "backend"))
from etfcity.api import city_bundle
from etfcity.data import get_store
from etfcity.rag import get_kb
from etfcity.tools import get_return, PERIOD_NAME

s = get_store(); b = city_bundle()
b["monthly"] = {k: [[d[:7], c] for d, c in s.monthly_first(k, "2000-01")] for k in s.etfs if s.has_prices(k)}
b["last"] = {k: [s.last_date(k), s.prices[k][1][-1]] for k in s.etfs if s.has_prices(k)}
b["returns"] = {}
for k in s.etfs:
    if not s.has_prices(k):
        continue
    b["returns"][k] = {}
    for p in PERIOD_NAME:
        r = get_return([k], p)
        if r.ok:
            f = {x.id: x.value for x in r.facts}
            b["returns"][k][p] = {"ret": f[f"ret_{p}_{k}"], "from": f[f"ret_{p}_{k}_from"], "to": f[f"ret_{p}_{k}_to"], "ann": f.get(f"ann_{p}_{k}")}
b["period_names"] = PERIOD_NAME
b["prev"] = {"label": s.prev["label"], "holdings": {k: sorted(v["top10"], key=lambda t: -t["weight"]) for k, v in s.prev["holdings"].items()}} if s.prev else None
nw = s._json("news.json", {}) or {}
b["news"] = {"source": nw.get("source"), "date": nw.get("date"), "items": {n: nw.get("news", {}).get(c["code"], []) for n, c in s.companies.items() if nw.get("news", {}).get(c["code"])}}
b["kb"] = [{"id": d["id"], "title": d["title"], "summary": d["summary"], "aliases": d["aliases"], "text": d["text"], "source": d["source_note"]} for d in get_kb().docs]
out = ROOT / "web" / "data"; out.mkdir(parents=True, exist_ok=True)
(out / "city.json").write_text(json.dumps(b, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("city.json", (out / "city.json").stat().st_size, "bytes", "| daily demo:", b["daily"].get("demo"))
