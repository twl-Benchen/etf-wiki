# 進度紀錄 (接手的人先讀這份)

更新時間：2026-11-21

## 怎麼接手
1. 讀 `CLAUDE.md` (規則) 和這份檔案。
2. `cd backend && python -m pytest -q` 確認後端測試通過。
3. 從「下一步」最上面一項開始做；做完一項就更新這份檔案並 commit。

## 已完成
- [x] 專案結構、初始資料 (5 檔 ETF：0050、006208、0056、00878、00919；24 家公司；歷史價格)
- [x] 後端核心 `backend/etfcity/`
  - `data.py` 資料載入；沒有 `data/daily.json` 時自動產生「示意行情」並在所有輸出標示
  - `facts.py` 有編號的數字 (Fact)、工具結果 (ToolResult)
  - `tools.py` 十個資料工具
  - `schemas.py` Pydantic 驗證 (工具與畫面動作白名單、參數範圍)
  - `planner.py` 規則版 Planner (`rule_plan`) 與 LLM 版 (`llm_plan`，驗證失敗重試一次，再失敗退回規則版)
  - `writer.py` 模板版 Writer 與 LLM 版的 prompt (LLM 只能寫 `{編號}`)
  - `checker.py` 數字填入與檢查
  - `scene.py` 依工具結果產生畫面動作與建議追問
  - `agent.py` 主流程；`llm.py` Groq (aisuite 或 HTTP) 與 mock

### 已完成 (2026-11-17 第二段)
- [x] 知識庫 32 篇 (`data/kb/`，16 篇匯入自 etf-wiki，16 篇自編；自編的 `status: 待核對`)
- [x] RAG (`rag.py`，字元 n-gram TF-IDF + FAISS；可用環境變數換成語意向量)
- [x] FastAPI (`api.py`)、Gradio 展示 (`app_gradio.py`)、HF Space 入口 (`app_space.py`、`Dockerfile`)
- [x] 截圖辨識 (`vision.py`，qwen/qwen3.8-27b，使用者確認後才計算)
- [x] 資料抓取：`scripts/fetch_prices.py` (yfinance)、`scripts/fetch_daily.py` (證交所與櫃買 OpenAPI)、`.github/workflows/update-data.yml`
- [x] `scripts/build_site_data.py` 產生 `web/data/city.json`
- [x] 測試 33 個全過 (`cd backend && python -m pytest -q`)

### 已完成 (2026-11-21)
- [x] 專案搬到 etf-wiki repo 的 `final-project/` (第十週作業評分後再搬出去，見 docs/deploy.md 第 6 節)
- [x] 前端 `web/`：`python web/build.py` 由 `web/src/` 的片段組成 `index.html`、`table.html`、`study.html`
  - 城市改成讀 `web/data/city.json`，大樓依產業自動配置 (5 檔 ETF、24 家公司)
  - 連上後端時，問答交給 LLM Agent (`api.part.js` 的 `askApi`)，畫面動作由 `runScene` 執行；連不上時用瀏覽器內的規則版
  - 「我的持股」對話框：手動輸入，或上傳截圖並在畫面上塗黑個資後送去辨識
  - 測試：`web/tests/run.py shot|qa`
- [x] 實驗一：題庫 60 題、`run.py`、`grade.py`；`C_rule` 流程檢查全過 (只是流程檢查，見 experiments/README.md)
- [x] 實驗二：`make_tasks.py` 產生 8 題 (答案由工具計算)、`web/table.html` 對照介面、`web/study.html` 測試頁、`analyze.py`
- [x] 實驗三：README、標準答案範本、看圖模型與傳統 OCR 兩種辨識腳本、評分程式
- [x] `docs/deploy.md`：本機、Groq、HF Space、GitHub Pages、資料更新、搬 repo

## 待辦清單 (依序)
1. **需要使用者**：申請 Groq 金鑰，跑 `scripts/check_groq.py`，依結果調整 prompt。
2. **需要使用者**：建 HF Space 部署後端 (docs/deploy.md 第 3 節)，把網址填進城市設定。
3. 在能連網的電腦跑 `scripts/fetch_prices.py` 與 `scripts/fetch_daily.py`，更新價格與當日行情；之後重跑 `build_site_data.py`、`web/build.py`。
4. 更新前十大持股 (`data/holdings.json`，填 `as_of` 與來源)，並整理配息資料 `data/dividends.json` (格式：`{"dividends": {"0056": [{"date": "YYYY-MM-DD", "amount": 0.0}]}}`)。
5. 跑實驗一 A、B、C、D，產生 `experiments/exp1/report.md`。
6. 實驗二：找受試者；實驗三：收截圖並標註。
7. 期末報告與 demo 腳本。
8. 城市加分項 (看時間)：ETF 換股的路線改道 (需要歷史持股)、月營收吊車、外資巴士、圖像生成的外牆貼圖。

## 已知問題
- 這個開發環境連不到 Groq、證交所、Yahoo、Hugging Face，所以 LLM 路徑和抓資料腳本都還沒有實際跑過。
- 知識庫中自編的 16 篇標示「待核對」，期末前要對照來源檢查。
- 城市在手機上可以用，但標籤較擠；實驗二建議用電腦做。
