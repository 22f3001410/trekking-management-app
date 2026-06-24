from flask import Blueprint, request, jsonify
from models.tables import db, AppUser
from config import AppConfig
import jwt
import datetime

auth_bp = Blueprint("auth_bp", __name__)

def generate_token(user_id, role):
    expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=AppConfig.JWT_EXPIRY_HOURS)
    payload = {
        "uid": user_id,
        "role": role,
        "exp": expiry
    }
    token = jwt.encode(payload, AppConfig.JWT_SECRET, algorithm="HS256")
    return token


def decode_token(token):
    try:
        data = jwt.decode(token, AppConfig.JWT_SECRET, algorithms=["HS256"])
        return data, None
    except jwt.ExpiredSignatureError:
        return None, "Token has expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, "No token provided"
    token = auth_header.split(" ")[1]
    payload, err = decode_token(token)
    if err:
        return None, err
    user = AppUser.query.get(payload["uid"])
    if not user or not user.is_active or user.is_blacklisted:
        return None, "User not found or inactive"
    return user, None


@auth_bp.route("/register", methods=["POST"])
def register_trekker():
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data received"}), 400

    required = ["full_name", "email_addr", "password"]
    for field in required:
        if field not in body or not body[field].strip():
            return jsonify({"error": f"{field} is required"}), 400

    existing = AppUser.query.filter_by(email_addr=body["email_addr"].lower()).first()
    if existing:
        return jsonify({"error": "Email already registered"}), 409

    new_user = AppUser(
        full_name=body["full_name"].strip(),
        email_addr=body["email_addr"].lower().strip(),
        role="trekker",
        phone_no=body.get("phone_no", "").strip()
    )
    new_user.set_password(body["password"])
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "Registration successful", "uid": new_user.uid}), 201


@auth_bp.route("/login", methods=["POST"])
def login_user():
    body = request.get_json()
    if not body or not body.get("email_addr") or not body.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    user = AppUser.query.filter_by(email_addr=body["email_addr"].lower()).first()
    if not user or not user.verify_password(body["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    if user.is_blacklisted:
        return jsonify({"error": "Your account has been blacklisted"}), 403

    if not user.is_active:
        return jsonify({"error": "Account is inactive"}), 403

    token = generate_token(user.uid, user.role)
    return jsonify({
        "token": token,
        "role": user.role,
        "uid": user.uid,
        "full_name": user.full_name
    }), 200


@auth_bp.route("/profile", methods=["GET"])
def get_profile():
    user, err = get_current_user()
    if err:
        return jsonify({"error": err}), 401
    return jsonify(user.to_dict()), 200


@auth_bp.route("/profile", methods=["PUT"])
def update_profile():
    user, err = get_current_user()
    if err:
        return jsonify({"error": err}), 401

    body = request.get_json()
    if body.get("full_name"):
        user.full_name = body["full_name"].strip()
    if body.get("phone_no"):
        user.phone_no = body["phone_no"].strip()
    if body.get("new_password"):
        user.set_password(body["new_password"])

    db.session.commit()
    return jsonify({"message": "Profile updated"}), 200