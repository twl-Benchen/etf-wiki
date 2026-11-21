import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("ETFCITY_DATA", ROOT / "data"))
# LLM 設定：沒有 GROQ_API_KEY 時自動改用 mock (規則版)，方便離線測試
LLM_PROVIDER = os.environ.get("ETFCITY_LLM", "groq" if os.environ.get("GROQ_API_KEY") else "mock")
PLANNER_MODEL = os.environ.get("ETFCITY_PLANNER_MODEL", "openai/gpt-oss-20b")
WRITER_MODEL = os.environ.get("ETFCITY_WRITER_MODEL", "openai/gpt-oss-120b")
VISION_MODEL = os.environ.get("ETFCITY_VISION_MODEL", "qwen/qwen3.8-27b")
CACHE_DIR = Path(os.environ.get("ETFCITY_CACHE", ROOT / ".cache_llm"))
DISCLAIMER = "本系統只說明資料，不提供投資建議，也不預測漲跌。"
# 城市行政區：產業 -> 行政區
DISTRICTS = {
    "semi": {"name": "半導體園區", "industries": ["半導體業"]},
    "tech": {"name": "電子科技區", "industries": ["電腦及週邊設備業", "電子零組件業", "其他電子業", "通信網路業", "光電業", "電子通路業", "資訊服務業", "數位雲端"]},
    "fin": {"name": "金融區", "industries": ["金融保險業"]},
    "port": {"name": "航運港區", "industries": ["航運業"]},
    "life": {"name": "民生工業區", "industries": []},  # 其餘產業
}


def district_of(industry: str) -> str:
    for k, d in DISTRICTS.items():
        if industry in d["industries"]:
            return k
    return "life"
