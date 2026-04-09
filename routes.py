from datetime import date, datetime, timedelta

from flask import jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from model import Availability, BusLocation, BusStop, StudentProfile, User


def _role_required(expected_role):
    if current_user.role != expected_role:
        return jsonify({"message": "Access denied"}), 403
    return None


def _qr_serializer(app):
    return URLSafeTimedSerializer(app.secret_key, salt="driver-live-qr")


def _build_qr_payload(app, driver_id):
    serializer = _qr_serializer(app)
    token = serializer.dumps(
        {
            "driver_id": driver_id,
            "date": date.today().isoformat(),
        }
    )
    return {
        "token": token,
        "expires_in": 60,
        "scan_url": url_for("claim_qr_attendance", token=token, _external=True),
    }


def _validate_qr_token(app, token, max_age=60):
    serializer = _qr_serializer(app)
    payload = serializer.loads(token, max_age=max_age)
    if payload.get("date") != date.today().isoformat():
        raise SignatureExpired("QR code is not valid for today.")
    return payload


def in_routes(app, db):
    @app.route("/")
    def index2():
        return render_template("index.html")

    @app.route("/about")
    def about():
        return render_template("about.html")

    @app.route("/dashboard")
    @login_required
    def dashboard():
        return render_template("dashboard.html")

    @app.route("/driver_dashboard")
    @login_required
    def driver():
        denied = _role_required("driver")
        if denied:
            return denied
        return render_template("drive.html", today=date.today())

    @app.route("/time_table")
    @login_required
    def schedule():
        denied = _role_required("student")
        if denied:
            return denied
        return render_template(
            "schedule.html",
            today=date.today(),
        )

    @app.route("/attendance-history")
    @login_required
    def attendance_history():
        denied = _role_required("student")
        if denied:
            return denied

        records = (
            Availability.query.filter_by(user_id=current_user.uid)
            .order_by(Availability.today_date.desc())
            .all()
        )
        return render_template("attendance_history.html", records=records)

    @app.route("/student-profile", methods=["GET", "POST"])
    @login_required
    def student_profile():
        denied = _role_required("student")
        if denied:
            return denied

        profile = StudentProfile.query.filter_by(user_id=current_user.uid).first()

        if request.method == "POST":
            if not profile:
                profile = StudentProfile(user_id=current_user.uid)
                db.session.add(profile)

            profile.full_name = request.form.get("full_name", "").strip()
            profile.mobile_number = request.form.get("mobile_number", "").strip()
            profile.address = request.form.get("address", "").strip()
            profile.enrollment_number = request.form.get("enrollment_number", "").strip()
            profile.parent_name = request.form.get("parent_name", "").strip()
            profile.parent_mobile_number = request.form.get("parent_mobile_number", "").strip()
            profile.study_year = request.form.get("study_year", "").strip()
            profile.branch = request.form.get("branch", "").strip()
            profile.program = request.form.get("program", "").strip()
            profile.specialization = request.form.get("specialization", "").strip()

            db.session.commit()
            return render_template(
                "student_profile.html",
                profile=profile,
                success="Profile details saved successfully.",
            )

        return render_template("student_profile.html", profile=profile)

    @app.route("/map")
    @login_required
    def map_page():
        if current_user.role == "driver":
            return redirect(url_for("driver"))
        return redirect(url_for("schedule"))

    @app.route("/signup", methods=["GET", "POST"])
    def sign():
        if request.method == "GET":
            return render_template("signup.html")

        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        role = request.form.get("role", "student").strip() or "student"

        if not username or not password:
            return render_template(
                "signup.html",
                error="Username and password are required.",
            ), 400

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return render_template(
                "signup.html",
                error="Username already exists.",
            ), 400

        user = User(
            username=username,
            password=generate_password_hash(password),
            role=role,
        )
        db.session.add(user)
        db.session.commit()
        return redirect(url_for("login"))

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if current_user.is_authenticated:
            if current_user.role == "driver":
                return redirect(url_for("driver"))
            return redirect(url_for("schedule"))

        if request.method == "GET":
            return render_template("login.html")

        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        selected_role = request.form.get("role", "").strip()

        user = User.query.filter_by(username=username).first()
        if not user:
            return render_template(
                "login.html",
                error="Invalid username or password.",
            ), 401

        password_matches = False
        stored_password = user.password or ""

        if stored_password.startswith(("pbkdf2:", "scrypt:")):
            password_matches = check_password_hash(stored_password, password)
        else:
            password_matches = stored_password == password
            if password_matches:
                user.password = generate_password_hash(password)
                db.session.commit()

        if not password_matches:
            return render_template(
                "login.html",
                error="Invalid username or password.",
            ), 401

        if user.role != selected_role:
            return render_template(
                "login.html",
                error="Selected role does not match this account.",
            ), 403

        login_user(user)

        if user.role == "driver":
            return redirect(url_for("driver"))
        return redirect(url_for("schedule"))

    @app.route("/logout")
    @login_required
    def logout():
        logout_user()
        return redirect(url_for("index2"))

    @app.route("/available", methods=["POST"])
    @login_required
    def mark_attendance():
        denied = _role_required("student")
        if denied:
            return denied

        data = request.get_json(silent=True) or {}
        use_bus = (data.get("use_bus") or "").strip().upper()

        if use_bus not in {"YES", "NO"}:
            return jsonify({"message": "Choose YES or NO."}), 400

        today = date.today()
        existing = Availability.query.filter_by(
            user_id=current_user.uid,
            today_date=today,
        ).first()

        if not existing:
            existing = Availability(
                user_id=current_user.uid,
                today_date=today,
            )
            db.session.add(existing)

        existing.use_bus = use_bus
        if use_bus == "NO":
            existing.latitude = None
            existing.longitude = None
            existing.attendance_marked_at = None
            existing.attendance_source = None

        db.session.commit()
        return jsonify({"message": f"Today's bus status saved as {use_bus}."})

    @app.route("/student/today")
    @login_required
    def student_today():
        denied = _role_required("student")
        if denied:
            return denied

        today = date.today()
        record = Availability.query.filter_by(
            user_id=current_user.uid,
            today_date=today,
        ).first()

        if not record:
            return jsonify({})

        return jsonify(
            {
                "use_bus": record.use_bus,
                "lat": record.latitude,
                "lng": record.longitude,
                "attendance_marked_at": record.attendance_marked_at.isoformat() if record.attendance_marked_at else None,
                "attendance_source": record.attendance_source,
            }
        )

    @app.route("/driver/qr/live")
    @login_required
    def driver_live_qr():
        denied = _role_required("driver")
        if denied:
            return denied

        return jsonify(_build_qr_payload(app, current_user.uid))

    @app.route("/student/attendance/scan", methods=["POST"])
    @login_required
    def student_scan_qr():
        denied = _role_required("student")
        if denied:
            return denied

        data = request.get_json(silent=True) or {}
        token = (data.get("token") or "").strip()
        if not token:
            return jsonify({"message": "QR token is missing."}), 400

        try:
            payload = _validate_qr_token(app, token)
        except SignatureExpired:
            return jsonify({"message": "This QR code expired. Ask the driver to refresh it."}), 400
        except BadSignature:
            return jsonify({"message": "Invalid QR code."}), 400

        today = date.today()
        existing = Availability.query.filter_by(
            user_id=current_user.uid,
            today_date=today,
        ).first()

        if not existing:
            existing = Availability(
                user_id=current_user.uid,
                today_date=today,
                use_bus="YES",
            )
            db.session.add(existing)

        existing.use_bus = "YES"
        existing.attendance_marked_at = datetime.utcnow()
        existing.attendance_source = f"QR from driver {payload.get('driver_id')}"
        db.session.commit()

        return jsonify(
            {
                "message": "Attendance marked successfully from the live driver QR code.",
                "attendance_marked_at": existing.attendance_marked_at.isoformat(),
            }
        )

    @app.route("/student/attendance/claim")
    @login_required
    def claim_qr_attendance():
        denied = _role_required("student")
        if denied:
            return denied

        records = (
            Availability.query.filter_by(user_id=current_user.uid)
            .order_by(Availability.today_date.desc())
            .all()
        )
        token = request.args.get("token", "").strip()
        if not token:
            return render_template(
                "attendance_history.html",
                records=records,
                claim_error="QR token is missing.",
            ), 400

        try:
            payload = _validate_qr_token(app, token)
        except SignatureExpired:
            return render_template(
                "attendance_history.html",
                records=records,
                claim_error="This QR code expired. Ask the driver to show the latest one.",
            ), 400
        except BadSignature:
            return render_template(
                "attendance_history.html",
                records=records,
                claim_error="Invalid QR code.",
            ), 400

        today = date.today()
        existing = Availability.query.filter_by(
            user_id=current_user.uid,
            today_date=today,
        ).first()

        if not existing:
            existing = Availability(
                user_id=current_user.uid,
                today_date=today,
                use_bus="YES",
            )
            db.session.add(existing)

        existing.use_bus = "YES"
        existing.attendance_marked_at = datetime.utcnow()
        existing.attendance_source = f"QR from driver {payload.get('driver_id')}"
        db.session.commit()

        return redirect(url_for("attendance_history"))

    @app.route("/driver/today", methods=["GET"])
    @login_required
    def driver_today():
        denied = _role_required("driver")
        if denied:
            return denied

        today = date.today()
        records = (
            db.session.query(
                User.username,
                Availability.use_bus,
                Availability.latitude,
                Availability.longitude,
                Availability.attendance_marked_at,
            )
            .join(Availability, Availability.user_id == User.uid)
            .filter(Availability.today_date == today)
            .order_by(User.username.asc())
            .all()
        )

        result = [
            {
                "username": username,
                "status": status,
                "lat": lat,
                "lng": lng,
                "attendance_marked_at": attendance_marked_at.isoformat() if attendance_marked_at else None,
            }
            for username, status, lat, lng, attendance_marked_at in records
        ]
        return jsonify(result)

    @app.route("/bus/stops")
    def get_bus_stops():
        stops = BusStop.query.all()
        result = [
            {
                "name": stop.name,
                "lat": stop.latitude,
                "lng": stop.longitude,
            }
            for stop in stops
        ]
        return jsonify(result)

    @app.route("/driver/stops")
    @login_required
    def driver_stops():
        denied = _role_required("driver")
        if denied:
            return denied

        today = date.today()
        records = (
            db.session.query(
                User.username,
                Availability.latitude,
                Availability.longitude,
            )
            .join(Availability, Availability.user_id == User.uid)
            .filter(
                Availability.today_date == today,
                Availability.use_bus == "YES",
                Availability.latitude.isnot(None),
                Availability.longitude.isnot(None),
            )
            .order_by(User.username.asc())
            .all()
        )

        result = [
            {
                "name": username,
                "lat": lat,
                "lng": lng,
            }
            for username, lat, lng in records
        ]
        return jsonify(result)

    @app.route("/student/stop")
    @login_required
    def get_student_stop():
        denied = _role_required("student")
        if denied:
            return denied

        today = date.today()
        record = Availability.query.filter_by(
            user_id=current_user.uid,
            today_date=today,
        ).first()

        if not record or record.latitude is None or record.longitude is None:
            return jsonify({})

        return jsonify({"lat": record.latitude, "lng": record.longitude})

    @app.route("/save_stop", methods=["POST"])
    @login_required
    def save_stop():
        denied = _role_required("student")
        if denied:
            return denied

        data = request.get_json(silent=True) or {}
        lat = data.get("lat")
        lng = data.get("lng")

        if lat is None or lng is None:
            return jsonify({"message": "Choose a stop on the map first."}), 400

        today = date.today()
        existing = Availability.query.filter_by(
            user_id=current_user.uid,
            today_date=today,
        ).first()

        if not existing:
            existing = Availability(
                user_id=current_user.uid,
                today_date=today,
                use_bus="YES",
            )
            db.session.add(existing)

        existing.latitude = lat
        existing.longitude = lng
        existing.use_bus = "YES"

        db.session.commit()
        return jsonify({"message": "Stop saved successfully."})

    @app.route("/bus/location", methods=["POST"])
    @login_required
    def save_bus_location():
        denied = _role_required("driver")
        if denied:
            return denied

        data = request.get_json(silent=True) or {}
        lat = data.get("lat")
        lng = data.get("lng")

        if lat is None or lng is None:
            return jsonify({"message": "Latitude and longitude are required."}), 400

        bus_location = BusLocation(
            driver_id=current_user.uid,
            latitude=lat,
            longitude=lng,
            today_date=date.today(),
        )
        db.session.add(bus_location)
        db.session.commit()

        return jsonify({"message": "Bus location updated."})

    @app.route("/bus/location/reset", methods=["POST"])
    @login_required
    def reset_bus_location():
        denied = _role_required("driver")
        if denied:
            return denied

        BusLocation.query.filter_by(
            driver_id=current_user.uid,
            today_date=date.today(),
        ).delete()
        db.session.commit()

        return jsonify({"message": "Previous live bus location cleared."})

    @app.route("/bus/latest")
    @login_required
    def bus_latest():
        today = date.today()
        latest = (
            BusLocation.query.filter_by(today_date=today)
            .order_by(BusLocation.recorded_at.desc())
            .first()
        )

        if not latest:
            return jsonify({})

        # Do not show stale coordinates from an older sharing session.
        if latest.recorded_at < datetime.utcnow() - timedelta(minutes=5):
            return jsonify({})

        driver_name = None
        if latest.driver_id:
            driver = User.query.get(latest.driver_id)
            driver_name = driver.username if driver else None

        return jsonify(
            {
                "lat": latest.latitude,
                "lng": latest.longitude,
                "driver": driver_name,
                "updated_at": latest.recorded_at.isoformat(),
            }
        )
