"""第一次接上 Groq 時執行：確認金鑰、模型名稱、Planner 與 Writer 的真實輸出都正常。
用法：GROQ_API_KEY=... python scripts/check_groq.py"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
if not os.environ.get("GROQ_API_KEY"):
    sys.exit("請先設定環境變數 GROQ_API_KEY")
os.environ["ETFCITY_LLM"] = "groq"
from etfcity import config
from etfcity.agent import Agent
from etfcity.llm import GroqLLM

llm = GroqLLM(cache=False)
for m in (config.PLANNER_MODEL, config.WRITER_MODEL):
    try:
        print(f"[模型] {m} →", llm.chat(m, [{"role": "user", "content": "只回答：OK"}], max_tokens=20).strip()[:40])
    except Exception as e:
        print(f"[模型] {m} 失敗：{e}")
a = Agent(llm=llm); bad = 0
for q in ["0050 跟 00878 差在哪？", "每月一萬買 0056，從 2021 年開始會怎樣？", "什麼是收益平準金？", "0056 明天會漲嗎？", "我有 0050 30萬、00919 20萬", "聯發科今天怎麼了？", "0050 近三年報酬多少？"]:
    r = a.ask(q); p = r["trace"].get("planner", {}); w = r["trace"].get("writer", {})
    flag = "規則備援" if p.get("fallback") else "LLM"
    print(f"\n問：{q}\n  規劃：{flag} type={r['type']} tools={[t['name'] for t in r['plan']['tools']]} {p.get('attempts', '')}")
    print(f"  撰寫：{w.get('final')} (嘗試 {len(w.get('attempts', []))} 次) 檢查={'通過' if r['check']['ok'] else '未通過'}\n  答：{r['answer']}")
    bad += (flag != "LLM") + (w.get("final") != "llm")
print(f"\n完成。退回規則或模板的次數：{bad} (0 最好；偏多時把上面的輸出貼給 Claude 調整 prompt)")
