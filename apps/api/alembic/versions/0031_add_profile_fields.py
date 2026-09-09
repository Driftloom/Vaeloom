"""add profile fields

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0031'
down_revision: Union[str, None] = '0030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS headline VARCHAR(255);"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSON DEFAULT '{}';"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);"))


def downgrade() -> None:
    try:
        op.drop_column('users', 'job_title')
        op.drop_column('users', 'social_links')
        op.drop_column('users', 'phone')
        op.drop_column('users', 'location')
        op.drop_column('users', 'headline')
        op.drop_column('users', 'bio')
    except Exception as e:
        print(f"Error downgrading: {e}")
        raise e
