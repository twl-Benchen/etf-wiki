"""實驗二題目：標準答案由工具計算，輸出到 web/study/tasks.json 給測試頁使用。
用法：python experiments/exp2/make_tasks.py"""
import json, sys
from pathlib import Path
R = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(R / "backend"))
from etfcity.data import get_store
from etfcity.config import DISTRICTS
from etfcity.tools import lookthrough, top10_overlap

s = get_store(); T = []


def mc(q, ans, opts, note=""):
    opts = list(dict.fromkeys([ans, *[o for o in opts if o != ans]]))[:4]
    import random; random.Random(len(T) * 7 + 3).shuffle(opts)   # 固定亂數打散，答案不會總在同一個位置
    T.append({"id": f"t{len(T) + 1}", "question": q, "answer": ans, "options": opts, "note": note})


pf = {"0050": 300000, "0056": 100000, "00878": 200000}
lt = lookthrough(pf); top = [x["name"] for x in lt.data["top"]]
desc = "、".join(f"{k} {v // 10000} 萬元" for k, v in pf.items())
mc(f"小明持有 {desc}。他實際持有最多的是哪一家公司？", top[0], top[1:4])
mc(f"同上 ({desc})，他實際持有第二多的是哪一家公司？", top[1], [top[0], *top[2:4]])
trio = ["0050", "0056", "00878"]; pairs = [(a, b) for i, a in enumerate(trio) for b in trio[i + 1:]]
w = {f"{a} 和 {b}": next(f.value for f in top10_overlap(a, b).facts if f.id.startswith("overlap_weight")) for a, b in pairs}
best = max(w, key=w.get); mc("0050、0056、00878 三檔中，哪兩檔的前十大重疊權重最高？", best, list(w))
n = len(s.etfs_holding("聯發科")); mc(f"城市裡的 {len(s.etfs)} 檔 ETF 中，有幾檔的前十大有聯發科？", f"{n} 檔", [f"{k} 檔" for k in range(1, len(s.etfs) + 1)])
t1 = s.top10("00919")[0]["name"]; others = [x["name"] for x in s.top10("00919")[1:4]]
mc("00919 的第一大持股是哪一家？", t1, others)
ov = next(f.value for f in top10_overlap("0050", "006208").facts if f.id.startswith("overlap_weight"))
mc("0050 和 006208 的前十大持股是否幾乎相同？", "幾乎相同" if ov > 60 else "差很多", ["幾乎相同", "差很多", "完全沒有重疊"])
pf2 = {"00878": 200000, "00919": 200000}; lt2 = lookthrough(pf2)
dist = lt2.data["districts"][0]["name"]
mc("小華持有 00878 與 00919 各 20 萬元。他的錢 (以前十大估算) 最集中在哪一條街 (產業)？", dist, [DISTRICTS[k]["name"] for k in ("semi", "fin", "port", "tech")])
mc("下列哪一家公司，同時在 0056 和 00919 的前十大裡？", next(n for n in s.weights("0056") if n in s.weights("00919")),
   [n for n in s.weights("0050") if n not in s.weights("0056") or n not in s.weights("00919")][:3])
out = {"data_note": f"前十大持股 {s.holdings_meta.get('as_of') or '初始資料'}；價格到 {s.last_date('0050')}", "tasks": T,
       "likert": ["我覺得這個介面容易看懂持股的組成。", "我覺得這個介面能幫我比較兩檔 ETF。", "我有信心我的答案是正確的。", "我願意再使用這個介面。"]}
p = R / "experiments" / "exp2" / "tasks.json"; p.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(T), "tasks →", p)
for t in T:
    print("-", t["question"], "→", t["answer"])
