from model import User
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import os
from extensions import db



def create_app():
    app = Flask(__name__)

    @app.route("/")
    def home():
        return "Flask + SQLAlchemy Working"

    database_url = os.getenv("DATABASE_URL")

    if database_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = database_url
        app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
        db.init_app(app)

    return app