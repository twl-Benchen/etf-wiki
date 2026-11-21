# 實驗

| 實驗 | 內容 | 怎麼跑 | 需要 |
|---|---|---|---|
| exp1 | 問答正確性：60 題 (觀念、數字、比較、拒答各 15)，比較 A 純 LLM、B 只有 RAG、C 完整版、D 完整版但 Writer 用 20b | `python experiments/exp1/run.py A B C D` 然後 `python experiments/exp1/grade.py` | `GROQ_API_KEY` |
| exp2 | 呈現方式的初步使用者測試：同一位受試者用表格與城市兩種介面各答 8 題，順序依編號交錯 | 打開 `web/study.html` (GitHub Pages 上的網址)，受試者做完下載 CSV，放進 `exp2/data/`，跑 `python experiments/exp2/analyze.py` | 10 位左右的同學 |
| exp3 | 截圖辨識的可行性測試：傳統 OCR 對看圖模型 | 見 `exp3/README.md` | 20 到 30 張去識別化的截圖、`GROQ_API_KEY`、tesseract |

- exp1 的標準答案在評分時由 `backend/etfcity/tools.py` 依當時資料計算，資料更新後重新評分即可。
- exp1 的 LLM 回應有快取 (`.cache_llm/`)，中斷後重跑會從還沒做的題目繼續。
- `C_rule` 是不呼叫 LLM 的規則版，只用來檢查流程；它的規則是看過題庫後調整的，不能當正式結果。
