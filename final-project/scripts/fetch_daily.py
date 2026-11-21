"""抓當日行情：證交所 OpenAPI (上市個股、大盤指數) 與櫃買中心 OpenAPI (上櫃個股)，寫成 data/daily.json。
欄位名稱以實際回傳為準，這裡做了容錯；任何一步失敗都會記在 data/_fetch_daily_log.json，不會覆蓋掉舊的 daily.json。
用法：python scripts/fetch_daily.py"""
import json, datetime as dt
from pathlib import Path
import requests
D = Path(__file__).resolve().parents[1] / "data"
LOG = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "steps": {}}
UA = {"User-Agent": "Mozilla/5.0 (etf-metropolis course project)", "Accept": "application/json"}
URLS = {"twse": "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", "tpex": "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes",
        "index": "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"}


def num(x):
    try:
        return float(str(x).replace(",", "").replace("+", "").strip())
    except Exception:
        return None


def roc(d):   # 民國日期 1151117 → 2026-11-17
    d = str(d or "").replace("/", "").strip()
    if len(d) == 7 and d.isdigit():
        return f"{int(d[:3]) + 1911}-{d[3:5]}-{d[5:]}"
    if len(d) == 8 and d.isdigit():
        return f"{d[:4]}-{d[4:6]}-{d[6:]}"
    return None


def get(name):
    r = requests.get(URLS[name], headers=UA, timeout=40); r.raise_for_status(); j = r.json()
    LOG["steps"][name] = {"rows": len(j), "keys": list(j[0].keys()) if j else []}
    return j


def pick(row, *keys):
    for k in keys:
        if k in row and str(row[k]).strip() not in ("", "--", "---"):
            return row[k]
    return None


def main():
    companies = json.loads((D / "companies.json").read_text(encoding="utf-8"))["companies"]
    want = {c["code"]: n for n, c in companies.items()}; etfs = json.loads((D / "etfs.json").read_text(encoding="utf-8"))["etfs"]
    want.update({k: e["name"] for k, e in etfs.items()})
    stocks, date = {}, None
    for src in ("twse", "tpex"):
        try:
            for row in get(src):
                code = str(pick(row, "Code", "SecuritiesCompanyCode", "證券代號") or "").strip()
                if code not in want:
                    continue
                close = num(pick(row, "ClosingPrice", "Close", "收盤價")); chg = num(pick(row, "Change", "漲跌價差"))
                date = date or roc(pick(row, "Date", "日期"))
                if close is None or chg is None:
                    continue
                prev = close - chg
                stocks[code] = {"name": want[code], "close": close, "change": chg, "pct": round(chg / prev * 100, 2) if prev else 0.0, "market": src}
        except Exception as e:
            LOG["steps"][src] = {"error": str(e)[:300]}
    index = None
    try:
        for row in get("index"):
            name = str(pick(row, "指數", "Index") or "")
            if name.strip() == "發行量加權股價指數":
                pct = num(pick(row, "漲跌百分比", "ChangePercent")); sign = str(pick(row, "漲跌", "Dir") or "")
                if pct is not None and "-" in sign and pct > 0:
                    pct = -pct
                index = {"name": "加權指數", "close": num(pick(row, "收盤指數", "ClosingIndex")), "pct": pct}; date = date or roc(pick(row, "日期", "Date")); break
    except Exception as e:
        LOG["steps"]["index"] = {"error": str(e)[:300]}
    missing = [n for c, n in want.items() if c not in stocks]
    LOG["result"] = {"date": date, "stocks": len(stocks), "missing": missing, "index": index}
    need = [c["code"] for c in companies.values()]
    if sum(c in stocks for c in need) >= len(need) * 0.8 and index and index.get("pct") is not None:
        (D / "daily.json").write_text(json.dumps({"date": date or LOG["time"][:10], "demo": False, "index": index, "stocks": stocks,
                                                  "source": "臺灣證券交易所 OpenAPI、證券櫃檯買賣中心 OpenAPI"}, ensure_ascii=False, indent=1), encoding="utf-8")
        LOG["written"] = True
    else:
        LOG["written"] = False


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        LOG["fatal"] = str(e)[:300]
    (D / "_fetch_daily_log.json").write_text(json.dumps(LOG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(LOG, ensure_ascii=False)[:2000])
