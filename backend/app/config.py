import os
from datetime import timedelta


def _bool(v, default=False):
    if v is None:
        return default
    return str(v).lower() in ("1", "true", "yes", "on")


class Config:
    # Core
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-change-me")
    QR_HMAC_SECRET = os.environ.get("QR_HMAC_SECRET", "dev-qr-hmac-secret-change-me")

    # Database — SQLite for dev, Postgres in prod via DATABASE_URL
    _db = os.environ.get("DATABASE_URL", "")
    if _db.startswith("postgres://"):
        _db = _db.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db or "sqlite:///" + os.path.join(
        os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "shebelieves.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Connection pool hygiene — CRITICAL for Render Postgres.
    # Render closes idle DB connections after ~5 min; without pool_recycle,
    # SQLAlchemy hands out dead sockets and you get "SSL error: decryption
    # failed or bad record mac". pool_pre_ping does a cheap SELECT 1 before
    # every checkout so stale connections are caught and replaced.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,    # < Render's idle timeout
        "pool_size": 5,
        "max_overflow": 5,
    }

    # JWT expiries (per SPEC §4)
    JWT_CUSTOMER_DAYS = 30
    JWT_STAFF_DAYS = 7  # organizer + admin
    GATE_GRACE_HOURS = 24  # gate token & lock = event.end_at + 24h

    # Business rules
    HOLD_DURATION_MINUTES = int(os.environ.get("HOLD_DURATION_MINUTES", "1440"))  # 24h
    MAX_TICKETS_PER_ORDER = 10
    MAX_WALKIN_QTY = 20
    ARCHIVE_AFTER_HOURS = 24

    # Uploads
    UPLOAD_DIR = os.environ.get(
        "UPLOAD_DIR",
        os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "uploads"),
    )
    MAX_CONTENT_LENGTH = 4 * 1024 * 1024  # 4MB request cap (poster max 2MB)
    POSTER_MAX_BYTES = 2 * 1024 * 1024

    # Bootstrap admin (SPEC §20)
    BOOTSTRAP_ADMIN_EMAIL = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@shebelieves.test")
    BOOTSTRAP_ADMIN_PASSWORD = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "Admin!Pass123")
    BOOTSTRAP_ADMIN_PHONE = os.environ.get("BOOTSTRAP_ADMIN_PHONE", "+263770000000")
    # Set to 1 to force the existing admin's email+password to match the env
    # vars on next boot (lockout recovery). Unset it again afterward.
    BOOTSTRAP_ADMIN_RESET = _bool(os.environ.get("BOOTSTRAP_ADMIN_RESET"), False)

    # Display
    DISPLAY_TZ = "Africa/Harare"

    # Background scheduler toggle.
    # DEFAULT: OFF in production. APScheduler inside gunicorn workers causes
    # SSL connection-pool corruption (every worker starts its own scheduler →
    # multiple threads fight over Postgres connections). Instead, trigger
    # /api/internal/jobs/run via Render Cron Jobs every minute. Set to "1"
    # locally if you want the in-process scheduler during dev.
    RUN_SCHEDULER = _bool(os.environ.get("RUN_SCHEDULER"), False)

    # Shared secret for the internal jobs endpoint. Must match the
    # Authorization: Bearer <token> header that the Render Cron job sends.
    INTERNAL_JOBS_TOKEN = os.environ.get("INTERNAL_JOBS_TOKEN", "")

    # Public base URL for building invite/share links
    PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5173")

    # Admin Ecocash number placeholder used in WhatsApp prefill text
    ADMIN_ECOCASH_NUMBER = os.environ.get("ADMIN_ECOCASH_NUMBER", "<ECOCASH-NUMBER>")


class TestConfig(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RUN_SCHEDULER = False
    HOLD_DURATION_MINUTES = 1440
