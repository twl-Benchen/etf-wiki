"""Planner 輸出的驗證 (Pydantic)。工具與畫面動作都是白名單，參數不合法就拒絕執行。"""
from __future__ import annotations
from typing import Literal, Any
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError
from .data import get_store

PlanType = Literal["concept", "number", "compare", "scenario", "portfolio", "market", "company", "refuse", "scene", "help"]
Period = Literal["1m", "3m", "6m", "1y", "3y", "5y", "ytd", "max"]


def _etf(v: str) -> str:
    v = str(v).strip()
    if v not in get_store().etfs:
        raise ValueError(f"不支援的 ETF 代號: {v}")
    return v


def _company(v: str) -> str:
    s = get_store(); v = str(v).strip()
    if v in s.companies:
        return v
    if v in s.by_code:
        return s.by_code[v]["name"]
    raise ValueError(f"城市裡沒有這家公司: {v}")


class _Etf(BaseModel):
    etf: str
    _v = field_validator("etf")(lambda cls, v: _etf(v))


class ArgsOverlap(BaseModel):
    a: str; b: str
    _v = field_validator("a", "b")(lambda cls, v: _etf(v))

    @model_validator(mode="after")
    def _diff(self):
        if self.a == self.b:
            raise ValueError("兩檔 ETF 不能相同")
        return self


class ArgsReturn(BaseModel):
    etfs: list[str] = Field(min_length=1, max_length=5)
    period: Period = "1y"
    _v = field_validator("etfs")(lambda cls, v: [_etf(x) for x in v])


class ArgsDividends(_Etf):
    year: int | None = Field(default=None, ge=2003, le=2100)


class ArgsDca(_Etf):
    monthly: int = Field(default=5000, ge=100, le=10_000_000)
    start: str = Field(default="2020-01", pattern=r"^(19|20)\d\d-(0[1-9]|1[0-2])$")
    end: str | None = Field(default=None, pattern=r"^(19|20)\d\d-(0[1-9]|1[0-2])$")

    @model_validator(mode="after")
    def _range(self):
        if self.end and self.end <= self.start:
            raise ValueError("結束月份必須晚於開始月份")
        return self


class ArgsLookthrough(BaseModel):
    positions: dict[str, float] = Field(min_length=1, max_length=10)

    @field_validator("positions")
    @classmethod
    def _pos(cls, v):
        out = {}
        for k, a in v.items():
            if not (0 < float(a) <= 1e10):
                raise ValueError("金額必須大於 0")
            out[_etf(k)] = float(a)
        return out


class ArgsCompany(BaseModel):
    company: str
    _v = field_validator("company")(lambda cls, v: _company(v))


class ArgsMarket(BaseModel):
    district: Literal["semi", "tech", "fin", "port", "life"] | None = None


class ArgsSearch(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    k: int = Field(default=3, ge=1, le=5)


TOOL_ARGS: dict[str, type[BaseModel]] = {"holdings_change": _Etf, "get_etf_info": _Etf, "get_top10_holdings": _Etf, "top10_overlap": ArgsOverlap, "get_return": ArgsReturn,
                                         "get_dividends": ArgsDividends, "simulate_dca": ArgsDca, "lookthrough": ArgsLookthrough,
                                         "get_stock_info": ArgsCompany, "market_summary": ArgsMarket, "search_knowledge": ArgsSearch}
SCENE_NAMES = {"focus_etfs", "fly_to", "mark_companies", "show_portfolio", "replay", "set_time", "reset"}


class ToolCall(BaseModel):
    name: str
    args: dict[str, Any] = {}

    @model_validator(mode="after")
    def _check(self):
        if self.name not in TOOL_ARGS:
            raise ValueError(f"不在白名單的工具: {self.name}")
        self.args = TOOL_ARGS[self.name](**self.args).model_dump(exclude_none=True)
        return self


class SceneCall(BaseModel):
    name: str
    args: dict[str, Any] = {}

    @model_validator(mode="after")
    def _check(self):
        if self.name not in SCENE_NAMES:
            raise ValueError(f"不在白名單的畫面動作: {self.name}")
        a = self.args
        if "etfs" in a:
            a["etfs"] = [_etf(x) for x in a["etfs"]][:5]
        if "companies" in a:
            a["companies"] = [_company(x) for x in a["companies"]][:12]
        if self.name == "set_time":
            h = float(a.get("hour", 14.5))
            if not 8 <= h <= 22:
                raise ValueError("時間必須在 8 到 22 點之間")
            a["hour"] = h
        return self


class Plan(BaseModel):
    type: PlanType
    tools: list[ToolCall] = Field(default_factory=list, max_length=6)
    scene: list[SceneCall] = Field(default_factory=list, max_length=6)
    reason: str = ""
    focus: dict[str, Any] = {}   # 規則版 Planner 的補充資訊 (例如點的是車站還是大樓)


def validate_plan(obj: dict) -> tuple[Plan | None, str]:
    try:
        return Plan(**obj), ""
    except ValidationError as e:
        return None, "; ".join(f"{'.'.join(str(x) for x in er['loc'])}: {er['msg']}" for er in e.errors()[:4])
    except Exception as e:  # noqa
        return None, str(e)
