# SmartRoute

SmartRoute is a college bus management application designed to reduce unnecessary bus stops, save travel time, and improve attendance tracking. Instead of forcing buses to follow fixed stops every day, the system allows students to mark their daily bus availability in the morning so the driver can know which stops to serve and which to skip.

## Problem Statement

College buses usually follow fixed routes and stop at every designated bus stop, even when students are not present. Due to traffic delays, students may miss the bus or may not be using the bus on certain days. However, the bus driver has no prior information about student availability, which results in unnecessary waiting, time loss, and inefficient transportation management.

There is currently no system that allows students to inform in advance whether they will use the college bus on a particular day, nor is there an integrated attendance mechanism. To address this issue, a mobile application is proposed in which students will mark their daily availability in the morning. Based on this information, the application will guide the bus driver on where to stop and where to skip.

Additionally, the system will include a QR-code-based attendance feature, where students scan a QR code provided by the bus driver to mark attendance, which is automatically shared with college authorities. This solution aims to reduce delays, optimize bus routes, and improve attendance management efficiency.

## Features

- Student and driver login flows
- Daily student bus availability marking
- Driver-facing view for active riders and route decisions
- Student profile management
- Attendance history tracking
- Bus location and stop data support
- Database support for SQLite in development and PostgreSQL in deployment

## Tech Stack

- Python
- Flask
- Flask-Login
- Flask-SQLAlchemy
- Flask-Migrate
- SQLite / PostgreSQL

## Project Structure

- `app.py`: Flask app factory and database setup
- `routes.py`: application routes and business logic
- `model.py`: database models
- `templates/`: HTML templates
- `static/`: CSS and client-side JavaScript
- `migrations/`: database migration files

## Local Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

The app uses a local SQLite database by default. If `DATABASE_URL` is set, it will use that database instead.

## Deployment

This project includes `Procfile`, `runtime.txt`, and `railway.json`, which makes it ready for platforms such as Railway.

## Repository Description

SmartRoute helps college buses avoid unnecessary stops by using daily student availability updates and attendance tracking to optimize routes and improve transport efficiency.
