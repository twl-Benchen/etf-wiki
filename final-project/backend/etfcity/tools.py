"""資料工具。每個工具回傳 ToolResult，裡面的 facts 是有編號的數字，回答中的數字只能來自這裡。"""
from __future__ import annotations
from datetime import date, timedelta
from .config import DISTRICTS
from .data import DataStore, get_store
from .facts import Fact, ToolResult

RULES = {"crash_below": -3.0, "boom_above": 3.0, "rain_below": -1.2, "replay_rain_below": -4.0, "replay_fireworks_above": 5.0}
PERIODS = {"1m": 30, "3m": 91, "6m": 182, "1y": 365, "3y": 365 * 3, "5y": 365 * 5}
PERIOD_NAME = {"1m": "近一個月", "3m": "近三個月", "6m": "近半年", "1y": "近一年", "3y": "近三年", "5y": "近五年", "ytd": "今年以來", "max": "上市以來"}
HOLD_NOTE = "只計各檔 ETF 的前十大成分股"
RET_NOTE = "價格報酬，未含息"


def _shift(d: str, days: int) -> str:
    return (date.fromisoformat(d) - timedelta(days=days)).isoformat()


def _hold_src(s: DataStore) -> str:
    m = s.holdings_meta
    return f"前十大成分股 ({m.get('source') or '投信公開資料'}" + (f"，資料日 {m['as_of']})" if m.get("as_of") else ")")


# ------------------------------------------------------------------ ETF
def get_etf_info(etf: str, s: DataStore | None = None) -> ToolResult:
    s = s or get_store(); e = s.etfs[etf]
    facts = [Fact(f"info_{etf}_listing", e["listing_date"], "date", f"{etf} 上市日期", "ETF 基本資料")]
    return ToolResult("get_etf_info", {"etf": etf}, data={k: e.get(k) for k in ("code", "name", "type", "issuer", "index_name", "dividend_freq", "dividend_months", "listing_date")},
                      facts=facts, sources=["ETF 基本資料 (證交所與投信公開資料)"])


def get_top10_holdings(etf: str, s: DataStore | None = None) -> ToolResult:
    s = s or get_store(); top = s.top10(etf); src = _hold_src(s)
    facts, by_d = [], {}
    for i, t in enumerate(top):
        facts.append(Fact(f"w_{etf}_{t['code']}", t["weight"], "pct", f"{t['name']}在 {etf} 的權重 (第 {i + 1} 大)", src))
        dk = s.companies[t["name"]]["district"]; by_d[dk] = round(by_d.get(dk, 0) + t["weight"], 2)
    facts.append(Fact(f"top10_sum_{etf}", round(sum(t["weight"] for t in top), 2), "pct", f"{etf} 前十大成分股的權重合計", src))
    order = sorted(by_d, key=lambda k: -by_d[k])
    for dk in order:
        facts.append(Fact(f"dist_{etf}_{dk}", by_d[dk], "pct", f"{etf} 前十大中屬於{DISTRICTS[dk]['name']}的權重合計", src))
    return ToolResult("get_top10_holdings", {"etf": etf}, facts=facts, sources=[src], note=HOLD_NOTE,
                      data={"etf": etf, "name": s.etfs[etf]["name"], "type": s.etfs[etf]["type"],
                            "top10": [{"rank": i + 1, "name": t["name"], "code": t["code"], "fact": f"w_{etf}_{t['code']}"} for i, t in enumerate(top)],
                            "districts": [{"key": dk, "name": DISTRICTS[dk]["name"], "fact": f"dist_{etf}_{dk}"} for dk in order]})


