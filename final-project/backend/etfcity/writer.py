"""Writer：把工具結果寫成回答。回答裡的數字一律寫成 {編號}，之後由 checker 填入。
template_write 是不靠 LLM 的模板版 (mock 模式，以及 LLM 重寫仍不合格時的備援)。"""
from __future__ import annotations
from .config import DISCLAIMER
from .facts import FactBook, ToolResult
from .schemas import Plan

CN_NUM = "零一兩三四五六七八九十"
MONTH_CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
cn = lambda n: CN_NUM[n] if 0 <= n <= 10 else str(n)
P = lambda fid: "{" + fid + "}"
STATE_TEXT = {"boom": "漲超過 {rule_boom}，店門口掛起彩帶、燈全亮", "up": "小漲，店裡燈比平常亮", "flat": "變動不大，照常營業", "down": "下跌，店裡燈暗了一些",
              "crash": "跌超過 {rule_crash}，鐵捲門拉下一半 (只代表今天的漲跌)"}


def _find(results: list[ToolResult], name: str) -> ToolResult | None:
    return next((r for r in results if r.name == name and r.ok), None)


def role_of(plan: Plan, results: list[ToolResult]) -> dict:
    r = _find(results, "get_stock_info")
    if plan.type == "company" and r:
        n = r.data["name"]
        return {"name": f"{n}店長", "icon": "店", "color": "#2e6b5e" if plan.focus.get("station") else "#5b4a8a"}
    if plan.type == "scenario":
        return {"name": "城市檔案室", "icon": "檔", "color": "#7a5c2e"}
    h = _find(results, "get_top10_holdings")
    if plan.type == "number" and h:
        return {"name": f"{h.data['etf']} 導覽員", "icon": "線", "color": None, "etf": h.data["etf"]}
    return {"name": "城市導覽員", "icon": "導", "color": "#435369"}


