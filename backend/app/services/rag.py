"""Retrieval over a student's own chunks using BM25 keyword ranking (no embeddings needed)."""
import math
import re
from collections import Counter

from ..db import col, many

STOP = set(
    "the a an and or of to in on for with is are was were be been it this that as by from at which "
    "what how why when where who can could should would do does did you your i we they them his her its "
    "about into than then so if not no yes also have has had will just more most some any".split()
)
_cache = {}  # (resource_id, updated_at) -> tokenised chunks


def _stem(w):
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) > len(suf) + 3:
            return w[: -len(suf)]
    return w


def tokens(text):
    return [_stem(w) for w in re.findall(r"[a-zA-Z0-9]{3,}", text.lower()) if w not in STOP]


def _load(resource):
    key = (resource["_id"], resource.get("updated_at"))
    if key not in _cache:
        for k in [k for k in _cache if k[0] == resource["_id"]]:
            del _cache[k]
        rows = col("resource_chunks").find({"resource_id": resource["_id"]})
        _cache[key] = [
            {"chunk_id": str(r["_id"]), "resource_id": resource["_id"], "page_number": r["page_number"],
             "text": r["text"], "tf": Counter(tokens(r["text"]))}
            for r in rows
        ]
    return _cache[key]


def retrieve(user_id, query, resource_ids, k=6, page_range=None):
    """Top-k chunks (dicts) from resources owned by this user, ranked with BM25."""
    resources = {r["_id"]: r for r in many("resources", {"_id": {"$in": list(resource_ids)}, "user_id": user_id})}
    docs = []
    for r in resources.values():
        docs.extend(_load(r))
    qt = set(tokens(query))
    if not docs or not qt:
        return []

    n = len(docs)
    avgdl = sum(sum(d["tf"].values()) for d in docs) / n or 1
    df = Counter()
    for d in docs:
        df.update(w for w in qt if w in d["tf"])

    k1, b = 1.5, 0.75
    scored = []
    for d in docs:
        dl = sum(d["tf"].values())
        s = 0.0
        for w in qt:
            f = d["tf"].get(w, 0)
            if not f:
                continue
            idf = math.log(1 + (n - df[w] + 0.5) / (df[w] + 0.5))
            s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgdl))
        if s <= 0:
            continue
        if page_range and page_range[0] and page_range[0] <= d["page_number"] <= (page_range[1] or page_range[0]):
            s *= 1.15
        scored.append((s, d))
    scored.sort(key=lambda x: x[0], reverse=True)

    out = []
    for i, (s, d) in enumerate(scored[:k], start=1):
        res = resources[d["resource_id"]]
        unit = {"pdf": "Page", "pptx": "Slide"}.get(res["file_type"], "Section")
        out.append(
            {"id": f"S{i}", "chunk_id": d["chunk_id"], "resource_id": res["_id"], "resource_title": res["title"],
             "location": f"{unit} {d['page_number']}", "page_number": d["page_number"], "text": d["text"], "score": round(s, 4)}
        )
    return out