def top10_overlap(a: str, b: str, s: DataStore | None = None) -> ToolResult:
    """前十大重疊：共同持股家數，與重疊權重 = Σ min(w_A, w_B)"""
    s = s or get_store(); A, B = s.weights(a), s.weights(b); src = _hold_src(s)
    shared = sorted((n for n in A if n in B), key=lambda n: -min(A[n], B[n]))
    facts = [Fact(f"overlap_count_{a}_{b}", len(shared), "count:家", f"{a} 與 {b} 前十大的共同持股家數", src),
             Fact(f"overlap_weight_{a}_{b}", round(sum(min(A[n], B[n]) for n in shared), 2), "pct", f"{a} 與 {b} 前十大的重疊權重 (共同持股取較小權重相加)", src)]
    items = []
    for n in shared:
        c = s.companies[n]["code"]
        facts += [Fact(f"w_{a}_{c}", A[n], "pct", f"{n}在 {a} 的權重", src), Fact(f"w_{b}_{c}", B[n], "pct", f"{n}在 {b} 的權重", src)]
        items.append({"name": n, "code": c, "facts": [f"w_{a}_{c}", f"w_{b}_{c}"]})
    ta, tb = s.top10(a)[0], s.top10(b)[0]
    for k, t in ((a, ta), (b, tb)):
        facts.append(Fact(f"w_{k}_{t['code']}", t["weight"], "pct", f"{t['name']}在 {k} 的權重 (第 1 大)", src))
    return ToolResult("top10_overlap", {"a": a, "b": b}, facts=facts, sources=[src], note=HOLD_NOTE,
                      data={"a": a, "b": b, "shared": items, "definition": "重疊權重 = Σ min(w_A, w_B)，只計前十大",
                            "top": {a: {"name": ta["name"], "fact": f"w_{a}_{ta['code']}"}, b: {"name": tb["name"], "fact": f"w_{b}_{tb['code']}"}}})


def get_return(etfs: list[str], period: str = "1y", s: DataStore | None = None) -> ToolResult:
    s = s or get_store(); facts, rows, errs = [], [], []
    for k in etfs:
        if not s.has_prices(k):
            errs.append(f"{k} 沒有價格資料"); continue
        end_d, end_p = s.last_date(k), s.prices[k][1][-1]
        if period == "max":
            start = (s.first_date(k), s.prices[k][1][0])
        elif period == "ytd":
            start = s.price_on_or_before(k, f"{int(end_d[:4]) - 1}-12-31") or (s.first_date(k), s.prices[k][1][0])
        else:
            start = s.price_on_or_before(k, _shift(end_d, PERIODS[period]))
            if start is None:
                errs.append(f"{k} 的資料不足{PERIOD_NAME[period]}"); continue
        d0, p0 = start; ret = (end_p / p0 - 1) * 100; pid = f"{period}_{k}"; src = f"{s.price_source} ({RET_NOTE})"
        facts += [Fact(f"ret_{pid}", round(ret, 2), "pct_signed", f"{k} {PERIOD_NAME[period]}的價格報酬 (未含息)", src, end_d),
                  Fact(f"ret_{pid}_from", d0, "date", f"{k} {PERIOD_NAME[period]}報酬的起算日", src),
                  Fact(f"ret_{pid}_to", end_d, "date", f"{k} 報酬的結算日 (資料日期)", src)]
        row = {"etf": k, "facts": {"ret": f"ret_{pid}", "from": f"ret_{pid}_from", "to": f"ret_{pid}_to"}, "_ret": ret}
        yrs = (date.fromisoformat(end_d) - date.fromisoformat(d0)).days / 365.25
        if yrs >= 1.5:
            facts.append(Fact(f"ann_{pid}", round(((end_p / p0) ** (1 / yrs) - 1) * 100, 2), "pct_signed", f"{k} {PERIOD_NAME[period]}的年化價格報酬 (未含息)", src, end_d))
            row["facts"]["ann"] = f"ann_{pid}"
        rows.append(row)
    if len(rows) == 2:
        a, b = rows; fid = f"ret_diff_{period}_{a['etf']}_{b['etf']}"
        facts.append(Fact(fid, round(abs(a["_ret"] - b["_ret"]), 2), "pp", f"{a['etf']} 與 {b['etf']} {PERIOD_NAME[period]}價格報酬的差距", RET_NOTE))
        hi = a if a["_ret"] >= b["_ret"] else b
        diff = {"fact": fid, "higher": hi["etf"]}
    else:
        diff = None
    return ToolResult("get_return", {"etfs": etfs, "period": period}, ok=bool(rows), facts=facts, error="；".join(errs), note=RET_NOTE,
                      sources=[f"{s.price_source}"], data={"period": period, "period_name": PERIOD_NAME[period], "rows": rows, "diff": diff, "basis": RET_NOTE})


