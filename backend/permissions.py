from __future__ import annotations

import sqlite3
from typing import Any, Literal

GLOBAL_ROLE_VALUES = ("LZ_ADMIN", "LZ_CRC", "LZ_CRF_ADMIN", "LZ_DATA_MANAGER", "LZ_AUDITOR")
STUDY_ROLE_VALUES = ("STUDY_PI", "STUDY_CRC", "STUDY_CONFIG_ADMIN", "STUDY_DATA_MANAGER")
ROLE_VALUES = (*GLOBAL_ROLE_VALUES, *STUDY_ROLE_VALUES)

LEGACY_ROLE_VALUES = ("sys_admin", "project_admin", "investigator", "crc", "data_manager", "viewer")
LEGACY_ROLE_MAP = {
    "sys_admin": "LZ_ADMIN",
    "project_admin": "STUDY_CONFIG_ADMIN",
    "investigator": "STUDY_PI",
    "crc": "STUDY_CRC",
    "data_manager": "STUDY_DATA_MANAGER",
    "viewer": "STUDY_PI",
}

StudyScopeType = Literal["all_studies", "assigned_studies", "own_studies"]


def normalize_role_code(role: str | None) -> str:
    if not role:
        return "STUDY_PI"
    return LEGACY_ROLE_MAP.get(role, role)


def user_role(user: dict[str, Any]) -> str:
    return normalize_role_code(str(user.get("role") or user.get("role_code") or ""))


ROLE_ACTIONS: dict[str, set[tuple[str, str]]] = {
    "LZ_CRC": {
        ("studies", "read"),
        ("patients", "read"),
        ("patients", "write"),
        ("consents", "read"),
        ("consents", "write"),
        ("crf", "read"),
        ("visits", "read"),
        ("follow_up_records", "read"),
        ("follow_up_records", "write"),
        ("crf", "write"),
        ("samples", "read"),
        ("samples", "write"),
        ("omics", "read"),
        ("omics", "write"),
        ("files", "read"),
        ("files", "write"),
        ("quality", "read"),
        ("quality", "write"),
    },
    "LZ_CRF_ADMIN": {
        ("studies", "read"),
        ("crf", "read"),
        ("visits", "read"),
        ("crf_config", "read"),
        ("crf_config", "write"),
        ("visits", "read"),
        ("visits", "write"),
    },
    "LZ_DATA_MANAGER": {
        ("studies", "read"),
        ("patients", "read"),
        ("consents", "read"),
        ("crf", "read"),
        ("visits", "read"),
        ("follow_up_records", "read"),
        ("samples", "read"),
        ("omics", "read"),
        ("files", "read"),
        ("exports", "read"),
        ("exports", "write"),
        ("quality", "read"),
        ("quality", "write"),
        ("audit", "read"),
    },
    "LZ_AUDITOR": {
        ("studies", "read"),
        ("patients", "read"),
        ("consents", "read"),
        ("crf", "read"),
        ("visits", "read"),
        ("follow_up_records", "read"),
        ("samples", "read"),
        ("omics", "read"),
        ("files", "read"),
        ("exports", "read"),
        ("quality", "read"),
        ("audit", "read"),
    },
    "STUDY_PI": {
        ("studies", "read"),
        ("patients", "read"),
        ("consents", "read"),
        ("crf", "read"),
        ("visits", "read"),
        ("follow_up_records", "read"),
        ("samples", "read"),
        ("omics", "read"),
        ("files", "read"),
        ("exports", "read"),
        ("quality", "read"),
    },
    "STUDY_CRC": {
        ("studies", "read"),
        ("patients", "read"),
        ("patients", "write"),
        ("consents", "read"),
        ("consents", "write"),
        ("crf", "read"),
        ("crf", "write"),
        ("follow_up_records", "read"),
        ("follow_up_records", "write"),
        ("samples", "read"),
        ("samples", "write"),
        ("omics", "read"),
        ("omics", "write"),
        ("files", "read"),
        ("files", "write"),
        ("visits", "read"),
    },
    "STUDY_CONFIG_ADMIN": {
        ("studies", "read"),
        ("studies", "write"),
        ("study_members", "read"),
        ("study_members", "write"),
        ("crf", "read"),
        ("crf_config", "read"),
        ("crf_config", "write"),
        ("visits", "read"),
        ("visits", "write"),
        ("audit", "read"),
    },
    "STUDY_DATA_MANAGER": {
        ("studies", "read"),
        ("patients", "read"),
        ("consents", "read"),
        ("crf", "read"),
        ("visits", "read"),
        ("follow_up_records", "read"),
        ("samples", "read"),
        ("omics", "read"),
        ("files", "read"),
        ("exports", "read"),
        ("exports", "write"),
        ("quality", "read"),
        ("quality", "write"),
        ("audit", "read"),
    },
}


def role_can(role: str, resource: str, action: str) -> bool:
    role = normalize_role_code(role)
    if role == "LZ_ADMIN":
        return True
    if (resource, action) in ROLE_ACTIONS.get(role, set()):
        return True
    if action == "read" and (resource, "read") in ROLE_ACTIONS.get(role, set()):
        return True
    return False


def get_user_study_scope(conn: sqlite3.Connection, user: dict[str, Any]) -> dict[str, Any]:
    role = user_role(user)
    if role == "LZ_ADMIN":
        return {"scopeType": "all_studies"}

    assigned_rows = conn.execute(
        "SELECT study_id FROM global_role_study_scope WHERE user_id = ? ORDER BY study_id",
        (user["id"],),
    ).fetchall()
    if role in GLOBAL_ROLE_VALUES:
        return {"scopeType": "assigned_studies", "studyIds": [row["study_id"] for row in assigned_rows]}

    member_rows = conn.execute(
        "SELECT study_id FROM study_members WHERE user_id = ? AND status = 'active' ORDER BY study_id",
        (user["id"],),
    ).fetchall()
    return {"scopeType": "own_studies", "studyIds": [row["study_id"] for row in member_rows]}


def accessible_study_ids(conn: sqlite3.Connection, user: dict[str, Any]) -> list[str] | None:
    scope = get_user_study_scope(conn, user)
    if scope["scopeType"] == "all_studies":
        return None
    return list(scope.get("studyIds") or [])


def can_access_study(conn: sqlite3.Connection, user: dict[str, Any], study_id: str) -> bool:
    role = user_role(user)
    if role == "LZ_ADMIN":
        return True
    return study_id in (accessible_study_ids(conn, user) or [])


def user_study_role(conn: sqlite3.Connection, user_id: str, study_id: str) -> str | None:
    row = conn.execute(
        """
        SELECT study_role
        FROM study_members
        WHERE user_id = ? AND study_id = ? AND status = 'active'
        """,
        (user_id, study_id),
    ).fetchone()
    return row["study_role"] if row else None


def first_accessible_study_id(conn: sqlite3.Connection, user: dict[str, Any]) -> str | None:
    ids = accessible_study_ids(conn, user)
    if ids is None:
        row = conn.execute("SELECT id FROM studies ORDER BY id LIMIT 1").fetchone()
        return row["id"] if row else None
    return ids[0] if ids else None
