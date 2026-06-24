from flask import Blueprint, request, jsonify
from models.tables import db, AppUser, TrekRoute, TrekBooking
from routes.auth_routes import get_current_user
import csv
import io

user_bp = Blueprint("user_bp", __name__)

def require_trekker():
    user, err = get_current_user()
    if err:
        return None, jsonify({"error": err}), 401
    if user.role != "trekker":
        return None, jsonify({"error": "Trekker access required"}), 403
    return user, None, None


@user_bp.route("/dashboard", methods=["GET"])
def user_dashboard():
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    active_treks = TrekRoute.query.filter_by(status="Open").count()
    my_bookings = TrekBooking.query.filter_by(user_id=user.uid).count()
    completed = TrekBooking.query.filter_by(user_id=user.uid, booking_status="Completed").count()

    return jsonify({
        "full_name": user.full_name,
        "active_treks": active_treks,
        "my_bookings": my_bookings,
        "completed_treks": completed
    }), 200


@user_bp.route("/treks", methods=["GET"])
def browse_treks():
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    difficulty = request.args.get("difficulty", "")
    location = request.args.get("location", "")
    duration = request.args.get("duration", "")
    search_q = request.args.get("q", "")

    query = TrekRoute.query.filter_by(status="Open")

    if difficulty:
        query = query.filter(TrekRoute.difficulty == difficulty)
    if location:
        query = query.filter(TrekRoute.location.ilike(f"%{location}%"))
    if duration:
        query = query.filter(TrekRoute.duration_days == int(duration))
    if search_q:
        query = query.filter(
            TrekRoute.trek_name.ilike(f"%{search_q}%") |
            TrekRoute.location.ilike(f"%{search_q}%")
        )

    treks = query.order_by(TrekRoute.start_date.asc()).all()
    return jsonify([t.to_dict() for t in treks]), 200


@user_bp.route("/treks/<int:trek_id>", methods=["GET"])
def trek_detail(trek_id):
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    trek = TrekRoute.query.get_or_404(trek_id)
    return jsonify(trek.to_dict()), 200


@user_bp.route("/bookings", methods=["POST"])
def book_trek():
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    body = request.get_json()
    trek_id = body.get("trek_id")
    if not trek_id:
        return jsonify({"error": "trek_id is required"}), 400

    trek = TrekRoute.query.get_or_404(trek_id)

    if trek.status != "Open":
        return jsonify({"error": "Trek is not open for booking"}), 400

    if trek.available_slots <= 0:
        return jsonify({"error": "No slots available"}), 400

    already_booked = TrekBooking.query.filter_by(
        user_id=user.uid,
        trek_id=trek_id,
        booking_status="Booked"
    ).first()
    if already_booked:
        return jsonify({"error": "You have already booked this trek"}), 409

    new_booking = TrekBooking(
        user_id=user.uid,
        trek_id=trek_id,
        booking_status="Booked",
        payment_status="Pending"
    )
    trek.available_slots -= 1
    db.session.add(new_booking)
    db.session.commit()

    return jsonify({"message": "Trek booked successfully", "booking_id": new_booking.booking_id}), 201


@user_bp.route("/bookings", methods=["GET"])
def my_bookings():
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    bookings = TrekBooking.query.filter_by(user_id=user.uid).order_by(TrekBooking.booked_on.desc()).all()
    return jsonify([b.to_dict() for b in bookings]), 200


@user_bp.route("/bookings/<int:booking_id>/cancel", methods=["PUT"])
def cancel_booking(booking_id):
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    booking = TrekBooking.query.get_or_404(booking_id)

    if booking.user_id != user.uid:
        return jsonify({"error": "Unauthorized"}), 403

    if booking.booking_status == "Cancelled":
        return jsonify({"error": "Booking already cancelled"}), 400

    trek = TrekRoute.query.get(booking.trek_id)
    booking.booking_status = "Cancelled"
    if trek:
        trek.available_slots += 1

    db.session.commit()
    return jsonify({"message": "Booking cancelled"}), 200


@user_bp.route("/history", methods=["GET"])
def trekking_history():
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    bookings = TrekBooking.query.filter_by(user_id=user.uid).order_by(TrekBooking.booked_on.desc()).all()
    return jsonify([b.to_dict() for b in bookings]), 200


@user_bp.route("/history/export", methods=["GET"])
def export_history():
    user, resp, code = require_trekker()
    if resp:
        return resp, code

    bookings = TrekBooking.query.filter_by(user_id=user.uid).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Booking ID", "Trek Name", "Location", "Start Date", "End Date", "Booking Status", "Booked On"])

    for b in bookings:
        trek = TrekRoute.query.get(b.trek_id)
        writer.writerow([
            b.booking_id,
            trek.trek_name if trek else "",
            trek.location if trek else "",
            str(trek.start_date) if trek else "",
            str(trek.end_date) if trek else "",
            b.booking_status,
            b.booked_on.strftime("%Y-%m-%d")
        ])

    output.seek(0)
    from flask import Response
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=trekking_history.csv"}
    )