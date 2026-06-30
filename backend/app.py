from flask import Flask, send_from_directory
from flask_mail import Mail
from flask_caching import Cache
from config import AppConfig
from models.tables import db, AppUser
import os

mail = Mail()
cache = Cache()

def build_app():
    flask_app = Flask(__name__, static_folder="../frontend", static_url_path="")

    flask_app.config.from_object(AppConfig)

    db.init_app(flask_app)
    mail.init_app(flask_app)
    cache.init_app(flask_app)

    from routes.auth_routes import auth_bp
    from routes.admin_routes import admin_bp
    from routes.staff_routes import staff_bp
    from routes.user_routes import user_bp

    flask_app.register_blueprint(auth_bp, url_prefix="/api/auth")
    flask_app.register_blueprint(admin_bp, url_prefix="/api/admin")
    flask_app.register_blueprint(staff_bp, url_prefix="/api/staff")
    flask_app.register_blueprint(user_bp, url_prefix="/api/user")

    with flask_app.app_context():
        db.create_all()
        seed_admin(flask_app)

    @flask_app.route("/", defaults={"path": ""})
    @flask_app.route("/<path:path>")
    def catch_all(path):
        return send_from_directory(flask_app.static_folder, "index.html")

    return flask_app


def seed_admin(flask_app):
    with flask_app.app_context():
        existing = AppUser.query.filter_by(role="admin").first()
        if existing:
            return
        admin_user = AppUser(
            full_name=AppConfig.ADMIN_NAME,
            email_addr=AppConfig.ADMIN_EMAIL,
            role="admin",
            is_active=True
        )
        admin_user.set_password(AppConfig.ADMIN_PASSWORD)
        db.session.add(admin_user)
        db.session.commit()


app = build_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)