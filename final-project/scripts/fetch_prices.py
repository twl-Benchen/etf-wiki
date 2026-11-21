"""抓 ETF 歷史日收盤價 (Yahoo Finance，透過 yfinance)，整份重寫 data/prices/<代號>.csv。
價格一律依股票分割還原 (例如 0050 在 2025-06 一拆四，分割前的價格全部除以 4)，但沒有把配息加回去，所以算出來的是價格報酬。
Yahoo 的資料有兩個已知問題，這裡會自動處理並記在 log：
1. 還原不完整：0050 在 2014 年以前的價格沒有除以 4，中間出現假的 -75%。依 yfinance 回報的分割倍數，把斷層之前的價格補除。
2. 起始日較晚：0050 在 Yahoo 只從 2009 年開始。現有檔案比較早的部分，依重疊期間的比例換算後保留在前面。
配息欄位另外存成 data/dividends_yf.json，只供核對，不直接用來計算。
用法：python scripts/fetch_prices.py"""
import csv, json, sys, time, statistics, datetime as dt
from pathlib import Path
D = Path(__file__).resolve().parents[1] / "data"
LOG = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ok": [], "failed": {}}


def fix_unadjusted(rows, factors):
    """單日價格突然變成約 1/k (k 是回報過的分割倍數)：斷層之前的價格補除 k。回傳修正過的斷層日期。"""
    fixed = []
    for i in range(len(rows) - 1, 0, -1):
        r = rows[i - 1][1] / rows[i][1]
        k = next((k for k in factors if abs(r / k - 1) < 0.03), None)
        if k:
            rows[:i] = [(d, round(c / k, 4)) for d, c in rows[:i]]; fixed.append({"date": rows[i][0], "factor": k})
    return fixed


def prepend_old(rows, old_rows):
    """新資料起始日比現有檔案晚時，把現有檔案較早的部分依重疊期間的比例換算後接在前面。"""
    if not old_rows or old_rows[0][0] >= rows[0][0]:
        return 0, None
    old = dict(old_rows); new = dict(rows)
    common = [d for d, _ in rows if d in old][:60]
    if len(common) < 20:
        raise RuntimeError(f"新舊資料重疊只有 {len(common)} 天，無法換算，不覆蓋")
    ratios = [old[d] / new[d] for d in common]; m = statistics.median(ratios)
    if max(abs(x / m - 1) for x in ratios) > 0.01:
        raise RuntimeError(f"新舊資料重疊期間比例不穩定 ({min(ratios):.3f} 到 {max(ratios):.3f})，不覆蓋")
    head = [(d, round(c / m, 4)) for d, c in old_rows if d < rows[0][0]]
    rows[:0] = head
    return len(head), round(m, 4)


def main():
    import yfinance as yf
    etfs = json.loads((D / "etfs.json").read_text(encoding="utf-8"))["etfs"]; divs = {}
    for code in etfs:
        try:
            t = yf.Ticker(f"{code}.TW"); h = t.history(period="max", auto_adjust=False, actions=True)
            if h is None or len(h) < 30:
                raise RuntimeError(f"只拿到 {0 if h is None else len(h)} 筆")
            rows = [(i.strftime("%Y-%m-%d"), round(float(c), 4)) for i, c in zip(h.index, h["Close"]) if c == c and c > 0]
            factors = sorted({float(v) for v in h.get("Stock Splits", []) if v and v > 1})
            fixed = fix_unadjusted(rows, factors)
            path = D / "prices" / f"{code}.csv"
            old_rows = [(r["date"], float(r["close"])) for r in csv.DictReader(open(path))] if path.exists() else []
            n_pre, scale = prepend_old(rows, old_rows)
            if len(rows) < len(old_rows) * 0.9:   # 新資料比舊資料短很多時不覆蓋，避免抓到殘缺資料
                raise RuntimeError(f"新資料 {len(rows)} 筆，比現有 {len(old_rows)} 筆少太多，不覆蓋")
            jumps = [rows[i][0] for i in range(1, len(rows)) if not 0.6 < rows[i][1] / rows[i - 1][1] < 1.6]   # 單日漲跌超過 40% 或 60%，可能是沒還原的分割
            if jumps:
                raise RuntimeError(f"還有可疑的單日斷層 {jumps[:5]}，不覆蓋")
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["date", "close"]); w.writerows(rows)
            if "Dividends" in h:
                divs[code] = [{"date": i.strftime("%Y-%m-%d"), "amount": round(float(v), 4)} for i, v in zip(h.index, h["Dividends"]) if v and v > 0]
            LOG["ok"].append({"code": code, "rows": len(rows), "first": rows[0][0], "last": rows[-1][0], "splits": factors, "fixed_unadjusted": fixed,
                              "prepended_old": n_pre, "old_scale": scale, "suspicious_drops": jumps})
        except Exception as e:
            LOG["failed"][code] = str(e)[:300]
        time.sleep(1)
    if LOG["ok"]:
        (D / "prices" / "_meta.json").write_text(json.dumps({"source": "Yahoo Finance 歷史收盤價 (已依分割還原，較早的部分沿用原本的檔案並換算)", "updated": LOG["time"], "last": {x["code"]: x["last"] for x in LOG["ok"]}}, ensure_ascii=False, indent=1), encoding="utf-8")
        (D / "dividends_yf.json").write_text(json.dumps({"note": "yfinance 的配息欄位，可能缺漏或不正確，只供核對", "dividends": divs}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        LOG["failed"]["_fatal"] = str(e)[:300]
    (D / "_fetch_prices_log.json").write_text(json.dumps(LOG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(LOG, ensure_ascii=False)[:1500])
    raise SystemExit(0 if LOG["ok"] and not LOG["failed"] else 1)
