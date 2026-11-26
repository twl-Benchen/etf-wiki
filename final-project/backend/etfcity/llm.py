"""LLM 呼叫。provider: groq (aisuite 或直接 HTTP) / mock (不呼叫 LLM，Agent 改走規則版)。
回應會存成 JSON 快取，重跑實驗時不必重新呼叫。"""
from __future__ import annotations
import hashlib, json, os, time
from .config import CACHE_DIR, LLM_PROVIDER


class LLMError(RuntimeError):
    pass


REASONING_EFFORT = os.environ.get("ETFCITY_REASONING_EFFORT", "low")
REASONING_EXTRA = 1500   # 推理模型 (gpt-oss) 先用 token 思考，再寫答案；上限要多留這些，否則答案會是空的


def is_reasoning(model: str) -> bool:
    return "gpt-oss" in model


class GroqLLM:
    name = "groq"

    def __init__(self, cache: bool = True):
        self.key = os.environ.get("GROQ_API_KEY", "")
        self.cache = cache
        self.calls = 0
        try:
            import aisuite  # type: ignore
            self.client = aisuite.Client()
        except Exception:
            self.client = None

    def _cache_path(self, payload: dict):
        h = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:24]
        return CACHE_DIR / f"{h}.json"

    def chat(self, model: str, messages: list[dict], json_mode: bool = False, temperature: float = 0.2, max_tokens: int = 1200) -> str:
        payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "json": json_mode}
        p = self._cache_path(payload)
        if self.cache and p.exists():
            return json.loads(p.read_text(encoding="utf-8"))["text"]
        if not self.key:
            raise LLMError("沒有設定 GROQ_API_KEY")
        last = None
        for attempt in range(3):
            try:
                text = self._call(model, messages, json_mode, temperature, max_tokens); self.calls += 1
                if self.cache:
                    CACHE_DIR.mkdir(parents=True, exist_ok=True)
                    p.write_text(json.dumps({"payload": payload, "text": text}, ensure_ascii=False), encoding="utf-8")
                return text
            except Exception as e:  # 額度或網路問題，稍等再試
                last = e; time.sleep(2 + 4 * attempt)
        raise LLMError(str(last))

    def _call(self, model, messages, json_mode, temperature, max_tokens) -> str:
        kw = {"temperature": temperature, "max_tokens": max_tokens}
        if is_reasoning(model):
            kw.update(max_tokens=max_tokens + REASONING_EXTRA, reasoning_effort=REASONING_EFFORT)
        if json_mode:
            kw["response_format"] = {"type": "json_object"}
        if self.client is not None and not any(isinstance(m.get("content"), list) for m in messages):
            r = self.client.chat.completions.create(model=f"groq:{model}", messages=messages, **kw)
            return _need_text(r.choices[0].message.content, getattr(r.choices[0], "finish_reason", ""))
        import requests
        r = requests.post("https://api.groq.com/openai/v1/chat/completions", timeout=60,
                          headers={"Authorization": f"Bearer {self.key}"}, json={"model": model, "messages": messages, **kw})
        if r.status_code != 200:
            raise LLMError(f"Groq {r.status_code}: {r.text[:200]}")
        c = r.json()["choices"][0]
        return _need_text(c["message"].get("content"), c.get("finish_reason", ""))


def _need_text(text, finish: str = "") -> str:
    """空白回答 (通常是 token 都用在推理上) 當成錯誤，不寫進快取，由呼叫端重試或退回規則版"""
    if not (text or "").strip():
        raise LLMError(f"模型沒有產生文字 (finish_reason={finish or '?'})")
    return text


class MockLLM:
    """不呼叫任何模型。Agent 看到 mock 就直接用規則版 Planner 與模板 Writer。"""
    name = "mock"
    calls = 0

    def chat(self, *a, **k) -> str:
        raise LLMError("mock provider 不產生文字")


def get_llm(provider: str | None = None):
    provider = provider or LLM_PROVIDER
    return GroqLLM() if provider == "groq" else MockLLM()


_CC = None


def _protected() -> list[str]:
    """不能被轉換的專有名稱：公司與 ETF 名稱 (例如台積電不能變成臺積電，臺企銀本來就是臺)"""
    from .data import get_store
    s = get_store()
    return sorted({*s.companies, *(e["name"] for e in s.etfs.values())}, key=len, reverse=True)


def to_tw(text: str) -> str:
    """LLM 可能夾雜簡體字，統一成台灣繁體用語 (有裝 OpenCC 才轉換)。
    s2twp 會把「台」轉成「臺」，所以先保護專有名稱，轉完後一般用字的「臺」改回台灣慣用的「台」。"""
    global _CC
    try:
        from opencc import OpenCC  # type: ignore
        _CC = _CC or OpenCC("s2twp")
    except Exception:
        return halfwidth_parens(text)
    keep = {}
    for i, n in enumerate(_protected()):
        if n in text:
            k = f"\uE000{i}\uE001"; keep[k] = n; text = text.replace(n, k)
    out = _CC.convert(text).replace("臺", "台")
    for a, b in OPENCC_FIX:
        out = out.replace(a, b)
    out = halfwidth_parens(out)
    for k, n in keep.items():
        out = out.replace(k, n)
    return out


# s2twp 偶爾把「只」轉成「隻」(例如「前十大只有」變成「前十大隻有」)
OPENCC_FIX = [("隻有", "只有"), ("隻是", "只是"), ("隻算", "只算"), ("隻計", "只計"), ("隻佔", "只佔"), ("隻占", "只占"), ("隻在", "只在"), ("隻要", "只要"), ("隻能", "只能")]


def halfwidth_parens(text: str) -> str:
    """介面規定括號用半形：（…） 改成 (…)，左括號前補一個空白"""
    import re
    text = re.sub(r"\s*（", " (", text).replace("）", ")")
    text = re.sub(r"([。，、；：！？「『])\s+\(", r"\1(", text)   # 標點後面不用空白
    text = re.sub(r"\)(?=[0-9A-Za-z\u4e00-\u9fff+\-])", ") ", text)
    return re.sub(r"^ \(", "(", text, flags=re.M)


def parse_json(text: str) -> dict:
    """容錯解析：去掉 ```json 區塊與前後雜訊"""
    t = text.strip()
    if "```" in t:
        t = t.split("```")[1]
        t = t[4:] if t.startswith("json") else t
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j < 0:
        raise ValueError("找不到 JSON")
    return json.loads(t[i:j + 1])
