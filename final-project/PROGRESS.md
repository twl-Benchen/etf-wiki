# 進度紀錄 (接手的人先讀這份)

更新時間：2026-11-17

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

## 下一步 (依序)
見檔案最下方的清單 (每次更新)。

## 重要限制與已知問題
- 這個開發環境連不到 Groq、證交所、Yahoo、Hugging Face，所以：
  - LLM 路徑 (`llm_plan`、LLM Writer) **還沒有用真的模型跑過**，只用 mock 測過流程。第一次接上 Groq 時要跑 `scripts/check_groq.py`。
  - 價格資料還是初始資料，要靠 GitHub Actions (`.github/workflows/update-data.yml`) 或本機執行 `scripts/fetch_*.py` 更新。
- 前十大持股是初始資料，`data/holdings.json` 的 `as_of` 是空的，更新後要填日期與來源。
- 配息資料 (`data/dividends.json`) 還沒有，`get_dividends` 會回覆「尚未整理」。

## 待辦清單
### 已完成 (2026-11-17 第二段)
- [x] 知識庫 32 篇 (`data/kb/`，16 篇匯入自 etf-wiki，16 篇自編；自編的 `status: 待核對`)
- [x] RAG (`rag.py`，字元 n-gram TF-IDF + FAISS；可用環境變數換成語意向量)
- [x] FastAPI (`api.py`)、Gradio 展示 (`app_gradio.py`)、HF Space 入口 (`app_space.py`、`Dockerfile`)
- [x] 截圖辨識 (`vision.py`，qwen/qwen3.8-27b，使用者確認後才計算)
- [x] 資料抓取：`scripts/fetch_prices.py` (yfinance)、`scripts/fetch_daily.py` (證交所與櫃買 OpenAPI)、`.github/workflows/update-data.yml`
- [x] `scripts/build_site_data.py` 產生 `web/data/city.json`
- [x] 測試 33 個全過 (`cd backend && python -m pytest -q`)

### 進行中：前端 `web/` (做到一半)
- `web/src/` 有四個片段，**還沒有 build.py，也還沒測過**：
  - `chat_head.part.html` (原型的 CSS/HTML，未修改)
  - `data.part.js` (新：從 city.json 讀資料、依產業自動配置大樓、新增民生工業區)
  - `scene.part.js` (原型場景，資料區塊換成 `__DATA_PART__` 佔位，支援真實行情 `real`)
  - `chat_ui.part.js` (原型對話 UI，已改成讀 CITY 資料、知識庫用 city.json 的 kb；裡面有 `__API_PART__` 佔位)

## 待辦清單 (依序)
1. 寫 `web/src/api.part.js` 取代 `__API_PART__`，至少要有：`let online=false`、`initApi()` (讀 `?api=` 網址參數或 localStorage 的後端網址，打 `/api/health`)、`connectApi()`、`askApi(q, typing)` (POST `/api/ask`，用 `addBot` 顯示回答與 trace，回傳 true；失敗回傳 false 改走規則版)、`runScene(actions)` (把後端的 focus_etfs / fly_to / mark_companies / show_portfolio / replay / set_time / reset 對應到現有的 setFocus、fitNames、setLabels、setRings、setMine、startReplay、applyTime、resetCity)。replay 的 series 格式是 `{d, inv, val, ch}`，ch 是百分比 (原型是小數)，要換算。
2. `chat_head.part.html`：設定面板加 `<button id="scn-real" data-scn="real">真實</button>` (chat_ui 有引用)、後端網址輸入框、持股輸入/截圖上傳對話框 (上傳前在 canvas 上讓使用者塗黑姓名帳號)；拿掉「原型｜規則模擬」「至 2025/5/29」字樣。
3. 寫 `web/build.py`：讀 `web/data/city.json` 取代 `data.part.js` 裡的 `__CITY__`，把 `__DATA_PART__`、`__API_PART__` 換掉，組成 `web/index.html`。測試沿用 `/home/claude/etf-city/test.py` 的做法 (Playwright + swiftshader，three.js 從本地 vendor 讀)。
4. 截圖檢查五個 ETF 的城市配置 (00919 新增群聯、力成、瑞儀，民生工業區目前沒有公司會被刪掉)。
5. GitHub repo `twl-Benchen/etf-metropolis` 建好後推上去，開 GitHub Pages (web/)、跑一次 Actions 更新資料。
6. 用 Groq 金鑰跑 `scripts/check_groq.py`，依結果調整 Planner / Writer prompt。
7. 實驗：`experiments/` 還沒寫。實驗一題庫 60 題 (觀念、數字、比較、拒答各 15)，標準答案由 tools 計算；四組設定用 `Agent(mode=...)` 與 `writer_model`。實驗二、三寫問卷與標註表格。
8. 配息資料 (`data/dividends.json`) 與前十大持股更新 (`holdings.json` 的 `as_of`)。
