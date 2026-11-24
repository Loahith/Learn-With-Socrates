from datetime import timedelta

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..db import many, one, utcnow
from ..serializers import resource_dict
from ..services import bloom_engine as be
from ..utils import uid

bp = Blueprint("analytics", __name__)


def _topics():
    """{topic_id: {title, resource_id, chapter_id}} for the user's completed resources."""
    out = {}
    for r in many("resources", {"user_id": uid(), "status": "completed"}):
        for t in many("extracted_topics", {"resource_id": r["_id"]}):
            out[t["_id"]] = {"title": t["title"], "resource_id": r["_id"], "chapter_id": t["chapter_id"]}
    return out


@bp.get("/dashboard")
@jwt_required()
def dashboard():
    u = uid()
    topics = _topics()
    prog = {p["topic_id"]: p for p in many("learning_progress", {"user_id": u}) if p["topic_id"] in topics}
    total = len(topics)
    overall = round(100 * sum(p["mastery"] for p in prog.values()) / total) if total else 0
    study = sum(a["duration_seconds"] for a in many("learning_activity", {"user_id": u, "activity_type": "study"}))
    results = many("quiz_results", {"user_id": u})
    acc = sum(r["score_pct"] for r in results) / len(results) if results else None

    last = one("learning_sessions", {"user_id": u}, sort=[("last_active_at", -1)])
    cont = None
    if last:
        res = one("resources", {"_id": last["resource_id"]})
        topic = one("extracted_topics", {"_id": last["topic_id"]}) if last.get("topic_id") else None
        chapter = one("chapters", {"_id": topic["chapter_id"]}) if topic else None
        if res:
            cont = {"session_id": last["_id"], "resource_id": res["_id"], "resource_title": res["title"],
                    "topic_id": topic["_id"] if topic else None, "topic_title": topic["title"] if topic else None,
                    "chapter_title": chapter["title"] if chapter else None, "mode": last["mode"]}

    subs = {s["_id"]: {"id": s["_id"], "name": s["name"]} for s in many("subjects", {"user_id": u})}
    all_res = many("resources", {"user_id": u}, sort=[("created_at", -1)])
    counts = {}
    for r in all_res:
        counts[r.get("subject_id")] = counts.get(r.get("subject_id"), 0) + 1

    now, recs, seen = utcnow(), [], set()

    def add(tid, reason):
        if tid in topics and tid not in seen and len(recs) < 5:
            seen.add(tid)
            recs.append({"topic_id": tid, "title": topics[tid]["title"], "resource_id": topics[tid]["resource_id"], "reason": reason})

    for p in prog.values():
        if p.get("next_review_at") and p["next_review_at"] <= now:
            add(p["topic_id"], "Due for revision")
    for b in many("bloom_progress", {"user_id": u}):
        if b["attempts"] > 0 and b["score"] < 0.5:
            add(b["topic_id"], f"Strengthen {be.LEVELS[b['level'] - 1]}")
    for tid in topics:
        if tid not in prog:
            add(tid, "New topic")

    return jsonify(
        overall_progress=overall, topics_total=total,
        topics_completed=sum(1 for p in prog.values() if p["status"] == "mastered"),
        topics_in_progress=sum(1 for p in prog.values() if p["status"] in ("learning", "practicing")),
        study_seconds=int(study), quiz_accuracy=round(acc, 1) if acc is not None else None, quizzes_taken=len(results),
        continue_learning=cont,
        recent_resources=[resource_dict(r, subs) for r in all_res[:4]],
        subjects=[{"id": s["id"], "name": s["name"], "resource_count": counts.get(s["id"], 0)} for s in subs.values()],
        recommended=recs,
    )


