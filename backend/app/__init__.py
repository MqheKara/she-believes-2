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
    """Create the first admin from env vars if none exists (SPEC §20)."""
    from .models import User

    if User.query.filter_by(role="admin").first():
        return
    email = app.config["BOOTSTRAP_ADMIN_EMAIL"]
    password = app.config["BOOTSTRAP_ADMIN_PASSWORD"]
    phone = app.config["BOOTSTRAP_ADMIN_PHONE"]
    admin = User(
        role="admin",
        name="Administrator",
        email=email.lower(),
        phone=phone,
        password_hash=hash_secret(password),
    )
    db.session.add(admin)
    db.session.commit()
    print("=" * 60)
    print("  Bootstrapped admin account (DEMO MODE):")
    print(f"    email:    {email}")
    print(f"    password: {password}")
    print("  Change these via env vars in production.")
    print("=" * 60)
