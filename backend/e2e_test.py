"""End-to-end test against the Flask test client. Exercises the full happy
path plus the critical edge cases from BUILD_INSTRUCTIONS.md's checklist:
signup -> checkout -> hold -> admin approve -> ticket -> gate scan
(valid/duplicate/invalid), walk-in, comp, CSV, oversell 409, hold expiry.

Run:  python e2e_test.py
Exit code 0 = all passed.
"""
import json
import sys
from datetime import timedelta
from decimal import Decimal

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.hashing import hash_secret
from app.models import Event, Order, TicketType, User, utcnow

PASS, FAIL = 0, 0


def check(cond, label):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    app = create_app(TestConfig)
    c = app.test_client()

    with app.app_context():
        # ---- seed an organizer + active event with tight inventory ----
        org = User(role="organizer", name="Org", email="org@t.test",
                   phone="+263771111111", password_hash=hash_secret("orgpassword1"))
        db.session.add(org)
        db.session.flush()
        ev = Event(organizer_id=org.id, title="Test Gala", category="Festival",
                   start_at=utcnow() + timedelta(days=5),
                   end_at=utcnow() + timedelta(days=5, hours=3),
                   location="Test Venue", status="active")
        db.session.add(ev)
        db.session.flush()
        tt = TicketType(event_id=ev.id, name="GA", price_usd=Decimal("10.00"), quantity_total=3)
        db.session.add(tt)
        db.session.commit()
        event_id, tt_id, org_id = ev.id, tt.id, org.id
        admin = User.query.filter_by(role="admin").first()

    # 1. customer signup
    r = c.post("/api/auth/signup", json={"name": "Thandi", "email": "thandi@t.test",
                                         "phone": "+263772222222", "password": "password123"})
    check(r.status_code == 201, "customer signup returns 201")
    ctoken = r.get_json()["token"]

    # 2. browse events
    r = c.get("/api/events")
    check(r.status_code == 200 and len(r.get_json()) == 1, "events list shows the active event")

    # 3-4. checkout with 2 tickets, different attendee names
    r = c.post("/api/orders", headers=auth(ctoken), json={
        "event_id": event_id,
        "items": [
            {"ticket_type_id": tt_id, "attendee_name": "Thandi M"},
            {"ticket_type_id": tt_id, "attendee_name": "Rumbi K"},
        ],
    })
    check(r.status_code == 201, "order request submits (201)")
    order = r.get_json()
    order_id = order["id"]
    check(order["status"] == "pending", "order is pending")
    check(order["total_usd"] == 20.0, "order total is $20.00")

    # hold placed
    with app.app_context():
        t = TicketType.query.get(tt_id)
        check(t.quantity_held == 2, "inventory hold = 2")
        check(t.quantity_remaining == 1, "remaining = 1 after hold")

    # 5. admin sees the request
    atoken = c.post("/api/auth/staff/login", json={
        "email": admin.email, "password": TestConfig.BOOTSTRAP_ADMIN_PASSWORD}).get_json()["token"]
    r = c.get("/api/admin/order-requests", headers=auth(atoken))
    reqs = r.get_json()
    check(any(o["id"] == order_id for o in reqs), "admin sees pending order with details")
    target = next(o for o in reqs if o["id"] == order_id)
    check(target["buyer_phone"] == "+263772222222", "admin sees customer phone")

    # 19. oversell: a second customer tries to buy 2 (only 1 remains) -> 409
    c2 = c.post("/api/auth/signup", json={"name": "Other", "email": "other@t.test",
                "phone": "+263773333333", "password": "password123"}).get_json()["token"]
    r = c.post("/api/orders", headers=auth(c2), json={
        "event_id": event_id,
        "items": [{"ticket_type_id": tt_id, "attendee_name": "A"},
                  {"ticket_type_id": tt_id, "attendee_name": "B"}]})
    check(r.status_code == 409 and r.get_json().get("error") == "sold_out",
          "oversell returns 409 sold_out")

    # 7. admin approves with ecocash code
    r = c.post(f"/api/admin/orders/{order_id}/approve", headers=auth(atoken),
               json={"ecocash_ref": "TXN12345"})
    check(r.status_code == 200, "admin approves order")
    with app.app_context():
        t = TicketType.query.get(tt_id)
        check(t.quantity_held == 0 and t.quantity_sold == 2, "held->sold conversion correct")

    # 8. submitted page poll: order now paid, has ticket ids
    r = c.get(f"/api/orders/{order_id}", headers=auth(ctoken))
    od = r.get_json()
    check(od["status"] == "paid" and od["first_ticket_id"], "order paid, ticket minted")
    ticket_id = od["first_ticket_id"]

    # 9. my-tickets + ticket detail with qr
    r = c.get("/api/my/tickets", headers=auth(ctoken))
    check(len(r.get_json()) == 2, "customer has 2 tickets")
    r = c.get(f"/api/tickets/{ticket_id}", headers=auth(ctoken))
    qr_code = r.get_json()["qr_code"]
    check(qr_code.count(".") == 2, "qr_code has signed 3-part format")

    # approval code display strips prefix
    r = c.get("/api/admin/order-requests?status=paid", headers=auth(atoken))
    paid = next(o for o in r.get_json() if o["id"] == order_id)
    check(paid["approval_code"] == "TXN12345", "approval code displays without prefix")

    # 14-15. create gate staff, gate login
    r = c.post("/api/admin/gate-staff", headers=auth(atoken), json={
        "name": "Gatekeeper", "phone": "+263774444444", "pin": "1234", "event_id": event_id})
    check(r.status_code == 201, "admin creates gate staff")
    r = c.post("/api/gate/login", json={"phone": "+263774444444", "pin": "1234"})
    check(r.status_code == 200, "gate staff logs in with phone+PIN")
    gtoken = r.get_json()["token"]

    # 16. valid scan
    r = c.post("/api/gate/checkin", headers=auth(gtoken),
               json={"qr_code": qr_code, "device_id": "dev-1", "scanned_at": utcnow().isoformat() + "Z"})
    check(r.get_json()["status"] == "valid", "first scan = VALID")

    # 17. duplicate scan
    r = c.post("/api/gate/checkin", headers=auth(gtoken),
               json={"qr_code": qr_code, "device_id": "dev-2", "scanned_at": utcnow().isoformat() + "Z"})
    body = r.get_json()
    check(body["status"] == "duplicate" and body["original_checkin"]["device_id"] == "dev-1",
          "second scan = DUPLICATE with original device")

    # 18. forged qr
    r = c.post("/api/gate/checkin", headers=auth(gtoken),
               json={"qr_code": "garbage.fake.signature", "device_id": "dev-1"})
    check(r.get_json()["status"] == "invalid", "forged QR = INVALID")

    # 10. walk-in with price override
    r = c.post("/api/admin/walk-in-tickets", headers=auth(atoken), json={
        "event_id": event_id, "ticket_type_id": tt_id, "buyer_name": "Door Buyer",
        "buyer_phone": "+263775555555", "attendee_name": "Door Buyer",
        "payment_ref": "DOOR99", "price_usd": "5.00", "quantity": 1})
    check(r.status_code == 201, "walk-in sale with price override (201)")

    # 11. comp ticket  (3 total: 2 sold + 1 walk-in = 3, sold out now -> comp should 409)
    r = c.post("/api/admin/comp-tickets", headers=auth(atoken), json={
        "event_id": event_id, "ticket_type_id": tt_id, "attendee_name": "Comped", "quantity": 1})
    check(r.status_code == 409, "comp blocked when sold out (counts against inventory)")

    # 12-13. attendee list + CSV
    r = c.get(f"/api/admin/events/{event_id}/attendees", headers=auth(atoken))
    data = r.get_json()
    sources = {row["source"] for row in data["attendees"]}
    check("Online" in sources and "Walk-in" in sources, "attendee list shows multiple sources")
    check(data["summary"]["total_tickets"] == 3, "summary total tickets = 3")
    r = c.get(f"/api/admin/events/{event_id}/attendees.csv", headers=auth(atoken))
    check(r.status_code == 200 and "attendees" in r.headers.get("Content-Disposition", ""),
          "CSV export downloads")
    check(len(r.get_data(as_text=True).strip().splitlines()) == 4, "CSV has header + 3 rows")

    # 20. hold expiry: create a fresh event, order, force-expire, sweep
    with app.app_context():
        from app.jobs import sweep_expired_holds
        ev2 = Event(organizer_id=org_id, title="Expiry Test", category="Other",
                    start_at=utcnow() + timedelta(days=2), end_at=utcnow() + timedelta(days=2, hours=2),
                    location="V", status="active")
        db.session.add(ev2); db.session.flush()
        tt2 = TicketType(event_id=ev2.id, name="GA", price_usd=Decimal("4.00"), quantity_total=5)
        db.session.add(tt2); db.session.commit()
        ev2_id, tt2_id = ev2.id, tt2.id

    r = c.post("/api/orders", headers=auth(ctoken), json={
        "event_id": ev2_id, "items": [{"ticket_type_id": tt2_id, "attendee_name": "X"}]})
    exp_order_id = r.get_json()["id"]
    with app.app_context():
        o = Order.query.get(exp_order_id)
        o.hold_expires_at = utcnow() - timedelta(minutes=1)
        db.session.commit()
        sweep_expired_holds(app)
        o = Order.query.get(exp_order_id)
        t2 = TicketType.query.get(tt2_id)
        check(o.status == "expired", "expired order swept to 'expired'")
        check(t2.quantity_held == 0, "swept hold returned to inventory")

    # cancel-pending flow
    r = c.post("/api/orders", headers=auth(ctoken), json={
        "event_id": ev2_id, "items": [{"ticket_type_id": tt2_id, "attendee_name": "Y"}]})
    cancel_id = r.get_json()["id"]
    r = c.delete(f"/api/orders/{cancel_id}", headers=auth(ctoken))
    check(r.status_code == 200, "customer cancels pending order")

    print("\n" + "=" * 50)
    print(f"  {PASS} passed, {FAIL} failed")
    print("=" * 50)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
