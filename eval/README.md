# eval/ QA 考題

用來**考 Wiki** 的題目，不能 ingest 進 Wiki。流程見 `AGENTS.md` 5.4。

- `questions.json`：只有題目，作答時只能讀這個檔
- `answers.json`：標準答案與出處，全部答完才能打開批改
- `set`：`dev` 用來找問題、修 Wiki；`holdout` 最後只考一次

## 目前題目的來歷

18 題 (dev 12、holdout 6) 是 AI 在 ingest **之前**，直接從 raw 卡上的原文連結出的題目 (origin: ai-from-raw)，標準答案還沒有經過人工確認，請找時間看過一遍。因為題目在 Wiki 寫出來之前就固定了，不會出現「看著 Wiki 出題」的問題。

限制：出題和寫 Wiki 的是同一個 AI，作答時它可能記得題目內容。之後可以加入人寫的題目，用新開的 AI 對話作答，結果會更客觀。

## dev-ext 外部題庫 (原 holdout-ext)

x01 到 x25 取自使用者提供的觀念題庫 (etf.txt，1,068 題)，`scope` 欄位：`in` 為 Wiki 範圍內，`out` 為範圍外 (正確行為是答「Wiki 沒有這項資料」)，`advice` 為投資建議性質 (正確行為是依 AGENTS.md 5.2 拒答)。題庫答案未必正確，使用者在 2026-11-23 逐題審查過，審查結果見 `holdout-ext-review.md`，修正後的答案在 `answers.json` 的 `reviewed_answer`。x03、x07、x09 是重複題 (`duplicate: true`)，不列入計分。這組題目已經用來找缺口並修改 Wiki，所以從 holdout 改成 dev-ext。

## 加入自己的題目

在兩個檔案各加一筆，id 用 `d13`、`h07` 往後排，問題與答案的 id 要一致。
