import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from .config import Config
from .extensions import db
from .hashing import hash_secret


def _parse_origins():
    """
    Read CORS_ORIGINS env var. Accepts a comma-separated list of origins, e.g.:
        CORS_ORIGINS=https://shebelieves.onrender.com,https://shebelieves.com
    Falls back to localhost for dev. We strip trailing slashes so a small typo
    in the Render dashboard doesn't silently break CORS matching.
    """
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    # CORS: exact origins from env var. We apply it to /api/* (JSON API) AND
    # /uploads/* (poster images) because the browser fetches both cross-origin
    # when frontend and backend live on different Render services.
    origins = _parse_origins()
    app.config["CORS_ORIGINS"] = origins
    CORS(
        app,
        resources={
            r"/api/*": {"origins": origins},
            r"/uploads/*": {"origins": origins},
        },
        expose_headers=["Content-Disposition"],
    )

    db.init_app(app)

    # Register blueprints
    from .routes.public import bp as public_bp
    from .routes.customer_auth import bp as customer_auth_bp
    from .routes.orders import bp as orders_bp
    from .routes.tickets import bp as tickets_bp
    from .routes.staff_auth import bp as staff_auth_bp
    from .routes.uploads import bp as uploads_bp
    from .routes.organizer import bp as organizer_bp
    from .routes.admin import bp as admin_bp
    from .routes.gate import bp as gate_bp
    from .routes.internal import bp as internal_bp

    for bp in (public_bp, customer_auth_bp, orders_bp, tickets_bp, staff_auth_bp,
               uploads_bp, organizer_bp, admin_bp, gate_bp, internal_bp):
        app.register_blueprint(bp)

    # Serve uploaded posters
    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_DIR"], filename)

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        # Log the underlying exception so logs actually show what blew up.
        app.logger.exception("500 server error")
        # Roll back the session so a poisoned transaction doesn't cascade
        # into the next request handled by this worker.
        try:
            db.session.rollback()
        except Exception:
            pass
        return jsonify({"error": "server_error"}), 500

    @app.errorhandler(Exception)
    def unhandled(e):
        # Last-ditch handler for anything that escapes the route.
        app.logger.exception("unhandled exception")
        try:
            db.session.rollback()
        except Exception:
            pass
        return jsonify({"error": "server_error"}), 500

    with app.app_context():
        db.create_all()
        _ensure_schema(app)
        bootstrap_admin(app)

    if app.config.get("RUN_SCHEDULER"):
        from .jobs import start_scheduler
        start_scheduler(app)

    from .cli import register_cli
    register_cli(app)

    return app


def _ensure_schema(app):
    """Tiny idempotent migration for columns added after first deploy.
    db.create_all() creates missing TABLES but never adds missing COLUMNS to
    existing tables, so a plain redeploy won't add `orders.intent_json`. We add
    it by hand if absent. Safe to run on every boot; works on Postgres + SQLite.
    """
    from sqlalchemy import inspect, text

    try:
        insp = inspect(db.engine)
        cols = {c["name"] for c in insp.get_columns("orders")}
        if "intent_json" not in cols:
            app.logger.info("migrating: adding orders.intent_json column")
            with db.engine.begin() as conn:
                conn.execute(text("ALTER TABLE orders ADD COLUMN intent_json TEXT"))
    except Exception:
        # Never let a migration check crash startup; log and continue.
        app.logger.exception("schema ensure failed")


def bootstrap_admin(app):
    """Ensure an admin account exists.

    Normal behavior: if no admin exists, create one from the BOOTSTRAP_ADMIN_*
    env vars. If an admin already exists, do nothing (so we don't clobber a
    real password on every deploy).

    Escape hatch: set BOOTSTRAP_ADMIN_RESET=1 to force the bootstrap admin's
    email/password to match the current env vars even if an admin already
    exists. Use this once to recover from a lockout, then UNSET it and redeploy
    so you're not resetting the password on every boot.
    """
    from .hashing import hash_secret
    from .models import User
    from .extensions import db as _db

    email = (app.config["BOOTSTRAP_ADMIN_EMAIL"] or "").lower()
    password = app.config["BOOTSTRAP_ADMIN_PASSWORD"]
    phone = app.config["BOOTSTRAP_ADMIN_PHONE"]
    reset = app.config.get("BOOTSTRAP_ADMIN_RESET")

    existing_admin = User.query.filter_by(role="admin").first()

    if existing_admin and not reset:
        return

    if existing_admin and reset:
        # Recover access: align the admin row with the env-var credentials.
        existing_admin.email = email
        existing_admin.password_hash = hash_secret(password)
        _db.session.commit()
        app.logger.warning(
            "BOOTSTRAP_ADMIN_RESET active: reset admin email+password from env. "
            "UNSET BOOTSTRAP_ADMIN_RESET and redeploy."
        )
        return

    # No admin yet → create one. If the target email is taken by a non-admin,
    # promote that account instead of crashing on the unique constraint.
    clash = User.query.filter_by(email=email).first()
    if clash:
        clash.role = "admin"
        clash.password_hash = hash_secret(password)
        _db.session.commit()
        app.logger.warning("bootstrap: promoted existing user %s to admin", email)
        return

    admin = User(
        role="admin",
        name="Administrator",
        email=email,
        phone=phone,
        password_hash=hash_secret(password),
    )
    _db.session.add(admin)
    _db.session.commit()
    app.logger.info("bootstrapped admin account: %s", email)