def get_dividends(etf: str, year: int | None = None, s: DataStore | None = None) -> ToolResult:
    s = s or get_store(); rows = s.dividends.get(etf, [])
    if year:
        rows = [r for r in rows if r["date"].startswith(str(year))]
    if not rows:
        return ToolResult("get_dividends", {"etf": etf, "year": year}, ok=False, error="配息資料還沒有整理好，目前只提供價格報酬 (未含息)。",
                          data={"freq": s.etfs[etf].get("dividend_freq"), "months": s.etfs[etf].get("dividend_months")})
    facts = [Fact(f"div_{etf}_{r['date'].replace('-', '')}", r["amount"], "price", f"{etf} 於 {r['date']} 除息的每單位配息", "投信配息公告") for r in rows]
    return ToolResult("get_dividends", {"etf": etf, "year": year}, facts=facts, sources=["投信配息公告"],
                      data={"rows": [{"date": r["date"], "fact": f"div_{etf}_{r['date'].replace('-', '')}"} for r in rows]})


def simulate_dca(etf: str, monthly: int = 5000, start: str = "2020-01", end: str | None = None, s: DataStore | None = None) -> ToolResult:
    """每月第一個交易日收盤價買進固定金額 (可買零股)，價格報酬，未含息與手續費"""
    s = s or get_store(); rows = s.monthly_first(etf, start, end)
    args = {"etf": etf, "monthly": monthly, "start": start, "end": end}
    if len(rows) < 2:
        return ToolResult("simulate_dca", args, ok=False, error=f"{etf} 在這段期間的資料不足，無法回測。")
    end_d, end_p = (s.last_date(etf), s.prices[etf][1][-1]) if not end else s.price_on_or_before(etf, end + "-31")
    sh = inv = 0.0; series = []; worst = (1e9, rows[0][0])
    for i, (d, p) in enumerate(rows):
        sh += monthly / p; inv += monthly; val = sh * p; pnl = (val / inv - 1) * 100
        if pnl < worst[0]:
            worst = (pnl, d)
        nxt = rows[i + 1][1] if i + 1 < len(rows) else end_p
        series.append({"d": d[:7], "inv": inv, "val": round(val), "ch": round((nxt / p - 1) * 100, 2)})
    val = sh * end_p
    series.append({"d": end_d, "inv": inv, "val": round(val), "ch": None})
    mn = min(series[:-1], key=lambda x: x["ch"]); mx = max(series[:-1], key=lambda x: x["ch"])
    p = f"dca_{etf}"; src = f"{s.price_source} (每月第一個交易日收盤價買進，可買零股，未含息與手續費)"
    facts = [Fact(f"{p}_monthly", monthly, "twd", "每月投入金額", "使用者輸入"), Fact(f"{p}_n", len(rows), "count:次", "總共買進次數", src),
             Fact(f"{p}_start", rows[0][0][:7], "month", "開始月份", src), Fact(f"{p}_end", end_d, "date", "結算日 (資料日期)", src),
             Fact(f"{p}_invested", inv, "twd", "累計投入本金", src), Fact(f"{p}_value", round(val), "twd", "期末市值", src),
             Fact(f"{p}_ret", round((val / inv - 1) * 100, 2), "pct_signed", "定期定額的價格報酬 (未含息)", src),
             Fact(f"{p}_worst_pnl", round(worst[0], 2), "pct_signed", "期間內帳面報酬最低的時候", src), Fact(f"{p}_worst_month", worst[1][:7], "month", "帳面報酬最低的月份", src),
             Fact(f"{p}_maxdrop", mn["ch"], "pct_signed", "單月最大跌幅", src), Fact(f"{p}_maxdrop_month", mn["d"], "month", "單月跌最多的月份", src),
             Fact(f"{p}_maxgain", mx["ch"], "pct_signed", "單月最大漲幅", src), Fact(f"{p}_maxgain_month", mx["d"], "month", "單月漲最多的月份", src)]
    return ToolResult("simulate_dca", args, facts=facts, sources=[src], note=RET_NOTE,
                      data={"etf": etf, "prefix": p, "requested_start": start, "actual_start": rows[0][0][:7], "ever_negative": worst[0] < 0,
                            "rained": mn["ch"] <= RULES["replay_rain_below"], "fireworks": mx["ch"] >= RULES["replay_fireworks_above"], "rules": RULES, "_series": series})


