import os

from flask import Flask
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text

db=SQLAlchemy()


def ensure_schema_updates(app):
    with app.app_context():
        inspector = inspect(db.engine)
        table_names = set(inspector.get_table_names())
        dialect = db.engine.dialect.name

        if "user_mark" in table_names:
            existing_columns = {
                column["name"] for column in inspector.get_columns("user_mark")
            }
            float_sql_type = "DOUBLE PRECISION" if dialect == "postgresql" else "FLOAT"
            datetime_sql_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
            if "latitude" not in existing_columns:
                db.session.execute(text(f"ALTER TABLE user_mark ADD COLUMN latitude {float_sql_type}"))
            if "longitude" not in existing_columns:
                db.session.execute(text(f"ALTER TABLE user_mark ADD COLUMN longitude {float_sql_type}"))
            if "attendance_marked_at" not in existing_columns:
                db.session.execute(
                    text(f"ALTER TABLE user_mark ADD COLUMN attendance_marked_at {datetime_sql_type}")
                )
            if "attendance_source" not in existing_columns:
                db.session.execute(text("ALTER TABLE user_mark ADD COLUMN attendance_source VARCHAR(30)"))
            db.session.commit()

def create_app():
    app = Flask(__name__, template_folder='templates')
    os.makedirs(app.instance_path, exist_ok=True)

    default_sqlite_path = os.path.join(app.instance_path, "testdb.db")
    database_url = os.getenv("DATABASE_URL", f"sqlite:///{default_sqlite_path}")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.secret_key = os.getenv("SECRET_KEY", "Some Key")
    
    db.init_app(app)
    
    login_manager=LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = "login"

    from model import User

    @login_manager.user_loader
    def user_loader(uid):
        return User.query.get(uid)
    
    from routes import in_routes
    
    in_routes(app,db)

    migrate=Migrate(app,db)

    with app.app_context():
        db.create_all()
    ensure_schema_updates(app)

    return app
