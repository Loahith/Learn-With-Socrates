from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..db import iso, many, one, to_int
from ..extensions import limiter
from ..serializers import question_dict
from ..services import assessment as svc
from ..services import llm
from ..utils import current_user, error, profile_of, uid

bp = Blueprint("assessments", __name__)
DIFFS = {"beginner", "intermediate", "advanced"}


def assessment_dict(a, reveal=False, with_questions=True):
    res = one("quiz_results", {"assessment_id": a["_id"]})
    topic = one("extracted_topics", {"_id": a["topic_id"]}) if a.get("topic_id") else None
    qs = svc.questions_of(a["_id"])
    d = {
        "id": a["_id"], "title": a["title"], "type": a["assessment_type"], "bloom_level": a.get("bloom_level"),
        "difficulty": a["difficulty"], "mode": a["mode_code"], "status": a["status"], "resource_id": a["resource_id"],
        "topic_id": a.get("topic_id"), "topic_title": topic["title"] if topic else None,
        "created_at": iso(a.get("created_at")), "question_count": len(qs), "score_pct": res["score_pct"] if res else None,
    }
    if with_questions:
        d["questions"] = [question_dict(q, reveal=reveal) for q in qs]
    return d


def build(d, force_level=None):
    """Shared by /assessments/generate and /bloom/assessment."""
    r = one("resources", {"_id": to_int(d.get("resource_id")), "user_id": uid()}) if d.get("resource_id") is not None else None
    topic = None
    if d.get("topic_id") is not None:
        topic = one("extracted_topics", {"_id": to_int(d.get("topic_id"))})
        owner = one("resources", {"_id": topic["resource_id"], "user_id": uid()}) if topic else None
        if not topic or not owner:
            return error("Topic not found.", 404)
        r = r or owner
    if not r:
        return error("Resource not found.", 404)
    if r["status"] != "completed":
        return error("This resource is still being processed.", 409)
    if topic and topic["resource_id"] != r["_id"]:
        return error("Topic does not belong to this resource.", 400)

    level = force_level or d.get("bloom_level")
    if level is not None:
        level = to_int(level)
        if level is None or not 1 <= level <= 6:
            return error("Bloom level must be between 1 and 6.")
    prof = profile_of(current_user())
    diff = d.get("difficulty") or prof["difficulty_level"]
    if diff not in DIFFS:
        return error("Invalid difficulty.")
    mode = d.get("mode") if d.get("mode") in ("socratic", "direct") else prof["preferred_mode"]
    try:
        a = svc.generate(uid(), r, topic, level, d.get("num_questions", 5), d.get("types"), diff, mode)
    except ValueError as exc:
        return error(str(exc), 422)
    except llm.LLMNotConfigured as exc:
        return error(str(exc), 503)
    except llm.LLMError as exc:
        return error(str(exc), 502)
    return jsonify(assessment=assessment_dict(a)), 201


@bp.post("/generate")
@jwt_required()
@limiter.limit("20 per hour")
def generate():
    return build(request.get_json(silent=True) or {})


@bp.get("")
@jwt_required()
def list_assessments():
    rows = many("assessments", {"user_id": uid()}, sort=[("created_at", -1)], limit=100)
    return jsonify(assessments=[assessment_dict(a, with_questions=False) for a in rows])


@bp.get("/results")
@jwt_required()
def results():
    out, weak = [], {}
    for r in many("quiz_results", {"user_id": uid()}, sort=[("created_at", -1)], limit=100):
        a = one("assessments", {"_id": r["assessment_id"]})
        if not a:
            continue
        out.append({"id": r["_id"], "assessment_id": a["_id"], "title": a["title"], "score_pct": r["score_pct"],
                    "correct_count": r["correct_count"], "total": r["total"], "mode": r["mode_code"],
                    "bloom_level": a.get("bloom_level"), "created_at": iso(r["created_at"])})
        if a.get("topic_id") and r["score_pct"] < 60:
            t = one("extracted_topics", {"_id": a["topic_id"]})
            if t:
                weak.setdefault(t["title"], []).append(r["score_pct"])
    weak_topics = [{"topic": t, "avg_score": round(sum(v) / len(v), 1)} for t, v in weak.items()]
    return jsonify(results=out, weak_topics=sorted(weak_topics, key=lambda x: x["avg_score"]))


@bp.get("/<int:aid>")
@jwt_required()
def get_assessment(aid):
    a = one("assessments", {"_id": aid, "user_id": uid()})
    if not a:
        return error("Assessment not found.", 404)
    return jsonify(assessment=assessment_dict(a, reveal=a["status"] == "submitted"))


@bp.post("/submit")
@jwt_required()
@limiter.limit("30 per hour")
def submit():
    d = request.get_json(silent=True) or {}
    a = one("assessments", {"_id": to_int(d.get("assessment_id")), "user_id": uid()})
    if not a:
        return error("Assessment not found.", 404)
    if a["status"] == "submitted":
        return error("This assessment was already submitted.", 409)
    raw = d.get("answers") or {}
    if not isinstance(raw, dict):
        return error("Answers must be an object of question id -> answer.")
    answers = {}
    for k, v in raw.items():
        i = to_int(k)
        if i is not None:
            answers[i] = str(v)[:4000]
    return jsonify(svc.submit(uid(), a, answers))
