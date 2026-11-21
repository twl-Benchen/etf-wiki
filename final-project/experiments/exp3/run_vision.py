"""用看圖模型辨識 images/ 裡的每張截圖，結果存成 pred_vision/<檔名>.json"""
import json, mimetypes, os, sys
from pathlib import Path
H = Path(__file__).resolve().parent; sys.path.insert(0, str(H.parents[1] / "backend"))
os.environ.setdefault("ETFCITY_LLM", "groq")
from etfcity.vision import parse_screenshot
from etfcity.llm import get_llm

out = H / "pred_vision"; out.mkdir(exist_ok=True); llm = get_llm("groq")
for p in sorted((H / "images").glob("*")):
    if p.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        continue
    dst = out / f"{p.name}.json"
    if dst.exists():
        continue
    r = parse_screenshot(p.read_bytes(), mimetypes.guess_type(p.name)[0] or "image/png", llm=llm)
    rows = [{"code": x["code"], "shares": x["shares"], "cost": x["cost"], "market_value": x["market_value"]} for x in r.get("rows", [])]
    dst.write_text(json.dumps({"ok": r.get("ok"), "error": r.get("error"), "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(p.name, "ok" if r.get("ok") else r.get("error"), len(rows))
