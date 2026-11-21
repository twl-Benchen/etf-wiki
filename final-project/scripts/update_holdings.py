"""更新前十大持股：python scripts/update_holdings.py <新持股.json>
新持股.json 格式：{"as_of": "YYYY-MM-DD", "source": "來源說明", "holdings": {"0050": [["台積電", 60.10], ...]}}
舊的 holdings.json 會先存到 data/holdings_history/<舊的 as_of 或 initial>.json，之後可以拿來做「換股改道」。
新出現的公司要先在 COMPANY_MASTER 補上代號、市場、產業。"""
import json, shutil, sys
from pathlib import Path
D = Path(__file__).resolve().parents[1] / "data"
COMPANY_MASTER = {  # 名稱: (代號, 市場, 證交所產業別)
    "南亞": ("1303", "TWSE", "塑膠工業"), "統一": ("1216", "TWSE", "食品工業"), "兆豐金": ("2886", "TWSE", "金融保險業"), "永豐金": ("2890", "TWSE", "金融保險業"),
    "台新新光金": ("2887", "TWSE", "金融保險業"), "凱基金": ("2883", "TWSE", "金融保險業"), "第一金": ("2892", "TWSE", "金融保險業"), "玉山金": ("2884", "TWSE", "金融保險業"),
    "合庫金": ("5880", "TWSE", "金融保險業"), "緯創": ("3231", "TWSE", "電腦及週邊設備業"), "英業達": ("2356", "TWSE", "電腦及週邊設備業"), "仁寶": ("2324", "TWSE", "電腦及週邊設備業"),
    "和碩": ("4938", "TWSE", "電腦及週邊設備業"), "光寶科": ("2301", "TWSE", "電腦及週邊設備業"), "台塑": ("1301", "TWSE", "塑膠工業"), "台化": ("1326", "TWSE", "塑膠工業"),
    "中鋼": ("2002", "TWSE", "鋼鐵工業"), "台泥": ("1101", "TWSE", "水泥工業"), "統一超": ("2912", "TWSE", "貿易百貨業"), "台灣大": ("3045", "TWSE", "通信網路業"),
    "遠傳": ("4904", "TWSE", "通信網路業"), "萬海": ("2615", "TWSE", "航運業"), "華航": ("2610", "TWSE", "航運業"), "智邦": ("2345", "TWSE", "通信網路業"),
    "奇鋐": ("3017", "TWSE", "電腦及週邊設備業"), "緯穎": ("6669", "TWSE", "電腦及週邊設備業"), "大立光": ("3008", "TWSE", "光電業"), "國巨": ("2327", "TWSE", "電子零組件業"),
    "日月光投控": ("3711", "TWSE", "半導體業"), "瑞昱": ("2379", "TWSE", "半導體業"), "聯詠": ("3034", "TWSE", "半導體業"),
}
new = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
cur = json.loads((D / "holdings.json").read_text(encoding="utf-8")); comp = json.loads((D / "companies.json").read_text(encoding="utf-8"))
etfs = json.loads((D / "etfs.json").read_text(encoding="utf-8"))["etfs"]
(D / "holdings_history").mkdir(exist_ok=True)
shutil.copy(D / "holdings.json", D / "holdings_history" / f"{cur.get('as_of') or 'initial'}.json")
H = {}
for k, rows in new["holdings"].items():
    assert k in etfs, f"不認得的 ETF：{k}"
    top = []
    for name, w in rows:
        if name not in comp["companies"]:
            if name not in COMPANY_MASTER:
                raise SystemExit(f"請先在 COMPANY_MASTER 補上「{name}」的代號與產業")
            c, m, ind = COMPANY_MASTER[name]; comp["companies"][name] = {"code": c, "market": m, "industry": ind}
        top.append({"name": name, "code": comp["companies"][name]["code"], "weight": float(w)})
    assert len(top) == 10, f"{k} 不是 10 檔"
    H[k] = {"top10": sorted(top, key=lambda t: -t["weight"])}
for k in etfs:
    H.setdefault(k, cur["holdings"][k])
used = {t["name"] for h in H.values() for t in h["top10"]}
comp["companies"] = {n: c for n, c in comp["companies"].items() if n in used}   # 城市只放目前有人持有的公司
(D / "holdings.json").write_text(json.dumps({"as_of": new["as_of"], "source": new["source"], "scope": "top10", "holdings": H}, ensure_ascii=False, indent=1), encoding="utf-8")
(D / "companies.json").write_text(json.dumps(comp, ensure_ascii=False, indent=1), encoding="utf-8")
print("更新完成", new["as_of"], "公司數", len(used))
