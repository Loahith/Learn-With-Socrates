import hashlib
import secrets
from datetime import timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, jwt_required
from pymongo.errors import DuplicateKeyError
from werkzeug.security import check_password_hash, generate_password_hash

from ..db import col, insert, one, update, utcnow
from ..extensions import limiter
from ..serializers import user_dict
from ..utils import EMAIL_RE, current_user, default_profile, error, notify, password_problem

bp = Blueprint("auth", __name__)


@bp.post("/register")
@limiter.limit("10 per hour")
def register():
    d = request.get_json(silent=True) or {}
    name = str(d.get("name") or "").strip()
    email = str(d.get("email") or "").strip().lower()
    pw = str(d.get("password") or "")
    if len(name) < 2 or len(name) > 120:
        return error("Please enter your name (2-120 characters).")
    if not EMAIL_RE.match(email) or len(email) > 255:
        return error("Please enter a valid email address.")
    problem = password_problem(pw)
    if problem:
        return error(problem)
    if one("users", {"email": email}):
        return error("An account with this email already exists.", 409)
    try:
        user = insert("users", {"name": name, "email": email, "password_hash": generate_password_hash(pw),
                                "is_active": True, "profile": default_profile()})
    except DuplicateKeyError:
        return error("An account with this email already exists.", 409)
    notify(user["_id"], "Welcome to Learn with Socrates", "Upload your first study resource to begin learning.", "success")
    return jsonify(token=create_access_token(identity=str(user["_id"])), user=user_dict(user)), 201


@bp.post("/login")
@limiter.limit("20 per hour")
def login():
    d = request.get_json(silent=True) or {}
    email = str(d.get("email") or "").strip().lower()
    user = one("users", {"email": email})
    if not user or not user.get("is_active") or not check_password_hash(user["password_hash"], str(d.get("password") or "")):
        return error("Incorrect email or password.", 401)
    return jsonify(token=create_access_token(identity=str(user["_id"])), user=user_dict(user))


@bp.post("/logout")
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    if not one("revoked_tokens", {"jti": jti}):
        insert("revoked_tokens", {"jti": jti, "expires_at": utcnow() + timedelta(hours=13)})
    return jsonify(message="Logged out.")


@bp.get("/profile")
@jwt_required()
def profile():
    return jsonify(user=user_dict(current_user()))


@bp.post("/forgot-password")
@limiter.limit("5 per hour")
def forgot_password():
    email = str((request.get_json(silent=True) or {}).get("email") or "").strip().lower()
    user = one("users", {"email": email})
    resp = {"message": "If that email exists, a reset link has been generated."}
    if user:
        raw = secrets.token_urlsafe(32)
        insert("password_reset_tokens", {"user_id": user["_id"], "token_hash": hashlib.sha256(raw.encode()).hexdigest(),
                                         "expires_at": utcnow() + timedelta(minutes=30), "used": False})
        link = f"{current_app.config['CORS_ORIGINS'][0]}/reset-password?token={raw}"
        current_app.logger.info("PASSWORD RESET LINK for %s: %s", email, link)  # no email server in local dev
        if current_app.debug:
            resp["dev_reset_link"] = link
    return jsonify(resp)


@bp.post("/reset-password")
@limiter.limit("10 per hour")
def reset_password():
    d = request.get_json(silent=True) or {}
    h = hashlib.sha256(str(d.get("token") or "").encode()).hexdigest()
    pw = str(d.get("password") or "")
    problem = password_problem(pw)
    if problem:
        return error(problem)
    t = one("password_reset_tokens", {"token_hash": h, "used": False})
    if not t or t["expires_at"] < utcnow():
        return error("This reset link is invalid or has expired.", 400)
    update("users", t["user_id"], {"password_hash": generate_password_hash(pw)})
    col("password_reset_tokens").update_one({"_id": t["_id"]}, {"$set": {"used": True}})
    return jsonify(message="Password updated. You can log in now.")
