from __future__ import annotations

try:
    from .database import connect, initialize_schema
    from .seed import seed_database
except ImportError:  # Allows `cd backend && python bootstrap.py`.
    from database import connect, initialize_schema
    from seed import seed_database


def main() -> None:
    initialize_schema()
    with connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS count FROM patients").fetchone()
    if not row or row["count"] == 0:
        seed_database()


if __name__ == "__main__":
    main()
