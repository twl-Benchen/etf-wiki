"""前端測試：截圖與批次提問。
three.js 從本地讀 (無頭瀏覽器常連不到 CDN)：mkdir -p vendor && cd vendor && npm pack three@0.160.0 && tar xzf three-0.160.0.tgz
用法：
  python run.py shot out.png 1366 768 "問題1" "問題2" ...
  python run.py qa q1.json"""
import json, os, sys
from playwright.sync_api import sync_playwright
T = os.path.dirname(os.path.abspath(__file__)); PAGE = os.path.join(T, "..", "index.html")
THREE = os.environ.get("THREE_DIR", os.path.join(T, "vendor", "package")) + "/"


def open_page(p, w=1366, h=768):
    b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": w, "height": h}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text and "URL scheme \"file\"" not in m.text else None)

    def route(r):
        u = r.request.url
        if "three@0.160.0/" in u:
            r.fulfill(path=THREE + u.split("three@0.160.0/")[1], content_type="application/javascript")
        elif "fonts.g" in u:
            r.abort()
        else:
            r.continue_()
    pg.route("**/*", route)
    pg.goto("file://" + os.path.abspath(PAGE))
    pg.wait_for_function("window.__ready===true", timeout=90000)
    return b, pg, errs


def ask(pg, q):
    pg.evaluate(f"window.__city.ask({json.dumps(q)})")
    pg.wait_for_function("!window.__city.busy", timeout=30000); pg.wait_for_timeout(300)
    if pg.evaluate("window.__city.replaying"):
        pg.evaluate("window.__city.fastReplay()"); pg.wait_for_function("!window.__city.replaying", timeout=90000)


LAST = "()=>{const ms=[...document.querySelectorAll('.msg.bot')];const m=ms[ms.length-1];const st=[...m.querySelectorAll('.trace .step')].map(s=>s.textContent);return {who:m.querySelector('.who')?.textContent,body:m.querySelector('.body').innerText,check:st[st.length-1]||'',chips:[...document.querySelectorAll('#chips button')].map(b=>b.textContent)}}"

if __name__ == "__main__":
    with sync_playwright() as p:
        if sys.argv[1] == "shot":
            out, w, h = sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
            b, pg, errs = open_page(p, w, h)
            for q in sys.argv[5:]:
                if q.startswith("js:"):
                    pg.evaluate(q[3:]); pg.wait_for_timeout(500)
                elif q.startswith("wait:"):
                    pg.wait_for_timeout(int(q[5:]))
                else:
                    ask(pg, q)
            pg.wait_for_timeout(1800); pg.screenshot(path=out)
        else:
            b, pg, errs = open_page(p)
            for q in json.load(open(sys.argv[2], encoding="utf-8")):
                ask(pg, q); r = pg.evaluate(LAST)
                print("Q:", q, "|", r["who"]); print("  A:", r["body"].replace("\n", " / ")); print("  check:", r["check"][:80]); print()
        print("ERRORS:", errs); b.close()
