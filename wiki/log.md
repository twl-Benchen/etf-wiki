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

## [2026-11-16] ingest | s03 折溢價與套利
- 討論：AI 提出 5 個重點 (兩個價格、兩個市場、套利機制與失效情況、2026 參考範圍、高溢價風險)，規劃 4 頁概念頁，並把 s02b 對初級市場門檻的說明合併進 primary-secondary-market。使用者授權 AI 自行決定
- 寫入：新增 sources/s03-premium-discount.md、concepts/nav.md、premium-discount.md、primary-secondary-market.md、creation-redemption.md；修改 expense-ratio.md (補回淨值連結)、twse.md (補上網站與專欄，有來源了)、what-is-etf.md (相關頁面)、index.md
- 檢查：lint.py 0 個問題；語意檢查發現 1 個問題 (見下)；0.5% / 3% / 5% 已標「截至 2026-05」
- 問題與修正：
  - [原文無法讀取] s03a 的 PDF 被證交所網站資安機制擋下，依 5.1 改用搜尋引擎提供的同一份 PDF 內文摘錄，另一篇同系列報導說法一致
  - [格式] 語意檢查發現 nav.md 寫「換算成每一個單位的價值」，來源只說「持股的總價值」，這半句是 AI 自己補的。lint.py 抓不到這種問題，因為整句有標來源。已刪除那半句

## [2026-11-16] ingest | s04 主動式與被動式
- 討論：AI 提出 4 個重點 (定義、三大差異、識別方式、不保證打敗指標)。和卡片規劃不同：卡片列了 etf-types、active-vs-passive、etf-ticker-codes 三頁，AI 判斷 etf-types 的內容會和另外兩頁重複，所以只建兩頁，ETF 種類的介紹放在 active-vs-passive。使用者授權 AI 自行決定
- 寫入：新增 sources/s04-active-vs-passive.md、concepts/active-vs-passive.md、concepts/etf-ticker-codes.md；修改 index-tracking.md (補上「被動式」的說法與連結)、index.md
- 檢查：lint.py 第 1 次 0 個問題，但 AI 檢查時發現 lint.py 本身有漏洞 (見下)；修腳本後抓到 1 個問題，修正後 0 個。語意檢查：常見誤解段落只寫證交所的說法，沒有寫「主動式比較好」之類的結論
- 問題與修正：
  - [格式] lint.py 的表格規則沒有在新段落重設，etf-ticker-codes.md 的表格沒有前導句，卻借用上一段的來源而通過檢查。修正腳本 (遇到標題就重設)，頁面改成表格前先寫一句有來源的前導句。這次是檢查工具本身出錯，而不是 Wiki 內容出錯
  - [缺資料] 卡片寫「主動式和被動式都要每天公開投資組合」，但 s04b 只寫到主動式，「兩者都要」只有沒建卡的報導提到，所以不寫進 Wiki

## [2026-11-16] ingest | s05 配息與總報酬
- 討論：AI 提出 5 個重點 (不是固定配息、看總報酬、月配季配的意思、六種風險、廣告提醒)。和卡片規劃不同：多開一頁 etf-risks，因為原文列出的六種風險可以把前面幾頁串起來，適合當簡報的總結章。原文的詐騙手法和定期定額建議不寫入。使用者授權 AI 自行決定
- 寫入：新增 sources/s05-dividend-vs-total-return.md、concepts/dividend-and-total-return.md、concepts/etf-risks.md、concepts/common-misconceptions.md；修改 what-is-etf.md (相關頁面)、index.md
- 檢查：lint.py 第 1 次 1 個問題 (總整理頁表格沒有前導句)，修正後 0 個；語意檢查：etf-risks 表格的「白話意思」欄是 AI 對風險名稱的解釋，屬於說明而不是新事實；common-misconceptions 沒有放新事實
- 問題與修正：
  - [格式] 總整理頁的表格表頭沒有來源，補上前導句。同樣的錯誤 (表格忘了前導句) 已經是第 2 次，代表 AGENTS.md 3.5 的頁面模板應該直接寫出表格的範例，見之後的流程修改