@bp.get("/progress")
@jwt_required()
def progress():
    u = uid()
    topics = _topics()
    prog = {p["topic_id"]: p for p in many("learning_progress", {"user_id": u}) if p["topic_id"] in topics}

    rows = [b for b in many("bloom_progress", {"user_id": u}) if b["topic_id"] in topics]
    bloom = []
    for i in range(1, 7):
        rs = [b for b in rows if b["level"] == i and b["attempts"] > 0]
        bloom.append({"level": i, "name": be.LEVELS[i - 1], "score": round(100 * sum(b["score"] for b in rs) / len(rs)) if rs else 0})

    today = utcnow().date()
    start = today - timedelta(days=today.weekday()) - timedelta(weeks=7)
    start_dt = utcnow().replace(year=start.year, month=start.month, day=start.day, hour=0, minute=0, second=0, microsecond=0)
    weeks = [{"label": (start + timedelta(weeks=i)).strftime("%d %b"), "study_minutes": 0.0, "quiz_avg": None, "_s": 0.0, "_n": 0} for i in range(8)]
    for a in many("learning_activity", {"user_id": u, "activity_type": "study", "created_at": {"$gte": start_dt}}):
        idx = (a["created_at"].date() - start).days // 7
        if 0 <= idx < 8:
            weeks[idx]["study_minutes"] += a["duration_seconds"] / 60
    for q in many("quiz_results", {"user_id": u, "created_at": {"$gte": start_dt}}):
        idx = (q["created_at"].date() - start).days // 7
        if 0 <= idx < 8:
            weeks[idx]["_s"] += q["score_pct"]
            weeks[idx]["_n"] += 1
    for w in weeks:
        w["study_minutes"] = round(w["study_minutes"])
        w["quiz_avg"] = round(w["_s"] / w["_n"], 1) if w["_n"] else None
        del w["_s"], w["_n"]

    done = 0
    resource_ids = {t["resource_id"] for t in topics.values()}
    chapter_topics = {}
    for tid, t in topics.items():
        chapter_topics.setdefault(t["chapter_id"], []).append(tid)
    for tids in chapter_topics.values():
        if tids and all(prog.get(t) and prog[t]["status"] == "mastered" for t in tids):
            done += 1

    strong = sorted([{"topic": topics[t]["title"], "mastery": round(100 * p["mastery"])} for t, p in prog.items() if p["mastery"] >= 0.7],
                    key=lambda x: -x["mastery"])[:6]
    weak = sorted([{"topic": topics[t]["title"], "mastery": round(100 * p["mastery"])} for t, p in prog.items()
                   if p["status"] == "practicing" and p["mastery"] < 0.4], key=lambda x: x["mastery"])[:6]
    return jsonify(bloom=bloom, weekly=weeks, chapters_completed=done,
                   topics_learned=sum(1 for p in prog.values() if p["status"] != "not_started"), strong=strong, weak=weak)


@bp.get("/activity")
@jwt_required()
def activity():
    u = uid()
    now = utcnow()
    start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    days = {(start + timedelta(days=i)).date(): {"minutes": 0.0, "events": 0} for i in range(30)}
    modes = {m: {"study_minutes": 0.0, "messages": 0, "quizzes": 0, "quiz_accuracy": None} for m in ("socratic", "direct")}

    for a in many("learning_activity", {"user_id": u}):
        if a["created_at"] >= start:
            d = a["created_at"].date()
            if d in days:
                days[d]["events"] += 1
                if a["activity_type"] == "study":
                    days[d]["minutes"] += a["duration_seconds"] / 60
        if a["activity_type"] == "study" and a.get("mode_code") in modes:
            modes[a["mode_code"]]["study_minutes"] += a["duration_seconds"] / 60

    session_ids = [s["_id"] for s in many("learning_sessions", {"user_id": u})]
    if session_ids:
        for m in many("chat_messages", {"session_id": {"$in": session_ids}, "role": "user"}):
            if m["mode_code"] in modes:
                modes[m["mode_code"]]["messages"] += 1
    chat_ids = [c["_id"] for c in many("free_chats", {"user_id": u})]
    if chat_ids:
        for m in many("free_messages", {"chat_id": {"$in": chat_ids}, "role": "user"}):
            if m["mode_code"] in modes:
                modes[m["mode_code"]]["messages"] += 1

    scores = {"socratic": [], "direct": []}
    for r in many("quiz_results", {"user_id": u}):
        if r["mode_code"] in scores:
            scores[r["mode_code"]].append(r["score_pct"])
    for code, vals in scores.items():
        modes[code]["quizzes"] = len(vals)
        modes[code]["quiz_accuracy"] = round(sum(vals) / len(vals), 1) if vals else None
        modes[code]["study_minutes"] = round(modes[code]["study_minutes"])

    return jsonify(
        daily=[{"date": d.isoformat(), "label": d.strftime("%d %b"), "minutes": round(v["minutes"]), "events": v["events"]} for d, v in days.items()],
        modes=modes)
