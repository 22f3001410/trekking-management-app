from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class AppUser(db.Model):
    __tablename__ = "app_users"

    uid = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email_addr = db.Column(db.String(180), unique=True, nullable=False)
    pwd_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="trekker")
    phone_no = db.Column(db.String(15), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_blacklisted = db.Column(db.Boolean, default=False)
    joined_on = db.Column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship("TrekBooking", backref="trekker", lazy=True)
    staff_profile = db.relationship("StaffProfile", backref="linked_user", uselist=False)

    def set_password(self, raw_pwd):
        self.pwd_hash = generate_password_hash(raw_pwd)

    def verify_password(self, raw_pwd):
        return check_password_hash(self.pwd_hash, raw_pwd)

    def to_dict(self):
        return {
            "uid": self.uid,
            "full_name": self.full_name,
            "email_addr": self.email_addr,
            "role": self.role,
            "phone_no": self.phone_no,
            "is_active": self.is_active,
            "is_blacklisted": self.is_blacklisted,
            "joined_on": self.joined_on.strftime("%Y-%m-%d")
        }


class TrekRoute(db.Model):
    __tablename__ = "trek_routes"

    trek_id = db.Column(db.Integer, primary_key=True)
    trek_name = db.Column(db.String(150), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    difficulty = db.Column(db.String(20), nullable=False)
    duration_days = db.Column(db.Integer, nullable=False)
    total_slots = db.Column(db.Integer, nullable=False)
    available_slots = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Pending")
    altitude_meters = db.Column(db.Integer, nullable=True)
    meeting_point = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    assigned_staff = db.relationship("StaffAssignment", backref="trek", lazy=True)
    bookings = db.relationship("TrekBooking", backref="trek", lazy=True)

    def to_dict(self):
        return {
            "trek_id": self.trek_id,
            "trek_name": self.trek_name,
            "location": self.location,
            "difficulty": self.difficulty,
            "duration_days": self.duration_days,
            "total_slots": self.total_slots,
            "available_slots": self.available_slots,
            "start_date": str(self.start_date),
            "end_date": str(self.end_date),
            "status": self.status,
            "altitude_meters": self.altitude_meters,
            "meeting_point": self.meeting_point
        }


class StaffProfile(db.Model):
    __tablename__ = "staff_profiles"

    staff_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("app_users.uid"), nullable=False)
    expertise_level = db.Column(db.String(50), nullable=True)
    emergency_contact = db.Column(db.String(15), nullable=True)
    joined_as_staff = db.Column(db.DateTime, default=datetime.utcnow)

    assignments = db.relationship("StaffAssignment", backref="staff", lazy=True)

    def to_dict(self):
        user = AppUser.query.get(self.user_id)
        return {
            "staff_id": self.staff_id,
            "user_id": self.user_id,
            "full_name": user.full_name if user else None,
            "email_addr": user.email_addr if user else None,
            "phone_no": user.phone_no if user else None,
            "expertise_level": self.expertise_level,
            "emergency_contact": self.emergency_contact,
            "is_active": user.is_active if user else False,
            "is_blacklisted": user.is_blacklisted if user else False
        }


class StaffAssignment(db.Model):
    __tablename__ = "staff_assignments"

    assignment_id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff_profiles.staff_id"), nullable=False)
    trek_id = db.Column(db.Integer, db.ForeignKey("trek_routes.trek_id"), nullable=False)
    assigned_on = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "assignment_id": self.assignment_id,
            "staff_id": self.staff_id,
            "trek_id": self.trek_id,
            "assigned_on": self.assigned_on.strftime("%Y-%m-%d")
        }


class TrekBooking(db.Model):
    __tablename__ = "trek_bookings"

    booking_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("app_users.uid"), nullable=False)
    trek_id = db.Column(db.Integer, db.ForeignKey("trek_routes.trek_id"), nullable=False)
    booked_on = db.Column(db.DateTime, default=datetime.utcnow)
    booking_status = db.Column(db.String(20), default="Booked")
    payment_status = db.Column(db.String(20), default="Pending")
    participants_count = db.Column(db.Integer, default=1)

    def to_dict(self):
        trek = TrekRoute.query.get(self.trek_id)
        return {
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "trek_id": self.trek_id,
            "trek_name": trek.trek_name if trek else None,
            "location": trek.location if trek else None,
            "start_date": str(trek.start_date) if trek else None,
            "end_date": str(trek.end_date) if trek else None,
            "booked_on": self.booked_on.strftime("%Y-%m-%d"),
            "booking_status": self.booking_status,
            "payment_status": self.payment_status,
            "participants_count": self.participants_count
        }