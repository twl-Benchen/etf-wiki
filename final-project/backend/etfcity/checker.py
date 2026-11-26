"""數字填入與檢查。
1. 把回答裡的 {編號} 換成 FactBook 裡的數字。
2. 檢查：不能引用不存在的編號；不能有不是透過編號產生的數字 (ETF 與股票代號、參考文件裡原本就有的數字除外)。"""
from __future__ import annotations
import re
from .data import get_store
from .facts import FactBook

PH = re.compile(r"\{([A-Za-z0-9_]+)\}")
NUM = re.compile(r"[+-]?\d[\d,]*(?:\.\d+)?")
UNITS = "%％元塊萬億倍點檔家次年月日天週"


def fill_and_check(draft: str, book: FactBook, allowed_text: str = "") -> dict:
    s = get_store(); codes = set(s.etfs) | set(s.by_code)
    unknown, used = [], []

    def sub(m):
        f = book.get(m.group(1))
        if f is None:
            unknown.append(m.group(1)); return m.group(0)
        used.append(f.id); return "\x00" + f.text() + "\x01"
    filled = PH.sub(sub, draft)
    # 把已填入的片段與「」內的例句遮掉，再找剩下的數字
    rest = re.sub(r"\x00.*?\x01", "§", filled); rest = re.sub(r"「[^」]*」", "§", rest)
    allowed = allowed_text.replace(",", "")
    stray = []
    for m in NUM.finditer(rest):
        tok = m.group(0); raw = tok.replace(",", "").lstrip("+-")
        if raw in codes:
            continue
        nxt = rest[m.end():m.end() + 2].lstrip()[:1]
        risky = "." in raw or len(raw) >= 3 or (nxt and nxt in UNITS)
        if not risky:
            continue
        if allowed and re.search(r"(?<![\d.])" + re.escape(raw) + r"(?![\d])", allowed):
            continue
        stray.append(tok + (nxt if nxt in UNITS else ""))
    # 編號沒有用大括號包住 (例如寫成 (ret_1y_0050) 或直接寫 ret_1y_0050)：數字沒有被填入，也算不合格
    bare = [fid for fid in book.facts if re.search(r"(?<![A-Za-z0-9_])" + re.escape(fid) + r"(?![A-Za-z0-9_])", rest)]
    text = filled.replace("\x00", "").replace("\x01", "")
    # 編號後面多寫的單位 (例如 +5.21%%、3 家家)
    text = re.sub(r"%\s*[%％]", "%", text); text = re.sub(r"(元|家|次|檔)\s*\1", r"\1", text)
    ok = not unknown and not stray and not bare
    msg = ""
    if bare:
        msg += f"編號沒有用大括號寫：{'、'.join(bare)}，要寫成 {{{bare[0]}}} 這種格式。"
    if unknown:
        msg += f"使用了不存在的編號：{'、'.join(unknown)}。"
    if stray:
        msg += f"出現不是用編號寫的數字：{'、'.join(stray)}，請改用編號或刪掉。"
    return {"ok": ok, "text": text, "used": used, "unknown": unknown, "stray": stray, "bare": bare, "message": msg}
