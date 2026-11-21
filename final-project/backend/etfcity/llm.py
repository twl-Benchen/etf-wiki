"""LLM 呼叫。provider: groq (aisuite 或直接 HTTP) / mock (不呼叫 LLM，Agent 改走規則版)。
回應會存成 JSON 快取，重跑實驗時不必重新呼叫。"""
from __future__ import annotations
import hashlib, json, os, time
from .config import CACHE_DIR, LLM_PROVIDER


class LLMError(RuntimeError):
    pass


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
        if json_mode:
            kw["response_format"] = {"type": "json_object"}
        if self.client is not None and not any(isinstance(m.get("content"), list) for m in messages):
            r = self.client.chat.completions.create(model=f"groq:{model}", messages=messages, **kw)
            return r.choices[0].message.content or ""
        import requests
        r = requests.post("https://api.groq.com/openai/v1/chat/completions", timeout=60,
                          headers={"Authorization": f"Bearer {self.key}"}, json={"model": model, "messages": messages, **kw})
        if r.status_code != 200:
            raise LLMError(f"Groq {r.status_code}: {r.text[:200]}")
        return r.json()["choices"][0]["message"]["content"] or ""


class MockLLM:
    """不呼叫任何模型。Agent 看到 mock 就直接用規則版 Planner 與模板 Writer。"""
    name = "mock"
    calls = 0

    def chat(self, *a, **k) -> str:
        raise LLMError("mock provider 不產生文字")


def get_llm(provider: str | None = None):
    provider = provider or LLM_PROVIDER
    return GroqLLM() if provider == "groq" else MockLLM()


def to_tw(text: str) -> str:
    """輸出統一成台灣繁體用語 (有裝 OpenCC 才轉換)"""
    try:
        from opencc import OpenCC  # type: ignore
        return OpenCC("s2twp").convert(text)
    except Exception:
        return text


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
