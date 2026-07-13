from flask import Blueprint, request, jsonify
from models.tables import db, AppUser, TrekRoute, StaffProfile, StaffAssignment, TrekBooking
from routes.auth_routes import get_current_user
from datetime import datetime
from extensions import cache

admin_bp = Blueprint("admin_bp", __name__)

def require_admin():
    user, err = get_current_user()
    if err:
        return None, jsonify({"error": err}), 401
    if user.role != "admin":
        return None, jsonify({"error": "Admin access required"}), 403
    return user, None, None


@admin_bp.route("/dashboard", methods=["GET"])
def dashboard_stats():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    total_treks = TrekRoute.query.count()
    total_users = AppUser.query.filter_by(role="trekker").count()
    total_staff = AppUser.query.filter_by(role="staff").count()
    total_bookings = TrekBooking.query.count()
    active_treks = TrekRoute.query.filter_by(status="Open").count()

    return jsonify({
        "total_treks": total_treks,
        "total_users": total_users,
        "total_staff": total_staff,
        "total_bookings": total_bookings,
        "active_treks": active_treks
    }), 200


@admin_bp.route("/treks", methods=["GET"])
def list_treks():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    search_term = request.args.get("q", "")
    query = TrekRoute.query
    if search_term:
        query = query.filter(
            TrekRoute.trek_name.ilike(f"%{search_term}%") |
            TrekRoute.location.ilike(f"%{search_term}%")
        )
    treks = query.order_by(TrekRoute.created_at.desc()).all()
    return jsonify([t.to_dict() for t in treks]), 200