def lookthrough(positions: dict[str, float], s: DataStore | None = None) -> ToolResult:
    """穿透持股：各 ETF 金額 × 成分股權重後加總 (只計前十大，為估計值)"""
    s = s or get_store(); ex, frm = {}, {}; total = covered = 0.0; src = _hold_src(s)
    for k, amt in positions.items():
        total += amt
        for n, w in s.weights(k).items():
            v = amt * w / 100; ex[n] = ex.get(n, 0) + v; frm.setdefault(n, {})[k] = round(v); covered += v
    if total <= 0:
        return ToolResult("lookthrough", {"positions": positions}, ok=False, error="沒有持股金額。")
    share = {n: v / total for n, v in ex.items()}; order = sorted(ex, key=lambda n: -ex[n])
    cp = round(covered / total * 100, 1)
    facts = [Fact("lt_total", total, "twd", "投入金額合計", "使用者輸入"), Fact("lt_covered", cp, "pct1", "前十大成分股涵蓋的資金比例", src),
             Fact("lt_rest", round(100 - cp, 1), "pct1", "前十大以外、沒有畫進城市的資金比例", src), Fact("lt_etf_count", len(positions), "count:檔", "持有的 ETF 檔數", "使用者輸入")]
    top = []
    for n in order[:6]:
        c = s.companies[n]["code"]
        facts.append(Fact(f"lt_share_{c}", round(share[n] * 100, 1), "pct1", f"實際持有{n}的估計比例 (來自 {'、'.join(frm[n])})", src))
        top.append({"name": n, "code": c, "fact": f"lt_share_{c}", "from": list(frm[n])})
    by_d = {}
    for n, v in share.items():
        dk = s.companies[n]["district"]; by_d[dk] = by_d.get(dk, 0) + v
    for dk in sorted(by_d, key=lambda k: -by_d[k]):
        facts.append(Fact(f"lt_dist_{dk}", round(by_d[dk] * 100, 1), "pct1", f"實際持有{DISTRICTS[dk]['name']}的估計比例", src))
    return ToolResult("lookthrough", {"positions": positions}, facts=facts, sources=[src], note=HOLD_NOTE + "，為估計值",
                      data={"positions": positions, "top": top, "_share": {n: round(v, 5) for n, v in share.items()},
                            "districts": [{"key": dk, "name": DISTRICTS[dk]["name"], "fact": f"lt_dist_{dk}"} for dk in sorted(by_d, key=lambda k: -by_d[k])]})


# ------------------------------------------------------------------ 個股與市場
def _state(pct: float) -> str:
    return "boom" if pct >= RULES["boom_above"] else "crash" if pct <= RULES["crash_below"] else "up" if pct >= 0.3 else "down" if pct <= -0.3 else "flat"


def _daily_src(s: DataStore) -> str:
    return "示意行情 (尚未接上每日行情，不是真實報價)" if s.daily.get("demo") else f"證交所每日行情 ({s.daily.get('date')})"


