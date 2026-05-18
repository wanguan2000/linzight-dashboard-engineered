from __future__ import annotations

try:
    from .database import connect, initialize_schema
    from .provisioning import ensure_initial_admin
except ImportError:  # Allows `cd backend && python bootstrap.py`.
    from database import connect, initialize_schema
    from provisioning import ensure_initial_admin


def main() -> None:
    initialize_schema()
    with connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()
    if not row or row["count"] == 0:
        ensure_initial_admin()


if __name__ == "__main__":
    main()