def template_write(plan: Plan, results: list[ToolResult], question: str = "") -> str:
    t = plan.type; out = []
    failed = [r for r in results if not r.ok]
    if t == "refuse":
        out.append("我不會預測漲跌，也不會告訴你該不該買賣，這是這個系統刻意設下的規則。")
        dv = _find(results, "get_dividends")
        if dv:
            d = dv.data; p = d["prefix"]
            out[0] = "我不會預測未來會配多少，也不會告訴你該不該買賣，這是這個系統刻意設下的規則。每次配多少要看投信當次的公告。"
            out.append(f"我能給你的是過去的紀錄：{d['etf']} {d['label']}除息 {P(p + '_n')}，每單位合計 {P(p + '_sum')}，過去的配息不代表未來。")
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
                out.append(f"{a} 和 {b} 的前十大成分股沒有共同持股，兩條導引線沒有經過同一家店。")
            elif n >= 8:
                out.append(f"{a} 和 {b} 的前十大成分股有 {cnt}相同，前十大重疊權重 {w}，兩條導引線幾乎走同一條路，同時持有兩檔的分散效果很有限。")
            else:
                out.append(f"{a} 和 {b} 的前十大成分股有 {cnt}重疊 ({names})，前十大重疊權重 {w}。")
            ta, tb = d["top"][a], d["top"][b]
            if ta["name"] != tb["name"]:
                out.append(f"最大的差別在第一大持股：{a} 是{ta['name']} {P(ta['fact'])}，{b} 是{tb['name']} {P(tb['fact'])}。")
        if rr and len(rr.data["rows"]) == 2:
            x, y = rr.data["rows"]
            out.append(f"{rr.data['period_name']} ({P(x['facts']['from'])} 到 {P(x['facts']['to'])}) 的價格報酬：{x['etf']} {P(x['facts']['ret'])}，{y['etf']} {P(y['facts']['ret'])}，相差 {P(rr.data['diff']['fact'])}。這只算股價，配息沒有加回來；配息比較多的 ETF，加回去之後差距會不一樣。")
        out.append("以上只計前十大成分股，不是完整持股。")
    elif t == "number" and any(r.name == "get_dividends" for r in results):
        out += _dividend_text(next(r for r in results if r.name == "get_dividends"))
    elif t == "number" and _find(results, "holdings_change"):
        d = _find(results, "holdings_change").data; k = d["etf"]
        if not d["added"] and not d["removed"]:
            out.append(f"和{d['prev_label']}相比，{k} 的前十大成分股名單沒有變。")
        else:
            out.append(f"和{d['prev_label']}相比，{k} 的前十大有 {P('chg_added_' + k)}新進、{P('chg_removed_' + k)}退出。")
            if d["added"]:
                out.append(f"新進的是{'、'.join(x['name'] + ' ' + P(x['fact']) for x in d['added'])}，這幾家店門口亮起綠色光柱。")
            if d["removed"]:
                out.append(f"退出的是{'、'.join(x['name'] + ' (原本 ' + P(x['fact']) + ')' for x in d['removed'])}，導引線不再經過這幾家店。")
        mv = [x for x in d["moves"]]
        if mv:
            out.append("留下來的公司中，權重變化最大的是" + "、".join(f"{x['name']} (從 {P(x['old'])} 變成 {P(x['now'])})" for x in mv[:2]) + "。")
        out.append("以上只比較前十大成分股。")
    elif t == "number":
        info = _find(results, "get_etf_info"); h = _find(results, "get_top10_holdings"); rr = _find(results, "get_return")
        if h:
            d = h.data; top = d["top10"][0]; k = d["etf"]; dist = d["districts"][0]
            name = info.data["name"] if info else d["name"]
            out.append(f"{k} {name}是一檔{d['type']} ETF，前十大成分股中最大的是{top['name']} {P(top['fact'])}，前十大合計 {P(f'top10_sum_{k}')}，其餘分散在其他公司 (只計前十大)。")
            out.append(f"前十大依序是：{'、'.join(x['name'] for x in d['top10'])}。這條導引線在{dist['name']}經過最多店，合計 {P(dist['fact'])}。")
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
            out.append(f"單月跌最多是 {P(p + '_maxdrop_month')} ({P(p + '_maxdrop')}){'，回放到那個月時城市下了一場大雨' if d['rained'] else ''}；漲最多是 {P(p + '_maxgain_month')} ({P(p + '_maxgain')}){'，那個月廣場放了煙火' if d['fireworks'] else ''}。")
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
                out.append(f"{multi['name']} {P(multi['fact'])} 比較特別，{'、'.join(multi['from'])} {cn(len(multi['from']))}檔都持有它，等於重複買了{'好幾次' if len(multi['from']) >= 3 else '兩次'}。")
            out.append(f"前十大成分股只涵蓋你 {P('lt_covered')} 的錢，其餘 {P('lt_rest')} 分散在其他公司，所以以上是估計值。店門口的金色購物袋越大，代表你在那家店持有越多。")
    elif t == "company":
        r = _find(results, "get_stock_info")
        if r:
            d = r.data; n = d["name"]; L = d["held_by"]
            not_held = f"{n}不在城市裡這幾檔 ETF 的前十大，所以櫥窗上沒有 ETF 貼紙 (ETF 可能持有它，只是不在前十大)。"
            if plan.focus.get("station"):
                if not L:
                    out.append(not_held)
                elif len(L) == 1:
                    out.append(f"{n}只在 {L[0]['etf']} 的前十大，權重 {P(L[0]['fact'])}，是它的第 {L[0]['rank']} 大持股。")
                else:
                    out.append(f"{n}同時在{cn(len(L))}檔 ETF 的前十大：{'、'.join(x['etf'] + ' ' + P(x['fact']) for x in L)}。這{cn(len(L))}檔的前十大都有{n}，櫥窗上貼了{cn(len(L))}張 ETF 貼紙，同時買的話，等於在這家店重複買了好幾次。")
            else:
                demo = " (示意行情)" if d["demo"] else ""
                if d["change_fact"]:
                    out.append(f"{n} ({d['code']}) 今天 {P(d['change_fact'])}{demo}，{STATE_TEXT[d['state']]}。")
                else:
                    out.append(f"{n} ({d['code']}) 今天沒有行情資料。")
                if d.get("mcap_fact"):
                    out.append(f"它的市值占大盤 {P(d['mcap_fact'])}，是上市公司第 {d['mcap_rank']} 大，所以店面{'是整排最寬的旗艦店' if d['mcap_rank'] == 1 else '比較寬' if d['mcap_rank'] <= 10 else '中等大小' if d['mcap_rank'] <= 40 else '比較小'}。")
                if L:
                    out.append(f"持有這家店的 ETF 有{cn(len(L))}檔 (櫥窗貼紙)：{'、'.join(x['etf'] + ' (權重 ' + P(x['fact']) + '，第 ' + str(x['rank']) + ' 大)' for x in L)}。")
                else:
                    out.append(not_held)
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
                ev.append(f"跌超過 {P('rule_crash')} 的有{li(d['crash'][:2])}，鐵捲門拉下一半")
            if d["boom"]:
                ev.append(f"漲超過 {P('rule_boom')} 的有{li(d['boom'][:2])}，門口掛起彩帶")
            if ev:
                out.append("；".join(ev) + "。")
            out.append("走到任何一家店門口，可以直接問店長。")
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
            out.append("切到晚上。晚上最容易看出今天的行情：漲越多的店燈越亮，跌很多的店會暗掉、鐵捲門拉下一半。" if night else "切到白天。白天看招牌下的跑馬燈：紅色是漲，綠色是跌，大跌的店鐵捲門拉下一半。")
        else:
            out.append("回到 ETF 廣場。地上每條彩色的導引線是一檔 ETF，沿著線走會經過它的前十大；櫥窗上的貼紙代表哪幾檔 ETF 持有這家店。")
    else:
        hi = "嗨，我是城市導覽員。" if plan.focus.get("greeting") else "這個問題我還聽不懂。"
        out.append(hi + "我可以回答：今天的行情、某家公司、兩檔 ETF 的比較、某檔 ETF 的報酬、前十大成分股與配息紀錄、每月定期定額的回放、你的持股穿透，以及 ETF 的名詞與觀念。也可以直接走到店門口，或點任何一家店。")
    for r in failed:
        if r.error and t not in ("concept",):
            out.append(r.error)
    return "".join(out)


