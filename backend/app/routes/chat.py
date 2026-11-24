from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..cascade import delete_free_chat
from ..db import insert, many, one, to_int, update, utcnow
from ..extensions import limiter
from ..serializers import free_chat_dict, free_message_dict
from ..services import free_tutor, llm, tutor
from ..utils import current_user, error, profile_of, uid

bp = Blueprint("chat", __name__)
DIFFS = {"beginner", "intermediate", "advanced"}


def _chat(cid):
    return one("free_chats", {"_id": to_int(cid), "user_id": uid()})


@bp.get("/chats")
@jwt_required()
def list_chats():
    rows = many("free_chats", {"user_id": uid()}, sort=[("last_active_at", -1)], limit=60)
    return jsonify(chats=[free_chat_dict(c) for c in rows])


@bp.post("/chats")
@jwt_required()
def create_chat():
    d = request.get_json(silent=True) or {}
    prof = profile_of(current_user())
    mode = d.get("mode") if d.get("mode") in ("socratic", "direct") else prof["preferred_mode"]
    diff = d.get("difficulty") if d.get("difficulty") in DIFFS else prof["difficulty_level"]
    lang = str(d.get("language") or prof.get("primary_language") or "en-US").strip()[:30]
    c = insert("free_chats", {"user_id": uid(), "title": "New chat", "mode_code": mode, "difficulty": diff,
                              "language": lang, "misconceptions": [], "last_active_at": utcnow()})
    return jsonify(chat=free_chat_dict(c)), 201


@bp.get("/chats/<int:cid>")
@jwt_required()
def get_chat(cid):
    c = _chat(cid)
    if not c:
        return error("Chat not found.", 404)
    msgs = many("free_messages", {"chat_id": cid}, sort=[("_id", 1)], limit=300)
    return jsonify(chat=free_chat_dict(c), messages=[free_message_dict(m) for m in msgs])


@bp.patch("/chats/<int:cid>")
@jwt_required()
def update_chat(cid):
    c = _chat(cid)
    if not c:
        return error("Chat not found.", 404)
    d = request.get_json(silent=True) or {}
    fields = {}
    if "mode" in d:
        if d["mode"] not in ("socratic", "direct"):
            return error("Mode must be 'socratic' or 'direct'.")
        fields["mode_code"] = d["mode"]  # history and misconceptions are kept
    if "difficulty" in d:
        if d["difficulty"] not in DIFFS:
            return error("Invalid difficulty.")
        fields["difficulty"] = d["difficulty"]
    if "title" in d and str(d["title"]).strip():
        fields["title"] = str(d["title"]).strip()[:160]
    if "language" in d and str(d["language"]).strip():
        fields["language"] = str(d["language"]).strip()[:30]
    if fields:
        update("free_chats", cid, fields)
        c.update(fields)
    return jsonify(chat=free_chat_dict(c))


@bp.delete("/chats/<int:cid>")
@jwt_required()
def remove_chat(cid):
    if not _chat(cid):
        return error("Chat not found.", 404)
    delete_free_chat(cid)
    return jsonify(message="Chat deleted.")


@bp.post("/chats/<int:cid>/message")
@jwt_required()
@limiter.limit("40 per minute")
def message(cid):
    c = _chat(cid)
    if not c:
        return error("Chat not found.", 404)
    d = request.get_json(silent=True) or {}
    action = d.get("action")
    if action and action not in tutor.ACTION_TEXT:
        return error("Unknown action.")
    text = str(d.get("message") or "").strip()
    if not action and not text:
        return error("Please say or type something.")
    if len(text) > 4000:
        return error("Message is too long (max 4000 characters).")
    lang = str(d.get("language") or c.get("language") or "en-US").strip()[:30]
    if lang != c.get("language"):
        update("free_chats", cid, {"language": lang})
        c["language"] = lang
    try:
        return jsonify(free_tutor.respond(c, text, action, language=lang))
    except llm.LLMNotConfigured as exc:
        return error(str(exc), 503)
    except llm.LLMError as exc:
        return error(str(exc), 502)
