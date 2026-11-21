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

## 3. 後端部署到 Hugging Face Space

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

- 歷史價格：`python scripts/fetch_prices.py` (yfinance)
- 當日行情：`python scripts/fetch_daily.py` (證交所與櫃買 OpenAPI)，寫出 `data/daily.json` 後，城市的「真實」行情按鈕才會出現
- 跑完記得 `python scripts/build_site_data.py && python web/build.py`

`.github/workflows/update-data.yml` 會在平日收盤後自動做上面的事，但 GitHub Actions 只讀 repo 根目錄的 `.github/`，所以要等專案搬到獨立的 repo 後才會生效。在那之前請在自己的電腦或 Colab 手動執行。

## 6. 搬到獨立的 repo (第十週作業評分後)

1. 在 GitHub 建立 `etf-metropolis`。
2. 把 `final-project/` 的內容複製到新 repo 的根目錄 (`.github/` 也要一起)。
3. 知識庫：新 repo 沒有上層的 `wiki/`，改成 `git clone https://github.com/twl-Benchen/etf-wiki` 後執行 `python scripts/import_wiki.py <etf-wiki 路徑>`。
4. 開啟新 repo 的 GitHub Pages (來源選 main，資料夾選 `/web` 不行的話選根目錄，再把網址改成 `/web/`)。
5. 確認 Actions 有權限寫回 repo (Settings → Actions → Workflow permissions → Read and write)。
