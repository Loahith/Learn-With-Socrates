import socket

try:
    _raw_h = socket.gethostname()
    _raw_h.encode("ascii")
except Exception:
    socket.gethostname = lambda: "localhost"
    socket.getfqdn = lambda *args, **kwargs: "localhost"

import logging
import os
from datetime import datetime, timezone

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import cors, jwt, limiter

log = logging.getLogger("learn_with_socrates")


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    from . import db as database
    database.init_db(app)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from .routes import analytics, assessments, auth, bloom, chat, learning, profile, resources

    app.register_blueprint(auth.bp, url_prefix="/api/auth")
    app.register_blueprint(resources.bp, url_prefix="/api")
    app.register_blueprint(learning.bp, url_prefix="/api/learning")
    app.register_blueprint(bloom.bp, url_prefix="/api/bloom")
    app.register_blueprint(assessments.bp, url_prefix="/api/assessments")
    app.register_blueprint(analytics.bp, url_prefix="/api/analytics")
    app.register_blueprint(profile.bp, url_prefix="/api")
    app.register_blueprint(chat.bp, url_prefix="/api/chat")

    # ---- JWT behaviour
    @jwt.token_in_blocklist_loader
    def is_revoked(_header, payload):
        return database.one("revoked_tokens", {"jti": payload["jti"]}) is not None

    @jwt.unauthorized_loader
    def missing(_msg):
        return jsonify(error="Authentication required."), 401

    @jwt.invalid_token_loader
    def invalid(_msg):
        return jsonify(error="Invalid token."), 401

    @jwt.expired_token_loader
    def expired(_h, _p):
        return jsonify(error="Session expired. Please log in again."), 401

    @jwt.revoked_token_loader
    def revoked(_h, _p):
        return jsonify(error="Session ended. Please log in again."), 401

    # ---- errors
    @app.errorhandler(HTTPException)
    def http_error(e):
        msg = e.description
        if e.code == 413:
            msg = "File is too large."
        if e.code == 429:
            msg = "Too many requests. Please slow down."
        return jsonify(error=msg), e.code

    @app.errorhandler(Exception)
    def unexpected(e):
        log.exception("Unhandled error")
        return jsonify(error="Something went wrong on the server."), 500

    @app.get("/")
    def index():
        return jsonify(
            message="Learn with Socrates Backend API is running.",
            frontend_url="http://localhost:5173",
            health_check="/api/health",
        )

    @app.get("/api/health")
    def health():
        try:
            database.ping()
            db_ok = True
        except Exception:
            db_ok = False
        return jsonify(status="ok" if db_ok else "database_down", database=db_ok, ai=bool(app.config["GROQ_API_KEY"]),
                       time=datetime.now(timezone.utc).isoformat())

    # ---- indexes + seed data
    try:
        from .utils import seed_modes
        database.ensure_indexes()
        seed_modes()
    except Exception as exc:
        log.error("Could not reach MongoDB. Is it running and is MONGODB_URI correct? %s", exc)

    return app
