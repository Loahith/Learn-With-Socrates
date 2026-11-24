"""Turn MongoDB documents into the JSON the frontend expects."""
from .db import iso
from .utils import profile_of

UNITS = {"pdf": "Page", "pptx": "Slide"}


def unit_of(resource):
    return UNITS.get(resource["file_type"], "Section")


def user_dict(u):
    return {"id": u["_id"], "email": u["email"], "name": u["name"], "created_at": iso(u.get("created_at")), "profile": profile_of(u)}


def resource_dict(r, subjects=None, counts=None):
    subj = None
    if r.get("subject_id") is not None and subjects is not None:
        subj = subjects.get(r["subject_id"])
    d = {
        "id": r["_id"], "title": r["title"], "original_filename": r["original_filename"], "file_type": r["file_type"],
        "file_size": r["file_size"], "status": r["status"], "error_message": r.get("error_message"),
        "page_count": r.get("page_count", 0), "unit": unit_of(r), "summary": r.get("summary"),
        "subject": subj, "created_at": iso(r.get("created_at")),
    }
    if counts:
        d.update(counts)
    return d


def topic_dict(t):
    return {
        "id": t["_id"], "resource_id": t["resource_id"], "chapter_id": t["chapter_id"], "title": t["title"],
        "description": t.get("description"), "key_concepts": t.get("key_concepts") or [],
        "objectives": t.get("objectives") or [], "prerequisites": t.get("prerequisites") or [],
        "page_start": t.get("page_start"), "page_end": t.get("page_end"),
    }


def session_dict(s):
    return {
        "id": s["_id"], "resource_id": s["resource_id"], "topic_id": s.get("topic_id"), "mode": s["mode"],
        "difficulty": s["difficulty"], "bloom_level": s["bloom_level"], "misconceptions": s.get("misconceptions") or [],
        "last_active_at": iso(s.get("last_active_at")),
    }


def message_dict(m):
    return {"id": m["_id"], "role": m["role"], "content": m["content"], "mode": m["mode_code"],
            "sources": m.get("sources") or [], "created_at": iso(m.get("created_at"))}


def question_dict(q, reveal=False):
    d = {"id": q["_id"], "type": q["question_type"], "bloom_level": q["bloom_level"], "question": q["question_text"],
         "options": q.get("options"), "source_ref": q.get("source_ref")}
    if reveal:
        d["correct_answer"] = q["correct_answer"]
        d["explanation"] = q.get("explanation")
    return d


def notification_dict(n):
    return {"id": n["_id"], "title": n["title"], "message": n["message"], "kind": n["kind"],
            "is_read": n["is_read"], "created_at": iso(n.get("created_at"))}


def free_chat_dict(c):
    return {"id": c["_id"], "title": c["title"], "mode": c["mode_code"], "difficulty": c["difficulty"],
            "language": c.get("language", "en-US"),
            "misconceptions": c.get("misconceptions") or [], "last_active_at": iso(c.get("last_active_at"))}


def free_message_dict(m):
    return {"id": m["_id"], "role": m["role"], "content": m["content"], "mode": m["mode_code"], "created_at": iso(m.get("created_at"))}
