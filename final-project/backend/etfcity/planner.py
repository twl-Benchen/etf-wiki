"""Planner：把問題變成執行計畫 (要呼叫的資料工具 + 畫面動作)。
LLM 版輸出 JSON，經 schemas.validate_plan 驗證；規則版 (rule_plan) 用在沒有 LLM 時，也是 LLM 失敗時的備援。"""
from __future__ import annotations
import re
from .data import get_store
from .schemas import validate_plan, Plan

ETF_ALIAS = {"元大台灣50": "0050", "台灣50": "0050", "台灣五十": "0050", "富邦台50": "006208", "元大高股息": "0056", "國泰永續高股息": "00878", "國泰永續": "00878",
             "群益台灣精選高息": "00919", "群益精選高息": "00919", "群益高息": "00919"}
CO_ALIAS = {"台積": "台積電", "TSMC": "台積電", "tsmc": "台積電", "發哥": "聯發科", "中華電信": "中華電", "日月光": "日月光投控", "長榮海運": "長榮", "長榮航空": "長榮航",
            "陽明海運": "陽明", "華南": "華南金", "國泰金控": "國泰金", "富邦金控": "富邦金", "中信": "中信金", "元大金控": "元大金", "世界先進": "世界", "上海銀": "上海商銀"}
CN = {"零": 0, "〇": 0, "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
REFUSE_RE = re.compile(r"(明天|下週|下周|明年|未來|之後|接下來|下個月).{0,8}(漲|跌|走勢|表現)|會(漲|跌)嗎|會不會(漲|跌|賺|賠)|該不該|要不要買|可以買嗎|能買嗎|值得買|推薦|明牌|保證|梭哈|all ?in|借錢|貸款.{0,4}買|開槓桿|融資|目標價|預測|穩賺|哪(一)?(檔|支)(最好|比較好|會賺)|現在.{0,4}(進場|上車|賣)", re.I)
KB_RE = re.compile(r"什麼是|是什麼|什麼意思|意思|怎麼算|如何計算|為什麼|差別|差在哪|收益平準金|折價|溢價|淨值|除息|填息|配息|內扣|費用|經理費|手續費|證交稅|稅|市值型|高股息型|定期定額是|成分股調整|換股|追蹤誤差|申購|買回|槓桿|反向|債券|殖利率|零股|下市|清算|風險|主動式|被動式")
PERIOD_RE = [("ytd", r"今年以來|今年|年初至今"), ("max", r"上市以來|成立以來|掛牌以來"), ("5y", r"(五|5)\s*年"), ("3y", r"(三|3)\s*年"), ("1y", r"(一|1)\s*年|去年到現在"),
             ("6m", r"半年|(六|6)\s*個月"), ("3m", r"(三|3)\s*個月|一季"), ("1m", r"(一|1)\s*個月|這個月")]
DISTRICT_RE = [("semi", r"半導體|園區"), ("tech", r"電子|科技區"), ("fin", r"金融"), ("port", r"航運|港"), ("life", r"民生|工業區")]


def parse_cn(s: str) -> int:
    total = sec = num = 0; last = ""
    for ch in s:
        if ch in CN:
            num = CN[ch]
        elif ch in "十百千":
            sec += (num or 1) * {"十": 10, "百": 100, "千": 1000}[ch]; num = 0; last = ch
        elif ch == "萬":
            total += (sec + num) * 10000; sec = num = 0; last = ch
    if num and last == "萬":
        return total + num * 1000
    if num and last == "千":
        return total + sec + num * 100
    return total + sec + num


def extract(q: str) -> dict:
    s = get_store(); t = re.sub(r"(\d),(?=\d{3})", r"\1", q)
    for a, k in {**{e["name"]: c for c, e in s.etfs.items()}, **ETF_ALIAS}.items():
        t = t.replace(a, f" {k} ")
    codes = sorted(s.etfs, key=len, reverse=True); code_re = re.compile(r"(?<!\d)(" + "|".join(codes) + r")(?!\d)")
    cos = []; tc = t
    alias = {**{n: n for n in s.companies}, **CO_ALIAS, **{c["code"]: n for n, c in s.companies.items()}}
    for a in sorted(alias, key=len, reverse=True):
        i = tc.find(a)
        if i >= 0 and alias[a] in s.companies:
            if alias[a] not in [x[1] for x in cos]:
                cos.append((i, alias[a]))
            tc = tc.replace(a, "＃" * len(a))
    cos = [n for _, n in sorted(cos)]
    tok = [("etf", m.group(1), m.start()) for m in code_re.finditer(tc)]
    ym = re.search(r"(?<!\d)((?:19|20)\d\d)\s*(?:年|/|-)\s*(\d{1,2})\s*月?", tc); yr = re.search(r"(?<!\d)(20[012]\d)(?!\d)", tc)
    hm = re.search(r"(?<!\d)(\d{1,2})\s*點", tc); hour = None
    if hm:
        hour = int(hm.group(1)) + (12 if re.search("晚上|下午|傍晚", tc) and int(hm.group(1)) < 12 else 0)
    mask = lambda m: "§" * len(m.group(0))
    ta = code_re.sub(mask, tc); ta = re.sub(r"(?<!\d)(?:19|20)\d\d(?!\d)\s*(?:年|/|-)?\s*(?:\d{1,2}\s*月)?", mask, ta); ta = re.sub(r"(?<!\d)\d{1,2}\s*點", mask, ta)
    ta = re.sub(r"[一二兩三四五六七八九十\d]+\s*(年|個月|檔|條|家|站|次|大)", mask, ta)
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(萬|千|k|K|百萬)?|([一二兩三四五六七八九十百千萬]*[十百千萬][一二兩三四五六七八九十百千萬]*)", ta):
        if m.group(1):
            v = float(m.group(1)) * {"萬": 10000, "千": 1000, "k": 1000, "K": 1000, "百萬": 1_000_000, None: 1}[m.group(2)]
        else:
            v = parse_cn(m.group(3))
        if v >= 100:
            tok.append(("amt", int(round(v)), m.start()))
    tok.sort(key=lambda x: x[2]); pairs = {}; last = None; pend = None
    for kind, v, _ in tok:
        if kind == "etf":
            last = v
            if pend is not None and v not in pairs:
                pairs[v] = pend; pend = None
        elif last and last not in pairs:
            pairs[last] = v
        else:
            pend = v
    etfs = list(dict.fromkeys(v for k, v, _ in tok if k == "etf"))
    period = next((p for p, r in PERIOD_RE if re.search(r, q)), None)
    district = next((d for d, r in DISTRICT_RE if re.search(r, q)), None)
    return {"etfs": etfs, "companies": cos, "amounts": [v for k, v, _ in tok if k == "amt"], "pairs": pairs,
            "year": int(ym.group(1)) if ym else int(yr.group(1)) if yr else None, "month": int(ym.group(2)) if ym else None, "hour": hour, "period": period, "district": district}


def is_refusal(q: str) -> bool:
    return bool(REFUSE_RE.search(q))


def rule_plan(q: str, ctx: dict | None = None) -> dict:
    """規則版 Planner，輸出和 LLM 版相同格式的 dict"""
    ctx = ctx or {}; E = extract(q); has = lambda r: re.search(r, q, re.I) is not None; s = get_store()
    follow = has(r"^(那|換成|改成|如果是|那如果|換)|呢[？?]?$")
    T = lambda n, **a: {"name": n, "args": {k: v for k, v in a.items() if v is not None}}
    if is_refusal(q):
        k = E["etfs"][:1]
        return {"type": "refuse", "tools": [T("get_return", etfs=k, period="1y")] if k else [], "reason": "預測漲跌或個人投資建議，依規則拒答", "focus": {"entities": E}}
    is_dca = not has("什麼是|是什麼") and (has("定期定額|每月|每個月|存股|回放|重播") or (has("如果|假設") and has("買|存|投入") and E["amounts"]))
    if not is_dca and follow and len(E["etfs"]) == 1 and ctx.get("type") == "scenario" and not E["pairs"]:
        is_dca = True
    if is_dca:
        k = (E["etfs"] or [ctx.get("etf") or "0050"])[0]; first = s.first_date(k)[:7]
        y = E["year"] or (int(str(ctx.get("start", "2020"))[:4]) if ctx.get("type") == "scenario" else 2020)
        start = f"{y}-{E['month'] or 1:02d}"; start = max(start, first); start = min(start, s.last_date(k)[:7])
        monthly = E["amounts"][0] if E["amounts"] else int(ctx.get("monthly", 5000)) if ctx.get("type") == "scenario" else 5000
        return {"type": "scenario", "tools": [T("simulate_dca", etf=k, monthly=max(100, min(monthly, 10_000_000)), start=start)], "reason": "定期定額回測", "focus": {"entities": E}}
    if (E["pairs"] and has("我(有|買|持有|手上|的)|持股|改成|換成|配置")) or has("我的城市|我的持股|看穿|穿透"):
        pos = {k: v for k, v in E["pairs"].items() if v > 0}; demo = not pos
        if demo:
            pos = {"0050": 300000, "0056": 100000, "00878": 200000}
        return {"type": "portfolio", "tools": [T("lookthrough", positions=pos)], "reason": "穿透持股", "focus": {"demo": demo, "entities": E}}
    if len(E["etfs"]) >= 2:
        a, b = E["etfs"][:2]
        return {"type": "compare", "tools": [T("top10_overlap", a=a, b=b), T("get_return", etfs=[a, b], period=E["period"] or "1y")], "reason": "比較兩檔 ETF", "focus": {"entities": E}}
    if E["companies"] and has("站|轉乘|經過|哪些線|哪幾檔|哪些 ?ETF"):
        return {"type": "company", "tools": [T("get_stock_info", company=E["companies"][0])], "reason": "查詢持有這家公司的 ETF", "focus": {"station": True, "entities": E}}
    if E["companies"] and not KB_RE.search(q.replace(E["companies"][0], "")):
        return {"type": "company", "tools": [T("get_stock_info", company=E["companies"][0])], "reason": "查詢公司今日狀況", "focus": {"entities": E}}
    if has("晚上|夜景|夜晚|天黑|白天|早上|中午|下午|傍晚") or E["hour"] is not None:
        h = E["hour"] if E["hour"] is not None else 20.5 if has("晚上|夜景|夜晚|天黑") else 18 if has("傍晚") else 9.5 if has("早上") else 12.5 if has("中午") else 14.5
        return {"type": "scene", "scene": [{"name": "set_time", "args": {"hour": max(8, min(22, h))}}], "reason": "切換時間", "focus": {"entities": E}}
    if len(E["etfs"]) == 1 and not (KB_RE.search(q) and not has("報酬|績效|漲了|跌了|前十大|成分股|持股|持有")):
        k = E["etfs"][0]
        if has("報酬|績效|漲了多少|跌了多少|漲幅|跌幅") or E["period"]:
            return {"type": "number", "tools": [T("get_return", etfs=[k], period=E["period"] or "1y")], "reason": "查詢區間報酬", "focus": {"entities": E, "only_return": True}}
        return {"type": "number", "tools": [T("get_etf_info", etf=k), T("get_top10_holdings", etf=k), T("get_return", etfs=[k], period="1y")], "reason": "介紹這檔 ETF", "focus": {"entities": E}}
    if has("總覽|全部|回到|重置|重來|整個城市|全城|看全部"):
        return {"type": "scene", "scene": [{"name": "reset", "args": {}}], "reason": "回到總覽", "focus": {"entities": E}}
    if KB_RE.search(q):
        return {"type": "concept", "tools": [T("search_knowledge", query=q)], "reason": "觀念題，檢索知識庫", "focus": {"entities": E}}
    if has("今天|今日|大盤|市場|怎麼了|發生|新聞|日報|下雨|煙火|港區|園區|金融區|科技區|行情") or E["district"]:
        return {"type": "market", "tools": [T("market_summary", district=E["district"])], "reason": "今日市場摘要", "focus": {"entities": E}}
    return {"type": "help", "tools": [], "reason": "無法判斷問題類型", "focus": {"greeting": has(r"^(嗨|哈囉|你好|您好|hi|hello|hey)"), "entities": E}}


def planner_prompt() -> str:
    s = get_store()
    etfs = "、".join(f"{k} ({e['name']}，{e['type']})" for k, e in s.etfs.items())
    return f"""你是 ETF 問答系統的 Planner。你的工作是把使用者的問題變成 JSON 執行計畫，不要回答問題本身，也不要計算任何數字。

可用的 ETF：{etfs}
城市裡的公司：{'、'.join(s.companies)}

資料工具 (只能用這些)：
- get_etf_info(etf)：ETF 基本資料
- get_top10_holdings(etf)：前十大成分股與權重
- top10_overlap(a, b)：兩檔 ETF 前十大的共同持股與重疊權重
- get_return(etfs: list, period)：價格報酬 (未含息)。period 只能是 1m, 3m, 6m, 1y, 3y, 5y, ytd, max
- simulate_dca(etf, monthly, start)：定期定額回測。monthly 是每月金額 (整數)，start 是 "YYYY-MM"
- lookthrough(positions)：穿透持股。positions 是 {{"ETF 代號": 金額}}
- get_stock_info(company)：公司今日漲跌與哪些 ETF 持有它
- market_summary(district?)：今日市場摘要。district 可省略，或是 semi, tech, fin, port, life
- search_knowledge(query)：檢索 ETF 觀念文件

問題類型 type：
- concept：觀念題 (名詞解釋、制度、費用) → search_knowledge
- number：單一 ETF 的數字 (報酬、成分股) 
- compare：比較兩檔 ETF → top10_overlap 加 get_return
- scenario：情境模擬 (定期定額) → simulate_dca
- portfolio：使用者說出自己的持股與金額 → lookthrough
- company：問某家公司
- market：問今天的市場
- scene：只是要操作畫面 (切換白天晚上、回到總覽)，tools 留空，scene 用 set_time(hour) 或 reset
- refuse：預測漲跌、報明牌、問該不該買賣、要求保證獲利、槓桿借錢投資。tools 可以放 get_return 提供歷史資料
- help：和 ETF 無關或看不懂

規則：
1. 只輸出一個 JSON 物件，格式：{{"type": "...", "tools": [{{"name": "...", "args": {{...}}}}], "scene": [], "reason": "一句話說明"}}
2. ETF 一律用代號。使用者沒有說金額或起始時間時，monthly 用 5000，start 用 "2020-01"。
3. 不要發明工具或參數。不確定就用 help。
4. scene 通常留空陣列，系統會依工具結果自動決定畫面動作。

範例：
問：0050 跟 00878 差在哪？
答：{{"type": "compare", "tools": [{{"name": "top10_overlap", "args": {{"a": "0050", "b": "00878"}}}}, {{"name": "get_return", "args": {{"etfs": ["0050", "00878"], "period": "1y"}}}}], "scene": [], "reason": "比較兩檔 ETF 的持股與報酬"}}
問：每月一萬買 0056，從 2021 年開始會怎樣？
答：{{"type": "scenario", "tools": [{{"name": "simulate_dca", "args": {{"etf": "0056", "monthly": 10000, "start": "2021-01"}}}}], "scene": [], "reason": "定期定額回測"}}
問：0056 明天會漲嗎？
答：{{"type": "refuse", "tools": [{{"name": "get_return", "args": {{"etfs": ["0056"], "period": "1y"}}}}], "scene": [], "reason": "預測漲跌，拒答並提供歷史資料"}}
問：什麼是收益平準金？
答：{{"type": "concept", "tools": [{{"name": "search_knowledge", "args": {{"query": "收益平準金"}}}}], "scene": [], "reason": "觀念題"}}"""


def llm_plan(llm, model: str, q: str, ctx: dict | None = None) -> tuple[Plan | None, list[dict]]:
    """呼叫 LLM 規劃。驗證失敗時把錯誤告訴模型重新規劃一次。回傳 (計畫或 None, 嘗試紀錄)"""
    from .llm import parse_json
    msgs = [{"role": "system", "content": planner_prompt()}]
    if ctx:
        msgs.append({"role": "system", "content": f"上一題的內容 (使用者可能用「換成…呢」延續)：{ctx}"})
    msgs.append({"role": "user", "content": q}); log = []
    for attempt in range(2):
        try:
            raw = llm.chat(model, msgs, json_mode=True, temperature=0.0, max_tokens=600); obj = parse_json(raw)
        except Exception as e:
            log.append({"attempt": attempt + 1, "error": f"輸出不是合法 JSON: {e}"}); raw, obj = "", None
        if obj is not None:
            plan, err = validate_plan(obj)
            if plan:
                log.append({"attempt": attempt + 1, "ok": True}); return plan, log
            log.append({"attempt": attempt + 1, "error": err})
        msgs += [{"role": "assistant", "content": raw or "(無)"}, {"role": "user", "content": f"上面的計畫不合法：{log[-1]['error']}。請只輸出修正後的 JSON。"}]
    return None, log
