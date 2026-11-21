"""抓 ETF 歷史日收盤價 (Yahoo Finance，透過 yfinance)，整份重寫 data/prices/<代號>.csv。
yfinance 的 Close 已經依股票分割還原 (例如 0050 一拆四)，但沒有把配息加回去，所以算出來的是價格報酬。
配息欄位另外存成 data/dividends_yf.json，只供核對，不直接用來計算。
用法：python scripts/fetch_prices.py"""
import csv, json, sys, time, datetime as dt
from pathlib import Path
D = Path(__file__).resolve().parents[1] / "data"
LOG = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ok": [], "failed": {}}


def main():
    import yfinance as yf
    etfs = json.loads((D / "etfs.json").read_text(encoding="utf-8"))["etfs"]; divs = {}
    for code in etfs:
        try:
            t = yf.Ticker(f"{code}.TW"); h = t.history(period="max", auto_adjust=False, actions=True)
            if h is None or len(h) < 30:
                raise RuntimeError(f"只拿到 {0 if h is None else len(h)} 筆")
            rows = [(i.strftime("%Y-%m-%d"), round(float(c), 4)) for i, c in zip(h.index, h["Close"]) if c == c and c > 0]
            old = D / "prices" / f"{code}.csv"
            if old.exists():   # 新資料比舊資料短很多時不覆蓋，避免抓到殘缺資料
                n_old = sum(1 for _ in open(old)) - 1
                if len(rows) < n_old * 0.9:
                    raise RuntimeError(f"新資料 {len(rows)} 筆，比現有 {n_old} 筆少太多，不覆蓋")
            with open(old, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["date", "close"]); w.writerows(rows)
            if "Dividends" in h:
                divs[code] = [{"date": i.strftime("%Y-%m-%d"), "amount": round(float(v), 4)} for i, v in zip(h.index, h["Dividends"]) if v and v > 0]
            LOG["ok"].append({"code": code, "rows": len(rows), "first": rows[0][0], "last": rows[-1][0]})
        except Exception as e:
            LOG["failed"][code] = str(e)[:300]
        time.sleep(1)
    if LOG["ok"]:
        (D / "prices" / "_meta.json").write_text(json.dumps({"source": "Yahoo Finance 歷史收盤價 (已依分割還原)", "updated": LOG["time"], "last": {x["code"]: x["last"] for x in LOG["ok"]}}, ensure_ascii=False, indent=1), encoding="utf-8")
        (D / "dividends_yf.json").write_text(json.dumps({"note": "yfinance 的配息欄位，可能缺漏或不正確，只供核對", "dividends": divs}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        LOG["failed"]["_fatal"] = str(e)[:300]
    (D / "_fetch_prices_log.json").write_text(json.dumps(LOG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(LOG, ensure_ascii=False)[:1500])
