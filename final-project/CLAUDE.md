# ETF 都會 (期末專案)

> 這個資料夾暫時放在 etf-wiki repo 裡 (第十週作業評分後再搬出去)。**只改 `final-project/` 裡的檔案**，不要動上層的 wiki、slides、eval、AGENTS.md。知識庫從上層 `wiki/` 匯入 (`python scripts/import_wiki.py ..`)。

**開始工作前先讀 `PROGRESS.md`**，裡面有目前進度、下一步和已知問題。每完成一段就更新 `PROGRESS.md` 並 commit。

## 專案
ETF 問答 Agent：數字一律由程式計算並以編號填入回答 (LLM 不直接寫數字)；Agent 同時輸出「畫面動作」操控前端 (目前是 Three.js 3D 商店街：第三人稱或眼睛視角走在街上，每家店是一家公司)。核心功能與呈現層分開。

## 規則
- 繁體中文、台灣用語。文件與介面文字：括號用半形 ()，中文逗號用全形 ，，不要用破折號 ——。
- 不預測漲跌、不給買賣建議。
- 不要把任何金鑰寫進程式或前端；Groq 金鑰只放後端環境變數 `GROQ_API_KEY`。
- 不要提及或引用舊的 App 專案；不要放任何 google-services.json。
- 報酬第一版只有價格報酬 (未含息)，輸出必須標示。持股只有前十大，輸出必須標示「前十大」。
- 改完後端跑 `cd backend && python -m pytest -q`；改完前端跑 `python web/build.py`。

## 結構
- `backend/etfcity/`：資料工具、facts、Planner、Writer、數字填入與檢查、RAG、FastAPI
- `data/`：ETF 基本資料、前十大持股、價格、每日行情、知識庫文件
- `scripts/`：抓資料與建置
- `web/`：前端 (GitHub Pages)
- `experiments/`：三個實驗