@admin_bp.route("/treks", methods=["POST"])
def create_trek():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    body = request.get_json()
    required_fields = ["trek_name", "location", "difficulty", "duration_days", "total_slots", "start_date", "end_date"]
    for f in required_fields:
        if f not in body:
            return jsonify({"error": f"{f} is required"}), 400

    if body["difficulty"] not in ["Easy", "Moderate", "Hard"]:
        return jsonify({"error": "Difficulty must be Easy, Moderate, or Hard"}), 400

    try:
        s_date = datetime.strptime(body["start_date"], "%Y-%m-%d").date()
        e_date = datetime.strptime(body["end_date"], "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    if s_date >= e_date:
        return jsonify({"error": "End date must be after start date"}), 400

    new_trek = TrekRoute(
        trek_name=body["trek_name"],
        location=body["location"],
        difficulty=body["difficulty"],
        duration_days=int(body["duration_days"]),
        total_slots=int(body["total_slots"]),
        available_slots=int(body["total_slots"]),
        start_date=s_date,
        end_date=e_date,
        status="Pending",
        altitude_meters=body.get("altitude_meters"),
        meeting_point=body.get("meeting_point", "")
    )
    db.session.add(new_trek)
    db.session.commit()
    cache.clear()
    return jsonify({"message": "Trek created", "trek_id": new_trek.trek_id}), 201


@admin_bp.route("/treks/<int:trek_id>", methods=["PUT"])
def edit_trek(trek_id):
    user, resp, code = require_admin()
    if resp:
        return resp, code

    trek = TrekRoute.query.get_or_404(trek_id)
    body = request.get_json()

    updatable = ["trek_name", "location", "difficulty", "duration_days", "total_slots",
                 "altitude_meters", "meeting_point", "status"]
    for field in updatable:
        if field in body:
            setattr(trek, field, body[field])

    if "start_date" in body:
        trek.start_date = datetime.strptime(body["start_date"], "%Y-%m-%d").date()
    if "end_date" in body:
        trek.end_date = datetime.strptime(body["end_date"], "%Y-%m-%d").date()

    db.session.commit()
    cache.clear()
    return jsonify({"message": "Trek updated"}), 200


@admin_bp.route("/treks/<int:trek_id>", methods=["DELETE"])
def remove_trek(trek_id):
    user, resp, code = require_admin()
    if resp:
        return resp, code

    trek = TrekRoute.query.get_or_404(trek_id)
    db.session.delete(trek)
    db.session.commit()
    cache.clear()
    return jsonify({"message": "Trek removed"}), 200


@admin_bp.route("/staff", methods=["GET"])
def list_staff():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    search_q = request.args.get("q", "")
    query = StaffProfile.query.join(AppUser, StaffProfile.user_id == AppUser.uid)
    if search_q:
        query = query.filter(
            AppUser.full_name.ilike(f"%{search_q}%") |
            AppUser.email_addr.ilike(f"%{search_q}%")
        )
    staff_list = query.all()
    return jsonify([s.to_dict() for s in staff_list]), 200


@admin_bp.route("/staff", methods=["POST"])
def add_staff():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    body = request.get_json()
    required = ["full_name", "email_addr", "password"]
    for f in required:
        if f not in body:
            return jsonify({"error": f"{f} is required"}), 400

    existing = AppUser.query.filter_by(email_addr=body["email_addr"].lower()).first()
    if existing:
        return jsonify({"error": "Email already exists"}), 409

    staff_user = AppUser(
        full_name=body["full_name"].strip(),
        email_addr=body["email_addr"].lower().strip(),
        role="staff",
        phone_no=body.get("phone_no", "")
    )
    staff_user.set_password(body["password"])
    db.session.add(staff_user)
    db.session.flush()

    profile = StaffProfile(
        user_id=staff_user.uid,
        expertise_level=body.get("expertise_level", ""),
        emergency_contact=body.get("emergency_contact", "")
    )
    db.session.add(profile)
    db.session.commit()
    return jsonify({"message": "Staff added", "staff_id": profile.staff_id}), 201


@admin_bp.route("/staff/<int:staff_id>/assign/<int:trek_id>", methods=["POST"])
def assign_staff_to_trek(staff_id, trek_id):
    user, resp, code = require_admin()
    if resp:
        return resp, code

    already = StaffAssignment.query.filter_by(staff_id=staff_id, trek_id=trek_id).first()
    if already:
        return jsonify({"error": "Staff already assigned to this trek"}), 409

    assignment = StaffAssignment(staff_id=staff_id, trek_id=trek_id)
    db.session.add(assignment)
    db.session.commit()
    return jsonify({"message": "Staff assigned to trek"}), 201


@admin_bp.route("/users", methods=["GET"])
def list_users():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    search_q = request.args.get("q", "")
    query = AppUser.query.filter_by(role="trekker")
    if search_q:
        query = query.filter(
            AppUser.full_name.ilike(f"%{search_q}%") |
            AppUser.email_addr.ilike(f"%{search_q}%")
        )
    users = query.all()
    return jsonify([u.to_dict() for u in users]), 200


@admin_bp.route("/users/<int:uid>/toggle-status", methods=["PUT"])
def toggle_user_status(uid):
    user, resp, code = require_admin()
    if resp:
        return resp, code

    target = AppUser.query.get_or_404(uid)
    body = request.get_json()
    action = body.get("action", "")

    if action == "deactivate":
        target.is_active = False
    elif action == "activate":
        target.is_active = True
    elif action == "blacklist":
        target.is_blacklisted = True
        target.is_active = False
    elif action == "unblacklist":
        target.is_blacklisted = False
        target.is_active = True
    else:
        return jsonify({"error": "Invalid action"}), 400

    db.session.commit()
    return jsonify({"message": f"User status updated: {action}"}), 200


@admin_bp.route("/bookings", methods=["GET"])
def all_bookings():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    bookings = TrekBooking.query.order_by(TrekBooking.booked_on.desc()).all()
    return jsonify([b.to_dict() for b in bookings]), 200


@admin_bp.route("/reports/summary", methods=["GET"])
def trek_summary_report():
    user, resp, code = require_admin()
    if resp:
        return resp, code

    treks = TrekRoute.query.all()
    report = []
    for t in treks:
        booking_count = TrekBooking.query.filter_by(trek_id=t.trek_id).count()
        report.append({
            "trek_name": t.trek_name,
            "location": t.location,
            "status": t.status,
            "total_slots": t.total_slots,
            "available_slots": t.available_slots,
            "total_bookings": booking_count
        })
    return jsonify(report), 200