"""實驗二分析：把 study.html 下載的 CSV 放進 experiments/exp2/data/，執行 python experiments/exp2/analyze.py
輸出每種介面的答對率、平均時間、主觀分數，以及同一位受試者兩種介面的差 (配對比較)。
人數少，結果只當作初步觀察。"""
import csv, glob, statistics as st
from pathlib import Path
H = Path(__file__).resolve().parent
rows = [r for f in glob.glob(str(H / "data" / "*_tasks.csv")) for r in csv.DictReader(open(f, encoding="utf-8-sig"))]
lik = [r for f in glob.glob(str(H / "data" / "*_likert.csv")) for r in csv.DictReader(open(f, encoding="utf-8-sig"))]
if not rows:
    raise SystemExit("experiments/exp2/data/ 裡還沒有資料")
people = sorted({r["participant"] for r in rows}); out = ["# 實驗二結果 (初步使用者測試)", "", f"受試者 {len(people)} 人：{'、'.join(people)}", "",
                                                          "| 介面 | 答對率 | 平均每題秒數 | " + " | ".join(f"感受 q{i}" for i in range(1, 5)) + " |", "|---|---|---|" + "---|" * 4]
per = {}
for c in ("table", "city"):
    R = [r for r in rows if r["condition"] == c]; L = [r for r in lik if r["condition"] == c]
    acc = sum(int(r["correct"]) for r in R) / len(R) if R else 0; sec = st.mean(float(r["seconds"]) for r in R) if R else 0
    lk = [f"{st.mean(int(r[f'q{i}']) for r in L):.2f}" if L else "-" for i in range(1, 5)]
    out.append(f"| {'表格' if c == 'table' else '城市'} | {acc * 100:.1f}% | {sec:.1f} | " + " | ".join(lk) + " |")
    for p in people:
        P = [r for r in R if r["participant"] == p]
        if P:
            per.setdefault(p, {})[c] = (sum(int(r["correct"]) for r in P) / len(P), st.mean(float(r["seconds"]) for r in P))
pairs = [(v["city"][0] - v["table"][0], v["city"][1] - v["table"][1]) for v in per.values() if "city" in v and "table" in v]
out += ["", "## 配對比較 (城市減表格)", ""]
if pairs:
    da, dt = [a for a, _ in pairs], [t for _, t in pairs]
    out += [f"- 答對率差：平均 {st.mean(da) * 100:+.1f} 個百分點，{sum(x > 0 for x in da)} 人城市較高、{sum(x < 0 for x in da)} 人表格較高",
            f"- 每題秒數差：平均 {st.mean(dt):+.1f} 秒，{sum(x < 0 for x in dt)} 人城市較快、{sum(x > 0 for x in dt)} 人表格較快"]
    try:
        from scipy.stats import wilcoxon
        if len(pairs) >= 6:
            out.append(f"- Wilcoxon 符號等級檢定 (秒數)：p = {wilcoxon(dt).pvalue:.3f}")
    except Exception:
        pass
out += ["", "城市介面包含對話問答，所以這裡比較的是整個系統和傳統表格，不是單純比較圖像化。"]
(H / "report.md").write_text("\n".join(out) + "\n", encoding="utf-8"); print("\n".join(out))
