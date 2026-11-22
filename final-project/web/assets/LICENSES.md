# 3D 素材來源與授權

兩份素材都是 CC0 1.0 (公眾領域)，可以免費用在個人、教育與商業用途，不需要標示作者。這裡仍然列出作者，感謝他們。

| 檔案 | 內容 | 作者與來源 | 授權 |
|---|---|---|---|
| `minis.glb` | 14 個 Q 版人物 (男女各款、警察、工人) 共用一套骨架，保留 11 種動作 (站立、走路、跑步、跳躍、坐下、點頭、搖頭…) | Kenney，Mini Characters 2.0，https://kenney.nl/assets/mini-characters | CC0 1.0 |
| `citybits.glb` | 汽車 (計程車、轎車、掀背車、旅行車、警車)、紅綠燈、消防栓、長椅、樹叢等 | Kay Lousberg，KayKit City Builder Bits 1.0，https://kaylousberg.itch.io/city-builder-bits | CC0 1.0 |

路邊停的機車、路上騎的機車與滑板車是程式自己畫的，沒有用外部素材。

重新產生：`cd scripts/assets && npm install && node build_assets.mjs --minis <Mini Characters 解壓縮後的 Models/GLB format 資料夾>` (KayKit 會自動從 GitHub 下載)。
