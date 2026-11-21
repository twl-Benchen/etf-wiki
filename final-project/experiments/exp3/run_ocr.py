"""傳統 OCR 基準：tesseract 讀出文字與座標，依 y 座標分成列，再用規則找代號與數字。
需要：apt install tesseract-ocr tesseract-ocr-chi-tra；pip install pytesseract pillow
規則：每列找 4 到 6 碼的代號 (可帶一個英文字母)；同一列的數字依大小判斷：整數且 ≥ 1 的最大值當股數，含小數且 < 10000 的當成本，含千分位且最大的當市值。
這是刻意寫得簡單的基準，用來和看圖模型比較。"""
import json, re
from pathlib import Path
from PIL import Image
import pytesseract

H = Path(__file__).resolve().parent; out = H / "pred_ocr"; out.mkdir(exist_ok=True)
CODE = re.compile(r"^(\d{4,6}[A-Z]?)$"); NUMR = re.compile(r"^[\d,]+(\.\d+)?$")


def rows_of(img):
    d = pytesseract.image_to_data(img, lang="chi_tra+eng", output_type=pytesseract.Output.DICT)
    words = [(d["top"][i] + d["height"][i] / 2, d["left"][i], d["text"][i].strip()) for i in range(len(d["text"])) if d["text"][i].strip()]
    words.sort(); lines = []
    for y, x, t in words:
        if lines and abs(lines[-1][0] - y) < 14:
            lines[-1][1].append((x, t))
        else:
            lines.append([y, [(x, t)]])
    return [[t for _, t in sorted(ws)] for _, ws in lines]


for p in sorted((H / "images").glob("*")):
    if p.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        continue
    img = Image.open(p).convert("L"); img = img.resize((img.width * 2, img.height * 2))
    found = []; cur = None
    for toks in rows_of(img):
        codes = [t for t in toks if CODE.match(t)]
        nums = [t for t in toks if NUMR.match(t) and not CODE.match(t)]
        if codes:
            cur = {"code": codes[0], "shares": None, "cost": None, "market_value": None}; found.append(cur)
        if cur and nums:
            vals = [(t, float(t.replace(",", ""))) for t in nums]
            ints = [v for t, v in vals if "." not in t and v >= 1]
            decs = [v for t, v in vals if "." in t and v < 10000]
            big = [v for t, v in vals if "," in t]
            cur["shares"] = cur["shares"] or (max(ints) if ints else None)
            cur["cost"] = cur["cost"] or (decs[0] if decs else None)
            cur["market_value"] = cur["market_value"] or (max(big) if big else None)
    (out / f"{p.name}.json").write_text(json.dumps({"ok": True, "rows": found}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(p.name, len(found))
