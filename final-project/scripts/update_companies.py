"""更新城市裡的公司：市值前 100 大 (data/market_cap.json) 加上 ETF 前十大持股，寫回 data/companies.json。
用法：
  python scripts/update_companies.py              用現有的 data/market_cap.json
  python scripts/update_companies.py 排行.tsv      先用新的排行表 (每行：排行、代號、名稱、市值占大盤比重，用 Tab 分隔) 重建 data/market_cap.json
新公司的產業類別從 FinMind 的台股基本資料查 (金鑰見 scripts/finmind.py)；已經有的公司保留原本的資料。
名稱後面的 * (證交所標示面額不是 10 元) 會拿掉，-KY 保留。"""
import json, os, sys, datetime as dt
from pathlib import Path
import requests
sys.path.insert(0, str(Path(__file__).resolve().parent))
import finmind
D = Path(__file__).resolve().parents[1] / "data"
SKIP = {"電子工業", "化學生技醫療"}   # FinMind 會同時給大類和細類，用細類
NORM = {"金融保險": "金融保險業"}


def load_tsv(path):
    rows = []
    for ln in Path(path).read_text(encoding="utf-8").splitlines():
        p = [x.strip() for x in ln.split("\t") if x.strip()]
        if len(p) >= 4 and p[0].isdigit():
            rows.append({"rank": int(p[0]), "code": p[1], "name": p[2].replace("*", ""), "share": float(p[3].rstrip("%"))})
    return sorted(rows, key=lambda r: r["rank"])[:100]


def industries(codes):
    tok = os.environ.get("FINMIND_TOKEN", "").strip()
    r = requests.get(finmind.URL, params={"dataset": "TaiwanStockInfo"}, headers={"Authorization": f"Bearer {tok}"} if tok else {}, timeout=60).json()
    out = {}
    for x in r.get("data", []):
        if x["stock_id"] in codes and x["industry_category"] not in SKIP:
            out.setdefault(x["stock_id"], {"industry": NORM.get(x["industry_category"], x["industry_category"]), "market": "TWSE" if x["type"] == "twse" else "TPEx"})
            if x["type"] == "twse":
                out[x["stock_id"]]["market"] = "TWSE"
    return out


def main():
    mc_path = D / "market_cap.json"
    if len(sys.argv) > 1:
        rows = load_tsv(sys.argv[1])
        mc = {"source": "證交所上市公司市值占大盤比重排行 (使用者提供)", "provided": dt.date.today().isoformat(), "scope": "上市公司市值前 100 大", "top": rows}
        mc_path.write_text(json.dumps(mc, ensure_ascii=False, indent=1), encoding="utf-8")
    mc = json.loads(mc_path.read_text(encoding="utf-8"))
    cj = json.loads((D / "companies.json").read_text(encoding="utf-8")); comp = cj["companies"]
    by_code = {c["code"]: n for n, c in comp.items()}
    new = [r for r in mc["top"] if r["code"] not in by_code]
    info = industries({r["code"] for r in new}) if new else {}
    missing = [r["code"] for r in new if r["code"] not in info]
    if missing:
        raise SystemExit(f"查不到產業類別：{missing}")
    for r in mc["top"]:
        n = by_code.get(r["code"])
        if n is None:
            n = r["name"]; comp[n] = {"code": r["code"], **info[r["code"]]}
        comp[n].update({"mcap_rank": r["rank"], "mcap_share": r["share"]})
    ranked = {r["code"] for r in mc["top"]}
    for n, c in comp.items():
        if c["code"] not in ranked:
            c.pop("mcap_rank", None); c.pop("mcap_share", None)
    cj = {"market_cap": {k: mc[k] for k in ("source", "provided", "scope")}, "companies": dict(sorted(comp.items(), key=lambda kv: kv[1].get("mcap_rank", 999)))}
    (D / "companies.json").write_text(json.dumps(cj, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"companies.json：{len(comp)} 家 (新增 {len(new)} 家)")


if __name__ == "__main__":
    main()
