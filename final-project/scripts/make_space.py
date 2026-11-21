"""產生 Hugging Face Space 要上傳的資料夾：python scripts/make_space.py  →  dist/space/
把 dist/space/ 裡的全部檔案上傳到一個 Docker 類型的 Space (網頁上拖曳上傳，或 git push 到 Space 的 repo)。
金鑰不在這個資料夾裡：請在 Space 的 Settings → Variables and secrets 新增 GROQ_API_KEY。"""
import shutil
from pathlib import Path
R = Path(__file__).resolve().parents[1]; out = R / "dist" / "space"
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)
ign = shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "tests", "_fetch_*_log.json")
shutil.copytree(R / "backend", out / "backend", ignore=ign)
shutil.copytree(R / "data", out / "data", ignore=ign)
for f in ("Dockerfile", "requirements.txt"):
    shutil.copy(R / f, out / f)
(out / "README.md").write_text("""---
title: ETF 都會 Agent
emoji: 🏙️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# ETF 都會 Agent (後端)

TAICA 生成式AI 期末專案的後端：ETF 問答 Agent。數字一律由程式計算，並以編號填入回答。

- `/`：Gradio 介面，可以看到 Agent 的規劃、工具結果、數字檢查
- `/api/health`、`/api/ask`、`/api/city`、`/api/portfolio/parse`、`/api/portfolio/lookthrough`：給城市網頁用的 API
- `/docs`：API 文件

需要在 Settings → Variables and secrets 設定 `GROQ_API_KEY`。沒有設定時會改用規則版 Agent。

本系統只說明資料，不提供投資建議，也不預測漲跌。
""", encoding="utf-8")
n = sum(1 for _ in out.rglob("*") if _.is_file())
print(f"完成：{out} ({n} 個檔案)")
