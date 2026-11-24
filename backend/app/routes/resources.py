import os
import re
import uuid

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from ..cascade import delete_resource
from ..db import col, insert, many, one, to_int, update
from ..extensions import limiter
from ..serializers import resource_dict, topic_dict, unit_of
from ..services import processing
from ..utils import error, uid

bp = Blueprint("resources", __name__)

MAGIC = {"pdf": (b"%PDF",), "docx": (b"PK",), "pptx": (b"PK",), "png": (b"\x89PNG",), "jpg": (b"\xff\xd8",), "jpeg": (b"\xff\xd8",)}


def _own(rid):
    return one("resources", {"_id": rid, "user_id": uid()})


def _subjects():
    return {s["_id"]: {"id": s["_id"], "name": s["name"]} for s in many("subjects", {"user_id": uid()})}


def _counts(ids):
    out = {i: {"chapter_count": 0, "topic_count": 0} for i in ids}
    for c in col("chapters").find({"resource_id": {"$in": ids}}, {"resource_id": 1}):
        out[c["resource_id"]]["chapter_count"] += 1
    for t in col("extracted_topics").find({"resource_id": {"$in": ids}}, {"resource_id": 1}):
        out[t["resource_id"]]["topic_count"] += 1
    return out


@bp.get("/subjects")
@jwt_required()
def subjects():
    counts = {}
    for r in col("resources").find({"user_id": uid()}, {"subject_id": 1}):
        counts[r.get("subject_id")] = counts.get(r.get("subject_id"), 0) + 1
    rows = sorted(many("subjects", {"user_id": uid()}), key=lambda s: s["name"].lower())
    return jsonify(subjects=[{"id": s["_id"], "name": s["name"], "resource_count": counts.get(s["_id"], 0)} for s in rows])


@bp.post("/resources/upload")
@jwt_required()
@limiter.limit("30 per hour")
def upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return error("Please choose a file to upload.")
    original = secure_filename(f.filename) or "upload"
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in current_app.config["ALLOWED_EXTENSIONS"]:
        return error("Unsupported file type. Allowed: " + ", ".join(sorted(current_app.config["ALLOWED_EXTENSIONS"])) + ".")
    head = f.stream.read(8)
    f.stream.seek(0)
    if ext in MAGIC and not any(head.startswith(m) for m in MAGIC[ext]):
        return error("The file content does not match its extension.")

    user_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], str(uid()))
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, f"{uuid.uuid4().hex}.{ext}")
    f.save(path)

    title = (request.form.get("title") or "").strip() or original.rsplit(".", 1)[0]
    subject_name = (request.form.get("subject") or "").strip()
    subject_id = processing.get_or_create_subject(uid(), subject_name)["_id"] if subject_name else None
    r = insert("resources", {
        "user_id": uid(), "subject_id": subject_id, "title": title[:255], "original_filename": original[:255],
        "stored_path": path, "file_type": ext, "file_size": os.path.getsize(path), "status": "uploaded",
        "error_message": None, "page_count": 0, "summary": None})
    processing.start_processing(r["_id"])
    return jsonify(resource=resource_dict(r, _subjects())), 201


@bp.get("/resources")
@jwt_required()
def list_resources():
    q = {"user_id": uid()}
    sid = to_int(request.args.get("subject_id"))
    if sid is not None:
        q["subject_id"] = sid
    if request.args.get("type"):
        q["file_type"] = request.args["type"].lower()
    if request.args.get("status"):
        q["status"] = request.args["status"]
    if request.args.get("q"):
        q["title"] = {"$regex": re.escape(request.args["q"][:100]), "$options": "i"}
    direction = 1 if request.args.get("sort") == "oldest" else -1
    rows = many("resources", q, sort=[("created_at", direction)])
    counts, subs = _counts([r["_id"] for r in rows]), _subjects()
    return jsonify(resources=[resource_dict(r, subs, counts.get(r["_id"])) for r in rows])


@bp.get("/resources/<int:rid>")
@jwt_required()
def get_resource(rid):
    r = _own(rid)
    if not r:
        return error("Resource not found.", 404)
    return jsonify(resource=resource_dict(r, _subjects(), _counts([rid])[rid]))


@bp.patch("/resources/<int:rid>")
@jwt_required()
def rename(rid):
    r = _own(rid)
    if not r:
        return error("Resource not found.", 404)
    d = request.get_json(silent=True) or {}
    fields = {}
    if "title" in d:
        t = str(d["title"]).strip()
        if not t:
            return error("Title cannot be empty.")
        fields["title"] = t[:255]
    if "subject" in d:
        name = str(d["subject"] or "").strip()
        fields["subject_id"] = processing.get_or_create_subject(uid(), name)["_id"] if name else None
    if fields:
        update("resources", rid, fields)
        r.update(fields)
    return jsonify(resource=resource_dict(r, _subjects()))


@bp.delete("/resources/<int:rid>")
@jwt_required()
def delete(rid):
    r = _own(rid)
    if not r:
        return error("Resource not found.", 404)
    delete_resource(rid)
    try:
        os.remove(r["stored_path"])
    except OSError:
        pass
    return jsonify(message="Resource deleted.")


@bp.post("/resources/<int:rid>/reprocess")
@jwt_required()
def reprocess(rid):
    r = _own(rid)
    if not r:
        return error("Resource not found.", 404)
    if r["status"] == "processing":
        return error("Already processing.", 409)
    update("resources", rid, {"status": "uploaded"})
    r["status"] = "uploaded"
    processing.start_processing(rid)
    return jsonify(resource=resource_dict(r, _subjects()))


@bp.get("/resources/<int:rid>/topics")
@jwt_required()
def topics(rid):
    r = _own(rid)
    if not r:
        return error("Resource not found.", 404)
    prog = {p["topic_id"]: p for p in many("learning_progress", {"user_id": uid()})}
    by_chapter = {}
    for t in many("extracted_topics", {"resource_id": rid}, sort=[("order_index", 1)]):
        p = prog.get(t["_id"])
        by_chapter.setdefault(t["chapter_id"], []).append(
            {**topic_dict(t), "mastery": round(p["mastery"], 2) if p else 0, "status": p["status"] if p else "not_started"})
    out = [{"id": c["_id"], "title": c["title"], "summary": c.get("summary"), "topics": by_chapter.get(c["_id"], [])}
           for c in many("chapters", {"resource_id": rid}, sort=[("order_index", 1)])]
    return jsonify(resource=resource_dict(r, _subjects()), chapters=out)


@bp.get("/resources/<int:rid>/preview")
@jwt_required()
def preview(rid):
    r = _own(rid)
    if not r:
        return error("Resource not found.", 404)
    page = request.args.get("page", 1, type=int)
    p = one("resource_pages", {"resource_id": rid, "page_number": page})
    if not p:
        return error("That page does not exist.", 404)
    return jsonify(page=page, unit=unit_of(r), total=r.get("page_count", 0), text=p["text"][:12000])
