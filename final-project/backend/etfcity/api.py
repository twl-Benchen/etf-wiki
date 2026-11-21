"""FastAPI：問答、城市資料、持股截圖、每日摘要。啟動：uvicorn etfcity.api:app --port 7860"""
from __future__ import annotations
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from . import __version__, config
from .agent import Agent
from .data import get_store
from .schemas import ArgsLookthrough, Plan, ToolCall
from .tools import RULES
from .vision import parse_screenshot

app = FastAPI(title="ETF 都會 API", version=__version__)
origins = [o.strip() for o in os.environ.get("ETFCITY_CORS", "*").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
_agent: Agent | None = None


def agent() -> Agent:
    global _agent
    if _agent is None:
        _agent = Agent()
    return _agent


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    context: dict | None = None


class PortfolioIn(BaseModel):
    positions: dict[str, float]


def city_bundle() -> dict:
    """前端畫城市需要的全部資料"""
    s = get_store()
    return {"etfs": s.etfs, "holdings": {k: s.top10(k) for k in s.etfs}, "holdings_meta": s.holdings_meta,
            "companies": {n: {k: c[k] for k in ("code", "industry", "district")} for n, c in s.companies.items() if n in s.city_companies()},
            "districts": {k: d["name"] for k, d in config.DISTRICTS.items()}, "daily": s.daily, "rules": RULES,
            "prices_as_of": {k: s.last_date(k) for k in s.etfs if s.has_prices(k)}}


@app.get("/api/health")
def health():
    s = get_store()
    return {"ok": True, "version": __version__, "llm": agent().llm.name, "planner_model": config.PLANNER_MODEL, "writer_model": config.WRITER_MODEL,
            "etfs": list(s.etfs), "daily_demo": bool(s.daily.get("demo")), "daily_date": s.daily.get("date")}


@app.get("/api/city")
def city():
    return city_bundle()


@app.post("/api/ask")
def ask(body: AskIn):
    return agent().ask(body.question, body.context)


@app.post("/api/portfolio/parse")
async def portfolio_parse(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 6 * 1024 * 1024:
        raise HTTPException(413, "圖片太大，請小於 6MB")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(415, "只接受圖片")
    return parse_screenshot(data, file.content_type)   # 圖片只在記憶體中處理，不會存檔


@app.post("/api/portfolio/lookthrough")
def portfolio_lookthrough(body: PortfolioIn):
    try:
        args = ArgsLookthrough(positions=body.positions).model_dump()
    except Exception as e:
        raise HTTPException(422, str(e))
    a = agent(); plan = Plan(type="portfolio", tools=[ToolCall(name="lookthrough", args=args)], reason="使用者確認後的持股")
    return a.answer_plan(plan, "我的持股穿透")


@app.get("/api/summary")
def summary():
    return agent().ask("今天城市怎麼了？")


@app.get("/")
def root():
    return {"name": "ETF 都會 API", "docs": "/docs", "health": "/api/health"}
