# eval/ QA 考題

這裡的題目是用來**考 Wiki** 的，不能 ingest 進 Wiki。流程請見 `AGENTS.md` 5.4。

## 檔案

- `qa.example.json`：格式範例，只有 2 題示範
- `qa.json`：正式題目 (由使用者放入，建議 20 到 30 題基本概念題)

## 格式

```json
[
  {
    "id": "q001",
    "question": "題目",
    "answer": "標準答案",
    "topic": "對應的主題，例如 折溢價",
    "origin": "human"
  }
]
```

- `origin`：`human` 是人寫的題目；`ai-from-raw` 是 AI 從 `raw/` 原始資料出的題目，要人工看過答案才能用。
- 不要讓 AI 從 `wiki/` 出題，自己出題自己考會測不出問題。

## 結果紀錄

每次考試的正確率、錯題和原因寫在 `wiki/log.md`，類型用 `eval`。
