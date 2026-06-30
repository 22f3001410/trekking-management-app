from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta
import csv
import os


def create_celery(application):
    engine = Celery(
        application.import_name,
        broker="redis://localhost:6379/0",
        backend="redis://localhost:6379/0"
    )
    engine.conf.update(application.config)

    class ContextTask(engine.Task):
        def __call__(self, *args, **kwargs):
            with application.app_context():
                return self.run(*args, **kwargs)

    engine.Task = ContextTask
    return engine


def register_schedules(celery_instance):
    celery_instance.conf.beat_schedule = {
        "send-trek-reminders": {
            "task": "workers.tasks.dispatch_reminders",
            "schedule": crontab(hour=8, minute=0),
        },
        "monthly-admin-report": {
            "task": "workers.tasks.compile_monthly_report",
            "schedule": crontab(day_of_month=1, hour=7, minute=0),
        },
    }
    celery_instance.conf.timezone = "Asia/Kolkata"


from app import app as flask_app, mail as mailer

celery = create_celery(flask_app)
register_schedules(celery)


@celery.task(name="workers.tasks.dispatch_reminders")
def dispatch_reminders():
    from models.tables import TrekBooking, TrekRoute, AppUser
    from flask_mail import Message

    cutoff_start = datetime.utcnow() + timedelta(hours=24)
    cutoff_end = datetime.utcnow() + timedelta(hours=48)

    upcoming = TrekBooking.query.join(TrekRoute).filter(
        TrekRoute.start_date >= cutoff_start.date(),
        TrekRoute.start_date <= cutoff_end.date(),
        TrekBooking.booking_status == "Booked"
    ).all()

    for entry in upcoming:
        participant = AppUser.query.get(entry.user_id)
        trek = TrekRoute.query.get(entry.trek_id)
        if participant and trek:
            mail_body = (
                f"Hello {participant.full_name},\n\n"
                f"This is a reminder that your trek '{trek.trek_name}' "
                f"is scheduled on {trek.start_date}.\n\n"
                f"Meeting point: {trek.meeting_point}\n"
                f"Difficulty: {trek.difficulty}\n\n"
                f"Stay prepared and have a great trek!\n\nTrekking App Team"
            )
            msg = Message(
                subject=f"Reminder: {trek.trek_name} is tomorrow!",
                recipients=[participant.email_addr],
                body=mail_body
            )
            mailer.send(msg)

    return "Reminders dispatched"


@celery.task(name="workers.tasks.compile_monthly_report")
def compile_monthly_report():
    from models.tables import TrekBooking, TrekRoute
    from flask_mail import Message

    now = datetime.utcnow()
    first_day = now.replace(day=1, hour=0, minute=0, second=0)
    last_month_end = first_day - timedelta(seconds=1)
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0)

    bookings = TrekBooking.query.filter(
        TrekBooking.booked_on >= last_month_start,
        TrekBooking.booked_on <= last_month_end
    ).all()

    total_bookings = len(bookings)
    confirmed = sum(1 for b in bookings if b.booking_status == "Booked")
    cancelled = sum(1 for b in bookings if b.booking_status == "Cancelled")

    trek_counts = {}
    for b in bookings:
        trek_counts[b.trek_id] = trek_counts.get(b.trek_id, 0) + 1

    popular_trek_name = "N/A"
    if trek_counts:
        top_id = max(trek_counts, key=trek_counts.get)
        route = TrekRoute.query.get(top_id)
        if route:
            popular_trek_name = route.trek_name

    report_lines = (
        f"Monthly Trekking Report — {last_month_start.strftime('%B %Y')}\n"
        f"{'=' * 45}\n"
        f"Total Bookings   : {total_bookings}\n"
        f"Confirmed        : {confirmed}\n"
        f"Cancelled        : {cancelled}\n"
        f"Most Popular Trek: {popular_trek_name}\n"
    )

    from config import AppConfig
    msg = Message(
        subject=f"Monthly Report — {last_month_start.strftime('%B %Y')}",
        recipients=[AppConfig.ADMIN_EMAIL],
        body=report_lines
    )
    mailer.send(msg)

    return "Monthly report sent"


@celery.task(name="workers.tasks.export_user_csv")
def export_user_csv(requesting_user_id):
    from models.tables import TrekBooking, TrekRoute

    rows = TrekBooking.query.filter_by(user_id=requesting_user_id).all()

    export_dir = os.path.join(os.getcwd(), "exports")
    os.makedirs(export_dir, exist_ok=True)
    output_path = os.path.join(export_dir, f"bookings_{requesting_user_id}.csv")

    with open(output_path, "w", newline="") as fout:
        writer = csv.writer(fout)
        writer.writerow(["Booking ID", "Trek Name", "Date", "Status", "Booked At"])
        for row in rows:
            trek = TrekRoute.query.get(row.trek_id)
            writer.writerow([
                row.booking_id,
                trek.trek_name if trek else "Unknown",
                trek.start_date if trek else "N/A",
                row.booking_status,
                row.booked_on.strftime("%Y-%m-%d %H:%M")
            ])

    return output_path