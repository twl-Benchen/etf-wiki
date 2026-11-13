# ETF 入門 LLM Wiki

給沒投資過的大學生的 ETF 知識庫，用 Andrej Karpathy 提出的 LLM Wiki 架構建立：人提供原始資料並負責討論與確認，AI 負責整理成互相連結的 Wiki 頁面。Wiki 再用來產生一份教學型 HTML 簡報。

之後這個 Wiki 也會當作期末專案 ETF都會 (ETF 問答 Agent) 的知識庫。

## 目前進度

- [x] 專案結構、規則手冊 (AGENTS.md 草稿)、流程設計 (docs/workflow.md 草稿)
- [x] 5 張原始資料卡 (raw/s01 到 s05)
- [ ] 定案 AGENTS.md
- [ ] Ingest 5 篇資料
- [ ] 用 QA 考 Wiki
- [ ] 教學 HTML 簡報
- [ ] 反思與流程修改

## 資料夾

| 位置 | 內容 |
|---|---|
| `AGENTS.md` | AI 的規則手冊：命名、格式、ingest / query / lint / eval / slides 流程 |
| `raw/` | 原始資料卡 |
| `wiki/` | AI 整理的 Wiki，`index.md` 是目錄，`log.md` 是操作與檢查紀錄 |
| `eval/` | QA 考題，用來檢查 Wiki |
| `slides/` | 教學 HTML 簡報 |
| `docs/workflow.md` | loop / graph 設計與修改紀錄 |

## 流程

詳細流程圖與說明請見 [docs/workflow.md](docs/workflow.md)。

```
選資料 → AI 提出重點 → 人確認 → 寫入 Wiki → Lint 檢查 → 寫 log
   ↑                                                      │
   └────────────────── 還有資料 ──────────────────────────┘
→ QA 考 Wiki → 補資料或修正 → 簡報大綱 → 人確認 → 產生簡報 → 簡報檢查 → 上線
```

## 聲明

本專案內容僅供教學，不構成任何投資建議。資料以各來源發布當時為準，數字請以官方最新公告為主。
