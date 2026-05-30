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

    # Display
    DISPLAY_TZ = "Africa/Harare"

    # Scheduler toggle (off during tests)
    RUN_SCHEDULER = _bool(os.environ.get("RUN_SCHEDULER"), True)

    # Public base URL for building invite/share links
    PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5173")

    # Admin Ecocash number placeholder used in WhatsApp prefill text
    ADMIN_ECOCASH_NUMBER = os.environ.get("ADMIN_ECOCASH_NUMBER", "<ECOCASH-NUMBER>")


class TestConfig(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RUN_SCHEDULER = False
    HOLD_DURATION_MINUTES = 1440
