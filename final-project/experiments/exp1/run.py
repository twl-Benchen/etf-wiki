"""實驗一：四種系統配置跑同一份題庫。
  A 純 LLM          Agent(mode="llm_only")
  B 只有 RAG        Agent(mode="rag_only")
  C 完整版          Agent(mode="full")  (Planner 20b、Writer 120b、工具、數字填入與檢查)
  D 完整版，Writer 改用 20b
沒有 GROQ_API_KEY 時只能跑 C_rule (規則版 Planner 與模板 Writer)，當作流程檢查。
LLM 回應有 JSON 快取 (.cache_llm/)，重跑不會重複扣額度；中斷後重跑會跳過已完成的題目。
用法：python experiments/exp1/run.py A B C D    或    python experiments/exp1/run.py C_rule"""
import json, os, sys, time
from pathlib import Path
H = Path(__file__).resolve().parent; sys.path.insert(0, str(H.parents[1] / "backend"))
from etfcity import config
from etfcity.agent import Agent
from etfcity.llm import get_llm, MockLLM

CONFIGS = {"A": dict(mode="llm_only"), "B": dict(mode="rag_only"), "C": dict(mode="full"), "D": dict(mode="full", writer_model="openai/gpt-oss-20b"), "C_rule": dict(mode="full")}


def run(name: str):
    llm = MockLLM() if name == "C_rule" else get_llm("groq")
    if name != "C_rule" and not os.environ.get("GROQ_API_KEY"):
        print(f"[{name}] 略過：沒有 GROQ_API_KEY"); return
    agent = Agent(llm=llm, **CONFIGS[name])
    qs = json.load(open(H / "questions.json", encoding="utf-8"))["questions"]
    out = H / "results" / f"{name}.jsonl"; out.parent.mkdir(exist_ok=True)
    done = {json.loads(l)["id"] for l in open(out, encoding="utf-8")} if out.exists() else set()
    with open(out, "a", encoding="utf-8") as f:
        for q in qs:
            if q["id"] in done:
                continue
            t0 = time.time()
            try:
                r = agent.ask(q["question"]); err = ""
            except Exception as e:  # 額度用完等錯誤：記下來，下次重跑會再試
                print(f"[{name}] {q['id']} 失敗：{e}"); break
            rec = {"id": q["id"], "config": name, "answer": r["answer"], "type_pred": r.get("type"), "refused": r.get("refused"), "check": r.get("check"),
                   "tools": [t["name"] for t in r.get("plan", {}).get("tools", [])] if r.get("plan") else [], "sources": r.get("sources", []),
                   "retrieved": [h["id"] for t in r.get("tool_results", []) if t["name"] == "search_knowledge" for h in t["data"].get("hits", [])],
                   "writer_final": r.get("trace", {}).get("writer", {}).get("final"), "planner_fallback": bool(r.get("trace", {}).get("planner", {}).get("fallback")),
                   "facts": {k: {"text": v["text"], "value": v["value"], "unit": v["unit"]} for k, v in (r.get("facts") or {}).items()},
                   "elapsed": round(time.time() - t0, 3), "error": err}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n"); f.flush()
            print(f"[{name}] {q['id']} {rec['elapsed']}s")


if __name__ == "__main__":
    for n in sys.argv[1:] or ["C_rule"]:
        run(n)
