"""Bloom's Taxonomy tracking + spaced revision (Ebbinghaus-style intervals)."""
from datetime import timedelta

from ..db import col, insert, many, one, update, utcnow

LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
MASTERY = 0.7
REVIEW_DAYS = [1, 3, 7, 14, 30, 60]

ACTIVITIES = {
    1: "Define key terms in your own notes, then take a Remember quiz.",
    2: "Explain the concept in your own words (Socratic mode helps here).",
    3: "Solve an application problem using the concept.",
    4: "Compare related ideas and break the concept into parts.",
    5: "Judge two approaches and justify which is better.",
    6: "Design or propose something new using the concept.",
}


def topic_levels(user_id, topic_id):
    rows = {b["level"]: b for b in many("bloom_progress", {"user_id": user_id, "topic_id": topic_id})}
    return [
        {"level": i, "name": LEVELS[i - 1], "attempts": rows[i]["attempts"] if i in rows else 0,
         "score": round(rows[i]["score"], 3) if i in rows else 0.0}
        for i in range(1, 7)
    ]


def current_level(levels):
    """Lowest level not yet mastered (needs evidence, not just viewing)."""
    for lv in levels:
        if lv["attempts"] == 0 or lv["score"] < MASTERY:
            return lv["level"]
    return 6


def get_progress(user_id, topic_id):
    p = one("learning_progress", {"user_id": user_id, "topic_id": topic_id})
    if not p:
        p = insert("learning_progress", {
            "user_id": user_id, "topic_id": topic_id, "mastery": 0.0, "status": "not_started",
            "time_spent_seconds": 0, "review_count": 0, "last_studied_at": None, "next_review_at": None})
    return p


def record_score(user_id, topic_id, level, score):
    """Blend new evidence into the running score for one level."""
    b = one("bloom_progress", {"user_id": user_id, "topic_id": topic_id, "level": level})
    if not b:
        insert("bloom_progress", {"user_id": user_id, "topic_id": topic_id, "level": level, "attempts": 1, "score": score})
    else:
        update("bloom_progress", b["_id"], {"attempts": b["attempts"] + 1, "score": 0.6 * b["score"] + 0.4 * score})


def refresh_progress(user_id, topic_id, assessed=False, last_score=None):
    """Recompute mastery from assessment evidence only."""
    levels = topic_levels(user_id, topic_id)
    p = get_progress(user_id, topic_id)
    fields = {"mastery": round(sum(l["score"] for l in levels) / 6, 3)}
    attempted = any(l["attempts"] for l in levels)
    if all(l["attempts"] and l["score"] >= MASTERY for l in levels):
        fields["status"] = "mastered"
    elif attempted:
        fields["status"] = "practicing"
    elif p["status"] == "not_started":
        fields["status"] = "learning"
    if assessed:
        fields["last_studied_at"] = utcnow()
        if last_score is not None and last_score >= MASTERY:
            idx = min(p["review_count"], len(REVIEW_DAYS) - 1)
            fields["review_count"] = p["review_count"] + 1
            fields["next_review_at"] = utcnow() + timedelta(days=REVIEW_DAYS[idx])
        else:
            fields["next_review_at"] = utcnow() + timedelta(days=1)
    update("learning_progress", p["_id"], fields)
    return {**p, **fields}
