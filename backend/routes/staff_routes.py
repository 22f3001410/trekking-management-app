from flask import Blueprint, request, jsonify
from models.tables import db, AppUser, TrekRoute, StaffProfile, StaffAssignment, TrekBooking
from routes.auth_routes import get_current_user
from extensions import cache

staff_bp = Blueprint("staff_bp", __name__)

def require_staff():
    user, err = get_current_user()
    if err:
        return None, jsonify({"error": err}), 401
    if user.role not in ["staff", "admin"]:
        return None, jsonify({"error": "Staff access required"}), 403
    return user, None, None


def get_staff_profile(user_id):
    return StaffProfile.query.filter_by(user_id=user_id).first()


@staff_bp.route("/dashboard", methods=["GET"])
def staff_dashboard():
    user, resp, code = require_staff()
    if resp:
        return resp, code

    profile = get_staff_profile(user.uid)
    if not profile:
        return jsonify({"error": "Staff profile not found"}), 404

    assignments = StaffAssignment.query.filter_by(staff_id=profile.staff_id).all()
    trek_ids = [a.trek_id for a in assignments]

    assigned_treks = TrekRoute.query.filter(TrekRoute.trek_id.in_(trek_ids)).all()

    trek_data = []
    for t in assigned_treks:
        reg_count = TrekBooking.query.filter_by(trek_id=t.trek_id, booking_status="Booked").count()
        info = t.to_dict()
        info["registered_users"] = reg_count
        trek_data.append(info)

    return jsonify({
        "staff_name": user.full_name,
        "assigned_treks": trek_data,
        "total_assigned": len(trek_data)
    }), 200


@staff_bp.route("/treks", methods=["GET"])
def my_treks():
    user, resp, code = require_staff()
    if resp:
        return resp, code

    profile = get_staff_profile(user.uid)
    if not profile:
        return jsonify([]), 200

    assignments = StaffAssignment.query.filter_by(staff_id=profile.staff_id).all()
    trek_ids = [a.trek_id for a in assignments]
    treks = TrekRoute.query.filter(TrekRoute.trek_id.in_(trek_ids)).all()
    return jsonify([t.to_dict() for t in treks]), 200


@staff_bp.route("/treks/<int:trek_id>/slots", methods=["PUT"])
def update_slots(trek_id):
    user, resp, code = require_staff()
    if resp:
        return resp, code

    profile = get_staff_profile(user.uid)
    if not profile:
        return jsonify({"error": "Staff profile not found"}), 404

    is_assigned = StaffAssignment.query.filter_by(staff_id=profile.staff_id, trek_id=trek_id).first()
    if not is_assigned:
        return jsonify({"error": "You are not assigned to this trek"}), 403

    trek = TrekRoute.query.get_or_404(trek_id)
    body = request.get_json()

    if "available_slots" in body:
        new_slots = int(body["available_slots"])
        if new_slots < 0 or new_slots > trek.total_slots:
            return jsonify({"error": "Invalid slot count"}), 400
        trek.available_slots = new_slots

    db.session.commit()
    cache.clear()
    return jsonify({"message": "Slots updated", "available_slots": trek.available_slots}), 200


@staff_bp.route("/treks/<int:trek_id>/status", methods=["PUT"])
def update_trek_status(trek_id):
    user, resp, code = require_staff()
    if resp:
        return resp, code

    profile = get_staff_profile(user.uid)
    if not profile:
        return jsonify({"error": "Staff profile not found"}), 404

    is_assigned = StaffAssignment.query.filter_by(staff_id=profile.staff_id, trek_id=trek_id).first()
    if not is_assigned:
        return jsonify({"error": "You are not assigned to this trek"}), 403

    trek = TrekRoute.query.get_or_404(trek_id)
    body = request.get_json()
    allowed_statuses = ["Open", "Closed", "Completed"]

    new_status = body.get("status", "")
    if new_status not in allowed_statuses:
        return jsonify({"error": f"Status must be one of {allowed_statuses}"}), 400

    trek.status = new_status
    db.session.commit()
    cache.clear()
    return jsonify({"message": f"Trek status set to {new_status}"}), 200


@staff_bp.route("/treks/<int:trek_id>/participants", methods=["GET"])
def trek_participants(trek_id):
    user, resp, code = require_staff()
    if resp:
        return resp, code

    profile = get_staff_profile(user.uid)
    if not profile:
        return jsonify({"error": "Staff profile not found"}), 404

    is_assigned = StaffAssignment.query.filter_by(staff_id=profile.staff_id, trek_id=trek_id).first()
    if not is_assigned:
        return jsonify({"error": "Not assigned to this trek"}), 403

    bookings = TrekBooking.query.filter_by(trek_id=trek_id).all()
    result = []
    for b in bookings:
        trekker = AppUser.query.get(b.user_id)
        if trekker:
            result.append({
                "booking_id": b.booking_id,
                "full_name": trekker.full_name,
                "email_addr": trekker.email_addr,
                "phone_no": trekker.phone_no,
                "booking_status": b.booking_status,
                "booked_on": b.booked_on.strftime("%Y-%m-%d")
            })
    return jsonify(result), 200