## [2026-11-16] eval | dev 第 1 次 (作答)
- 作答方式：只讀 eval/questions.json 的 dev 題，依 5.2 查 index.md 後打開頁面作答，作答時未打開 answers.json
- 作答紀錄：
  - d01 Exchange Traded Fund，正式名稱指數股票型基金 (what-is-etf)
  - d02 追蹤指數，不是打敗指數 (index-tracking)
  - d03 經理費、保管費等從淨值直接扣除，不會收到帳單 (expense-ratio)
  - d04 0.1%；和一般股票的比較：Wiki 沒有這項資料 (trading-costs)
  - d05 折價 (premium-discount)
  - d06 初級市場用淨值、次級市場用市價，一般人主要在次級市場 (primary-secondary-market)
  - d07 申購買回的套利機制會縮小價差 (creation-redemption)
  - d08 股票型 A、債券型 D (etf-ticker-codes)
  - d09 總報酬率，因為配息不固定、價格變化影響很大 (dividend-and-total-return)
  - d10 不是，由投信依基金狀況決定 (dividend-and-total-return)
  - d11 ETF 和指數的報酬差距，原因例如要付內扣費用 (tracking-error)
  - d12 Wiki 只提供觀念，不提供投資建議，附上 etf-0050、expense-ratio (依 5.2 第 4 點)

## [2026-11-16] eval | dev 第 1 次 (批改)
- 題數 / 正確率：12 題，正確 11、部分正確 1、錯誤 0、Wiki 沒有資料 0，正確率 91.7%，達到通過標準
- 錯題與原因：d04 部分正確，原因是缺資料。Wiki 只有 ETF 證交稅 0.1%，沒有一般股票的稅率。這個問題在 ingest s02 時就已經記下 (卡片寫了 0.3%，但來源沒有)，eval 證實它確實會影響回答
- 處理：依 5.4 第 5 點補新的 raw 卡，不把標準答案寫進 Wiki。找到財政部法規資料庫的證券交易稅條例當官方來源，建立 s06 (使用者授權 AI 代建，卡片上註明 added_by)
- 待人確認：d04 判成「部分正確」，依 5.4 第 6 點需要人看過

## [2026-11-16] ingest | s06 證券交易稅條例
- 討論：AI 提出 3 個重點 (股票 0.3%、其他核准有價證券 0.1%、債券 ETF 暫停徵收到 2026-12-31)，只修改 trading-costs.md，不新開頁面
- 寫入：新增 raw/s06 卡、sources/s06-securities-transaction-tax.md；修改 trading-costs.md、index.md、raw/README.md
- 檢查：lint.py 0 個問題；語意檢查：債券 ETF 的期限已寫明並提醒以最新公告為準
- 問題與修正：
  - 法條沒有直接寫 ETF 的稅率，ETF 0.1% 仍標 s02b，股票 0.3% 標 s06a，避免把兩個來源混成一句話
  - 附帶發現：債券 ETF 暫停徵收在 2026-12-31 到期，離現在只剩一個多月，簡報要特別標日期

## [2026-11-16] eval | dev 第 2 次
- 題數 / 正確率：12 題，正確 12，正確率 100%
- 錯題與原因：無。d04 改答「ETF 0.1%，一般股票 0.3%，ETF 比較低」(trading-costs)
- 處理：無。限制：第 2 次的進步只能證明 d04 的缺口補上了，因為 dev 題目本來就是用來修 Wiki 的，這也是設計 holdout 組的原因

