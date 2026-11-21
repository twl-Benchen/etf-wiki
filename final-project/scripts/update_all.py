"""一次更新全部資料並重建網頁 (需要能連網)：python scripts/update_all.py
步驟：當日行情 → 歷史價格 → 前端資料 → 網頁 → 後端測試。任何一步失敗都會繼續，最後列出結果。"""
import subprocess, sys
from pathlib import Path
R = Path(__file__).resolve().parents[1]
steps = [("當日行情", [sys.executable, "scripts/fetch_daily.py"]), ("歷史價格", [sys.executable, "scripts/fetch_prices.py"]),
         ("前端資料", [sys.executable, "scripts/build_site_data.py"]), ("網頁", [sys.executable, "web/build.py"]),
         ("實驗二題目", [sys.executable, "experiments/exp2/make_tasks.py"]), ("網頁 (含新題目)", [sys.executable, "web/build.py"]),
         ("後端測試", [sys.executable, "-m", "pytest", "-q"])]
res = []
for name, cmd in steps:
    p = subprocess.run(cmd, cwd=R / "backend" if name == "後端測試" else R, capture_output=True, text=True)
    res.append((name, p.returncode == 0, (p.stdout + p.stderr).strip().splitlines()[-1:] or [""]))
for name, ok, tail in res:
    print(f"{'成功' if ok else '失敗'}｜{name}｜{tail[0][:150]}")
print("\n看 data/_fetch_daily_log.json 與 data/_fetch_prices_log.json 了解抓資料的細節。資料有更新的話記得 commit。")
