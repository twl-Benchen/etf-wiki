"""把 Quaternius Universal Base Characters 的 glTF 整理成合併前的工作資料夾：
拿掉 Normal 與 Roughness 貼圖 (網頁用不到、檔案很大)，顏色貼圖縮小並轉成 JPEG。
用法：python prep_characters.py <角色資料夾> <頭髮資料夾> <輸出資料夾>
角色資料夾要有 Superhero_Male_FullBody.gltf/.bin、Superhero_Female_FullBody.gltf/.bin、T_Superhero_Male_Light.png、T_Superhero_Female_Light_BaseColor.png、T_Eye_Brown.png
頭髮資料夾要有 Hair_SimpleParted.gltf/.bin、Hair_Long.gltf/.bin、T_Hair_1_BaseColor.png、T_Hair_2_BaseColor.png"""
import json, shutil, sys
from pathlib import Path
from PIL import Image

CHAR, HAIR, OUT = (Path(a) for a in sys.argv[1:4])
OUT.mkdir(parents=True, exist_ok=True)
# 原始檔名 → (新檔名, 邊長)；其他圖片 (Normal、Roughness) 一律丟掉
TEX = {"T_Superhero_Male_Dark.png": ("male_body.jpg", 1024, CHAR / "T_Superhero_Male_Light.png"),
       "T_Superhero_Female_Dark_BaseColor.png": ("female_body.jpg", 1024, CHAR / "T_Superhero_Female_Light_BaseColor.png"),
       "T_Eye_Brown.png": ("eye.jpg", 128, CHAR / "T_Eye_Brown.png"),
       "T_Hair_1_BaseColor.png": ("hair_1.jpg", 512, HAIR / "T_Hair_1_BaseColor.png"),
       "T_Hair_2_BaseColor.png": ("hair_2.jpg", 512, HAIR / "T_Hair_2_BaseColor.png")}
for _, (name, size, src) in TEX.items():
    Image.open(src).convert("RGB").resize((size, size), Image.LANCZOS).save(OUT / name, quality=86)

for folder, files in [(CHAR, ["Superhero_Male_FullBody", "Superhero_Female_FullBody"]), (HAIR, ["Hair_SimpleParted", "Hair_Long"])]:
    for f in files:
        j = json.loads((folder / f"{f}.gltf").read_text(encoding="utf-8"))
        shutil.copy(folder / f"{f}.bin", OUT / f"{f}.bin")
        for m in j.get("materials", []):
            m.pop("normalTexture", None); m.pop("occlusionTexture", None)
            pbr = m.setdefault("pbrMetallicRoughness", {}); pbr.pop("metallicRoughnessTexture", None); pbr["metallicFactor"] = 0; pbr["roughnessFactor"] = 0.85
        for img in j.get("images", []):   # 用不到的圖片先指向一張小圖，合併時會被清掉
            img["uri"] = TEX[img["uri"]][0] if img.get("uri") in TEX else "eye.jpg"
            img["mimeType"] = "image/jpeg"
        (OUT / f"{f}.gltf").write_text(json.dumps(j), encoding="utf-8")
print("ok", sorted(p.name for p in OUT.iterdir()))