## [2026-11-16] eval | holdout (只考一次)
- 作答 (未打開 answers.json 前)：
  - h01 指數：追蹤指數；股票：在交易所像股票一樣買賣；基金：投信發行管理的一籃子投資 (what-is-etf)
  - h02 經理費 0.32%、保管費 0.035% (etf-0050)
  - h03 通常 0.5% 以內，持續超過 3% 明顯偏離，5% 以上要格外小心 (premium-discount)
  - h04 溢價收斂時市價會被套利拉回淨值附近，多付的溢價就消失，所以資產沒跌也可能虧損 (premium-discount + creation-redemption)
  - h05 簡稱前兩字「平衡」，代碼第六碼 T (etf-ticker-codes)
  - h06 不一定，證交所強調不保證超越績效指標、大盤或被動式 ETF (active-vs-passive)
- 題數 / 正確率：6 題，正確 6，正確率 100%
- 觀察：h04 需要同時讀兩頁才能完整回答，premium-discount 只寫了「會虧損」的結果，「為什麼」的機制在 creation-redemption。單頁讀者 (例如之後的 ETF都會 Agent 只抓一頁時) 可能答不完整，簡報要把這兩頁放在相鄰的位置
- 限制：出題、寫 Wiki、作答的都是同一個 AI，分數偏樂觀。建議使用者另外寫幾題，用新開的對話作答，結果會更客觀

## [2026-11-16] slides | 製作與檢查
- 頁數與大綱變更：17 頁 (封面、目錄、15 頁內容含回顧)，依 5 章排列：ETF 是什麼、花多少錢、兩個價格、種類、新手觀念。依 holdout h04 的觀察，把折溢價 (第 10 頁) 和套利 (第 11 頁) 放在相鄰位置，並在第 11 頁的結論同時引用兩頁。使用者授權 AI 自行確認大綱
- 檢查結果：
  - 來源：新增 scripts/check_slides.py，17 頁中 2 頁結構頁、15 頁有來源，路徑全部存在
  - 內容比對：逐頁對照 Wiki，數字 (0.32%、約 0.11%、0.1425%、0.1%、0.3%、0.5%/3%/5%、A/D/T) 都和 Wiki 一致；第 14 頁 A、B 的總報酬是用 Wiki 的假設例子算出來的，屬於例子，不是新事實
  - 版面：用 Chrome 截圖 1366×768 和 390×844 各 17 張，沒有 JavaScript 錯誤
- 問題與修正：
  - [格式] 第 11 頁的結論用到折溢價頁的說法，data-source 漏標 premium-discount.md，補上
  - [格式] 第 17 頁回顧頁原本當成結構頁 (不標來源)，但它重述了事實，改成標 4 個來源頁
  - [格式] 截圖發現：第 11 頁箭頭文字壓到箭頭；第 4、10、11 頁的 SVG 文字在手機上只剩約 8px；電腦版第 8、11、15 頁內容超出一個畫面。SVG 改成 HTML 排版，調整字級與間距後，電腦版全部一頁放得下，手機版只剩第 8、15 頁需要往下捲動 (卡片較多，可以接受)
  - 根目錄新增 index.html，自動導向 slides/

## [2026-11-16] rule-change | v1.2
- 修改：
  - AGENTS.md 5.1 第 2 步：討論時要列出「卡片上有、但原文找不到」的說法，當場決定要不要補卡
  - AGENTS.md 5.5 第 6 步：加入 check_slides.py 與電腦、手機截圖檢查，能用 HTML 排版的不用 SVG
  - docs/workflow.md 更新成 v1.2 流程圖，新增原文讀取分支、卡片 vs 原文、語意檢查、找錯頁出路、holdout、簡報三段檢查
- 原因：跑完一輪後回頭看 log。最常出錯的節點是「寫入 Wiki」(lint 共抓到 9 個問題，語意檢查 1 個)；eval 唯一的缺資料 (d04) 在 ingest s02 就已經發現，卻拖到 eval 才補；簡報的版面問題靠截圖才發現。所以把這三種檢查往前移
