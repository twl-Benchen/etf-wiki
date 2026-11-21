"""抓城市裡每家公司最近的新聞標題 (FinMind 台股新聞，彙整各家媒體的標題與連結)，寫成 data/news.json，給遊戲裡的路人和店長當聊天話題。
只存標題、來源、時間與連結，不存內文；過濾論壇文章與帶預測或買賣字眼的標題，同一事件的重複標題只留一則。
用法：python scripts/fetch_news.py   (每家公司一次查詢，100 家約用 100 次 FinMind 額度)"""
import json, re, sys, time, datetime as dt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import finmind
D = Path(__file__).resolve().parents[1] / "data"
LOG = {"time": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ok": 0, "empty": [], "failed": {}}
KEEP = 3
FORUM = re.compile(r"/forum/|ptt\.cc|dcard\.tw|mobile01\.com|爆料同學會|股市爆料")
# 系統不預測漲跌、不給買賣建議，所以帶預測或買賣字眼的標題不拿來聊天
SPEC = re.compile(r"會(崩|漲|跌|噴|飆|回|上|下)|上看|下看|目標價|看增|看好|看壞|看旺|買進|賣出|進場|抄底|加碼|減碼|必買|該買|怎麼買|能買|推薦|明牌|飆股|噴發|存股|穩賺|翻倍|值得|布局|撿便宜|權證|個股概覽|報價|走勢圖")


def clean(title, source):
    t = re.sub(r"\s+", " ", title or "").strip()
    parts = t.split(" - ")
    if len(parts) > 1 and len(parts[-1]) <= 14:   # 標題後面常接「 - 媒體名稱」
        t = " - ".join(parts[:-1])
    return t.strip()


def main():
    companies = json.loads((D / "companies.json").read_text(encoding="utf-8"))["companies"]
    daily = json.loads((D / "daily.json").read_text(encoding="utf-8")) if (D / "daily.json").exists() else {}
    date = daily.get("date") or dt.date.today().isoformat()
    out = {}
    for name, c in companies.items():
        try:
            rows = finmind.get("TaiwanStockNews", c["code"], date, date)
            seen, items = set(), []
            for r in sorted(rows, key=lambda x: x.get("date", ""), reverse=True):
                if FORUM.search((r.get("link") or "") + (r.get("title") or "")) or SPEC.search(r.get("title") or ""):
                    continue
                t = clean(r.get("title"), r.get("source"))
                key = re.sub(r"[^\w]", "", t)[:16]
                if len(t) < 8 or key in seen:
                    continue
                seen.add(key); items.append({"date": (r.get("date") or "")[:16], "source": (r.get("source") or "").strip(), "title": t, "link": r.get("link") or ""})
                if len(items) >= KEEP:
                    break
            if items:
                out[c["code"]] = items; LOG["ok"] += 1
            else:
                LOG["empty"].append(name)
        except Exception as e:
            LOG["failed"][name] = str(e)[:200]
            if "limit" in str(e).lower() or "402" in str(e):
                break   # 額度用完就停，保留舊資料
        time.sleep(0.15)
    if out:
        old = json.loads((D / "news.json").read_text(encoding="utf-8")).get("news", {}) if (D / "news.json").exists() else {}
        old.update(out)
        (D / "news.json").write_text(json.dumps({"source": "FinMind 台股新聞 (各家媒體的標題與連結，版權屬原媒體)", "date": date, "updated": LOG["time"], "news": old}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        LOG["failed"]["_fatal"] = str(e)[:300]
    (D / "_fetch_news_log.json").write_text(json.dumps(LOG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: (v if k != "empty" else len(v)) for k, v in LOG.items()}, ensure_ascii=False)[:800])
    raise SystemExit(0 if LOG["ok"] and not LOG["failed"] else 1)
