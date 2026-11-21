"""依工具結果決定畫面動作。動作只描述「要看什麼」，由前端決定怎麼呈現 (城市、圖表都可以)。"""
from __future__ import annotations
from .data import get_store
from .facts import ToolResult
from .schemas import Plan


def _f(results, name):
    return next((r for r in results if r.name == name and r.ok), None)


def derive_scene(plan: Plan, results: list[ToolResult]) -> list[dict]:
    s = get_store(); t = plan.type; A = lambda n, **a: {"name": n, "args": a}
    if plan.scene:   # Planner 指定的動作 (已驗證過)
        return [A(c.name, **c.args) for c in plan.scene]
    if t == "compare":
        ov = _f(results, "top10_overlap")
        if ov:
            d = ov.data; a, b = d["a"], d["b"]; shared = [x["name"] for x in d["shared"]]
            names = list(dict.fromkeys([d["top"][a]["name"], d["top"][b]["name"], *shared[:4]]))
            return [A("focus_etfs", etfs=[a, b]), A("mark_companies", companies=names, label="weights", etfs=[a, b], ring=shared), A("fly_to", companies=names)]
    if t == "number":
        h = _f(results, "get_top10_holdings"); rr = _f(results, "get_return")
        k = h.data["etf"] if h else rr.data["rows"][0]["etf"] if rr and rr.data["rows"] else None
        if k:
            names = [x["name"] for x in s.top10(k)]
            return [A("focus_etfs", etfs=[k]), A("mark_companies", companies=names[:5], label="weights", etfs=[k], ring=[]), A("fly_to", companies=names)]
    if t == "scenario":
        r = _f(results, "simulate_dca")
        if r:
            k = r.data["etf"]; names = [x["name"] for x in s.top10(k)]
            return [A("focus_etfs", etfs=[k]), A("mark_companies", companies=names[:3], label="weights", etfs=[k], ring=[]), A("fly_to", companies=names),
                    A("replay", etf=k, monthly=r.args["monthly"], series=r.data["_series"], rules=r.data["rules"])]
    if t == "portfolio":
        r = _f(results, "lookthrough")
        if r:
            names = [x["name"] for x in r.data["top"]]
            return [A("focus_etfs", etfs=list(r.data["positions"])), A("show_portfolio", shares=r.data["_share"]),
                    A("mark_companies", companies=names, label="portfolio", etfs=[], ring=[]), A("fly_to", companies=names)]
    if t == "company":
        r = _f(results, "get_stock_info")
        if r:
            n = r.data["name"]; ks = [h["etf"] for h in r.data["held_by"]]
            return [A("focus_etfs", etfs=ks), A("mark_companies", companies=[n], label="weights" if plan.focus.get("station") else "change", etfs=ks, ring=[n]), A("fly_to", companies=[n])]
    if t == "market":
        r = _f(results, "market_summary")
        if r:
            d = r.data
            if d["district"]:
                names = [n for n in s.city_companies() if s.companies[n]["district"] == d["district"]]
                return [A("focus_etfs", etfs=[]), A("mark_companies", companies=names[:8], label="change", etfs=[], ring=[]), A("fly_to", companies=names)]
            hot = [x["name"] for x in d["crash"][:3] + d["boom"][:3]] or [x["name"] for x in d["downs"][:2] + d["ups"][:2]]
            return [A("reset"), A("mark_companies", companies=hot, label="change", etfs=[], ring=[x["name"] for x in d["crash"][:1] + d["boom"][:1]]), A("fly_to", overview=True)]
    if t == "refuse":
        r = _f(results, "get_return")
        if r and r.data["rows"]:
            return [A("focus_etfs", etfs=[r.data["rows"][0]["etf"]])]
    if t == "concept":
        r = _f(results, "search_knowledge")
        if r:
            doc = r.data["_docs"][0]; ks = [k for k in s.etfs if k in doc["text"] or k in " ".join(doc.get("aliases", []))][:3]
            if ks:
                return [A("focus_etfs", etfs=ks)]
    return []


def followups(plan: Plan, results: list[ToolResult]) -> list[str]:
    s = get_store(); t = plan.type; codes = list(s.etfs)
    other = lambda k: next(c for c in ["00878", "0050", "0056"] if c != k)
    if t == "compare":
        r = _f(results, "top10_overlap")
        if r:
            a, b = r.data["a"], r.data["b"]
            return [f"每月 5000 買 {b}，從 2020 到現在會怎樣？", f"我有 {a} 30萬、{b} 20萬", "什麼是收益平準金？"]
    if t == "number":
        h = _f(results, "get_top10_holdings"); rr = _f(results, "get_return")
        k = h.data["etf"] if h else rr.data["rows"][0]["etf"] if rr and rr.data["rows"] else codes[0]
        return [f"每月 5000 買 {k}，從 2020 到現在會怎樣？", f"{k} 跟 {other(k)} 差在哪？", f"{k} 近三年報酬"]
    if t == "scenario":
        r = _f(results, "simulate_dca"); k = r.data["etf"] if r else "0050"
        return [f"換成 {other(k)} 呢？", f"{k} 前十大是哪些？", "回到全城"]
    if t == "portfolio":
        return ["改成 0050 20萬、00878 40萬", "聯發科站有哪些線經過？", "回到全城"]
    if t == "company":
        r = _f(results, "get_stock_info")
        if r and r.data["held_by"]:
            n = r.data["name"]; ks = [h["etf"] for h in r.data["held_by"]]
            first = f"{n}今天怎麼了？" if plan.focus.get("station") else f"{n}站有哪些線經過？"
            return [first, f"{ks[0]} 跟 {ks[-1]} 差在哪？" if len(ks) >= 2 else f"{ks[0]} 前十大是哪些？", "今天城市怎麼了？"]
    if t == "market":
        r = _f(results, "market_summary")
        hot = (r.data["crash"] or r.data["boom"] or r.data["downs"] or [{"name": "台積電"}])[0]["name"] if r else "台積電"
        return [f"{hot}今天怎麼了？", "0050 跟 00878 差在哪？", "晚上的城市長怎樣？"]
    if t == "refuse":
        r = _f(results, "get_return"); k = r.data["rows"][0]["etf"] if r and r.data["rows"] else "0056"
        return [f"每月 5000 買 {k}，從 2020 到現在會怎樣？", "什麼是除息和填息？"]
    if t == "concept":
        return ["市值型跟高股息差在哪？", "什麼是折溢價？", "今天城市怎麼了？"]
    if t == "scene":
        night = plan.scene and plan.scene[0].name == "set_time" and plan.scene[0].args["hour"] >= 18.5
        return ["切回白天", "今天城市怎麼了？"] if night else ["晚上的城市長怎樣？", "今天城市怎麼了？", "0050 跟 00878 差在哪？"]
    return ["今天城市怎麼了？", "0050 跟 00878 差在哪？", "每月 5000 買 0050，從 2020 到現在會怎樣？", "我有 0050 30萬、0056 10萬、00878 20萬", "什麼是收益平準金？"]
