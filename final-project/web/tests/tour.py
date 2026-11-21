"""商店街的多張截圖檢查：python tour.py 輸出資料夾 [寬 高]
依序截：廣場起點、走到台積電、眼睛視角、店家卡片、導覽圖、問答 (比較兩檔 ETF)、晚上。"""
import os, sys, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run import open_page, ask

out = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1366; H = int(sys.argv[3]) if len(sys.argv) > 3 else 768
os.makedirs(out, exist_ok=True)
STEPS = [
    ("01_plaza", []),
    ("02_tsmc_tp", ["js:__city.teleport('台積電')", "wait:900"]),
    ("03_tsmc_fp", ["js:__city.view('fp')", "wait:900"]),
    ("04_card", ["js:__city.view('tp')", "js:__city.teleport('聯發科')", "js:__city.card('聯發科')", "wait:900"]),
    ("05_street", ["js:__city.card(null)", "js:document.getElementById('card').hidden=true", "js:__city.teleport('鴻海')", "js:__city.look(__city.me().yaw + 1.57, 0.1)", "wait:900"]),
    ("06_map", ["js:__city.map(true)", "wait:600"]),
    ("07_compare", ["js:__city.map(false)", "q:0056 跟 00919 差在哪？", "wait:3200"]),
    ("08_market", ["q:今天城市怎麼了？", "wait:1200"]),
    ("09_night", ["js:__city.map(false)", "q:晚上的城市長怎樣？", "js:__city.teleport('長榮')", "js:__city.look(__city.me().yaw + 3.0, 0.15)", "wait:1200"]),
]
only = set(os.environ.get("ONLY", "").split(",")) - {""}
with sync_playwright() as p:
    b, pg, errs = open_page(p, W, H)
    for name, acts in STEPS:
        for a in acts:
            if a.startswith("js:"):
                pg.evaluate(a[3:]); pg.wait_for_timeout(150)
            elif a.startswith("wait:"):
                pg.wait_for_timeout(int(a[5:]))
            elif a.startswith("q:"):
                ask(pg, a[2:])
        if not only or name in only:
            pg.screenshot(path=os.path.join(out, name + ".png"))
        print(name, json.dumps(pg.evaluate("__city.me()"), ensure_ascii=False))
    print("ERRORS:", errs); b.close()
