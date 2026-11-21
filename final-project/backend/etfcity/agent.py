"""Agent 主流程：Planner → 驗證 → 執行工具 → Writer → 數字填入與檢查 → 畫面動作。"""
from __future__ import annotations
import time
from . import config
from .facts import FactBook, ToolResult
from .llm import get_llm, to_tw, LLMError
from .planner import rule_plan, llm_plan, is_refusal
from .schemas import validate_plan, Plan
from .tools import TOOLS
from .writer import template_write, writer_messages, role_of, footer
from .checker import fill_and_check
from .scene import derive_scene, followups

HELP_PLAN = {"type": "help", "tools": [], "reason": "計畫驗證失敗"}


class Agent:
    """mode: full (工具 + RAG + 數字填入與檢查) / rag_only (只有 RAG) / llm_only (純 LLM)。後兩種只用在實驗一的對照組。"""

    def __init__(self, llm=None, planner_model: str | None = None, writer_model: str | None = None, mode: str = "full"):
        self.llm = llm or get_llm(); self.mode = mode
        self.planner_model = planner_model or config.PLANNER_MODEL; self.writer_model = writer_model or config.WRITER_MODEL

    # ---------- 規劃 ----------
    def plan(self, q: str, ctx: dict | None, trace: dict) -> Plan:
        guard = is_refusal(q)   # 規則版拒答守門，和 LLM 的判斷各自獨立
        plan = None
        if self.llm.name != "mock":
            try:
                plan, log = llm_plan(self.llm, self.planner_model, q, ctx); trace["planner"] = {"by": self.planner_model, "attempts": log}
            except LLMError as e:
                trace["planner"] = {"by": self.planner_model, "error": str(e)}
        if plan is None:
            obj = rule_plan(q, ctx); plan, err = validate_plan(obj)
            trace.setdefault("planner", {})["fallback"] = "rule"
            if plan is None:
                trace["planner"]["rule_error"] = err; plan, _ = validate_plan(HELP_PLAN)
        if guard and plan.type != "refuse":
            keep = [t for t in plan.tools if t.name == "get_return"][:1]
            plan = Plan(type="refuse", tools=keep, reason="規則守門：預測漲跌或投資建議"); trace["planner"]["guard"] = True
        return plan

    # ---------- 執行 ----------
    def run_tools(self, plan: Plan) -> list[ToolResult]:
        out = []
        for call in plan.tools:
            try:
                out.append(TOOLS[call.name](**call.args))
            except Exception as e:  # 工具出錯不讓整個回答失敗
                out.append(ToolResult(call.name, call.args, ok=False, error=f"{call.name} 執行失敗：{e}"))
        return out

    # ---------- 撰寫與檢查 ----------
    def write(self, plan: Plan, results: list[ToolResult], book: FactBook, q: str, role: dict, trace: dict) -> dict:
        kb = next((r for r in results if r.name == "search_knowledge" and r.ok), None)
        allowed = "\n".join(d["text"] for d in kb.data["_docs"][:2]) if kb else ""
        attempts = []
        if self.llm.name != "mock" and plan.type not in ("scene", "help"):
            feedback = ""
            for i in range(2):
                try:
                    draft = self.llm.chat(self.writer_model, writer_messages(plan, results, book, q, role, feedback), temperature=0.3, max_tokens=700)
                except LLMError as e:
                    attempts.append({"by": self.writer_model, "error": str(e)}); break
                chk = fill_and_check(draft.strip(), book, allowed)
                attempts.append({"by": self.writer_model, "draft": draft.strip(), "ok": chk["ok"], "message": chk["message"]})
                if chk["ok"]:
                    trace["writer"] = {"attempts": attempts, "final": "llm"}; return chk
                feedback = chk["message"]
        draft = template_write(plan, results, q); chk = fill_and_check(draft, book, allowed)
        attempts.append({"by": "template", "draft": draft, "ok": chk["ok"], "message": chk["message"]})
        trace["writer"] = {"attempts": attempts, "final": "template"}
        return chk

    # ---------- 對外 ----------
    def ask(self, question: str, context: dict | None = None) -> dict:
        t0 = time.time(); q = (question or "").strip()[:500]; trace: dict = {}
        if self.mode != "full":
            return self._baseline(q, t0)
        plan = self.plan(q, context, trace)
        return self.answer_plan(plan, q, trace, t0)

    def answer_plan(self, plan: Plan, q: str, trace: dict | None = None, t0: float | None = None) -> dict:
        """執行一份已驗證的計畫 (ask 的後半段；持股確認後也直接走這裡)"""
        trace = trace if trace is not None else {}; t0 = t0 or time.time()
        results = self.run_tools(plan)
        book = FactBook()
        for r in results:
            book.add_all(r.facts)
        role = role_of(plan, results)
        chk = self.write(plan, results, book, q, role, trace)
        scene = derive_scene(plan, results)
        dca = next((r for r in results if r.name == "simulate_dca" and r.ok), None)
        ctx = {"type": plan.type}
        if dca:
            ctx.update(etf=dca.args["etf"], monthly=dca.args["monthly"], start=dca.args["start"])
        return {
            "question": q, "answer": to_tw(chk["text"]), "role": role, "type": plan.type, "refused": plan.type == "refuse",
            "plan": {"type": plan.type, "tools": [c.model_dump() for c in plan.tools], "scene": [a["name"] for a in scene], "reason": plan.reason},
            "tool_results": [r.to_dict() for r in results], "facts": book.to_dict(), "scene": scene,
            "check": {"ok": chk["ok"], "used": chk["used"], "unknown": chk["unknown"], "stray": chk["stray"]},
            "sources": footer(results), "notes": list(dict.fromkeys(r.note for r in results if r.note)), "followups": followups(plan, results),
            "context": ctx, "trace": trace, "llm": self.llm.name, "elapsed": round(time.time() - t0, 3),
        }

    def _baseline(self, q: str, t0: float) -> dict:
        """實驗一的對照組：A 純 LLM、B 只有 RAG。不經過工具與數字檢查。"""
        sys = "你是 ETF 問答助理，用繁體中文回答，三到六句話。不預測漲跌、不建議買賣。"
        msgs = [{"role": "system", "content": sys}]; src = []
        if self.mode == "rag_only":
            r = TOOLS["search_knowledge"](query=q)
            if r.ok:
                msgs.append({"role": "system", "content": "參考文件：\n" + "\n\n".join(f"《{d['title']}》\n{d['text'][:1500]}" for d in r.data["_docs"][:2])}); src = r.sources
        msgs.append({"role": "user", "content": q})
        ans = self.llm.chat(self.writer_model, msgs, temperature=0.3, max_tokens=700)
        return {"question": q, "answer": to_tw(ans.strip()), "type": self.mode, "facts": {}, "scene": [], "sources": src, "check": None,
                "refused": None, "llm": self.llm.name, "elapsed": round(time.time() - t0, 3)}
