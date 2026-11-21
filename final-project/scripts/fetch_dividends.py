"""抓 ETF 歷年配息 (FinMind 除權息結果表，資料來自證交所)，寫成 data/dividends.json。用法：python scripts/fetch_dividends.py
- amount：除息當時每單位配多少元 (公告的金額)。
- amount_adj：依股票分割換算成和 data/prices/ 同一個基準 (0050 在 2025-06 一拆四，分割前的配息除以 4)，之後要算含息報酬時用這個。
- 有 data/dividends_yf.json (Yahoo 的配息欄位) 時順便核對，結果寫在 data/_fetch_dividends_log.json。
任何一檔失敗都不會覆蓋該檔原本的資料。金鑰放在環境變數 FINMIND_TOKEN (見 scripts/finmind.py)。"""
import json, sys, time, datetime as dt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import finmind
D = Path(__file__).resolve().parents[1] / "data"
LOG = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ok": [], "failed": {}, "check_yahoo": {}}


def check_yahoo(code, rows):
    """和 Yahoo 的配息比對：日期相同時，金額 (換算到同一基準) 差超過 1% 或某一邊沒有的列出來。"""
    p = D / "dividends_yf.json"
    if not p.exists():
        return None
    yf = {r["date"]: r["amount"] for r in json.loads(p.read_text(encoding="utf-8")).get("dividends", {}).get(code, [])}
    if not yf:
        return None
    first = min(yf); ours = {r["date"]: r for r in rows if r["date"] >= first}
    diff = [{"date": d, "finmind": r["amount_adj"], "yahoo": yf[d]} for d, r in ours.items() if d in yf and abs(yf[d] / r["amount_adj"] - 1) > 0.01]
    return {"compared": len(set(ours) & set(yf)), "amount_diff": diff, "only_finmind": sorted(set(ours) - set(yf)), "only_yahoo": sorted(set(yf) - set(ours))}


def main():
    etfs = json.loads((D / "etfs.json").read_text(encoding="utf-8"))["etfs"]
    path = D / "dividends.json"
    out = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    out.setdefault("dividends", {})
    for code in etfs:
        try:
            sp = finmind.splits(code)
            rows = []
            for r in finmind.get("TaiwanStockDividendResult", code, "2000-01-01"):
                amt = r.get("stock_and_cache_dividend")
                if not amt or "息" not in str(r.get("stock_or_cache_dividend", "")):
                    continue
                rows.append({"date": r["date"], "amount": round(amt, 4), "amount_adj": round(amt / finmind.factor_after(r["date"], sp), 4)})
            rows.sort(key=lambda x: x["date"])
            out["dividends"][code] = rows
            LOG["ok"].append({"code": code, "count": len(rows), "first": rows[0]["date"] if rows else None, "last": rows[-1]["date"] if rows else None})
            chk = check_yahoo(code, rows)
            if chk:
                LOG["check_yahoo"][code] = chk
        except Exception as e:
            LOG["failed"][code] = str(e)[:300]
        time.sleep(0.5)
    if LOG["ok"]:
        out.update({"source": "FinMind 除權息結果表 (資料來自證交所)", "updated": LOG["time"],
                    "note": "amount 是除息當時每單位的配息；amount_adj 依股票分割換算成和價格檔同一個基準"})
        out = {k: out[k] for k in ("source", "updated", "note", "dividends")}
        path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        LOG["failed"]["_fatal"] = str(e)[:300]
    (D / "_fetch_dividends_log.json").write_text(json.dumps(LOG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(LOG, ensure_ascii=False)[:1500])
    raise SystemExit(0 if LOG["ok"] and not LOG["failed"] else 1)
