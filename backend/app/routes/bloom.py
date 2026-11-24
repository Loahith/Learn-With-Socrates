from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..db import many
from ..services import bloom_engine as be
from ..utils import error, uid
from .assessments import build

bp = Blueprint("bloom", __name__)


def _user_topics():
    """[(topic, resource_title)] for the user's completed resources, in reading order."""
    out = []
    for r in many("resources", {"user_id": uid(), "status": "completed"}, sort=[("_id", 1)]):
        chapters = {c["_id"]: c["order_index"] for c in many("chapters", {"resource_id": r["_id"]})}
        topics = many("extracted_topics", {"resource_id": r["_id"]})
        topics.sort(key=lambda t: (chapters.get(t["chapter_id"], 0), t["order_index"]))
        out.extend((t, r["title"]) for t in topics)
    return out


@bp.get("/topics")
@jwt_required()
def topics():
    by_topic = {}
    for b in many("bloom_progress", {"user_id": uid()}):
        by_topic.setdefault(b["topic_id"], {})[b["level"]] = b
    prog = {p["topic_id"]: p for p in many("learning_progress", {"user_id": uid()})}
    out = []
    for t, rtitle in _user_topics():
        rows = by_topic.get(t["_id"], {})
        lv = [{"level": i, "name": be.LEVELS[i - 1], "attempts": rows[i]["attempts"] if i in rows else 0,
               "score": round(rows[i]["score"], 3) if i in rows else 0.0} for i in range(1, 7)]
        p = prog.get(t["_id"])
        out.append({"topic_id": t["_id"], "title": t["title"], "resource_id": t["resource_id"], "resource_title": rtitle,
                    "levels": lv, "current_level": be.current_level(lv),
                    "mastery": round(p["mastery"], 2) if p else 0, "status": p["status"] if p else "not_started"})
    return jsonify(topics=out)


@bp.get("/progress")
@jwt_required()
def progress():
    rows = many("bloom_progress", {"user_id": uid()})
    titles = {t["_id"]: t["title"] for t, _ in _user_topics()}
    rows = [b for b in rows if b["topic_id"] in titles]
    levels = []
    for i in range(1, 7):
        rs = [b for b in rows if b["level"] == i and b["attempts"] > 0]
        levels.append({"level": i, "name": be.LEVELS[i - 1],
                       "score": round(sum(b["score"] for b in rs) / len(rs), 3) if rs else 0.0,
                       "topics_assessed": len(rs), "attempts": sum(b["attempts"] for b in rs)})
    current = next((l["level"] for l in levels if l["topics_assessed"] == 0 or l["score"] < be.MASTERY), 6)

    weak = sorted(
        [{"topic_id": b["topic_id"], "topic": titles[b["topic_id"]], "level": b["level"], "level_name": be.LEVELS[b["level"] - 1],
          "score": round(b["score"], 2)} for b in rows if b["attempts"] > 0 and b["score"] < 0.5],
        key=lambda w: w["score"])[:8]

    recs = []
    for tid in {b["topic_id"] for b in rows}:
        lv = be.topic_levels(uid(), tid)
        if any(l["attempts"] == 0 or l["score"] < be.MASTERY for l in lv):
            cur = be.current_level(lv)
            recs.append({"topic_id": tid, "topic": titles[tid], "level": cur, "level_name": be.LEVELS[cur - 1], "activity": be.ACTIVITIES[cur]})
    return jsonify(levels=levels, current_level=current, current_level_name=be.LEVELS[current - 1],
                   weak_concepts=weak, recommendations=recs[:6])


@bp.post("/assessment")
@jwt_required()
def assessment():
    d = request.get_json(silent=True) or {}
    if d.get("topic_id") is None:
        return error("topic_id is required.")
    if not d.get("bloom_level"):
        return error("bloom_level is required.")
    return build(d)
