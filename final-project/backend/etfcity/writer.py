"""Writer：把工具結果寫成回答。回答裡的數字一律寫成 {編號}，之後由 checker 填入。
template_write 是不靠 LLM 的模板版 (mock 模式，以及 LLM 重寫仍不合格時的備援)。"""
from __future__ import annotations
from .config import DISCLAIMER
from .facts import FactBook, ToolResult
from .schemas import Plan

CN_NUM = "零一兩三四五六七八九十"
cn = lambda n: CN_NUM[n] if 0 <= n <= 10 else str(n)
P = lambda fid: "{" + fid + "}"
STATE_TEXT = {"boom": "漲超過 {rule_boom}，頂樓放起煙火，窗戶幾乎全亮", "up": "小漲，窗戶比平常亮", "flat": "變動不大，燈光照常", "down": "下跌，窗戶暗了一些",
              "crash": "跌超過 {rule_crash}，外牆出現裂痕、搭起鷹架，窗戶暗了一大半"}


def _find(results: list[ToolResult], name: str) -> ToolResult | None:
    return next((r for r in results if r.name == name and r.ok), None)


def role_of(plan: Plan, results: list[ToolResult]) -> dict:
    r = _find(results, "get_stock_info")
    if plan.type == "company" and r:
        n = r.data["name"]
        return {"name": f"{n}站站務員", "icon": "站", "color": "#2e6b5e"} if plan.focus.get("station") else {"name": f"{n}大樓管理員", "icon": "管", "color": "#5b4a8a"}
    if plan.type == "scenario":
        return {"name": "城市檔案室", "icon": "檔", "color": "#7a5c2e"}
    h = _find(results, "get_top10_holdings")
    if plan.type == "number" and h:
        return {"name": f"{h.data['etf']} 線站長", "icon": "線", "color": None, "etf": h.data["etf"]}
    return {"name": "城市導覽員", "icon": "導", "color": "#435369"}


