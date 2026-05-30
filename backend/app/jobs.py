"""Background jobs (SPEC §17). Sweeper releases expired holds every 60s;
archiver flips past events to archived every 6h."""
import json
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
            if (order.payment_ref or "").startswith("INTENT:"):
                try:
                    items = json.loads(order.payment_ref.split(":", 1)[1])
                    for ttid, qty in Counter(it["ticket_type_id"] for it in items).items():
                        tt = TicketType.query.get(ttid)
                        if tt:
                            tt.quantity_held = max(0, tt.quantity_held - qty)
                except (ValueError, IndexError):
                    pass
            order.status = "expired"
            order.hold_expires_at = None
        if expired:
            db.session.commit()


def archive_past_events(app):
    with app.app_context():
        cutoff = utcnow() - timedelta(hours=app.config["ARCHIVE_AFTER_HOURS"])
        past = Event.query.filter(Event.status == "active", Event.end_at < cutoff).all()
        for e in past:
            e.status = "archived"
        if past:
            db.session.commit()


def start_scheduler(app):
    from apscheduler.schedulers.background import BackgroundScheduler

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(lambda: sweep_expired_holds(app), "interval", seconds=60, id="sweeper")
    scheduler.add_job(lambda: archive_past_events(app), "interval", hours=6, id="archiver")
    scheduler.start()
    return scheduler
