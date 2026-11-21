"""組成 web/index.html：python web/build.py (先跑 scripts/build_site_data.py 更新 web/data/city.json)"""
import json, os
W = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(W, "src")
rd = lambda n: open(os.path.join(S, n), encoding="utf-8").read()
city = json.load(open(os.path.join(W, "data", "city.json"), encoding="utf-8"))
data = rd("data.part.js").replace("__CITY__", json.dumps(city, ensure_ascii=False, separators=(",", ":")))
scene = rd("scene.part.js").replace("__DATA_PART__", data)
ui = rd("chat_ui.part.js").replace("__API_PART__", rd("api.part.js")) + rd("game.part.js")
head = rd("chat_head.part.html")
html = "<!doctype html>\n<html lang=\"zh-Hant-TW\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
i = head.index("<div id=\"sky\">")
html += head[:i] + "</head>\n<body>\n" + head[i:] + scene + ui + "</script>\n</body>\n</html>\n"
for marker in ("__CITY__", "__DATA_PART__", "__API_PART__", "__HIST__"):
    assert marker not in html, marker
open(os.path.join(W, "index.html"), "w", encoding="utf-8").write(html)
print("index.html", len(html.encode()), "bytes")

# 實驗二用的表格介面與測試頁
compact = json.dumps(city, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(W, "table.html"), "w", encoding="utf-8").write(rd("table.html").replace("__CITY__", compact))
tasks = os.path.join(W, "..", "experiments", "exp2", "tasks.json")
if os.path.exists(tasks):
    st = json.dumps(json.load(open(tasks, encoding="utf-8")), ensure_ascii=False)
    open(os.path.join(W, "study.html"), "w", encoding="utf-8").write(rd("study.html").replace("__STUDY__", st))
print("table.html, study.html")
