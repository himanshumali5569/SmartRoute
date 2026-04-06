"""add location columns and bus table

Revision ID: 0d9b8d8f4f40
Revises: 7e47c9445bfd
Create Date: 2026-03-30 18:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0d9b8d8f4f40"
down_revision = "7e47c9445bfd"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user_mark", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("user_mark", sa.Column("longitude", sa.Float(), nullable=True))
    op.create_table(
        "bus_location",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("today_date", sa.Date(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["user.uid"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("bus_location")
    op.drop_column("user_mark", "longitude")
    op.drop_column("user_mark", "latitude")
