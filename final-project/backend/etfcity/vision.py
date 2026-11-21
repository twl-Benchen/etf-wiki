"""持股截圖辨識：看圖模型把券商庫存截圖讀成 JSON，使用者確認後才計算穿透持股。"""
from __future__ import annotations
import base64
from pydantic import BaseModel, Field, ValidationError
from . import config
from .data import get_store
from .llm import get_llm, parse_json, LLMError

PROMPT = """這是一張台灣券商 App 的庫存截圖。請把每一檔持股讀出來，只輸出 JSON，格式如下：
{"positions": [{"code": "股票或 ETF 代號", "name": "名稱", "shares": 股數 (整數，一張是 1000 股), "cost": 成本均價或 null, "market_value": 市值或 null}]}
規則：看不清楚的欄位填 null，不要猜；不要輸出姓名、帳號等個人資料；截圖裡沒有持股就輸出 {"positions": []}。"""


class Position(BaseModel):
    code: str = Field(min_length=4, max_length=8)
    name: str = ""
    shares: float | None = Field(default=None, ge=0, le=1e9)
    cost: float | None = Field(default=None, ge=0, le=1e6)
    market_value: float | None = Field(default=None, ge=0, le=1e12)


class Parsed(BaseModel):
    positions: list[Position] = Field(default_factory=list, max_length=50)


def normalize(parsed: Parsed) -> dict:
    """把辨識結果整理成給使用者確認的表格，並估計每檔的金額"""
    s = get_store(); rows = []
    for p in parsed.positions:
        code = p.code.strip().upper(); in_city = code in s.etfs; amount = None; basis = ""
        if p.market_value:
            amount, basis = p.market_value, "截圖上的市值"
        elif p.shares and in_city and s.has_prices(code):
            amount, basis = round(p.shares * s.prices[code][1][-1]), f"股數 × {s.last_date(code)} 收盤價"
        elif p.shares and p.cost:
            amount, basis = round(p.shares * p.cost), "股數 × 成本均價"
        rows.append({"code": code, "name": p.name or (s.etfs[code]["name"] if in_city else ""), "shares": p.shares, "cost": p.cost, "market_value": p.market_value,
                     "amount": amount, "amount_basis": basis, "in_city": in_city})
    return {"rows": rows, "positions": {r["code"]: r["amount"] for r in rows if r["in_city"] and r["amount"]},
            "skipped": [r["code"] for r in rows if not r["in_city"]], "note": "請確認或修正辨識結果後再計算。不在城市裡的標的不會納入穿透持股。"}


def parse_screenshot(image: bytes, mime: str = "image/png", llm=None) -> dict:
    llm = llm or get_llm()
    if llm.name == "mock":
        return {"ok": False, "error": "後端沒有設定 GROQ_API_KEY，無法辨識截圖。可以改用手動輸入代號與金額。"}
    url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
    msgs = [{"role": "user", "content": [{"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": url}}]}]
    try:
        raw = llm.chat(config.VISION_MODEL, msgs, json_mode=True, temperature=0.0, max_tokens=1200)
        parsed = Parsed(**parse_json(raw))
    except (LLMError, ValidationError, ValueError) as e:
        return {"ok": False, "error": f"辨識失敗：{e}"}
    return {"ok": True, "model": config.VISION_MODEL, **normalize(parsed)}
