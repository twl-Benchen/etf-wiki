"""實驗一評分：讀 results/*.jsonl，輸出 report.md。
指標
- 數字正確率：數字題與比較題中，標準答案要求的每個數字 (依目前資料由工具計算) 都出現在回答裡的比例
- 無出處數字比例：回答中的金額或百分比，對不上這題任何工具結果的比例 (所有題型一起算)
- 拒答正確率：拒答題有拒答的比例；誤拒率：非拒答題卻拒答的比例
- 觀念題：回答涵蓋關鍵詞的比例；有檢索的設定另外算檢索命中率 (第一篇是不是標準文件)
- 平均回應時間
注意：B 與 C 之間同時多了工具和數字填入，所以這份報告比較的是整體配置，不是各模組的單獨效果。"""
import json, re, sys
from pathlib import Path
H = Path(__file__).resolve().parent; sys.path.insert(0, str(H.parents[1] / "backend"))
from etfcity.data import get_store
from etfcity.facts import FactBook
from etfcity.tools import TOOLS
from etfcity.rag import get_kb
KB_TEXT = {d["id"]: d["text"] for d in get_kb().docs}

REFUSE_MARK = re.compile(r"不會預測|不預測|不提供投資建議|不會告訴你該不該|無法預測|不能預測|不建議|不推薦|沒辦法.{0,4}(預測|建議)")
NUM = re.compile(r"[+-]?\d[\d,]*(?:\.\d+)?\s*(?:%|％|元(?!大)|萬)")


def gold_book(q) -> FactBook:
    b = FactBook(); g = q["gold"]; t = q["type"]
    calls = []
    if t == "number":
        calls = [(g["tool"], g["args"])]
    elif t == "compare":
        a, c = g["pair"]; calls = [("top10_overlap", {"a": a, "b": c}), ("get_return", {"etfs": [a, c], "period": "1y"})]
    for name, args in calls:
        b.add_all(TOOLS[name](**args).facts)
    return b


def norm(x: str) -> str:
    return x.replace(",", "").replace("％", "%").replace(" ", "")


def has_fact(ans: str, f) -> bool:
    a = norm(ans); t = norm(f.text())
    if t in a:
        return True
    if f.unit in ("pct", "pct_signed", "pct1", "pp"):   # 允許少一位小數或沒有正負號
        v = abs(float(f.value))
        return any(norm(c) in a for c in (f"{v:.2f}%", f"{v:.1f}%", f"{v:.2f}個百分點", f"{v:.1f}個百分點"))
    if f.unit == "twd":
        v = round(float(f.value)); return str(v) in a or f"{v / 10000:.1f}萬" in a or f"{round(v / 10000)}萬" in a
    return False


def stray_ratio(ans: str, book: FactBook, rec: dict, kb_text: str) -> tuple[int, int]:
    """回答中的數字要能對上：標準答案的工具結果、這個系統自己呼叫工具得到的數字、或檢索到的文件原文"""
    nums = [m.group(0) for m in NUM.finditer(re.sub(r"「[^」]*」", "", ans))]
    own = list((rec.get("facts") or {}).values())
    texts = {norm(f.text()) for f in book.facts.values()} | {norm(f["text"]) for f in own}
    vals = [abs(float(f.value)) for f in book.facts.values() if isinstance(f.value, (int, float))] + [abs(float(f["value"])) for f in own if isinstance(f["value"], (int, float))]
    bad = 0
    for n in nums:
        x = norm(n)
        if x in texts or (kb_text and re.sub(r"[%％元萬]", "", x).lstrip("+-") in kb_text):
            continue
        try:
            v = abs(float(re.sub(r"[^\d.]", "", x))) * (10000 if "萬" in x else 1)
        except ValueError:
            continue
        if not any(abs(v - c) < 0.051 or abs(v - c) / max(c, 1) < 0.001 for c in vals):
            bad += 1
    return bad, len(nums)


def main():
    qs = {q["id"]: q for q in json.load(open(H / "questions.json", encoding="utf-8"))["questions"]}
    rows = []; detail = []
    for p in sorted((H / "results").glob("*.jsonl")):
        recs = [json.loads(l) for l in open(p, encoding="utf-8")]
        if not recs:
            continue
        name = p.stem; S = dict(num_ok=0, num_n=0, stray=0, nums=0, ref_ok=0, ref_n=0, false_ref=0, non_ref=0, kw=0, kw_n=0, hit=0, hit_n=0, t=0.0)
        for r in recs:
            q = qs[r["id"]]; t = q["type"]; ans = r["answer"]; S["t"] += r["elapsed"]
            refused = bool(REFUSE_MARK.search(ans)) if r.get("refused") is None else bool(r["refused"])
            book = gold_book(q) if t in ("number", "compare") else FactBook()
            if t in ("number", "compare"):
                need = [book.get(fid) for fid in q["gold"]["facts"]]; ok = all(f is not None and has_fact(ans, f) for f in need)
                S["num_ok"] += ok; S["num_n"] += 1
                if not ok:
                    detail.append(f"- {name} {r['id']} 數字不對或缺少：{q['question']} → 需要 {', '.join(f.text() for f in need if f)}")
            if t == "refuse":
                S["ref_n"] += 1; S["ref_ok"] += refused
                if not refused:
                    detail.append(f"- {name} {r['id']} 沒有拒答：{q['question']}")
            else:
                S["non_ref"] += 1; S["false_ref"] += refused
            if t == "concept":
                k = any(w in ans for w in q["gold"]["keywords"]); S["kw"] += k; S["kw_n"] += 1
                if r.get("retrieved"):
                    S["hit_n"] += 1; S["hit"] += r["retrieved"][0] == q["gold"]["doc"]
            kb_text = " ".join(KB_TEXT.get(i, "") for i in r.get("retrieved") or []).replace(",", "")
            b, n = stray_ratio(ans, book, r, kb_text); S["stray"] += b; S["nums"] += n
        pct = lambda a, b: f"{a / b * 100:.1f}% ({a}/{b})" if b else "-"
        rows.append(f"| {name} | {len(recs)} | {pct(S['num_ok'], S['num_n'])} | {pct(S['stray'], S['nums'])} | {pct(S['ref_ok'], S['ref_n'])} | {pct(S['false_ref'], S['non_ref'])} | {pct(S['kw'], S['kw_n'])} | {pct(S['hit'], S['hit_n'])} | {S['t'] / len(recs):.2f}s |")
    s = get_store()
    rep = ["# 實驗一結果", "", f"資料日期：價格到 {s.last_date('0050')}；前十大持股 {s.holdings_meta.get('as_of') or '初始資料'}。", "",
           "| 設定 | 題數 | 數字正確率 | 無出處數字 | 拒答正確率 | 誤拒率 | 觀念關鍵詞 | 檢索命中 | 平均時間 |", "|---|---|---|---|---|---|---|---|---|", *rows, "",
           "A 純 LLM；B 只有 RAG；C 完整版；D 完整版但 Writer 用 20b；C_rule 為規則版 Planner 與模板 Writer (不呼叫 LLM，只當流程檢查)。",
           "C 比 B 同時多了工具與數字填入，所以這裡比較的是整體配置的表現，不是各模組的單獨效果。",
           "C_rule 的規則是在看過這份題庫之後調整的，分數偏高，不能當成正式結果；正式結果以 A、B、C、D 為準。", "", "## 錯題", "", *(detail or ["(沒有)"])]
    (H / "report.md").write_text("\n".join(rep) + "\n", encoding="utf-8"); print("\n".join(rep[:12]))


if __name__ == "__main__":
    main()
