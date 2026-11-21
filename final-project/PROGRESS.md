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
- [x] 接上 FinMind (金鑰放環境變數 `FINMIND_TOKEN`，共用工具 `scripts/finmind.py`，每小時 600 次，一次完整更新約用 15 次)
  - 歷史價格改成以 FinMind 為主 (資料來自證交所)，失敗時才用 Yahoo。分割倍數直接查 FinMind 的分割表 (0050：2025-06-18 恢復交易，4 倍)
  - 和 Yahoo 相比修正了：2008-10 到 2009-03 的錯誤價格、颱風假與停牌日的假價格、漏掉的週六補行交易日、006208/00878/00919 上市前的假價格 (發行價)
  - 配息 `scripts/fetch_dividends.py` → `data/dividends.json` (5 檔共 123 筆，`amount` 是當時每單位配息，`amount_adj` 依分割換算成和價格檔同一基準)。和 Yahoo 核對：Yahoo 的 0050 在 2014 年以前沒有除以 4、2022-08-02 多一筆，006208 有一筆日期錯誤，其餘一致
  - `get_dividends` 工具現在有資料了，來源標示改成依 `dividends.json`
  - `update_all.py`、GitHub Actions (要在 repo Secrets 加 `FINMIND_TOKEN`)、Colab 筆記本、`docs/deploy.md` 都已加上 FinMind
- [x] 城市納入上市公司市值前 100 大 (`data/market_cap.json`，使用者 2026-11-21 提供的排行；`scripts/update_companies.py` 合併進 `companies.json`，新公司的產業查 FinMind)
  - 城市公司 (`city_companies`) = 市值前 100 大加上 ETF 前十大，共 100 家；當日行情 105 檔 (含 5 檔 ETF) 全到
  - 區改名成街：半導體街、電子街、金融街、航運港、民生街 (程式裡仍叫 district)
  - `get_stock_info` 多了市值占大盤比重；沒有被 ETF 前十大持有的公司 (例如大立光) 會說明「不在前十大，櫥窗沒有貼紙」
  - 後端回答改成商店街的比喻 (店長、導引線、櫥窗貼紙、鐵捲門、彩帶)
  - 修正：OpenCC 會把「台積電」轉成「臺積電」，現在先保護公司與 ETF 名稱，一般用字統一用「台」
  - 實驗二第 7 題的選項原本寫死舊區名 (答案不在選項裡)，改成讀設定
- [x] 前端改版：3D 商店街 (取代原本可旋轉的俯瞰城市)
  - 回字型街道一圈 656 公尺，兩側都是店；100 家公司依產業分成五條街 (半導體街、電子街、航運港、金融街、民生街)，同街內相近產業排在一起；空位補一般小店 (早餐店、飲料店…，不能互動)
  - 店面寬度依市值排行：第 1 名旗艦店 26 公尺、2 到 10 名 14 公尺、11 到 40 名 10 公尺、其餘 7.5 公尺；大店有屋頂招牌
  - 今天的漲跌：招牌下的跑馬燈 (紅漲綠跌) 加外觀五級 (大漲掛彩帶、燈全亮；大跌鐵捲門拉下一半、招牌閃爍)
  - ETF：地上的彩色導引線，從 ETF 廣場的站牌出發，沿著馬路經過它的前十大；櫥窗貼紙寫著持有它的 ETF 與權重
  - 角色：背後視角 (看得到背部，可滾輪拉遠拉近) 與眼睛視角，按 V 或按鈕切換；WASD 走路、拖曳轉頭、Shift 跑步、空白鍵跳；手機左下搖桿；點店家或地面會自動走過去 (可按「直接傳送」)；不會穿牆
  - 店家卡片 (今日漲跌、市值占大盤、持有的 ETF、問店長)；走到店門口會出現提示，按 E 或點提示打開
  - 小地圖與導覽圖 (每家店依漲跌上色，可選 ETF 看導引線、選兩檔標出共同持有的店，點店家直接傳送)
  - ETF 廣場：大螢幕 (平常顯示今日大盤，回放時畫走勢)、5 個 ETF 站牌、噴水池；港口有貨櫃船與起重機；路上有機車、汽車 (遇到人會停) 和路人
  - Agent 的畫面動作照舊 (後端不用改)：fly_to 改成走過去、focus_etfs 導引線變亮其他店變暗、mark_companies 光柱加浮動標籤、show_portfolio 金色購物袋、replay 廣場大螢幕
  - 效能：遠處的店只畫建築本體；一般街景約 120 到 260 個 draw call、3.5 萬個三角形；手機不開陰影
  - 滑板車：按 F 或「滑板車」上下車；最快每秒 15 公尺，按 Shift 24 公尺 (走路 4.4、跑步 9)；W 加速、S 煞車、轉向有速度上限所以會畫弧線；轉彎身體傾斜、速度快時視野變寬；高速時分段移動避免穿牆
  - 路上的機車與汽車重新建模 (輪子會轉、機車有座墊、龍頭與騎士)
