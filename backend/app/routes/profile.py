import base64
import io
import os
from datetime import timedelta
from PIL import Image, ImageOps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from ..cascade import purge_user
from ..db import col, insert, many, one, update, utcnow
from ..serializers import notification_dict, user_dict
from ..utils import current_user, error, password_problem, uid

bp = Blueprint("profile", __name__)
LEVELS = {"beginner", "intermediate", "advanced"}

PROFILE_FIELDS = {
    "avatar_url": 2000000,
    "phone": 40,
    "dob": 30,
    "bio": 500,
    "location": 120,
    "academic_year": 60,
    "primary_language": 60,
    "linkedin_url": 255,
    "github_url": 255,
    "education_level": 60,
    "institution": 160,
    "major": 120,
    "learning_goal": 255,
}


def process_avatar_image(stream):
    img = Image.open(stream)
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        mask = img.split()[-1] if "A" in img.getbands() else None
        bg.paste(img, mask=mask)
        img = bg
    else:
        img = img.convert("RGB")

    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    img.thumbnail((256, 256), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


@bp.put("/profile")
@jwt_required()
def update_profile():
    u, d = current_user(), request.get_json(silent=True) or {}
    fields = {}
    if "name" in d:
        name = str(d["name"]).strip()
        if len(name) < 2 or len(name) > 120:
            return error("Name must be 2-120 characters.")
        fields["name"] = name
    for field, limit in PROFILE_FIELDS.items():
        if field in d:
            val = str(d[field] or "").strip()
            fields[f"profile.{field}"] = (val[:limit]) if val else None
    if fields:
        update("users", u["_id"], fields)
    return jsonify(user=user_dict(current_user()))


@bp.post("/profile/avatar")
@jwt_required()
def upload_avatar():
    u = current_user()
    file = request.files.get("avatar")
    if not file or not file.filename:
        d = request.get_json(silent=True) or {}
        raw_b64 = d.get("avatar_url") or d.get("image")
        if not raw_b64:
            return error("No image provided.")
        try:
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            raw_bytes = base64.b64decode(raw_b64)
            file_stream = io.BytesIO(raw_bytes)
        except Exception:
            return error("Invalid image format.")
    else:
        file_stream = file.stream

    try:
        avatar_data_url = process_avatar_image(file_stream)
    except Exception as exc:
        return error(f"Could not process image: {exc}")

    update("users", u["_id"], {"profile.avatar_url": avatar_data_url})
    return jsonify(user=user_dict(current_user()), avatar_url=avatar_data_url)


@bp.delete("/profile/avatar")
@jwt_required()
def remove_avatar():
    u = current_user()
    update("users", u["_id"], {"profile.avatar_url": None})
    return jsonify(user=user_dict(current_user()), ok=True)


@bp.put("/profile/preferences")
@jwt_required()
def preferences():
    u, d = current_user(), request.get_json(silent=True) or {}
    fields = {}
    if "preferred_mode" in d:
        if d["preferred_mode"] not in ("socratic", "direct"):
            return error("Invalid teaching mode.")
        fields["profile.preferred_mode"] = d["preferred_mode"]
    if "difficulty_level" in d:
        if d["difficulty_level"] not in LEVELS:
            return error("Invalid difficulty level.")
        fields["profile.difficulty_level"] = d["difficulty_level"]
    if "daily_goal_minutes" in d:
        try:
            g = int(d["daily_goal_minutes"])
        except (TypeError, ValueError):
            return error("Daily goal must be a number.")
        fields["profile.daily_goal_minutes"] = max(5, min(g, 600))
    for flag in ("notify_revision", "notify_progress"):
        if flag in d:
            fields[f"profile.{flag}"] = bool(d[flag])
    if fields:
        update("users", u["_id"], fields)
    return jsonify(user=user_dict(current_user()))


@bp.put("/profile/password")
@jwt_required()
def change_password():
    u, d = current_user(), request.get_json(silent=True) or {}
    if not check_password_hash(u["password_hash"], str(d.get("current_password") or "")):
        return error("Current password is incorrect.", 403)
    problem = password_problem(str(d.get("new_password") or ""))
    if problem:
        return error(problem)
    update("users", u["_id"], {"password_hash": generate_password_hash(d["new_password"])})
    return jsonify(message="Password changed.")


@bp.delete("/profile")
@jwt_required()
def delete_account():
    u, d = current_user(), request.get_json(silent=True) or {}
    if not check_password_hash(u["password_hash"], str(d.get("password") or "")):
        return error("Password is incorrect.", 403)
    paths = [r["stored_path"] for r in many("resources", {"user_id": u["_id"]})]
    insert("revoked_tokens", {"jti": get_jwt()["jti"], "expires_at": utcnow() + timedelta(hours=13)})
    purge_user(u["_id"])  # removes the user and every related document
    for p in paths:
        try:
            os.remove(p)
        except OSError:
            pass
    return jsonify(message="Account deleted.")


@bp.get("/notifications")
@jwt_required()
def notifications():
    rows = many("notifications", {"user_id": uid()}, sort=[("_id", -1)], limit=30)
    return jsonify(notifications=[notification_dict(n) for n in rows], unread=sum(1 for n in rows if not n["is_read"]))


@bp.post("/notifications/read")
@jwt_required()
def mark_read():
    col("notifications").update_many({"user_id": uid(), "is_read": False}, {"$set": {"is_read": True}})
    return jsonify(ok=True)
