"""JWT issue/verify + route guards. Tokens carry sub (user id), role, and
for gate staff the scoped event id. HS256 per SPEC §18."""
import functools
from datetime import datetime, timedelta

import jwt
from flask import current_app, g, jsonify, request

from .models import User


def _secret():
    return current_app.config["JWT_SECRET"]


def issue_token(user: User, expires_at: datetime):
    payload = {
        "sub": user.id,
        "role": user.role,
        "exp": expires_at,
        "iat": datetime.utcnow(),
    }
    if user.role == "gate_staff":
        payload["event_id"] = user.gate_staff_event_id
    return jwt.encode(payload, _secret(), algorithm="HS256")


def token_for_customer(user):
    exp = datetime.utcnow() + timedelta(days=current_app.config["JWT_CUSTOMER_DAYS"])
    return issue_token(user, exp)


def token_for_staff(user):
    exp = datetime.utcnow() + timedelta(days=current_app.config["JWT_STAFF_DAYS"])
    return issue_token(user, exp)


def token_for_gate(user, event_end_at):
    exp = event_end_at + timedelta(hours=current_app.config["GATE_GRACE_HOURS"])
    return issue_token(user, exp)


def _decode():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        return jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def load_current_user():
    """Populate g.current_user / g.claims if a valid token is present. Never raises."""
    g.current_user = None
    g.claims = None
    claims = _decode()
    if not claims:
        return None
    user = User.query.get(claims.get("sub"))
    if not user:
        return None
    g.current_user = user
    g.claims = claims
    return user


def require_auth(*roles):
    """Guard a route. Pass roles to restrict; empty = any authenticated user."""

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            user = load_current_user()
            if not user:
                return jsonify({"error": "unauthorized"}), 401
            if roles and user.role not in roles:
                return jsonify({"error": "forbidden"}), 403
            # Gate staff lockout check (event ended >24h ago invalidates anyway via exp)
            if user.locked_until and user.locked_until > datetime.utcnow():
                return jsonify({"error": "locked"}), 423
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def optional_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        load_current_user()
        return fn(*args, **kwargs)

    return wrapper