- [x] 建模升級 (使用者選 A + B)：CC0 素材，見 `web/assets/LICENSES.md`
  - `scripts/assets/build_assets.mjs` 把素材整理成小檔案：人物 `mannequin.glb` (633 KB，12 種動作) 與街道道具 `citybits.glb` (207 KB)
  - 主角換成有骨架動畫的模特兒 (藍色上衣、黃色背包)，依速度切換站立、走路、慢跑、衝刺與跳躍；騎滑板車時用簡單的反向動力學讓手握龍頭
  - 路人與店長：離主角近的換成有動畫的模型 (物件池，電腦 14 + 8 個、手機 7 + 4 個)，遠的維持簡易模型
  - 汽車換成 KayKit 的計程車、轎車、警車…；轉角有紅綠燈，人行道有消防栓與垃圾桶，廣場有長椅與樹叢
  - 素材載入失敗 (例如直接用 file:// 打開 index.html) 會自動退回簡易模型；測試改成用本機 http 伺服器 (`web/tests/run.py`)
  - 測試：`web/tests/tour.py` (多張截圖)、`web/tests/interact.py` (鍵盤、視角、點擊走路、手機搖桿)、`run.py qa` (離線問答)；也用本機後端測過連線模式；實驗二測試頁的 iframe 正常載入

## 待辦清單 (依序)
1. **需要使用者**：申請 Groq 金鑰，跑 `scripts/check_groq.py`，依結果調整 prompt。
2. **需要使用者**：建 HF Space 部署後端 (docs/deploy.md 第 3 節)，把網址填進城市設定。
3. ~~跑 `python scripts/update_all.py`~~ (2026-11-21 完成，之後要更新資料再跑一次即可)
4. 前十大持股與投信官網核對 (配息資料已完成)。另外：規則版 Planner、模板 Writer、前端離線版還沒有接 `get_dividends` (問「0056 去年配多少」目前會被導到知識庫)；接的時候注意 0050 分割前的配息是舊單位，要說明或用 `amount_adj`。
5. 跑實驗一 A、B、C、D，產生 `experiments/exp1/report.md`。
5-1. **需要使用者**：實際打開商店街試走 (電腦與手機)，回報手感、速度、哪裡看不清楚；實驗二受試者要先花一分鐘熟悉走路操作。
6. 實驗二：找受試者；實驗三：收截圖並標註。
7. 期末報告與 demo 腳本。
8. 建模升級 (等使用者選方案)：人物換成 Quaternius 的 CC0 角色與動作庫 (要使用者從 itch.io 下載)、車輛與街道道具換成 KayKit City Builder Bits (CC0，GitHub 可直接下載)、電腦版加 SSAO 與夜間招牌光暈。
9. 城市加分項 (看時間)：ETF 觀光電車 (搭某檔 ETF 依權重一站一站停)、走進 3D 店內 (共用店內樣板)、月營收、圖像生成的外牆貼圖。

## 已知問題
- 開發環境 2026-11-21 起可以連證交所、櫃買、Yahoo、FinMind、Groq (Groq 還沒有金鑰，所以 LLM 路徑還沒實際跑過)。
- 價格改用 FinMind 後，Yahoo 在 2008 到 2009 年的錯誤價格已經修正。沒有設定 `FINMIND_TOKEN` 而且 FinMind 額度用完時，會退回 Yahoo，這時候那段期間的價格會不準 (log 的 `source` 會寫 yahoo)。
- 知識庫自編文件：`income-equalization`、`split` 已對照來源改寫 (status: 已核對)；其餘標示「待核對」的 9 篇期末前要對照來源檢查 (`grep -l '待核對' data/kb/*.md`)。
- 商店街還沒在真的手機上測過效能 (開發環境只有軟體模擬的顯示卡)；實驗二建議用電腦做。
- 從廣場看對面時，站在某些角度點招牌可能先點到前面的東西 (站牌、牌樓)，屬於正常的遮擋。
