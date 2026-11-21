"""資料載入。所有工具都透過 DataStore 取資料。"""
from __future__ import annotations
import csv, json, random, bisect
from functools import lru_cache
from pathlib import Path
from .config import DATA_DIR, DISTRICTS, district_of


class DataStore:
    def __init__(self, data_dir: Path | str = DATA_DIR):
        self.dir = Path(data_dir)
        self.etfs: dict = self._json("etfs.json")["etfs"]
        h = self._json("holdings.json")
        self.holdings_meta = {k: h.get(k) for k in ("as_of", "source", "scope")}
        self.holdings: dict = h["holdings"]
        self.companies: dict = self._json("companies.json")["companies"]
        for n, c in self.companies.items():
            c["name"] = n
            c["district"] = district_of(c["industry"])
        self.by_code = {c["code"]: c for c in self.companies.values()}
        self.prices: dict[str, tuple[list[str], list[float]]] = {}
        for k in self.etfs:
            p = self.dir / "prices" / f"{k}.csv"
            if p.exists():
                ds, cs = [], []
                with open(p, encoding="utf-8") as f:
                    for r in csv.DictReader(f):
                        try:
                            c = float(r["close"])
                        except (ValueError, KeyError):
                            continue
                        if c > 0:
                            ds.append(r["date"]); cs.append(c)
                self.prices[k] = (ds, cs)
        self.dividends: dict = self._json("dividends.json", {}).get("dividends", {})
        self.daily = self._load_daily()
        self.price_source = self._json("prices/_meta.json", {}).get("source", "ETF 歷史收盤價")

    def _json(self, name: str, default=None):
        p = self.dir / name
        if not p.exists():
            if default is not None:
                return default
            raise FileNotFoundError(p)
        return json.loads(p.read_text(encoding="utf-8"))

    # ---------- 每日行情 ----------
    def _load_daily(self) -> dict:
        d = self._json("daily.json", {})
        if d.get("stocks"):
            d.setdefault("demo", False)
            return d
        # 還沒有真實行情時，用固定亂數產生示意行情，所有輸出都會標示「示意」
        rng = random.Random(20261117)
        bias = {"semi": -1.6, "tech": -0.4, "fin": 0.3, "port": 2.4, "life": 0.2}
        stocks = {}
        for n, c in self.companies.items():
            pct = round(bias[c["district"]] + rng.uniform(-2.2, 2.2), 2)
            stocks[c["code"]] = {"name": n, "pct": pct}
        fixed = {"2330": -3.42, "2603": 5.87, "2609": 4.31}
        for k, v in fixed.items():
            if k in stocks:
                stocks[k]["pct"] = v
        w = {t["code"]: t["weight"] for t in self.holdings["0050"]["top10"]}
        idx = sum(stocks[c]["pct"] * x for c, x in w.items()) / sum(w.values())
        return {"date": None, "demo": True, "index": {"name": "大盤 (以 0050 前十大估算)", "pct": round(idx, 2)}, "stocks": stocks}

    def change_of(self, name: str) -> float | None:
        c = self.companies.get(name)
        s = self.daily["stocks"].get(c["code"]) if c else None
        return None if s is None else s.get("pct")

    # ---------- 持股 ----------
    def top10(self, etf: str) -> list[dict]:
        return sorted(self.holdings[etf]["top10"], key=lambda t: -t["weight"])

    def weights(self, etf: str) -> dict[str, float]:
        return {t["name"]: t["weight"] for t in self.holdings[etf]["top10"]}

    def etfs_holding(self, name: str) -> list[dict]:
        out = []
        for k in self.etfs:
            top = self.top10(k)
            for i, t in enumerate(top):
                if t["name"] == name:
                    out.append({"etf": k, "weight": t["weight"], "rank": i + 1})
        return out

    def city_companies(self) -> list[str]:
        seen = []
        for k in self.etfs:
            for t in self.holdings[k]["top10"]:
                if t["name"] not in seen:
                    seen.append(t["name"])
        return seen

    # ---------- 價格 ----------
    def has_prices(self, etf: str) -> bool:
        return etf in self.prices and len(self.prices[etf][0]) > 1

    def first_date(self, etf: str) -> str:
        return self.prices[etf][0][0]

    def last_date(self, etf: str) -> str:
        return self.prices[etf][0][-1]

    def price_on_or_before(self, etf: str, date: str) -> tuple[str, float] | None:
        ds, cs = self.prices[etf]
        i = bisect.bisect_right(ds, date) - 1
        return None if i < 0 else (ds[i], cs[i])

    def price_on_or_after(self, etf: str, date: str) -> tuple[str, float] | None:
        ds, cs = self.prices[etf]
        i = bisect.bisect_left(ds, date)
        return None if i >= len(ds) else (ds[i], cs[i])

    def monthly_first(self, etf: str, start_ym: str, end_ym: str | None = None) -> list[tuple[str, float]]:
        """每月第一個交易日 (日期, 收盤)"""
        ds, cs = self.prices[etf]
        out, seen = [], set()
        for d, c in zip(ds, cs):
            ym = d[:7]
            if ym < start_ym or (end_ym and ym > end_ym) or ym in seen:
                continue
            seen.add(ym); out.append((d, c))
        return out

    def suspicious_jumps(self, etf: str, thr: float = 0.4) -> list[str]:
        """單日跌幅超過 thr，可能是沒有還原的股票分割"""
        ds, cs = self.prices[etf]
        return [ds[i] for i in range(1, len(cs)) if cs[i] / cs[i - 1] - 1 < -thr]


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    return DataStore()