def template_write(plan: Plan, results: list[ToolResult], question: str = "") -> str:
    t = plan.type; out = []
    failed = [r for r in results if not r.ok]
    if t == "refuse":
        out.append("我不會預測漲跌，也不會告訴你該不該買賣，這是這個系統刻意設下的規則。")
        r = _find(results, "get_return")
        if r:
            row = r.data["rows"][0]; f = row["facts"]
            out.append(f"我能給你的是過去的資料：{row['etf']} {r.data['period_name']}的價格報酬是 {P(f['ret'])} ({P(f['from'])} 到 {P(f['to'])}，未含息)，過去的表現不代表未來。")
        out.append("想知道長期持有是什麼感覺，可以問我定期定額的回放，看城市怎麼走過每一次下跌。")
    elif t == "compare":
        ov = _find(results, "top10_overlap"); rr = _find(results, "get_return")
        if ov:
            d = ov.data; a, b = d["a"], d["b"]; n = len(d["shared"]); names = "、".join(x["name"] for x in d["shared"])
            cnt, w = P(f"overlap_count_{a}_{b}"), P(f"overlap_weight_{a}_{b}")
            if n == 0:
                out.append(f"{a} 和 {b} 的前十大成分股沒有共同持股，兩條線完全不重疊。")
            elif n >= 8:
                out.append(f"{a} 和 {b} 的前十大成分股有 {cnt}相同，前十大重疊權重 {w}，幾乎是同一條線，同時持有兩檔的分散效果很有限。")
            else:
                out.append(f"{a} 和 {b} 的前十大成分股有 {cnt}重疊 ({names})，前十大重疊權重 {w}。")
            ta, tb = d["top"][a], d["top"][b]
            if ta["name"] != tb["name"]:
                out.append(f"最大的差別在第一大持股：{a} 是{ta['name']} {P(ta['fact'])}，{b} 是{tb['name']} {P(tb['fact'])}。")
        if rr and len(rr.data["rows"]) == 2:
            x, y = rr.data["rows"]
            out.append(f"{rr.data['period_name']} ({P(x['facts']['from'])} 到 {P(x['facts']['to'])}) 的價格報酬：{x['etf']} {P(x['facts']['ret'])}，{y['etf']} {P(y['facts']['ret'])}，相差 {P(rr.data['diff']['fact'])}。這只算股價，配息沒有加回來；配息比較多的 ETF，加回去之後差距會不一樣。")
        out.append("以上只計前十大成分股，不是完整持股。")
    elif t == "number" and _find(results, "holdings_change"):
        d = _find(results, "holdings_change").data; k = d["etf"]
        if not d["added"] and not d["removed"]:
            out.append(f"和{d['prev_label']}相比，{k} 的前十大成分股名單沒有變。")
        else:
            out.append(f"和{d['prev_label']}相比，{k} 的前十大有 {P('chg_added_' + k)}新進、{P('chg_removed_' + k)}退出。")
            if d["added"]:
                out.append(f"新進的是{'、'.join(x['name'] + ' ' + P(x['fact']) for x in d['added'])}，城市裡這幾站是新開的。")
            if d["removed"]:
                out.append(f"退出的是{'、'.join(x['name'] + ' (原本 ' + P(x['fact']) + ')' for x in d['removed'])}，這幾站停駛了。")
        mv = [x for x in d["moves"]]
        if mv:
            out.append("留下來的公司中，權重變化最大的是" + "、".join(f"{x['name']} (從 {P(x['old'])} 變成 {P(x['now'])})" for x in mv[:2]) + "。")
        out.append("以上只比較前十大成分股。")
    elif t == "number":
        info = _find(results, "get_etf_info"); h = _find(results, "get_top10_holdings"); rr = _find(results, "get_return")
        if h:
            d = h.data; top = d["top10"][0]; k = d["etf"]; dist = d["districts"][0]
            name = info.data["name"] if info else d["name"]
            out.append(f"{k} {name}是一檔{d['type']} ETF，前十大成分股中最大的是{top['name']} {P(top['fact'])}，前十大合計 {P(f'top10_sum_{k}')}，其餘分散在其他公司，沒有畫進城市。")
            out.append(f"前十大依序是：{'、'.join(x['name'] for x in d['top10'])}。這條線在{dist['name']}停最多，合計 {P(dist['fact'])}。")
            ask_d = (plan.focus.get("entities") or {}).get("district")
            hit = next((x for x in d["districts"] if x["key"] == ask_d), None)
            if ask_d and hit and hit is not dist:
                out.append(f"你問的{hit['name']}，在前十大裡合計 {P(hit['fact'])}。")
            elif ask_d and not hit:
                out.append("前十大裡沒有你問的這個產業。")
        if rr:
            for row in rr.data["rows"]:
                f = row["facts"]
                s = f"{row['etf']} {rr.data['period_name']}的價格報酬是 {P(f['ret'])} ({P(f['from'])} 到 {P(f['to'])}，未含息)"
                if "ann" in f:
                    s += f"，換算年化約 {P(f['ann'])}"
                out.append(s + "。")
    elif t == "scenario":
        r = _find(results, "simulate_dca")
        if r:
            d = r.data; p = d["prefix"]; k = d["etf"]
            if d["actual_start"] != d["requested_start"]:
                out.append(f"{k} 的資料從 {P(p + '_start')} 才開始，所以從那個月起算。")
            out.append(f"從 {P(p + '_start')} 開始，每月第一個交易日買 {P(p + '_monthly')}的 {k}，共買 {P(p + '_n')}，總共投入 {P(p + '_invested')}。到 {P(p + '_end')}，市值約 {P(p + '_value')}，價格報酬 {P(p + '_ret')} (未含息)。")
            out.append(f"最難熬的是 {P(p + '_worst_month')}，帳面 {P(p + '_worst_pnl')}。" if d["ever_negative"] else "整段期間，每個月初的帳面都沒有虧損。")
            out.append(f"單月跌最多是 {P(p + '_maxdrop_month')} ({P(p + '_maxdrop')}){'，回放到那個月時城市下了一場大雨' if d['rained'] else ''}；漲最多是 {P(p + '_maxgain_month')} ({P(p + '_maxgain')}){'，那個月頂樓放了煙火' if d['fireworks'] else ''}。")
    elif t == "portfolio":
        r = _find(results, "lookthrough")
        if r:
            d = r.data; t0 = d["top"][0]
            if plan.focus.get("demo"):
                out.append("你沒有給金額，我先用示範配置。")
            src = f"全部來自 {t0['from'][0]}" if len(t0["from"]) == 1 else f"來自 {'、'.join(t0['from'])}"
            out.append(f"你一共投入 {P('lt_total')}，分在 {P('lt_etf_count')} ETF。把它們拆開來看，你實際持有最多的是{t0['name']}，估計占 {P(t0['fact'])}，{src}。")
            multi = next((x for x in d["top"][1:] if len(x["from"]) >= 3), None) or next((x for x in d["top"][1:] if len(x["from"]) >= 2), None)
            if multi:
                out.append(f"{multi['name']} {P(multi['fact'])} 比較特別，{'、'.join(multi['from'])} {cn(len(multi['from']))}條線都經過它，等於重複買了{'好幾次' if len(multi['from']) >= 3 else '兩次'}。")
            out.append(f"前十大成分股只涵蓋你 {P('lt_covered')} 的錢，其餘 {P('lt_rest')} 分散在其他公司，沒有畫進城市，所以以上是估計值。金色框越高，代表你在那棟樓持有越多。")
    elif t == "company":
        r = _find(results, "get_stock_info")
        if r:
            d = r.data; n = d["name"]; L = d["held_by"]
            if plan.focus.get("station"):
                if len(L) == 1:
                    out.append(f"{n}站只有 {L[0]['etf']} 經過，權重 {P(L[0]['fact'])}，是它的第 {L[0]['rank']} 大持股。")
                else:
                    out.append(f"{n}站是{cn(len(L))}條線的轉乘站：{'、'.join(x['etf'] + ' ' + P(x['fact']) for x in L)}。這{cn(len(L))}檔的前十大都有{n}，同時買的話，等於在這站重複買了好幾次。")
            else:
                demo = " (示意行情)" if d["demo"] else ""
                if d["change_fact"]:
                    out.append(f"{n} ({d['code']}) 今天 {P(d['change_fact'])}{demo}，{STATE_TEXT[d['state']]}。")
                else:
                    out.append(f"{n} ({d['code']}) 今天沒有行情資料。")
                if L:
                    out.append(f"經過這棟樓的捷運線有{cn(len(L))}條：{'、'.join(x['etf'] + ' (權重 ' + P(x['fact']) + '，第 ' + str(x['rank']) + ' 大)' for x in L)}。")
    elif t == "market":
        r = _find(results, "market_summary")
        if r:
            d = r.data; demo = " (示意行情)" if d["demo"] else ""
            li = lambda xs: "、".join(f"{x['name']} {P(x['fact'])}" for x in xs)
            if d["district"]:
                out.append(f"{d['district_name']}今天{demo}{' ' if demo else ''}平均 {P('dist_avg_' + d['district'])}。")
                if d["ups"]:
                    out.append(f"上漲的有{li(d['ups'])}。")
                if d["downs"]:
                    out.append(f"下跌的有{li(d['downs'])}。")
            else:
                if d["index_fact"]:
                    out.append(f"今天{demo}{' ' if demo else ''}大盤 {P(d['index_fact'])}{'，城市在下雨' if d['rain'] else ''}。")
                parts = []
                if d["worst"] and d["worst"]["_v"] < -0.5:
                    parts.append(f"{d['worst']['name']}最弱，平均 {P(d['worst']['fact'])}")
                if d["best"] and d["best"]["_v"] > 0.5:
                    parts.append(f"{d['best']['name']}最強，平均 {P(d['best']['fact'])}")
                out.append("；".join(parts) + "。" if parts else "各區變動都不大，燈光照常。")
            ev = []
            if d["crash"]:
                ev.append(f"跌超過 {P('rule_crash')} 的有{li(d['crash'][:2])}，外牆龜裂、搭起鷹架")
            if d["boom"]:
                ev.append(f"漲超過 {P('rule_boom')} 的有{li(d['boom'][:2])}，頂樓在放煙火")
            if ev:
                out.append("；".join(ev) + "。")
            out.append("點任何一棟大樓，可以直接問它的管理員。")
    elif t == "concept":
        r = _find(results, "search_knowledge")
        if r:
            doc = r.data["_docs"][0]
            out.append(_first_section(doc["text"]))
        else:
            out.append("知識庫裡找不到相關的資料，所以我不亂回答。可以換個說法，或問收益平準金、折溢價、除息填息、內扣費用、市值型和高股息型的差別。")
    elif t == "scene":
        sc = plan.scene[0] if plan.scene else None
        if sc and sc.name == "set_time":
            night = sc.args["hour"] >= 18.5
            out.append("切到晚上。晚上最容易看出今天的行情：漲越多的大樓窗戶亮越多，跌很多的大樓會整片暗掉。" if night else "切到白天。白天看外觀：漲的大樓頂樓燈框是紅色，跌的是綠色，大跌的大樓搭著鷹架。")
        else:
            out.append("回到全城視角。每條彩色的線是一檔 ETF，轉乘站代表兩檔以上的 ETF 前十大都有這家公司。")
    else:
        hi = "嗨，我是城市導覽員。" if plan.focus.get("greeting") else "這個問題我還聽不懂。"
        out.append(hi + "我可以回答：今天的行情、某家公司、兩檔 ETF 的比較、某檔 ETF 的報酬與前十大成分股、每月定期定額的回放、你的持股穿透，以及 ETF 的名詞與觀念。也可以直接點城市裡的大樓或車站。")
    for r in failed:
        if r.error and t not in ("concept",):
            out.append(r.error)
    return "".join(out)


