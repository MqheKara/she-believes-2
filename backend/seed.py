"""Seed script (SPEC §20). Creates a demo organizer and ~4 sample events
across categories with realistic ticket types so a fresh install is
immediately clickable.

Run:  python seed.py
"""
from datetime import timedelta
from decimal import Decimal

from app import create_app
from app.extensions import db
from app.hashing import hash_secret
from app.models import Event, TicketType, User, utcnow

DEMO_ORGANIZER_EMAIL = "host@shebelieves.test"
DEMO_ORGANIZER_PASSWORD = "HostPass123!"


def run():
    app = create_app()
    with app.app_context():
        organizer = User.query.filter_by(email=DEMO_ORGANIZER_EMAIL).first()
        if not organizer:
            organizer = User(
                role="organizer",
                name="Grace Moyo",
                email=DEMO_ORGANIZER_EMAIL,
                phone="+263771234567",
                password_hash=hash_secret(DEMO_ORGANIZER_PASSWORD),
            )
            db.session.add(organizer)
            db.session.flush()

        if Event.query.filter_by(organizer_id=organizer.id).count() > 0:
            print("Events already seeded — skipping.")
            return

        now = utcnow()
        events = [
            {
                "title": "Women's Prayer Altar — Harare",
                "description": "An evening of worship and intercession. Come ready, "
                               "come open, come expectant. A gathering of women, united in prayer.",
                "category": "Church",
                "start_at": now + timedelta(days=14, hours=18),
                "end_at": now + timedelta(days=14, hours=21),
                "location": "City Sports Centre, Harare",
                "color_scheme": "#EC1E79,#2BC4D9",
                "types": [("General", "0.00", 500), ("Front Rows", "10.00", 80)],
            },
            {
                "title": "Soirée of Light — Year-End Gala",
                "description": "A dressed-up celebration of the year. Royal violet "
                               "and gold, an evening to remember.",
                "category": "Festival",
                "start_at": now + timedelta(days=40, hours=19),
                "end_at": now + timedelta(days=40, hours=23),
                "location": "Meikles Hotel Ballroom, Harare",
                "color_scheme": "#4B1259,#D4A537",
                "types": [("Standard", "25.00", 200), ("VIP Table", "120.00", 20)],
            },
            {
                "title": "Acoustic Praise Night",
                "description": "Live worship music under the stars. Bring your voice.",
                "category": "Music",
                "start_at": now + timedelta(days=7, hours=18, minutes=30),
                "end_at": now + timedelta(days=7, hours=21, minutes=30),
                "location": "Borrowdale Gardens, Harare",
                "color_scheme": "#4B1259,#2BC4D9",
                "types": [("Early Bird", "8.00", 150), ("Door", "12.00", 150)],
            },
            {
                "title": "Sisterhood Arts Brunch",
                "description": "Creativity, conversation, and community over brunch. "
                               "Lunch included.",
                "category": "Arts",
                "start_at": now + timedelta(days=21, hours=10),
                "end_at": now + timedelta(days=21, hours=13),
                "location": "The Venue, Avondale, Harare",
                "color_scheme": "#EC1E79,#F58FBE",
                "types": [("Brunch Seat", "15.00", 60)],
            },
        ]

        for spec in events:
            ev = Event(
                organizer_id=organizer.id,
                title=spec["title"],
                description=spec["description"],
                category=spec["category"],
                start_at=spec["start_at"],
                end_at=spec["end_at"],
                location=spec["location"],
                color_scheme=spec["color_scheme"],
                status="active",  # pre-approved so the install is clickable
            )
            db.session.add(ev)
            db.session.flush()
            for name, price, qty in spec["types"]:
                db.session.add(TicketType(
                    event_id=ev.id, name=name, price_usd=Decimal(price), quantity_total=qty
                ))

        db.session.commit()
        print("Seeded demo organizer + 4 events.")
        print(f"  Organizer login: {DEMO_ORGANIZER_EMAIL} / {DEMO_ORGANIZER_PASSWORD}")


if __name__ == "__main__":
    run()