def get_stock_info(company: str, s: DataStore | None = None) -> ToolResult:
    s = s or get_store(); c = s.companies[company]; pct = s.change_of(company); src = _daily_src(s); hs = _hold_src(s)
    facts = []
    if pct is not None:
        facts.append(Fact(f"chg_{c['code']}", pct, "pct_signed", f"{company}今天的漲跌幅", src, s.daily.get("date")))
    held = s.etfs_holding(company)
    for h in held:
        facts.append(Fact(f"w_{h['etf']}_{c['code']}", h["weight"], "pct", f"{company}在 {h['etf']} 的權重 (第 {h['rank']} 大)", hs))
    facts += [Fact("rule_boom", RULES["boom_above"], "pct0", "大樓放煙火的漲幅門檻", "城市規則"), Fact("rule_crash", abs(RULES["crash_below"]), "pct0", "大樓龜裂的跌幅門檻", "城市規則")]
    return ToolResult("get_stock_info", {"company": company}, facts=facts, sources=[src, hs], note="示意行情" if s.daily.get("demo") else "",
                      data={"name": company, "code": c["code"], "industry": c["industry"], "district": DISTRICTS[c["district"]]["name"], "demo": bool(s.daily.get("demo")),
                            "state": _state(pct) if pct is not None else None, "change_fact": f"chg_{c['code']}" if pct is not None else None,
                            "held_by": [{"etf": h["etf"], "rank": h["rank"], "fact": f"w_{h['etf']}_{c['code']}"} for h in held]})


def market_summary(district: str | None = None, s: DataStore | None = None) -> ToolResult:
    s = s or get_store(); src = _daily_src(s); names = s.city_companies(); facts = []; avg = {}
    for dk in DISTRICTS:
        v = [s.change_of(n) for n in names if s.companies[n]["district"] == dk and s.change_of(n) is not None]
        if v:
            avg[dk] = round(sum(v) / len(v), 2); facts.append(Fact(f"dist_avg_{dk}", avg[dk], "pct_signed", f"{DISTRICTS[dk]['name']}今天的平均漲跌 (城市內的公司)", src))
    idx = s.daily.get("index") or {}
    if idx.get("pct") is not None:
        facts.append(Fact("idx_chg", idx["pct"], "pct_signed", f"{idx.get('name', '大盤')}今天的漲跌幅", src))
    movers = sorted((n for n in names if s.change_of(n) is not None), key=lambda n: s.change_of(n))
    if district:
        movers = [n for n in movers if s.companies[n]["district"] == district]

    def item(n):
        c = s.companies[n]["code"]; facts.append(Fact(f"chg_{c}", s.change_of(n), "pct_signed", f"{n}今天的漲跌幅", src)); return {"name": n, "fact": f"chg_{c}"}
    crash = [item(n) for n in movers if s.change_of(n) <= RULES["crash_below"]][:3]
    boom = [item(n) for n in reversed(movers) if s.change_of(n) >= RULES["boom_above"]][:3]
    ups = [item(n) for n in reversed(movers) if s.change_of(n) > 0][:3]; downs = [item(n) for n in movers if s.change_of(n) < 0][:3]
    facts += [Fact("rule_boom", RULES["boom_above"], "pct0", "大樓放煙火的漲幅門檻", "城市規則"), Fact("rule_crash", abs(RULES["crash_below"]), "pct0", "大樓龜裂的跌幅門檻", "城市規則")]
    order = sorted(avg, key=lambda k: avg[k])
    return ToolResult("market_summary", {"district": district}, facts=facts, sources=[src], note="示意行情" if s.daily.get("demo") else "",
                      data={"date": s.daily.get("date"), "demo": bool(s.daily.get("demo")), "district": district, "district_name": DISTRICTS[district]["name"] if district else None,
                            "rain": idx.get("pct") is not None and idx["pct"] <= RULES["rain_below"], "index_fact": "idx_chg" if idx.get("pct") is not None else None,
                            "worst": {"key": order[0], "name": DISTRICTS[order[0]]["name"], "fact": f"dist_avg_{order[0]}", "_v": avg[order[0]]} if order else None,
                            "best": {"key": order[-1], "name": DISTRICTS[order[-1]]["name"], "fact": f"dist_avg_{order[-1]}", "_v": avg[order[-1]]} if order else None,
                            "crash": crash, "boom": boom, "ups": ups, "downs": downs})


