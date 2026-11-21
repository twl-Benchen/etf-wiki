"""實驗三評分：比較 pred_vision/ 與 pred_ocr/ 和 gold.csv，輸出 report.md"""
import csv, json
from collections import defaultdict
from pathlib import Path
H = Path(__file__).resolve().parent
gold = defaultdict(dict)
for r in csv.DictReader(open(H / "gold.csv", encoding="utf-8-sig")):
    f = lambda k: float(r[k].replace(",", "")) if r.get(k, "").strip() else None
    gold[r["image"]][r["code"].strip().upper()] = {"shares": f("shares"), "cost": f("cost"), "market_value": f("market_value")}


def close(a, b, tol):
    return a is not None and b is not None and (abs(a - b) <= tol * abs(b) if tol else a == b)


lines = ["# 實驗三結果 (截圖辨識可行性測試)", "", f"截圖 {len(gold)} 張，持股 {sum(len(v) for v in gold.values())} 列。", "",
         "| 方法 | 代號正確率 | 股數 | 成本 | 市值 | 整張完全正確 | 多讀的列 |", "|---|---|---|---|---|---|---|"]
for name in ("vision", "ocr"):
    d = H / f"pred_{name}"
    if not d.exists():
        continue
    S = defaultdict(int)
    for img, g in gold.items():
        p = d / f"{img}.json"; rows = json.loads(p.read_text(encoding="utf-8"))["rows"] if p.exists() else []
        pred = {str(x["code"]).upper(): x for x in rows}; perfect = set(pred) == set(g)
        S["extra"] += len(set(pred) - set(g))
        for code, gv in g.items():
            S["n"] += 1; pv = pred.get(code)
            if not pv:
                perfect = False; continue
            S["code"] += 1
            for k, tol in (("shares", 0), ("cost", 0.001), ("market_value", 0.005)):
                if gv[k] is None:
                    continue
                S[k + "_n"] += 1; ok = close(pv.get(k), gv[k], tol); S[k] += ok; perfect &= ok
        S["img"] += 1; S["perfect"] += perfect
    pct = lambda a, b: f"{S[a] / S[b] * 100:.1f}% ({S[a]}/{S[b]})" if S[b] else "-"
    lines.append(f"| {'看圖模型' if name == 'vision' else '傳統 OCR'} | {pct('code', 'n')} | {pct('shares', 'shares_n')} | {pct('cost', 'cost_n')} | {pct('market_value', 'market_value_n')} | {pct('perfect', 'img')} | {S['extra']} |")
lines += ["", "張數有限，這是可行性測試，不代表能適用所有券商的截圖。"]
(H / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8"); print("\n".join(lines))
