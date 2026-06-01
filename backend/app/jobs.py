"""Background jobs (SPEC §17).

Two functions you can call:
  - sweep_expired_holds: releases pending orders past their hold window
  - archive_past_events: flips finished events to archived

In production these are triggered by an external Render Cron Job hitting
POST /api/internal/jobs/run (see app/routes/internal.py). The in-process
APScheduler is disabled by default because running it inside gunicorn
workers corrupts the Postgres connection pool ("SSL error: decryption
failed or bad record mac").

For local dev, set RUN_SCHEDULER=1 and the in-process scheduler kicks in.
"""
from collections import Counter
from datetime import timedelta

from .extensions import db
from .models import Event, Order, TicketType, utcnow


def sweep_expired_holds(app):
    with app.app_context():
        now = utcnow()
        expired = (
            Order.query.filter(Order.status == "pending", Order.hold_expires_at < now).all()
        )
        for order in expired:
            for ttid, qty in Counter(
                it["ticket_type_id"] for it in order.get_intent()
            ).items():
                tt = TicketType.query.get(ttid)
                if tt:
                    tt.quantity_held = max(0, tt.quantity_held - qty)
            order.status = "expired"
            order.hold_expires_at = None
            order.clear_intent()
        if expired:
            db.session.commit()
        return len(expired)


def archive_past_events(app):
    with app.app_context():
        cutoff = utcnow() - timedelta(hours=app.config["ARCHIVE_AFTER_HOURS"])
        past = Event.query.filter(Event.status == "active", Event.end_at < cutoff).all()
        for e in past:
            e.status = "archived"
        if past:
            db.session.commit()
        return len(past)


def start_scheduler(app):
    """In-process scheduler — LOCAL DEV ONLY. See module docstring."""
    from apscheduler.schedulers.background import BackgroundScheduler

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(lambda: sweep_expired_holds(app), "interval", seconds=60, id="sweeper")
    scheduler.add_job(lambda: archive_past_events(app), "interval", hours=6, id="archiver")
    scheduler.start()
    return scheduler


# ---------------------------------------------------------------------------
# Lazy / on-demand sweeping — the free-tier mechanism.
#
# Instead of a background timer (unreliable on a free service that sleeps),
# we release expired holds the moment availability is read. A per-process
# throttle stops us from running the sweep on literally every request: at
# most once per _SWEEP_THROTTLE_SECONDS per worker. Worst case with N workers
# is N cheap indexed queries per interval — negligible.
import time as _time

_SWEEP_THROTTLE_SECONDS = 30
_ARCHIVE_THROTTLE_SECONDS = 3600
_last_sweep = 0.0
_last_archive = 0.0


def maybe_sweep(app, force=False):
    """Release expired holds if we haven't done so recently. Safe to call on
    any read path; it's idempotent and throttled."""
    global _last_sweep
    now = _time.monotonic()
    if not force and (now - _last_sweep) < _SWEEP_THROTTLE_SECONDS:
        return
    _last_sweep = now
    try:
        sweep_expired_holds(app)
    except Exception:
        # Never let housekeeping break the actual request.
        app.logger.exception("lazy sweep failed")


def maybe_archive(app, force=False):
    """Archive finished events occasionally. Cosmetic, long throttle."""
    global _last_archive
    now = _time.monotonic()
    if not force and (now - _last_archive) < _ARCHIVE_THROTTLE_SECONDS:
        return
    _last_archive = now
    try:
        archive_past_events(app)
    except Exception:
        app.logger.exception("lazy archive failed")
