"""add student profile table

Revision ID: 8b291e8d4c11
Revises: 0d9b8d8f4f40
Create Date: 2026-03-30 20:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b291e8d4c11"
down_revision = "0d9b8d8f4f40"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "student_profile",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("mobile_number", sa.String(length=20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("enrollment_number", sa.String(length=50), nullable=True),
        sa.Column("parent_name", sa.String(length=120), nullable=True),
        sa.Column("parent_mobile_number", sa.String(length=20), nullable=True),
        sa.Column("study_year", sa.String(length=30), nullable=True),
        sa.Column("branch", sa.String(length=80), nullable=True),
        sa.Column("program", sa.String(length=80), nullable=True),
        sa.Column("specialization", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.uid"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade():
    op.drop_table("student_profile")
