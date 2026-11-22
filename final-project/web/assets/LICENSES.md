# 3D 素材來源與授權

兩份素材都是 CC0 1.0 (公眾領域)，可以免費用在個人、教育與商業用途，不需要標示作者。這裡仍然列出作者，感謝他們。

| 檔案 | 內容 | 作者與來源 | 授權 |
|---|---|---|---|
| `mannequin.glb` | 人物模型與 12 種動作 (站立、走路、慢跑、衝刺、跳躍、講話、坐下、跳舞…)，已移除其他動作與手指骨頭的動作 | Quaternius，Universal Animation Library (Standard)，https://quaternius.com/packs/universalanimationlibrary.html | CC0 1.0 |
| `people.glb` | 真人外觀的男女角色 (含眼睛、眉毛) 與兩款頭髮，貼圖縮小成 JPEG、拿掉 Normal 與 Roughness；衣服是遊戲裡用著色器畫上去的 | Quaternius，Universal Base Characters (Standard)，https://quaternius.com/packs/universalbasecharacters.html | CC0 1.0 |
| `citybits.glb` | 汽車 (計程車、轎車、掀背車、旅行車、警車)、紅綠燈、消防栓、垃圾桶、長椅、樹叢等 | Kay Lousberg，KayKit City Builder Bits 1.0，https://kaylousberg.itch.io/city-builder-bits | CC0 1.0 |

重新產生：`cd scripts/assets && npm install`，角色先跑 `python prep_characters.py <角色資料夾> <頭髮資料夾> <工作資料夾>`，再 `node build_assets.mjs --people <工作資料夾> <UAL1_Standard.glb 的路徑>` (原始 zip 太大，不放進 repo)。
