import re, pytest
from fastapi.testclient import TestClient
from etfcity.agent import Agent
from etfcity.api import app
from etfcity.checker import fill_and_check
from etfcity.data import get_store
from etfcity.facts import Fact, FactBook
from etfcity.planner import rule_plan, extract, parse_cn
from etfcity.rag import get_kb
from etfcity.schemas import validate_plan
from etfcity import tools

S = get_store(); A = Agent(); C = TestClient(app)
QS = ["今天城市怎麼了？", "台積電今天怎麼了？", "聯發科站有哪些線經過？", "0050 跟 006208 差在哪？", "0056 跟 00878 差在哪？", "0056 前十大是哪些？", "什麼是收益平準金？",
      "市值型跟高股息差在哪？", "0056 明天會漲嗎？", "晚上的城市長怎樣？", "切回白天", "為什麼港區在放煙火？", "改成 0050 20萬、00878 40萬", "我的持股", "回到全城", "嗨",
      "每月 5000 買 0050，從 2020 到現在會怎樣？", "每月五千存0056從2022年開始", "我有 30萬的0050、20萬的00919", "0050 近三年報酬", "00919 今年以來績效", "什麼是量子糾纏？", "00878 最近換股換了什麼？", "0050 的前十大有什麼變化？"]


def test_overlap_definition():
    r = tools.top10_overlap("0050", "00878"); A_, B_ = S.weights("0050"), S.weights("00878")
    exp = round(sum(min(A_[n], B_[n]) for n in A_ if n in B_), 2)
    f = {x.id: x.value for x in r.facts}
    assert f["overlap_weight_0050_00878"] == exp and f["overlap_count_0050_00878"] == len([n for n in A_ if n in B_])
    assert tools.top10_overlap("00878", "0050").facts[1].value == exp


def test_return_matches_prices():
    r = tools.get_return(["0050"], "1y"); f = {x.id: x.value for x in r.facts}
    p0 = S.price_on_or_before("0050", f["ret_1y_0050_from"])[1]; p1 = S.prices["0050"][1][-1]
    assert f["ret_1y_0050"] == round((p1 / p0 - 1) * 100, 2) and f["ret_1y_0050_to"] == S.last_date("0050")


def test_dca_invested_and_value():
    r = tools.simulate_dca("0050", 5000, "2020-01"); f = {x.id: x.value for x in r.facts}; rows = S.monthly_first("0050", "2020-01")
    assert f["dca_0050_invested"] == 5000 * len(rows) == 5000 * f["dca_0050_n"]
    sh = sum(5000 / p for _, p in rows); assert f["dca_0050_value"] == round(sh * S.prices["0050"][1][-1])
    assert r.data["_series"][-1]["val"] == f["dca_0050_value"]


def test_lookthrough_sums():
    r = tools.lookthrough({"0050": 300000, "0056": 100000}); f = {x.id: x.value for x in r.facts}
    assert f["lt_total"] == 400000 and abs(f["lt_covered"] + f["lt_rest"] - 100) < 0.11
    tsmc = 300000 * S.weights("0050")["台積電"] / 100 / 400000 * 100
    assert f["lt_share_2330"] == round(tsmc, 1)


def test_validation_rejects_bad_plans():
    for bad in [{"type": "number", "tools": [{"name": "os_system", "args": {}}]}, {"type": "number", "tools": [{"name": "get_return", "args": {"etfs": ["9999"]}}]},
                {"type": "scenario", "tools": [{"name": "simulate_dca", "args": {"etf": "0050", "monthly": -5, "start": "2020-01"}}]},
                {"type": "scenario", "tools": [{"name": "simulate_dca", "args": {"etf": "0050", "start": "2020/1"}}]},
                {"type": "compare", "tools": [{"name": "top10_overlap", "args": {"a": "0050", "b": "0050"}}]},
                {"type": "scene", "scene": [{"name": "delete_everything", "args": {}}]}, {"type": "hack"}]:
        plan, err = validate_plan(bad); assert plan is None and err


def test_checker():
    b = FactBook(); b.add_all([Fact("ret_a", 5.21, "pct_signed", "x"), Fact("n", 3, "count:家", "y")])
    ok = fill_and_check("0050 的報酬是 {ret_a}，共有 {n}重疊，前十大。", b); assert ok["ok"] and "+5.21%" in ok["text"] and "3 家" in ok["text"]
    assert not fill_and_check("報酬是 {ret_b}。", b)["ok"]
    bad = fill_and_check("報酬是 {ret_a}，另一檔是 8.3%。", b); assert not bad["ok"] and bad["stray"]
    assert not fill_and_check("投入 325,000 元。", b)["ok"]
    assert fill_and_check("賣出要繳 0.1% 的證交稅。", b, allowed_text="證交稅率是 0.1%")["ok"]
    assert fill_and_check("報酬 {ret_a}%。", b)["text"].count("%") == 1


def test_parse_amounts():
    assert parse_cn("五千") == 5000 and parse_cn("一萬五") == 15000 and parse_cn("三十萬") == 300000
    e = extract("我有 0050 30萬、0056 10萬"); assert e["pairs"] == {"0050": 300000, "0056": 100000}
    e = extract("30萬的0050、20萬的00878"); assert e["pairs"] == {"0050": 300000, "00878": 200000}
    assert extract("每月 5,000 買元大高股息")["etfs"] == ["0056"] and extract("每月 5,000 買元大高股息")["amounts"] == [5000]


@pytest.mark.parametrize("q", QS)
def test_agent_answers_pass_number_check(q):
    r = A.ask(q); assert r["check"]["ok"], (q, r["check"], r["answer"]); assert r["answer"] and "{" not in r["answer"]
    for a in r["scene"]:
        assert a["name"] in {"focus_etfs", "fly_to", "mark_companies", "show_portfolio", "replay", "set_time", "reset"}


def test_refusal_and_guard():
    for q in ["0056 明天會漲嗎？", "推薦我一檔必賺的 ETF", "我該不該現在梭哈 0050", "借錢買 00878 可以嗎"]:
        r = A.ask(q); assert r["refused"] and "不會預測" in r["answer"], q
    assert not A.ask("0050 近一年報酬")["refused"]


def test_context_followup():
    r1 = A.ask("每月 3000 買 0050，從 2021 到現在會怎樣？"); r2 = A.ask("換成 00878 呢？", r1["context"])
    t = r2["plan"]["tools"][0]; assert t["name"] == "simulate_dca" and t["args"]["etf"] == "00878" and t["args"]["monthly"] == 3000


def test_kb():
    kb = get_kb(); assert len(kb.docs) >= 30
    assert kb.search("什麼是收益平準金？")[0]["title"] == "收益平準金" and kb.search("折價溢價是什麼")[0]["title"] == "折溢價"
    assert kb.search("什麼是量子糾纏？") == []
    assert "找不到" in A.ask("什麼是量子糾纏？")["answer"]


def test_api():
    assert C.get("/api/health").json()["ok"]
    b = C.get("/api/city").json(); assert set(b["etfs"]) == set(S.etfs) and len(b["companies"]) == len(S.city_companies())
    r = C.post("/api/ask", json={"question": "0050 跟 00878 差在哪？"}).json(); assert r["type"] == "compare" and r["scene"][0]["name"] == "focus_etfs"
    r = C.post("/api/portfolio/lookthrough", json={"positions": {"0050": 100000}}).json(); assert r["type"] == "portfolio" and r["check"]["ok"]
    assert C.post("/api/portfolio/lookthrough", json={"positions": {"9999": 1}}).status_code == 422
    assert C.post("/api/ask", json={"question": ""}).status_code == 422
