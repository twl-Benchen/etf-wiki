"""FinMind API 小工具 (資料來自證交所與櫃買中心)。
金鑰放在環境變數 FINMIND_TOKEN，不要寫進程式或 commit；沒有金鑰也能用，但每小時額度較少。
說明：https://finmind.github.io/"""
import os, time
import requests

URL = "https://api.finmindtrade.com/api/v4/data"


def get(dataset, data_id, start="2000-01-01", end=None, tries=3):
    """回傳資料列 (list of dict)。額度用完或參數錯誤時丟出 RuntimeError。"""
    params = {"dataset": dataset, "data_id": data_id, "start_date": start}
    if end:
        params["end_date"] = end
    tok = os.environ.get("FINMIND_TOKEN", "").strip()
    headers = {"Authorization": f"Bearer {tok}"} if tok else {}
    for i in range(tries):
        try:
            r = requests.get(URL, params=params, headers=headers, timeout=60); j = r.json()
            break
        except (requests.ConnectionError, requests.Timeout, ValueError):
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))
    if j.get("status") != 200:
        raise RuntimeError(f"FinMind {dataset} {data_id}：{j.get('status')} {j.get('msg')}")
    return j.get("data", [])


def splits(code):
    """股票分割 (含反分割)：[(恢復交易日, 倍數)]，倍數 = 分割前價格 / 分割後參考價，例如 0050 在 2025-06-18 是 4。"""
    out = []
    for r in get("TaiwanStockSplitPrice", code):
        if r.get("before_price") and r.get("after_price"):
            k = r["before_price"] / r["after_price"]
            out.append((r["date"], round(k) if abs(k - round(k)) < 0.02 else round(k, 4)))
    return sorted(out)


def factor_after(date, sp):
    """在 date 之後發生的分割倍數乘積：把 date 當天的價格或配息換算成現在的基準要除以這個數。"""
    f = 1
    for d, k in sp:
        if date < d:
            f *= k
    return f