def search_knowledge(query: str, k: int = 3, s: DataStore | None = None) -> ToolResult:
    from .rag import get_kb
    hits = get_kb().search(query, k)
    if not hits:
        return ToolResult("search_knowledge", {"query": query}, ok=False, error="知識庫裡找不到相關文件。")
    return ToolResult("search_knowledge", {"query": query}, sources=[f"知識庫《{h['title']}》{h['source_note']}" for h in hits[:2]],
                      data={"hits": [{"id": h["id"], "title": h["title"], "score": h["score"], "summary": h["summary"]} for h in hits], "_docs": hits})


def holdings_change(etf: str, s: DataStore | None = None) -> ToolResult:
    """和前一份持股比較：新進、退出前十大的公司，以及留下來的公司權重變化"""
    s = s or get_store(); args = {"etf": etf}
    if not s.prev or etf not in s.prev["holdings"]:
        return ToolResult("holdings_change", args, ok=False, error="沒有前一份持股資料可以比較。")
    old = {t["name"]: t for t in s.prev["holdings"][etf]["top10"]}; new = {t["name"]: t for t in s.top10(etf)}
    added = [n for n in new if n not in old]; removed = [n for n in old if n not in new]; kept = [n for n in new if n in old]
    src_new, src_old = _hold_src(s), f"前十大成分股 ({s.prev['label']})"
    facts = [Fact(f"chg_added_{etf}", len(added), "count:家", f"{etf} 新進前十大的公司家數", src_new),
             Fact(f"chg_removed_{etf}", len(removed), "count:家", f"{etf} 退出前十大的公司家數", src_old)]
    for n in added:
        facts.append(Fact(f"w_{etf}_{new[n]['code']}", new[n]["weight"], "pct", f"{n}目前在 {etf} 的權重 (新進)", src_new))
    for n in removed:
        facts.append(Fact(f"oldw_{etf}_{old[n]['code']}", old[n]["weight"], "pct", f"{n}在 {etf} 前一份資料的權重 (已退出)", src_old))
    moves = sorted(kept, key=lambda n: -abs(new[n]["weight"] - old[n]["weight"]))[:3]
    for n in moves:
        c = new[n]["code"]
        facts += [Fact(f"w_{etf}_{c}", new[n]["weight"], "pct", f"{n}目前在 {etf} 的權重", src_new), Fact(f"oldw_{etf}_{c}", old[n]["weight"], "pct", f"{n}在 {etf} 前一份資料的權重", src_old)]
    return ToolResult("holdings_change", args, facts=facts, sources=[src_new, src_old], note=HOLD_NOTE,
                      data={"etf": etf, "prev_label": s.prev["label"], "now_label": s.holdings_meta.get("as_of") or "目前資料",
                            "added": [{"name": n, "fact": f"w_{etf}_{new[n]['code']}"} for n in added],
                            "removed": [{"name": n, "fact": f"oldw_{etf}_{old[n]['code']}"} for n in removed],
                            "moves": [{"name": n, "now": f"w_{etf}_{new[n]['code']}", "old": f"oldw_{etf}_{new[n]['code']}", "up": new[n]["weight"] > old[n]["weight"]} for n in moves]})


TOOLS = {"holdings_change": holdings_change, "get_etf_info": get_etf_info, "get_top10_holdings": get_top10_holdings, "top10_overlap": top10_overlap, "get_return": get_return,
         "get_dividends": get_dividends, "simulate_dca": simulate_dca, "lookthrough": lookthrough, "get_stock_info": get_stock_info,
         "market_summary": market_summary, "search_knowledge": search_knowledge}
