import re

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from .db import col, insert, one, utcnow

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MODES = {"socratic": "Socratic Learning", "direct": "Direct Teaching"}


def error(message, status=400):
    return jsonify(error=message), status


def uid():
    return int(get_jwt_identity())


def current_user():
    return one("users", {"_id": uid()})


def default_profile():
    return {
        "avatar_url": None,
        "phone": None,
        "dob": None,
        "bio": None,
        "location": None,
        "academic_year": None,
        "primary_language": None,
        "linkedin_url": None,
        "github_url": None,
        "education_level": None,
        "institution": None,
        "major": None,
        "learning_goal": None,
        "preferred_mode": "socratic",
        "difficulty_level": "beginner",
        "daily_goal_minutes": 30,
        "notify_revision": True,
        "notify_progress": True,
    }


def profile_of(user):
    return {**default_profile(), **(user.get("profile") or {})}


def password_problem(pw):
    if len(pw) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        return "Password must contain letters and numbers."
    if len(pw) > 128:
        return "Password is too long."
    return None


def seed_modes():
    for code, name in MODES.items():
        if not one("teaching_modes", {"code": code}):
            insert("teaching_modes", {"code": code, "name": name})


def log_activity(user_id, kind, resource_id=None, topic_id=None, mode=None, seconds=0, meta=None):
    insert(
        "learning_activity",
        {"user_id": user_id, "resource_id": resource_id, "topic_id": topic_id, "activity_type": kind,
         "mode_code": mode, "duration_seconds": seconds, "meta": meta, "created_at": utcnow()},
    )


def notify(user_id, title, message, kind="info"):
    insert("notifications", {"user_id": user_id, "title": title, "message": message[:500], "kind": kind, "is_read": False})
