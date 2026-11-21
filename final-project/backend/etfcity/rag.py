"""知識庫檢索 (RAG)。一篇文件一個向量。
預設用字元 n-gram 的 TF-IDF 向量 (不用下載模型，免費的 Space 也跑得動)；
設定環境變數 ETFCITY_EMBED_MODEL (例如 BAAI/bge-small-zh-v1.5) 且裝了 sentence-transformers 時改用語意向量。
裝了 faiss 就用 FAISS 的內積索引，否則用 numpy 計算，結果相同。"""
from __future__ import annotations
import math, os, re
from collections import Counter
from functools import lru_cache
from pathlib import Path
import numpy as np
from .config import DATA_DIR

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


def parse_doc(path: Path) -> dict:
    txt = path.read_text(encoding="utf-8"); meta = {}
    if txt.startswith("---"):
        _, fm, body = txt.split("---", 2)
        for line in fm.strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1); v = v.strip()
                meta[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()] if v.startswith("[") and v.endswith("]") else v
    else:
        body = txt
    body = body.strip()
    urls = meta.get("source_urls") or []
    if isinstance(urls, str):
        urls = [urls]
    return {"id": path.stem, "title": meta.get("title", path.stem), "summary": meta.get("summary", ""), "aliases": meta.get("aliases", []) or [],
            "source_urls": urls, "source_note": f" (來源：{meta['source_name']})" if meta.get("source_name") else "", "text": body}


def _grams(s: str) -> list[str]:
    s = re.sub(r"[\s，。、；：？！「」()（）\-\[\]*#>|`]", "", s.lower())
    return [s[i:i + n] for n in (1, 2, 3) for i in range(len(s) - n + 1)]


class KnowledgeBase:
    def __init__(self, kb_dir: Path | str | None = None):
        self.dir = Path(kb_dir or DATA_DIR / "kb")
        self.docs = [parse_doc(p) for p in sorted(self.dir.glob("*.md"))]
        self.model = None; self.index = None
        name = os.environ.get("ETFCITY_EMBED_MODEL")
        if name:
            try:
                from sentence_transformers import SentenceTransformer  # type: ignore
                self.model = SentenceTransformer(name)
            except Exception:
                self.model = None
        if self.docs:
            self._build()

    def _doc_text(self, d: dict) -> str:  # 標題與別名加重
        return (d["title"] + " ") * 3 + " ".join(d["aliases"]) * 2 + " " + d["summary"] + " " + d["text"]

    def _build(self):
        if self.model is not None:
            self.mat = np.asarray(self.model.encode([self._doc_text(d) for d in self.docs], normalize_embeddings=True), dtype="float32")
        else:
            counts = [Counter(_grams(self._doc_text(d))) for d in self.docs]
            df = Counter(g for c in counts for g in c)
            self.vocab = {g: i for i, g in enumerate(df)}
            n = len(self.docs)
            self.idf = np.array([math.log((1 + n) / (1 + df[g])) + 1 for g in self.vocab], dtype="float32")
            self.mat = np.vstack([self._tfidf(c) for c in counts])
        if faiss is not None:
            self.index = faiss.IndexFlatIP(self.mat.shape[1]); self.index.add(self.mat)

    def _tfidf(self, c: Counter) -> np.ndarray:
        v = np.zeros(len(self.vocab), dtype="float32")
        for g, k in c.items():
            i = self.vocab.get(g)
            if i is not None:
                v[i] = (1 + math.log(k)) * self.idf[i]
        nrm = np.linalg.norm(v)
        return v / nrm if nrm else v

    def embed(self, q: str) -> np.ndarray:
        if self.model is not None:
            return np.asarray(self.model.encode([q], normalize_embeddings=True), dtype="float32")[0]
        return self._tfidf(Counter(_grams(q)))

    def search(self, query: str, k: int = 3, min_score: float | None = None) -> list[dict]:
        if not self.docs:
            return []
        query = re.sub(r"什麼是|是什麼|什麼意思|為什麼|怎麼|如何|請問|可以|嗎|呢|的意思|多少|哪些|有沒有|？|\?", " ", query).strip() or query
        qv = self.embed(query)
        if self.index is not None:
            sc, ix = self.index.search(qv.reshape(1, -1), min(k, len(self.docs))); pairs = list(zip(ix[0].tolist(), sc[0].tolist()))
        else:
            sims = self.mat @ qv; order = np.argsort(-sims)[:k]; pairs = [(int(i), float(sims[i])) for i in order]
        thr = min_score if min_score is not None else (0.35 if self.model is not None else 0.1)
        out = []
        for i, sc_ in pairs:
            d = self.docs[i]; bonus = 0.25 if any(a and a.lower() in query.lower() for a in [d["title"], *d["aliases"]]) else 0.0
            if sc_ + bonus >= thr:
                out.append({**d, "score": round(min(0.99, sc_ + bonus), 3)})
        return sorted(out, key=lambda h: -h["score"])


@lru_cache(maxsize=1)
def get_kb() -> KnowledgeBase:
    return KnowledgeBase()
