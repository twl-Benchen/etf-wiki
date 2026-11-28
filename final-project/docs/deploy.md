# 部署與第一次執行

## 1. 本機跑起來

```bash
cd final-project
pip install -r requirements-dev.txt
cd backend && python -m pytest -q          # 測試
python app_gradio.py                        # Gradio 介面 (看 Agent 的執行過程)
uvicorn etfcity.api:app --port 7860         # 只開 API
```

沒有設定 `GROQ_API_KEY` 時，Agent 自動改用規則版 Planner 與模板 Writer (畫面上會顯示)，方便離線開發。

## 2. 接上 Groq

```bash
export GROQ_API_KEY=你的金鑰                 # Windows PowerShell：$env:GROQ_API_KEY="你的金鑰"
python scripts/check_groq.py                # 確認模型名稱與 LLM 的規劃、撰寫都正常
```

`check_groq.py` 最後會列出「退回規則或模板的次數」。次數偏多時，把輸出貼給 Claude 調整 `planner.py` 的 `planner_prompt()` 或 `writer.py` 的 `WRITER_SYSTEM`。

## 3. 後端部署到 Render (目前採用)

Hugging Face 從 2026-11 起，Docker 與 Gradio 類型的 Space 要訂閱 PRO 才能用免費 CPU (只有純前端的 Static Space 免費)，所以後端改放 Render。Render 直接從 GitHub repo 建置 `final-project/Dockerfile`，不用另外上傳檔案。

1. 用 GitHub 帳號登入 render.com，授權 Render 讀取 `twl-Benchen/etf-wiki`。
2. New → Web Service → 選 `twl-Benchen/etf-wiki`，設定：
   - Name：`etf-metropolis` (網址會是 `https://etf-metropolis.onrender.com`，名稱被用走時 Render 會加後綴)
   - Branch：`main`
   - Root Directory：`final-project`
   - Runtime / Language：Docker (Dockerfile Path 留預設 `./Dockerfile`)
   - Instance Type：Free
3. Environment Variables：新增 `GROQ_API_KEY` (值是 Groq 金鑰) 與 `ETFCITY_CORS=https://twl-benchen.github.io`。
4. 建立後等建置完成，打開 `<網址>/api/health` 應該看到 `"llm":"groq"`。
5. Dockerfile 會讀 Render 給的環境變數 `PORT`；後端啟動後約用 180 MB 記憶體。
6. 免費方案閒置一段時間會休眠，第一次連線要等它醒來，展示前先打開一次網址。免費方案的細節以 Render 網站上的說明為準。
7. main 有新的 commit 時 Render 預設會自動重新部署 (資料更新也會跟著上線)。

## 3-1. 後端部署到 Hugging Face Space (需要 PRO)

1. 在 Hugging Face 建一個 Space，SDK 選 **Docker**。
2. 在 `final-project/` 執行 `python scripts/make_space.py`，把產生的 `dist/space/` 裡的全部檔案上傳到 Space (網頁上的 Files → Add file → Upload files，或 git push 到 Space 的 repo)。
3. Space 的 Settings → Variables and secrets 新增 secret `GROQ_API_KEY`。若要限制只有自己的網站能呼叫，再加 variable `ETFCITY_CORS=https://twl-benchen.github.io`。
4. 建好之後，`https://<帳號>-<space 名稱>.hf.space/` 是 Gradio 介面，`/api/health` 可以確認狀態，`/docs` 是 API 文件。
5. 免費的 Space 閒置一段時間會休眠，展示前先打開一次網址把它叫醒。

## 4. 前端 (GitHub Pages)

目前放在 etf-wiki repo 裡，repo 的 GitHub Pages 從 main 根目錄部署，所以網址是：

- 城市：`https://twl-benchen.github.io/etf-wiki/final-project/web/`
- 表格介面：`.../final-project/web/table.html`
- 實驗二測試頁：`.../final-project/web/study.html`

要連上後端：打開城市 →「城市設定」→ 後端網址填 Space 的網址 → 連線。也可以直接用網址參數 `?api=https://<帳號>-<space>.hf.space`，設定會記在瀏覽器裡。

修改前端後：

```bash
python scripts/build_site_data.py   # 資料有變才需要
python web/build.py                 # 產生 index.html、table.html、study.html
```

## 5. 資料更新

- 一次全部更新：`python scripts/update_all.py` (當日行情、歷史價格、配息、前端資料、網頁、後端測試)
- 歷史價格：`python scripts/fetch_prices.py`，優先用 FinMind (資料來自證交所，已依分割還原)，失敗時改用 Yahoo Finance
- 配息：`python scripts/fetch_dividends.py` (FinMind 除權息結果表)，寫出 `data/dividends.json`
- 新聞標題：`python scripts/fetch_news.py` (FinMind 台股新聞)，寫出 `data/news.json`，給遊戲裡的路人和店長當聊天話題；只存標題、來源與連結，並過濾論壇文章和帶預測或買賣字眼的標題
- FinMind 金鑰：到 FinMind 官網註冊後取得，設成環境變數 `FINMIND_TOKEN` (例如 `export FINMIND_TOKEN=...`；Colab 放在 Secrets；GitHub Actions 放在 repo 的 Secrets)。不要寫進程式或 commit。沒有金鑰也能抓，但每小時額度較少
- 當日行情：`python scripts/fetch_daily.py` (證交所與櫃買 OpenAPI)，寫出 `data/daily.json` 後，城市的「真實」行情按鈕才會出現
- 跑完記得 `python scripts/build_site_data.py && python web/build.py`

`.github/workflows/update-data.yml` 會在平日收盤後自動做上面的事，但 GitHub Actions 只讀 repo 根目錄的 `.github/`，所以要等專案搬到獨立的 repo 後才會生效。在那之前請在自己的電腦或 Colab 手動執行。

## 6. 搬到獨立的 repo (第十週作業評分後)

1. 在 GitHub 建立 `etf-metropolis`。
2. 把 `final-project/` 的內容複製到新 repo 的根目錄 (`.github/` 也要一起)。
3. 知識庫：新 repo 沒有上層的 `wiki/`，改成 `git clone https://github.com/twl-Benchen/etf-wiki` 後執行 `python scripts/import_wiki.py <etf-wiki 路徑>`。
4. 開啟新 repo 的 GitHub Pages (來源選 main，資料夾選 `/web` 不行的話選根目錄，再把網址改成 `/web/`)。
5. 確認 Actions 有權限寫回 repo (Settings → Actions → Workflow permissions → Read and write)。
