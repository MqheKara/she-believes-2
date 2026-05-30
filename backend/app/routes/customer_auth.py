from flask import Blueprint, g, jsonify, request

from ..auth import require_auth, token_for_customer
from ..core import valid_phone
from ..extensions import db
from ..hashing import hash_secret, verify_secret
from ..models import User

bp = Blueprint("customer_auth", __name__, url_prefix="/api/auth")


@bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    print(data)
    name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not name or not email or not phone:
        return jsonify({"error": "missing_fields"}), 400
    if not valid_phone(phone):
        return jsonify({"error": "invalid_phone", "message": "Phone must start with +263."}), 400
    if len(password) < 8:
        return jsonify({"error": "weak_password", "message": "Use at least 8 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email_taken"}), 409
    if User.query.filter_by(phone=phone).first():
        return jsonify({"error": "phone_taken"}), 409

    user = User(
        role="customer",
        name=name,
        email=email,
        phone=phone,
        password_hash=hash_secret(password),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"token": token_for_customer(user), "user": user.public_dict()}), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email, role="customer").first()
    if not user or not verify_secret(password, user.password_hash):
        return jsonify({"error": "bad_credentials"}), 401
    return jsonify({"token": token_for_customer(user), "user": user.public_dict()})


@bp.get("/me")
@require_auth()
def me():
    return jsonify({"user": g.current_user.public_dict()})
