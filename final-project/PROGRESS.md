# 進度紀錄 (接手的人先讀這份)

更新時間：2026-11-28

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
  - `scripts/assets/build_assets.mjs` 把素材整理成小檔案：Q 版人物 `minis.glb` (717 KB) 與街道道具 `citybits.glb` (207 KB)
  - 人物換成 Q 版 (Kenney Mini Characters 2.0，使用者覺得原本的真人模型不好看)：14 個角色共用一套骨架，依速度切換站立、走路、跑步與跳躍；騎滑板車時用簡單的反向動力學讓手握龍頭
    - 主角只用淺膚色的 10 個角色 (使用者要求)，按「換角色」輪流切換，記在瀏覽器；路人與店長 14 個角色都會出現
    - three.js 會把重複的骨頭名稱改成 torso_1，複製角色後依骨頭順序改回標準名稱，動作才套得上；每個角色外層節點加 `M_` 前綴，避免和場景名稱撞名
    - 先前試過 Quaternius 的模特兒與真人外觀角色 (Universal Animation Library、Universal Base Characters)，已移除
  - 路人與店長：離主角近的換成有動畫的模型 (物件池，電腦 20 + 10 個、手機 10 + 5 個)，遠的維持簡易模型
  - 路上騎機車的人換成坐著的 Q 版人物，戴依頭部大小做的安全帽
  - 路邊停的機車重新建模 (車身、踏板、座墊、龍頭、後照鏡、車牌、輪子合併成一個模型，車身有 7 種顏色)
  - 汽車換成 KayKit 的計程車、轎車、警車…；轉角有紅綠燈，人行道有消防栓 (拿掉看起來像黑色垃圾袋的垃圾桶)，廣場有長椅與樹叢
  - 素材載入失敗 (例如直接用 file:// 打開 index.html) 會自動退回簡易模型；測試改成用本機 http 伺服器 (`web/tests/run.py`)
  - 遊戲化：
    - 新聞 `scripts/fetch_news.py` (FinMind 台股新聞) → `data/news.json` → `city.json`：每家公司最多 3 則標題 (來源、時間、連結)，過濾論壇文章與帶預測或買賣字眼的標題；目前 69 家有新聞
    - 路人聊天 (靠近按 E 或點提示)：聊附近或今天漲跌最大的公司新聞，或考一個知識庫名詞；可以「帶我去」「問店長」「看原文」「換一則」；路人會停下來轉向你、播講話動作
    - 店家卡片多了「店長說」新聞
    - 任務 (Q 或「任務」)：5 張 ETF 集章卡 (走到前十大店門口自動蓋章，同一家店可以蓋好幾張卡，用來說明重疊持股；集滿後導覽員總結組成)、今日任務、和 5 位路人聊天、問 3 個問題、騎滑板車繞一圈；可以追蹤一張卡 (沒蓋章的店頭上有星星，上方顯示下一家與距離，點一下帶路)；進度存在瀏覽器
    - 測試：`web/tests/game.py`
  - 畫面效果：天空改成場景裡的漸層球；設定裡的畫質「高」有環境遮蔽 (GTAO) 加光暈、「中」只有光暈、「省電」都關掉 (電腦預設高、手機預設中，記在瀏覽器)；晚上招牌、跑馬燈、路燈會發光
  - 測試：`web/tests/tour.py` (多張截圖)、`web/tests/interact.py` (鍵盤、視角、點擊走路、手機搖桿)、`run.py qa` (離線問答)；也用本機後端測過連線模式；實驗二測試頁的 iframe 正常載入

### 已完成 (2026-11-26)
- [x] 配息問答接上規則版 Planner、模板 Writer 與前端離線版 (原本問「0056 去年配多少」會被導到知識庫)
  - `get_dividends(etf, year?)`：有年份列那一年 (依除息日)，沒有就列最近一年 (最後一次除息往前 335 天，季配四次、半年配兩次)；每次除息日與每單位配息、合計、次數都是編號數字
  - 0050 分割前的配息：每筆保留當時的金額，另附換算後的金額 (`amount_adj`)；合計一律用換算後的單位 (不然 2025 年會把舊單位 2.7 元和新單位 0.36 元直接相加)，回答會說明「一拆四，合計已換算」
  - 新的數字單位 `div` (最多三位小數，例如 0.675 元、1 元)
  - Planner：單一 ETF 加上「配息、除息、股息」加上「多少、幾次、什麼時候、去年…」才走配息；「配息多就代表賺比較多嗎」「什麼是除息」這類觀念題仍走知識庫。「今年、去年、前年」依資料最新的年份換算。「那 00878 呢？」會延續上一題的配息與年份
  - 問未來配息 (「0056 明年會配多少」) 拒答，只附最近一年的配息紀錄；守門規則也會保留 `get_dividends`
  - 沒有那一年的紀錄時 (例如 00919 2020 年) 說明紀錄從哪一年開始，年份也用編號，通過數字檢查
  - LLM 版 Planner 的 prompt 加上 `get_dividends` 和範例；Writer 的 prompt 加上配息規則
  - 前端：`city.json` 多了 `dividends`，離線版有相同的工具、判斷與回答，數字檢查全過
  - 測試：後端 49 個全過 (新增配息工具與路由測試)；`web/tests/run.py qa` 用 11 題配息與既有題目檢查，回答和後端一致，沒有錯誤
- [x] 重新匯入上層 wiki (`python scripts/import_wiki.py ..`)：wiki 在 11-23 有更新，新增 5 篇 (`wiki-ex-dividend`、`wiki-compound-interest`、`wiki-etf-features`、`wiki-etf-vs-stock-and-fund`、`wiki-price-movement`)，更新 6 篇；知識庫共 37 篇
  - 自編的 `ex-dividend` 和 `wiki-ex-dividend` 標題相同，檢索仍是自編的排第一、wiki 版第二 (實驗一的檢索命中不變)，LLM Writer 會同時拿到兩篇；兩篇內容沒有矛盾，但自編那篇的「除息日前一個交易日」等說法 wiki 沒有，仍標示待核對
  - 前端離線版的「為什麼…」原本一律導到今日行情，「ETF 為什麼會漲跌？」現在和後端一樣導到知識庫 (「為什麼港區在放煙火？」仍是行情)
  - 實驗一 `C_rule` 重跑仍全部通過
- [x] 觀念題模板回答：略過表格 (後端原本沒有略過)，原本接表格的句子去掉結尾冒號 (「0050 是什麼」原本結尾是「截至 2025-01：。」)
- [x] `docs/demo.md` 加上配息問答 (7-2) 與未來配息的拒答
- [x] 雲端環境改用個人環境「etf-wiki」(允許證交所、櫃買、Yahoo、FinMind、Groq；FinMind 與 Groq 金鑰存在環境的網路密鑰，由代理伺服器自動帶上，程式的環境變數放佔位值即可，例如 `FINMIND_TOKEN=proxy-injected`)
- [x] 跑 `scripts/update_all.py`：價格 (FinMind) 5 檔更新到 2026-11-26；0050 依一拆四還原，分割前後沒有斷層 (2025-06-10 47.16，06-18 47.57)；當日行情 2026-11-25 (證交所 OpenAPI 還沒公布 11-26)，5 檔 ETF 收盤與漲跌和價格檔一致；配息、新聞 (73 家) 同步更新

- [x] 第一次實際接上 Groq (`scripts/check_groq.py`)，Planner 與 Writer 7 題都由 LLM 完成 (0 次退回)。過程中修正：
  - gpt-oss 是推理模型，token 先用在思考，`max_tokens` 太小時回答是空的 (原本有兩題空白卻判為通過)。現在 gpt-oss 會加上 `reasoning_effort` (預設 low，環境變數 `ETFCITY_REASONING_EFFORT`) 並多留 1500 個 token；空白回答當成錯誤，不寫進快取，Writer 會重寫或退回模板
  - LLM 回答的全形括號統一改成半形；OpenCC 把「只有」轉成「隻有」的錯誤改回來
  - Writer prompt 加上：不能用「六成、一半」代替數字、不寫英文狀態代碼 (crash)、不寫「建議多關注」、權重要說明是前十大、未含息只用在報酬
  - 新增測試：空白回答退回模板、括號轉換 (後端 50 個全過)

- [x] 實驗一 A、B、C、D 正式跑完 (2026-11-26，價格到 11-26，前十大 11-20)，結果在 `experiments/exp1/report.md`
  - 數字正確率：A 純 LLM 3.3%、B 只有 RAG 0%、C 完整版 96.7%、D (Writer 20b) 93.3%；無出處數字：A 88.9%、B 90.4%、C 與 D 0%
  - 拒答正確率：A、B 13.3%，C、D 100%；誤拒率四組都是 0%；觀念關鍵詞：A 66.7%，B、C、D 100%
  - C、D 都錯 n15 (「我有 00878 20 萬和 00919 20 萬，前十大涵蓋多少比例？」)：LLM Planner 選了 `top10_overlap`，應該用 `lookthrough`。使用者決定不改 (2026-11-28)，維持原始結果，報告裡當成錯誤分析的例子
  - D 錯 n06：Writer 把編號寫成 `(ret_6m_0050)`，數字沒有填入，原本的檢查卻放行。已修正 checker (沒有大括號的編號判為不合格，會重寫或退回模板)，這是檢查程式的漏洞；報告裡的 D 結果維持修正前的原始紀錄
  - 這次用的 Groq 額度：兩個模型各約 1000 次請求中的數百次 (免費方案的每日上限)

- [x] 後端部署到 Render (2026-11-28)：`https://etf-metropolis.onrender.com`，Singapore 區、Free 方案，Root Directory `final-project`，環境變數 `GROQ_API_KEY`、`ETFCITY_CORS`；`/api/health` 回傳 `"llm":"groq"`。GitHub 的 Render App 只開放 etf-wiki 這個 repo
  - 城市預設連這個後端；休眠時顯示「後端喚醒中」並重試最多 90 秒，期間的問題會等它醒來 (見 docs/deploy.md 第 4 節)
  - `web/tests/run.py` 改成預設加 `?api=` 用離線版 (要測連線模式設環境變數 `API=網址`)；喚醒流程用模擬的延遲回應測過 (25 秒後醒來：問題等到後再由後端回答；一直沒醒：90 秒後改用離線版)

## 待辦清單 (依序)
1. ~~申請 Groq 金鑰，跑 `scripts/check_groq.py`，依結果調整 prompt~~ (2026-11-26 完成)
2. ~~部署後端~~ (2026-11-28 改用 Render 完成，城市已預設連線)
3. ~~跑 `python scripts/update_all.py`~~ (2026-11-21 完成，之後要更新資料再跑一次即可)
4. 前十大持股與投信官網核對 (要能連到投信網站；配息資料與配息問答已完成)。
5. ~~跑實驗一 A、B、C、D~~ (2026-11-26 完成，見上方；n15 維持原結果)
5-1. **需要使用者**：實際打開商店街試走 (電腦與手機)，回報手感、速度、哪裡看不清楚；實驗二受試者要先花一分鐘熟悉走路操作。
6. 實驗二：找受試者；實驗三：收截圖並標註。
7. 期末報告與 demo 腳本。
8. (完成) 人物外觀升級，見上方。
9. 城市加分項 (看時間)：ETF 觀光電車 (搭某檔 ETF 依權重一站一站停)、走進 3D 店內 (共用店內樣板)、月營收、圖像生成的外牆貼圖。

## 已知問題
- 開發環境 2026-11-21 起可以連證交所、櫃買、Yahoo、FinMind、Groq (Groq 還沒有金鑰，所以 LLM 路徑還沒實際跑過)。
- Claude Code 雲端的預設環境連不到證交所、櫃買、Yahoo、FinMind、Groq；要用個人環境「etf-wiki」(已設定好允許網域與金鑰)。Yahoo 偶爾回 429 (流量限制)，價格以 FinMind 為主所以不影響。
- 雲端環境預裝的瀏覽器配合 Playwright 1.63.0；`pip install -r requirements-dev.txt` 會裝最新版而找不到瀏覽器，這時執行 `pip install playwright==1.63.0`。
- 價格改用 FinMind 後，Yahoo 在 2008 到 2009 年的錯誤價格已經修正。沒有設定 `FINMIND_TOKEN` 而且 FinMind 額度用完時，會退回 Yahoo，這時候那段期間的價格會不準 (log 的 `source` 會寫 yahoo)。
- 知識庫自編文件：`income-equalization`、`split` 已對照來源改寫 (status: 已核對)；其餘標示「待核對」的 9 篇期末前要對照來源檢查 (要能連到證交所等網站) (`grep -l '待核對' data/kb/*.md`)。
- 商店街還沒在真的手機上測過效能 (開發環境只有軟體模擬的顯示卡)；實驗二建議用電腦做。
- 從廣場看對面時，站在某些角度點招牌可能先點到前面的東西 (站牌、牌樓)，屬於正常的遮擋。
