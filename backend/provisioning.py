from __future__ import annotations

import os

try:
    from .database import connect, utc_now
    from .security import hash_password
except ImportError:  # Allows `cd backend && python provisioning.py`.
    from database import connect, utc_now
    from security import hash_password


INITIAL_ADMIN_ID = "USR-LZ-ADMIN-001"
INITIAL_ADMIN_EMAIL = os.getenv("LINZIGHT_INITIAL_ADMIN_EMAIL", "guan.wang@linzight.com")
INITIAL_ADMIN_PASSWORD = os.getenv("LINZIGHT_INITIAL_ADMIN_PASSWORD", "ChangeMe1234!")


def ensure_initial_admin() -> dict[str, str]:
    now = utc_now()
    with connect() as conn:
        existing_admin = conn.execute("SELECT id FROM users WHERE role_code = 'LZ_ADMIN' LIMIT 1").fetchone()
        if existing_admin:
            return {"status": "exists", "user_id": existing_admin["id"]}

        conn.execute(
            """
            INSERT INTO users (id, username, display_name, role, role_code, password_hash, status, created_at, updated_at)
            VALUES (?, ?, ?, 'sys_admin', 'LZ_ADMIN', ?, 'active', ?, ?)
            """,
            (
                INITIAL_ADMIN_ID,
                INITIAL_ADMIN_EMAIL,
                "LZ 系统管理员",
                hash_password(INITIAL_ADMIN_PASSWORD),
                now,
                now,
            ),
        )
        return {"status": "created", "user_id": INITIAL_ADMIN_ID}
