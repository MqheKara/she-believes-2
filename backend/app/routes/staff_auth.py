from flask import Blueprint, jsonify, request

from ..auth import token_for_staff
from ..hashing import verify_secret
from ..models import User

bp = Blueprint("staff_auth", __name__, url_prefix="/api/auth")


@bp.post("/staff/login")
def staff_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter(
        User.email == email, User.role.in_(("admin", "organizer"))
    ).first()
    if not user or not verify_secret(password, user.password_hash):
        return jsonify({"error": "bad_credentials"}), 401
    return jsonify({"token": token_for_staff(user), "user": user.public_dict()})
