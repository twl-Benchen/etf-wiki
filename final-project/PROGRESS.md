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
- [x] 前十大持股更新到 2026-11-20 (來源 pocket.tw，待與投信官網核對)；舊資料存在 `data/holdings_history/initial.json`；更新方式 `scripts/update_holdings.py`
- [x] 換股比較 `holdings_change` (後端工具、離線版、畫面上新進的車站亮綠色光圈)
- [x] 假 LLM 測試 (`backend/tests/test_llm_path.py`)：計畫驗證失敗重試、Writer 寫了沒編號的數字被退回、退回模板
- [x] `scripts/update_all.py` 一鍵更新資料；`notebooks/etf_metropolis_colab.ipynb` 在 Colab 更新資料、測 Groq、跑實驗一
- [x] `docs/demo.md` 期末 demo 流程
- [x] `scripts/make_space.py` 產生 HF Space 上傳資料夾 `dist/space/` (已在本機用 TestClient 驗證可啟動)
- [x] 跑 `scripts/update_all.py`：價格更新到 2026-11-20 (5 檔)，當日行情為 2026-11-20 真實資料 (27 檔全到，不再是示意行情)
  - Yahoo 的 0050 有兩個問題，`fetch_prices.py` 已改成自動處理並記在 log：2014 年以前沒有除以 4 (中間有假的 -75%)，以及只從 2009 年開始。現在 0050 從 2003-06-30 到 2026-11-20 全部依一拆四還原，分割前後沒有斷層 (2025-06-10 停牌前 47.16，06-18 復牌 47.57)
  - 0056 原本 2007-12 的 4 筆也保留下來
  - `fetch_daily.py` 加上重試 (證交所偶爾會中途切斷連線)
  - 0050、006208、0056、00878、00919 當日漲跌與價格檔一致

## 待辦清單 (依序)
1. **需要使用者**：申請 Groq 金鑰，跑 `scripts/check_groq.py`，依結果調整 prompt。
2. **需要使用者**：建 HF Space 部署後端 (docs/deploy.md 第 3 節)，把網址填進城市設定。
3. ~~跑 `python scripts/update_all.py`~~ (2026-11-21 完成，之後要更新資料再跑一次即可)
4. 前十大持股與投信官網核對；整理配息資料 `data/dividends.json` (格式：`{"dividends": {"0056": [{"date": "YYYY-MM-DD", "amount": 0.0}]}}`)。
5. 跑實驗一 A、B、C、D，產生 `experiments/exp1/report.md`。
6. 實驗二：找受試者；實驗三：收截圖並標註。
7. 期末報告與 demo 腳本。
8. 城市加分項 (看時間)：ETF 換股的路線改道 (需要歷史持股)、月營收吊車、外資巴士、圖像生成的外牆貼圖。

## 已知問題
- 開發環境 2026-11-21 起可以連證交所、櫃買、Yahoo、Groq (Groq 還沒有金鑰，所以 LLM 路徑還沒實際跑過)。
- 0050 在 2008-10 到 2009-03 的價格有幾天單日漲跌超過 10% (例如 2009-02-19 +16.5%)，當時漲跌幅限制是 7%，應該是 Yahoo 原始資料的錯誤；舊檔案也一樣。只影響從那段期間開始算的報酬，期末前可以和證交所歷史資料核對。
- 知識庫自編文件：`income-equalization`、`split` 已對照來源改寫 (status: 已核對)；其餘標示「待核對」的 9 篇期末前要對照來源檢查 (`grep -l '待核對' data/kb/*.md`)。
- 城市在手機上可以用，但標籤較擠；實驗二建議用電腦做。
