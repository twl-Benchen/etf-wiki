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
