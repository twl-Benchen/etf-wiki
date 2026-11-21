"""Gradio 展示：看得到 Agent 的計畫、工具結果、畫面動作與數字檢查。
本機執行：cd backend && python app_gradio.py"""
import json
import gradio as gr
from etfcity.agent import Agent
from etfcity.data import get_store

AGENT = Agent(); S = get_store()
EXAMPLES = ["0050 跟 00878 差在哪？", "每月 5000 買 0050，從 2020 到現在會怎樣？", "我有 0050 30萬、0056 10萬、00878 20萬", "什麼是收益平準金？", "0056 明天會漲嗎？", "台積電今天怎麼了？", "0050 近三年報酬"]


def slim(o, depth=0):
    if isinstance(o, list):
        return [slim(x, depth + 1) for x in o[:8]] + ([f"…共 {len(o)} 筆"] if len(o) > 8 else [])
    if isinstance(o, dict):
        return {k: slim(v, depth + 1) for k, v in o.items() if not k.startswith("_") and k != "series"}
    return o


def run(q, ctx):
    r = AGENT.ask(q, ctx or None)
    chk = r["check"]; w = r["trace"].get("writer", {})
    answer = f"**{r['role']['name']}**\n\n{r['answer']}\n\n" + "".join(f"- 來源：{s}\n" for s in r["sources"])
    facts = [[k, f["text"], f["label"], f["source"]] for k, f in r["facts"].items()]
    drafts = "\n\n".join(f"【第 {i + 1} 版，{a.get('by')}】{'通過' if a.get('ok') else '未通過：' + a.get('message', a.get('error', ''))}\n{a.get('draft', '')}" for i, a in enumerate(w.get("attempts", [])))
    check = f"{'通過' if chk['ok'] else '未通過'}｜使用的編號 {len(chk['used'])} 個｜不存在的編號 {chk['unknown']}｜沒有來源的數字 {chk['stray']}｜最後採用：{w.get('final')}｜LLM：{r['llm']}"
    return answer, json.dumps(r["plan"], ensure_ascii=False, indent=1), json.dumps(r["trace"].get("planner", {}), ensure_ascii=False, indent=1), \
        json.dumps(slim(r["tool_results"]), ensure_ascii=False, indent=1), facts, drafts, check, json.dumps(slim(r["scene"]), ensure_ascii=False, indent=1), r["context"]


with gr.Blocks(title="ETF 都會 Agent") as demo:
    gr.Markdown(f"# ETF 都會 Agent\n數字由程式計算並以編號填入，LLM 不直接寫數字。支援的 ETF：{'、'.join(S.etfs)}。\n\n本系統只說明資料，不提供投資建議，也不預測漲跌。")
    ctx = gr.State({})
    with gr.Row():
        q = gr.Textbox(label="問題", placeholder="例如：0050 跟 00878 差在哪？", scale=5); btn = gr.Button("送出", variant="primary", scale=1)
    gr.Examples(EXAMPLES, q)
    ans = gr.Markdown(label="回答")
    with gr.Accordion("① 規劃 (Planner 輸出的計畫，已通過驗證)", open=True):
        plan = gr.Code(language="json"); plog = gr.Code(language="json", label="規劃過程")
    with gr.Accordion("② 工具結果", open=False):
        tools_out = gr.Code(language="json")
    with gr.Accordion("③ 有編號的數字 (facts)", open=True):
        facts = gr.Dataframe(headers=["編號", "值", "意義", "來源"], wrap=True)
    with gr.Accordion("④ Writer 草稿與 ⑤ 數字填入與檢查", open=True):
        drafts = gr.Textbox(label="草稿 (數字的位置是 {編號})", lines=6); check = gr.Textbox(label="檢查結果")
    with gr.Accordion("⑥ 畫面動作 (交給前端執行)", open=False):
        scene = gr.Code(language="json")
    outs = [ans, plan, plog, tools_out, facts, drafts, check, scene, ctx]
    btn.click(run, [q, ctx], outs); q.submit(run, [q, ctx], outs)

if __name__ == "__main__":
    demo.launch()
