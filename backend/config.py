import os

base_dir = os.path.abspath(os.path.dirname(__file__))

class AppConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "trek$ecret!9271"
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(base_dir, "trekking.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    REDIS_URL = os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL

    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300

    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME") or "youremail@gmail.com"
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD") or "yourpassword"
    MAIL_DEFAULT_SENDER = MAIL_USERNAME

    ADMIN_EMAIL = "admin@trekking.com"
    ADMIN_PASSWORD = "Admin@1234"
    ADMIN_NAME = "Super Admin"

    JWT_SECRET = os.environ.get("JWT_SECRET") or "jwt_trek_9271_key"
    JWT_EXPIRY_HOURS = 24