def _dividend_text(r: ToolResult) -> list[str]:
    d = r.data; k = r.args["etf"]; out = []
    months = "、".join(MONTH_CN[m] for m in d.get("months") or [] if 1 <= m <= 12)
    if d.get("freq"):
        out.append(f"{k} 是{d['freq']}" + (f"，通常在{months}月除息。" if months else "。"))
    if not r.ok:
        return out   # 錯誤說明 (例如那一年沒有紀錄) 由 template_write 最後統一加上
    p = d["prefix"]; when = f"{P(p + '_year')} 年" if d["year"] else "最近一年"
    out.append(f"{when}一共除息 {P(p + '_n')}，每單位合計 {P(p + '_sum')}。")
    items = []
    for x in d["rows"]:
        s = f"{P(x['date_fact'])} {P(x['fact'])}"
        if x.get("adj_fact"):
            s += f" (分割前的舊單位，換算成現在約 {P(x['adj_fact'])})"
        items.append(s)
    out.append("每次是" + "、".join(items) + "。")
    if d.get("split"):
        out.append(d["split_note"].replace("要換算成現在的單位才能和現在的價格比較", "上面的合計已經換算成現在的單位") + "。")
    out.append("配息是每一單位拿到的現金；這個系統算的報酬都是價格報酬，沒有把配息加回去 (未含息)。")
    return out


def _first_section(md: str, limit: int = 420) -> str:
    """模板版觀念題：取文件開頭的說明 (去掉標題與 markdown 記號)"""
    import re
    lines = []
    for ln in md.splitlines():
        ln = ln.strip()
        if ln.startswith("|"):   # 表格模板版不呈現
            continue
        if not ln or ln.startswith("#"):
            if lines and sum(len(x) for x in lines) > 120:
                break
            continue
        ln = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", ln); ln = re.sub(r"\s*\(來源[:：][^)]*\)", "", ln); ln = re.sub(r"^[-*]\s*", "", ln).replace("**", "")
        ln = re.sub(r"[:：]\s*$", "", ln)   # 後面原本接表格的冒號
        lines.append(ln)
        if sum(len(x) for x in lines) > limit:
            break
    return "".join(x if x[-1] in "。！？" else x + "。" for x in lines)


WRITER_SYSTEM = """你是「ETF 都會」的城市導覽員，用繁體中文、台灣用語回答 ETF 問題。

最重要的規則：你不可以自己寫任何數字。
- 需要數字的地方，一律寫成大括號編號，例如 {ret_1y_0050}。系統會把編號換成正確的數字和單位 (例如 +5.21%、325,000 元、3 家、2024/5/29)，所以編號後面不要再加 %、元、家這些單位。
- 只能使用「可用數字」清單裡的編號。清單裡沒有的數字就不要提。
- ETF 代號 (例如 0050) 和股票代號可以直接寫。「前十大」「兩檔」這類用國字。
- 不可以用「六成」「一半」「三倍」「近五成」這類說法代替數字；要講比例就用編號。
- 觀念題可以引用「參考文件」裡出現的數字，必須和文件一模一樣。

其他規則：
- 只根據工具結果和參考文件回答，不要補充清單以外的事實。
- 不預測漲跌，不建議買賣，不說哪一檔比較好，也不要寫「建議多關注」「建議留意」這類建議。
- 工具結果裡的英文欄位名稱與狀態代碼 (例如 crash、boom、state、district) 不要寫進回答，改用白話 (例如「跌超過門檻，鐵捲門拉下一半」)。
- 報酬都是價格報酬，要說明「未含息」(「未含息」只用在報酬，持股比例、權重不要寫未含息)。持股資料只有前十大，要說明是「前十大」的結果。
- 配息是每單位的現金，只有過去的紀錄，不能說未來會配多少。工具結果的 split 是 true 時，要說明分割前的配息是舊單位、合計已換算成現在的單位。
- 提到持股權重或重疊時，要說明是「前十大」成分股的資料。
- 三到六句話，口語、好懂，不要條列、不要標題、不要 markdown。括號用半形 ()，不要用全形（）。不要用破折號。
- 如果角色是店長或導覽員，用那個角色的口吻。"""


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
