"""Fact：有編號的數字。Writer 只能寫 {編號}，數字由程式填入。"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Fact:
    id: str
    value: Any
    unit: str          # pct / pct_signed / pct1 / pp / twd / price / count:<量詞> / date / month / text
    label: str         # 這個數字是什麼 (給 Writer 看)
    source: str = ""
    as_of: str | None = None

    def text(self) -> str:
        v, u = self.value, self.unit
        if u == "pct":
            return f"{v:.2f}%"
        if u == "pct0":
            return f"{v:.0f}%"
        if u == "pct1":
            return f"{v:.1f}%"
        if u == "pct_signed":
            return f"{v:+.2f}%"
        if u == "pp":
            return f"{v:.2f} 個百分點"
        if u == "twd":
            return f"{round(v):,} 元"
        if u == "price":
            return f"{v:,.2f} 元"
        if u.startswith("count:"):
            return f"{int(v)} {u[6:]}"
        if u == "date":   # YYYY-MM-DD -> YYYY/M/D
            y, m, d = str(v).split("-")
            return f"{y}/{int(m)}/{int(d)}"
        if u == "month":  # YYYY-MM -> YYYY/MM
            return str(v).replace("-", "/")
        return str(v)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["text"] = self.text()
        return d


@dataclass
class ToolResult:
    name: str
    args: dict
    ok: bool = True
    data: dict = field(default_factory=dict)      # 給畫面與 Writer 參考的結構化內容 (不含要寫進回答的數字)
    facts: list[Fact] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    note: str = ""                                # 限制說明，例如「只計前十大」
    error: str = ""

    def to_dict(self, slim: bool = True) -> dict:
        data = {k: v for k, v in self.data.items() if not (slim and k.startswith("_"))}
        return {"name": self.name, "args": self.args, "ok": self.ok, "data": data,
                "facts": [f.to_dict() for f in self.facts], "sources": self.sources, "note": self.note, "error": self.error}


class FactBook:
    def __init__(self):
        self.facts: dict[str, Fact] = {}

    def add_all(self, facts: list[Fact]):
        for f in facts:
            self.facts[f.id] = f

    def get(self, fid: str) -> Fact | None:
        return self.facts.get(fid)

    def table(self) -> str:
        """給 Writer 的清單：編號 | 意義 | 值"""
        return "\n".join(f"{{{f.id}}} = {f.text()}  ← {f.label}" for f in self.facts.values())

    def to_dict(self) -> dict:
        return {k: f.to_dict() for k, f in self.facts.items()}
