# ETF 入門 LLM Wiki

給沒投資過的大學生的 ETF 知識庫，用 Andrej Karpathy 提出的 LLM Wiki 架構建立：人提供原始資料並負責討論與確認，AI 負責整理成互相連結的 Wiki 頁面。Wiki 再用來產生一份教學型 HTML 簡報。

之後這個 Wiki 也會當作期末專案 ETF都會 (ETF 問答 Agent) 的知識庫。

## 目前進度

- [x] 規則手冊 AGENTS.md (v0 → v1 → v1.1 → v1.2)
- [x] Ingest 6 篇資料 (s01 到 s05，加上 eval 後補的 s06)，共 22 個 wiki 頁面
- [x] Eval：dev 12 題 (第 1 次 91.7%，補資料後 100%)、holdout 6 題 (100%)
- [x] 教學 HTML 簡報 17 頁：https://twl-benchen.github.io/etf-wiki/slides/
- [x] 反思與流程修改 (docs/workflow.md)

## 資料夾

| 位置 | 內容 |
|---|---|
| `AGENTS.md` | AI 的規則手冊：命名、格式、ingest / query / lint / eval / slides 流程 |
| `raw/` | 原始資料卡 |
| `wiki/` | AI 整理的 Wiki，`index.md` 是目錄，`log.md` 是操作與檢查紀錄 |
| `eval/` | QA 考題 (questions / answers 分開，dev / holdout 兩組) |
| `scripts/` | `lint.py` 檢查 Wiki、`check_slides.py` 檢查簡報來源 |
| `slides/` | 教學 HTML 簡報 |
| `docs/workflow.md` | loop / graph 設計與修改紀錄 |

## 流程

詳細流程圖與說明請見 [docs/workflow.md](docs/workflow.md)。

```
選資料 → 讀原文 → 報告重點與缺口 → 人確認 → 寫入 Wiki → lint.py → 語意檢查 → log + commit
   ↑                                                                          │
   └──────────────────────────── 還有資料 ────────────────────────────────────┘
→ Eval dev (缺資料回到選資料) → Eval holdout → 簡報大綱 → 產生簡報
→ check_slides.py → 內容比對 → 截圖檢查 → GitHub Pages
```

## 聲明

本專案內容僅供教學，不構成任何投資建議。資料以各來源發布當時為準，數字請以官方最新公告為主。
