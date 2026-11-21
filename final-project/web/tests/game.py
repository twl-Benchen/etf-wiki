"""遊戲流程測試：任務面板、追蹤、蓋章、路人聊天、店長新聞、集滿一張卡。用法：python game.py 輸出資料夾"""
import os, sys, json, math
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run import open_page
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
ok = lambda c, m: print(("通過" if c else "失敗") + "｜" + m)
with sync_playwright() as p:
    b, pg, errs = open_page(p, 1366, 768)
    pg.evaluate("__city.resetGame()"); pg.reload(); pg.wait_for_function("window.__ready===true && !!window.__assets", timeout=120000)
    pg.mouse.move(600, 300); pg.keyboard.press("q"); pg.wait_for_timeout(400)
    ok(pg.evaluate("!document.getElementById('questDlg').hidden"), "按 Q 打開任務面板")
    pg.click("[data-track='etf:0050']"); pg.wait_for_timeout(300)
    ok(pg.evaluate("!document.getElementById('tracker').hidden"), "追蹤 0050 集章卡後顯示下一家店：" + pg.evaluate("document.getElementById('tracker').innerText"))
    pg.screenshot(path=os.path.join(out, "g1_quests.png"))
    pg.keyboard.press("q"); pg.evaluate("__city.teleport('台積電')"); pg.wait_for_timeout(1500)
    g = pg.evaluate("__city.game()")
    ok("台積電" in g["visited"].get("0050", []) and "台積電" in g["visited"].get("006208", []), "走到台積電同時蓋 0050 與 006208 兩張卡")
    pg.screenshot(path=os.path.join(out, "g2_stamp.png"))
    pg.evaluate("__city.card('台積電')"); pg.wait_for_timeout(600)
    ok(pg.evaluate("!!document.querySelector('#card .say q')"), "店家卡片有店長說的新聞：" + (pg.evaluate("document.querySelector('#card .say q') && document.querySelector('#card .say q').textContent") or "")[:40])
    pg.screenshot(path=os.path.join(out, "g3_card.png"))
    pg.keyboard.press("Escape")
    # 路人：站到某個路人旁邊
    for i in range(40):
        w = pg.evaluate(f"__city.walker({i})")
        if w: break
    pg.evaluate(f"__city.place({w['x']} - Math.sin({w['yaw']}) * 1.6, {w['z']} - Math.cos({w['yaw']}) * 1.6, {w['yaw']})"); pg.wait_for_timeout(1200)
    near = pg.evaluate("document.getElementById('near').innerText")
    ok("聊天" in near, f"靠近路人會出現聊天提示：{near}")
    pg.keyboard.press("e"); pg.wait_for_timeout(1500)
    ok(pg.evaluate("!document.getElementById('talk').hidden"), "按 E 和路人聊天：" + pg.evaluate("document.querySelector('#talk .tb').innerText")[:80])
    pg.screenshot(path=os.path.join(out, "g4_talk.png"))
    pg.click("#talk [data-a='2']") if pg.evaluate("document.querySelectorAll('#talk [data-a]').length > 3") else None
    pg.wait_for_timeout(300); pg.keyboard.press("Escape")
    # 集滿 0050
    for n in pg.evaluate("Object.keys(window.__city.TOOLS.get_holdings({etf:'0050'}).top10.reduce((a,x)=>(a[x.name]=1,a),{}))"):
        pg.evaluate(f"__city.teleport({json.dumps(n)})"); pg.wait_for_timeout(700)
    g = pg.evaluate("__city.game()")
    ok("etf:0050" in g["done"], f"集滿 0050 集章卡 ({len(g['visited'].get('0050', []))} 家)")
    last = pg.evaluate("[...document.querySelectorAll('.msg.bot .body')].at(-1).innerText")
    print("  總結：", last[:160].replace("\n", " "))
    pg.screenshot(path=os.path.join(out, "g5_done.png"))
    print("ERRORS:", errs); b.close()
