from app import db
from flask_login import UserMixin
from datetime import date, datetime

class User(db.Model,UserMixin):
    __tablename__='user'
    
    uid=db.Column(db.Integer, primary_key=True)
    username=db.Column(db.String, nullable=False)
    password=db.Column(db.String, nullable=False)
    role=db.Column(db.String, nullable=False, default="student")

    def __repr__(self):
        return f"User:{self.username}"

    def get_id(self):
        return self.uid
    

class Availability(db.Model):
    __tablename__='user_mark'

    id=db.Column(db.Integer, primary_key=True)    
    user_id=db.Column(db.Integer, db.ForeignKey('user.uid'), nullable=False)    
    today_date=db.Column(db.Date, default=date.today)
    use_bus=db.Column(db.String(10), nullable=False)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    attendance_marked_at = db.Column(db.DateTime, nullable=True)
    attendance_source = db.Column(db.String(30), nullable=True)


class BusStop(db.Model):
    __tablename__='user_map'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)    


class BusLocation(db.Model):
    __tablename__ = "bus_location"

    id = db.Column(db.Integer, primary_key=True)
    driver_id = db.Column(db.Integer, db.ForeignKey("user.uid"), nullable=False)
    today_date = db.Column(db.Date, default=date.today, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class StudentProfile(db.Model):
    __tablename__ = "student_profile"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.uid"), nullable=False, unique=True)
    full_name = db.Column(db.String(120), nullable=True)
    mobile_number = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    enrollment_number = db.Column(db.String(50), nullable=True)
    parent_name = db.Column(db.String(120), nullable=True)
    parent_mobile_number = db.Column(db.String(20), nullable=True)
    study_year = db.Column(db.String(30), nullable=True)
    branch = db.Column(db.String(80), nullable=True)
    program = db.Column(db.String(80), nullable=True)
    specialization = db.Column(db.String(120), nullable=True)




    

