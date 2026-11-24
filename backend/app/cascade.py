"""MongoDB has no foreign-key cascades, so related data is removed here."""
from .db import col, many


def _ids(name, flt):
    return [d["_id"] for d in many(name, flt)]


def clear_resource_content(rid):
    """Remove extracted pages/chunks/chapters/topics (used before re-processing and on delete)."""
    topic_ids = _ids("extracted_topics", {"resource_id": rid})
    for name in ("resource_pages", "resource_chunks", "chapters", "extracted_topics"):
        col(name).delete_many({"resource_id": rid})
    if topic_ids:
        q = {"topic_id": {"$in": topic_ids}}
        col("learning_progress").delete_many(q)
        col("bloom_progress").delete_many(q)
        for name in ("learning_sessions", "assessments", "learning_activity"):
            col(name).update_many(q, {"$set": {"topic_id": None}})


def delete_assessments(flt):
    aids = _ids("assessments", flt)
    if aids:
        for name in ("questions", "student_answers", "quiz_results"):
            col(name).delete_many({"assessment_id": {"$in": aids}})
        col("assessments").delete_many({"_id": {"$in": aids}})


def delete_resource(rid):
    clear_resource_content(rid)
    sids = _ids("learning_sessions", {"resource_id": rid})
    if sids:
        col("chat_messages").delete_many({"session_id": {"$in": sids}})
        col("learning_sessions").delete_many({"_id": {"$in": sids}})
    delete_assessments({"resource_id": rid})
    col("learning_activity").update_many({"resource_id": rid}, {"$set": {"resource_id": None}})
    col("resources").delete_one({"_id": rid})


def delete_free_chat(cid):
    col("free_messages").delete_many({"chat_id": cid})
    col("free_chats").delete_one({"_id": cid})


def purge_user(user_id):
    for rid in _ids("resources", {"user_id": user_id}):
        delete_resource(rid)
    for cid in _ids("free_chats", {"user_id": user_id}):
        delete_free_chat(cid)
    delete_assessments({"user_id": user_id})
    for name in ("learning_sessions", "learning_progress", "bloom_progress", "learning_activity", "notifications",
                 "subjects", "password_reset_tokens", "quiz_results", "student_answers"):
        col(name).delete_many({"user_id": user_id})
    col("users").delete_one({"_id": user_id})