def _first_section(md: str, limit: int = 420) -> str:
    """模板版觀念題：取文件開頭的說明 (去掉標題與 markdown 記號)"""
    import re
    lines = []
    for ln in md.splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#"):
            if lines and sum(len(x) for x in lines) > 120:
                break
            continue
        ln = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", ln); ln = re.sub(r"\s*\(來源[:：][^)]*\)", "", ln); ln = re.sub(r"^[-*]\s*", "", ln).replace("**", "")
        lines.append(ln)
        if sum(len(x) for x in lines) > limit:
            break
    return "".join(x if x[-1] in "。！？" else x + "。" for x in lines)


WRITER_SYSTEM = """你是「ETF 都會」的城市導覽員，用繁體中文、台灣用語回答 ETF 問題。

最重要的規則：你不可以自己寫任何數字。
- 需要數字的地方，一律寫成大括號編號，例如 {ret_1y_0050}。系統會把編號換成正確的數字和單位 (例如 +5.21%、325,000 元、3 家、2024/5/29)，所以編號後面不要再加 %、元、家這些單位。
- 只能使用「可用數字」清單裡的編號。清單裡沒有的數字就不要提。
- ETF 代號 (例如 0050) 和股票代號可以直接寫。「前十大」「兩檔」這類用國字。
- 觀念題可以引用「參考文件」裡出現的數字，必須和文件一模一樣。

其他規則：
- 只根據工具結果和參考文件回答，不要補充清單以外的事實。
- 不預測漲跌，不建議買賣，不說哪一檔比較好。
- 報酬都是價格報酬，要說明「未含息」。持股資料只有前十大，要說明是「前十大」的結果。
- 三到六句話，口語、好懂，不要條列、不要標題、不要 markdown。括號用半形 ()。
- 如果角色是大樓管理員或站務員，用那個角色的口吻。"""


