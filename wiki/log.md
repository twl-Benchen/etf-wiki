---
title: 操作紀錄
type: log
---

# 操作紀錄

格式請見 `AGENTS.md` 第 6 節。只能往下新增，不能修改舊紀錄。

## [2026-11-13] setup | 建立專案地基
- 建立資料夾結構：raw/、wiki/、eval/、slides/、docs/
- 準備 5 張原始資料卡 (s01 到 s05)，主題涵蓋：什麼是 ETF、成本、折溢價、主動式與被動式、配息與總報酬
- 寫好 AGENTS.md 草稿 v0 和 docs/workflow.md 流程設計 v0，尚待與使用者討論定案
- eval/ 只放了格式範例，正式 QA 題目待使用者上傳

## [2026-11-16] rule-change | v0 → v1
- 修改：依 AI 對 v0 的逐節檢討 (共約 40 點) 定案 v1，主要變更如下
  - 專有名詞解釋改成「以每一頁為單位」，lint 的「太難」才有客觀標準
  - frontmatter 新增 summary、aliases；type 擴充成 concept / entity / source / index / log
  - 來源標註分成事實句 (必標) 與舉例比喻 (不標，但開頭寫「假設」且不能有新事實)；多網址的卡用子編號 s03a / s03b
  - 「截至」日期定義為來源發布或規定生效的月份
  - raw/ 改成只有人能改，ingest 狀態表從 raw/README.md 搬到 wiki/index.md
  - 「常見誤解」段落改成選填；entity 與 source 頁新增模板
  - 官方提醒可以寫，但要寫成「證交所提醒…」；矛盾改用 log 標籤 [矛盾]
  - Lint 拆成機械檢查 (新增 scripts/lint.py，每次全域執行) 與語意檢查 (只看改動頁)
  - Eval 題目與答案拆檔，分 dev / holdout 兩組，通過標準 dev 80% 以上且無「錯誤」
  - Slides 規定：eval 通過才開始、結構頁不標來源、data-source 從 repo 根目錄寫、圖表自己畫、根目錄部署 Pages
  - 每次 ingest 完成就 commit
- 原因：v0 有多處規則互相衝突或無法執行，例如 index/log 的 type 不在清單內、例子無法標來源、eval 讀題目時同時讀到答案、孤立頁面的定義永遠不會成立
- 使用者決定的 6 件事：例子不標來源 (是)、子編號 (用)、核對發現的新來源 (回報後由人決定建卡)、eval 拆檔與 holdout (要，門檻 80%)、狀態欄 (搬到 index)、commit 與 lint 腳本 (AI 每次 ingest 後 commit，要寫腳本)
- 同步調整 raw 卡：補上 subids 對照、s05 補確切發布日期 2024-11-29 (屬於定案前的整理，之後 raw/ 由人維護)

## [2026-11-16] ingest | s01 什麼是 ETF
- 討論：AI 提出 4 個重點 (英文全名與正式名稱、指數、股票、基金三面向)，規劃新增 3 頁 (what-is-etf、index-tracking、twse) 與來源摘要頁。使用者授權 AI 依 AGENTS.md 自行決定，未另外修改計畫
- 寫入：新增 sources/s01-what-is-etf.md、concepts/what-is-etf.md、concepts/index-tracking.md、entities/twse.md；更新 index.md
- 檢查：lint.py 第 1 次 1 個問題，修正後 0 個；語意檢查：「投信」「成分股」在首次出現處已補括號解釋，無建議句
- 問題與修正：
  - [格式] AI 在 twse.md 自行加上證交所官網網址，原文沒有提到，lint 判為缺來源。刪除，等有來源時再補。這是 AI 用自己的知識補內容的典型錯誤，機械檢查有效擋下
  - s01a 是放在個人網站的轉載文，不是官方原始網址，已記在來源摘要頁核對紀錄

## [2026-11-16] ingest | s02 ETF 的成本
- 討論：AI 提出 4 個重點 (內扣費用、0050 分級費率、交易成本、追蹤誤差)。和卡片規劃不同的地方：多開一頁 tracking-error (卡片沒列，但 s02b 有完整說明，而且 eval 也有題目需要)。使用者授權 AI 自行決定
- 寫入：新增 sources/s02-etf-costs.md、concepts/expense-ratio.md、concepts/trading-costs.md、concepts/tracking-error.md、entities/etf-0050.md；更新 index.md
- 檢查：lint.py 第 1 次 6 個問題，修正後 0 個；語意檢查：費率與稅率都已加「截至」，0050 頁只列數字、沒有寫「比較划算」之類的結論
- 問題與修正：
  - [矛盾] s02b 寫 0050 內扣約 0.46%，s02a 寫 2025-01 調降後經理費約 0.11%。判斷是新舊資料差異，兩者都寫並標日期
  - [原文無法讀取] s02a 全文抓取被擋，改用搜尋引擎提供的文章摘錄，已記在來源摘要頁核對紀錄
  - [缺資料] 卡片寫「一般股票證交稅 0.3%」，但兩個來源都沒有，Wiki 不寫。這會影響 eval d04，先記下
  - [格式] expense-ratio.md 連到還沒建立的 nav.md (淨值頁要等 s03 才建)，lint 判為死連結，先拿掉連結只留文字說明
  - [格式] 0050 費率表格每列都被判為缺來源，是規則沒有考慮表格，見下一筆 rule-change

## [2026-11-16] rule-change | v1.1
- 修改：AGENTS.md 3.4 新增表格的來源規則 (前導句有標來源就代表整張表)；scripts/lint.py 同步支援
- 原因：ingest s02 時，0050 分級費率很適合用表格呈現，但 v1 的「每個事實句都要標來源」讓表格每一列都要重複標，表格會變得很難讀
