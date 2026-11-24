from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..db import insert, many, one, to_int, update, utcnow
from ..extensions import limiter
from ..serializers import message_dict, resource_dict, session_dict, topic_dict
from ..services import bloom_engine, llm, tutor
from ..utils import current_user, error, log_activity, profile_of, uid

bp = Blueprint("learning", __name__)
DIFFS = {"beginner", "intermediate", "advanced"}


def _session(sid):
    return one("learning_sessions", {"_id": to_int(sid), "user_id": uid()})


def _subj_map(resource):
    s = one("subjects", {"_id": resource.get("subject_id")}) if resource.get("subject_id") else None
    return {s["_id"]: {"id": s["_id"], "name": s["name"]}} if s else {}


def _payload(s):
    msgs = many("chat_messages", {"session_id": s["_id"]}, sort=[("_id", 1)], limit=300)
    resource = one("resources", {"_id": s["resource_id"]})
    topic = one("extracted_topics", {"_id": s["topic_id"]}) if s.get("topic_id") else None
    levels = bloom_engine.topic_levels(uid(), topic["_id"]) if topic else []
    prog = one("learning_progress", {"user_id": uid(), "topic_id": topic["_id"]}) if topic else None
    topic_out = None
    if topic:
        ch = one("chapters", {"_id": topic["chapter_id"]})
        topic_out = {**topic_dict(topic), "chapter_title": ch["title"] if ch else ""}
    return {
        "session": session_dict(s),
        "messages": [message_dict(m) for m in msgs],
        "resource": resource_dict(resource, _subj_map(resource)),
        "topic": topic_out,
        "bloom": {"levels": levels, "current_level": bloom_engine.current_level(levels) if levels else s["bloom_level"]},
        "progress": {
            "mastery": round(prog["mastery"], 2) if prog else 0,
            "status": prog["status"] if prog else "not_started",
            "time_spent_seconds": prog["time_spent_seconds"] if prog else 0,
        },
    }


@bp.post("/session")
@jwt_required()
def create_session():
    d = request.get_json(silent=True) or {}
    r = one("resources", {"_id": to_int(d.get("resource_id")), "user_id": uid()})
    if not r:
        return error("Resource not found.", 404)
    if r["status"] != "completed":
        return error("This resource is still being processed.", 409)
    topic_id = to_int(d.get("topic_id"))
    if topic_id is not None and not one("extracted_topics", {"_id": topic_id, "resource_id": r["_id"]}):
        return error("Topic not found in this resource.", 404)

    mode = d.get("mode")
    if mode and mode not in ("socratic", "direct"):
        return error("Invalid teaching mode.")
    s = one("learning_sessions", {"user_id": uid(), "resource_id": r["_id"], "topic_id": topic_id}, sort=[("last_active_at", -1)])
    if s:  # resume: keep conversation, optionally change mode
        fields = {"last_active_at": utcnow()}
        if mode:
            fields["mode"] = mode
        update("learning_sessions", s["_id"], fields)
        s.update(fields)
    else:
        prof = profile_of(current_user())
        s = insert("learning_sessions", {
            "user_id": uid(), "resource_id": r["_id"], "topic_id": topic_id, "mode": mode or prof["preferred_mode"],
            "difficulty": prof["difficulty_level"], "bloom_level": 1, "misconceptions": [], "last_active_at": utcnow()})
    return jsonify(_payload(s)), 201


@bp.get("/session/<int:sid>")
@jwt_required()
def get_session(sid):
    s = _session(sid)
    if not s:
        return error("Session not found.", 404)
    return jsonify(_payload(s))


@bp.patch("/session/<int:sid>/mode")
@jwt_required()
def set_mode(sid):
    s = _session(sid)
    if not s:
        return error("Session not found.", 404)
    code = (request.get_json(silent=True) or {}).get("mode")
    if code not in ("socratic", "direct"):
        return error("Mode must be 'socratic' or 'direct'.")
    update("learning_sessions", sid, {"mode": code})  # conversation, topic, misconceptions and progress are untouched
    s["mode"] = code
    log_activity(uid(), "mode_switch", s["resource_id"], s.get("topic_id"), code)
    return jsonify(session=session_dict(s))


@bp.patch("/session/<int:sid>")
@jwt_required()
def update_session(sid):
    s = _session(sid)
    if not s:
        return error("Session not found.", 404)
    diff = (request.get_json(silent=True) or {}).get("difficulty")
    if diff not in DIFFS:
        return error("Invalid difficulty.")
    update("learning_sessions", sid, {"difficulty": diff})
    s["difficulty"] = diff
    return jsonify(session=session_dict(s))


@bp.post("/session/<int:sid>/heartbeat")
@jwt_required()
def heartbeat(sid):
    s = _session(sid)
    if not s:
        return error("Session not found.", 404)
    secs = max(0, min(int((request.get_json(silent=True) or {}).get("seconds") or 0), 120))
    if secs:
        log_activity(uid(), "study", s["resource_id"], s.get("topic_id"), s["mode"], secs)
        if s.get("topic_id"):
            p = bloom_engine.get_progress(uid(), s["topic_id"])
            fields = {"time_spent_seconds": p["time_spent_seconds"] + secs, "last_studied_at": utcnow()}
            if p["status"] == "not_started":
                fields["status"] = "learning"
            update("learning_progress", p["_id"], fields)
        update("learning_sessions", sid, {"last_active_at": utcnow()})
    return jsonify(ok=True)


@bp.post("/chat")
@jwt_required()
@limiter.limit("40 per minute")
def chat():
    d = request.get_json(silent=True) or {}
    s = _session(d.get("session_id"))
    if not s:
        return error("Session not found.", 404)
    action = d.get("action")
    if action and action not in tutor.ACTION_TEXT:
        return error("Unknown action.")
    text = str(d.get("message") or "").strip()
    if not action and not text:
        return error("Please type a message.")
    if len(text) > 4000:
        return error("Message is too long (max 4000 characters).")
    try:
        return jsonify(tutor.respond(s, text, action))
    except llm.LLMNotConfigured as exc:
        return error(str(exc), 503)
    except llm.LLMError as exc:
        return error(str(exc), 502)


@bp.get("/history")
@jwt_required()
def history():
    out = []
    for s in many("learning_sessions", {"user_id": uid()}, sort=[("last_active_at", -1)], limit=50):
        last = one("chat_messages", {"session_id": s["_id"]}, sort=[("_id", -1)])
        res = one("resources", {"_id": s["resource_id"]})
        topic = one("extracted_topics", {"_id": s["topic_id"]}) if s.get("topic_id") else None
        out.append({**session_dict(s), "resource_title": res["title"] if res else "",
                    "topic_title": topic["title"] if topic else None,
                    "last_message": last["content"][:140] if last else None})
    return jsonify(sessions=out)