def writer_messages(plan: Plan, results: list[ToolResult], book: FactBook, question: str, role: dict, feedback: str = "") -> list[dict]:
    import json
    ctx = []
    for r in results:
        d = r.to_dict(slim=True); d.pop("facts", None)
        ctx.append({"tool": r.name, "ok": r.ok, "data": d["data"], "note": r.note, "error": r.error})
    docs = ""
    k = _find(results, "search_knowledge")
    if k:
        docs = "\n\n參考文件：\n" + "\n\n".join(f"《{d['title']}》\n{d['text'][:1500]}" for d in k.data["_docs"][:2])
    user = (f"角色：{role['name']}\n問題類型：{plan.type}\n使用者的問題：{question}\n\n工具結果 (結構)：\n{json.dumps(ctx, ensure_ascii=False)}\n\n"
            f"可用數字 (只能用這些編號)：\n{book.table() or '(這題沒有數字)'}{docs}\n\n"
            + ("這題屬於拒答：先說明不預測、不建議買賣的原因，再提供上面的歷史資料。\n" if plan.type == "refuse" else "")
            + (f"\n上一版回答不合格：{feedback}\n請修正後重寫。" if feedback else "") + "\n請寫出回答。")
    return [{"role": "system", "content": WRITER_SYSTEM}, {"role": "user", "content": user}]


def footer(results: list[ToolResult]) -> list[str]:
    src = []
    for r in results:
        for x in r.sources:
            if x not in src:
                src.append(x)
    return src


__all__ = ["template_write", "writer_messages", "role_of", "footer", "DISCLAIMER"]
