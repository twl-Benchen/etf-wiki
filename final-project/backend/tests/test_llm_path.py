"""用假的 LLM 測 LLM 路徑：計畫驗證失敗會重試、Writer 寫了沒有編號的數字會被退回、最後仍不合格改用模板。"""
import json
from etfcity.agent import Agent


class FakeLLM:
    name = "fake"

    def __init__(self, plans, drafts):
        self.plans, self.drafts, self.calls = list(plans), list(drafts), []

    def chat(self, model, messages, json_mode=False, **kw):
        self.calls.append((model, json_mode))
        return self.plans.pop(0) if json_mode else self.drafts.pop(0)


GOOD_PLAN = json.dumps({"type": "compare", "tools": [{"name": "top10_overlap", "args": {"a": "0050", "b": "00878"}}, {"name": "get_return", "args": {"etfs": ["0050", "00878"], "period": "1y"}}], "scene": [], "reason": "比較"})
BAD_PLAN = json.dumps({"type": "compare", "tools": [{"name": "run_python", "args": {"code": "rm -rf /"}}]})


def test_plan_retry_then_writer_feedback():
    drafts = ["0050 和 00878 重疊權重是 8.2%，差很多。",                                  # 自己寫數字 → 退回
              "兩檔前十大有 {overlap_count_0050_00878}重疊，重疊權重 {overlap_weight_0050_00878}，近一年價格報酬 (未含息) 分別是 {ret_1y_0050} 和 {ret_1y_00878}。"]
    llm = FakeLLM([BAD_PLAN, GOOD_PLAN], drafts); a = Agent(llm=llm)
    r = a.ask("0050 跟 00878 差在哪？")
    p = r["trace"]["planner"]; w = r["trace"]["writer"]
    assert p["attempts"][0].get("error") and p["attempts"][1]["ok"] and not p.get("fallback")
    assert [x["ok"] for x in w["attempts"]] == [False, True] and w["final"] == "llm"
    assert r["check"]["ok"] and "8.2%" not in r["answer"].replace("8.20%", "") and "{" not in r["answer"]
    assert [m for m, j in llm.calls] == ["openai/gpt-oss-20b", "openai/gpt-oss-20b", "openai/gpt-oss-120b", "openai/gpt-oss-120b"]


def test_planner_fails_twice_falls_back_to_rules_and_writer_falls_back_to_template():
    llm = FakeLLM(["不是 JSON", BAD_PLAN], ["報酬是 99.9%", "還是 99.9%"]); a = Agent(llm=llm)
    r = a.ask("0050 跟 00878 差在哪？")
    assert r["trace"]["planner"]["fallback"] == "rule" and r["type"] == "compare"
    assert r["trace"]["writer"]["final"] == "template" and r["check"]["ok"] and "99.9" not in r["answer"]


def test_guard_overrides_llm_plan():
    plan = json.dumps({"type": "number", "tools": [{"name": "get_return", "args": {"etfs": ["0056"], "period": "1y"}}], "scene": []})
    llm = FakeLLM([plan], ["我不會預測漲跌。0056 近一年價格報酬 {ret_1y_0056} (未含息)。"]); a = Agent(llm=llm)
    r = a.ask("0056 明天會漲嗎？")
    assert r["refused"] and r["type"] == "refuse" and r["trace"]["planner"]["guard"]


def test_unknown_placeholder_rejected():
    llm = FakeLLM([GOOD_PLAN], ["重疊 {overlap_weight_0050_00878}，報酬 {ret_5y_0050}。", "重疊 {overlap_weight_0050_00878}，前十大。"]); a = Agent(llm=llm)
    r = a.ask("0050 跟 00878 差在哪？"); w = r["trace"]["writer"]["attempts"]
    assert "ret_5y_0050" in w[0]["message"] and w[1]["ok"]


def test_empty_llm_answer_falls_back_and_parens():
    from etfcity.llm import halfwidth_parens
    assert halfwidth_parens("報酬（未含息）。（註）") == "報酬 (未含息)。(註)"

    class Empty:
        name = "fake"
        def chat(self, model, messages, **k):
            return "" if "Writer" not in model else ""
    from etfcity.agent import Agent
    a = Agent(llm=Empty())
    r = a.ask("0050 跟 00878 差在哪？")
    assert r["answer"].strip() and r["trace"]["writer"]["final"] == "template"
