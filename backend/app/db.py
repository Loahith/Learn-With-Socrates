"""MongoDB access layer (PyMongo). Documents are plain dicts with integer `_id`s
(from a counters collection) so the JSON the API returns stays simple."""
from datetime import datetime, timezone

from pymongo import ASCENDING, MongoClient, ReturnDocument

_client = None
_db = None


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


def init_db(app):
    global _client, _db
    _client = MongoClient(app.config["MONGODB_URI"], serverSelectionTimeoutMS=5000)
    _db = _client[app.config["MONGODB_DB"]]


def ping():
    _client.admin.command("ping")


def col(name):
    return _db[name]


def next_id(name):
    doc = _db["counters"].find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return doc["seq"]


def insert(name, doc):
    doc["_id"] = next_id(name)
    now = utcnow()
    doc.setdefault("created_at", now)
    doc.setdefault("updated_at", now)
    _db[name].insert_one(doc)
    return doc


def update(name, _id, fields):
    fields = dict(fields)
    fields["updated_at"] = utcnow()
    _db[name].update_one({"_id": _id}, {"$set": fields})


def one(name, flt, sort=None):
    return _db[name].find_one(flt, sort=sort) if sort else _db[name].find_one(flt)


def many(name, flt=None, sort=None, limit=0):
    cur = _db[name].find(flt or {})
    if sort:
        cur = cur.sort(sort)
    if limit:
        cur = cur.limit(limit)
    return list(cur)


def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def ensure_indexes():
    U = {"unique": True}
    idx = [
        ("users", [("email", 1)], U),
        ("password_reset_tokens", [("token_hash", 1)], U),
        ("revoked_tokens", [("jti", 1)], U),
        ("revoked_tokens", [("expires_at", 1)], {"expireAfterSeconds": 0}),  # auto-clean
        ("subjects", [("user_id", 1), ("name", 1)], U),
        ("resources", [("user_id", 1), ("status", 1)], {}),
        ("resource_pages", [("resource_id", 1), ("page_number", 1)], U),
        ("resource_chunks", [("resource_id", 1)], {}),
        ("chapters", [("resource_id", 1)], {}),
        ("extracted_topics", [("resource_id", 1)], {}),
        ("extracted_topics", [("chapter_id", 1)], {}),
        ("learning_sessions", [("user_id", 1), ("resource_id", 1), ("topic_id", 1)], {}),
        ("chat_messages", [("session_id", 1)], {}),
        ("learning_progress", [("user_id", 1), ("topic_id", 1)], U),
        ("bloom_progress", [("user_id", 1), ("topic_id", 1), ("level", 1)], U),
        ("assessments", [("user_id", 1)], {}),
        ("questions", [("assessment_id", 1)], {}),
        ("student_answers", [("assessment_id", 1)], {}),
        ("quiz_results", [("assessment_id", 1)], U),
        ("quiz_results", [("user_id", 1), ("created_at", 1)], {}),
        ("learning_activity", [("user_id", 1), ("created_at", 1)], {}),
        ("notifications", [("user_id", 1)], {}),
        ("free_chats", [("user_id", 1)], {}),
        ("free_messages", [("chat_id", 1)], {}),
    ]
    for name, keys, opts in idx:
        _db[name].create_index([(k, ASCENDING) for k, _ in keys], **opts)
