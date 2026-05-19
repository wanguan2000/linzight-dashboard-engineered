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
        ("patients", "read"),
        ("patients", "write"),
        ("consents", "read"),
        ("consents", "write"),
        ("crf", "read"),
        ("crf", "write"),
        ("crf_config", "read"),
        ("crf_config", "write"),
        ("follow_up_records", "read"),
        ("follow_up_records", "write"),
        ("samples", "read"),
        ("samples", "write"),
        ("omics", "read"),
        ("omics", "write"),
        ("files", "read"),
        ("files", "write"),
        ("exports", "read"),
        ("exports", "write"),
        ("quality", "read"),
        ("quality", "write"),
        ("visits", "read"),
        ("visits", "write"),
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
    },
}

PERMISSION_MATRIX: list[dict[str, Any]] = [
    {
        "module": "Study Configuration",
        "operation": "Read Study configuration",
        "resource": "studies",
        "action": "read",
        "endpoints": ["GET /studies", "GET /study-configurations", "GET /studies/{study_id}/configuration"],
    },
    {
        "module": "LZ System Management",
        "operation": "Create, update, terminate, or delete Studies",
        "resource": "study_lifecycle",
        "action": "write",
        "endpoints": ["POST /studies", "PATCH /studies/{study_id}", "DELETE /studies/{study_id}"],
    },
    {
        "module": "Account and Study Members",
        "operation": "Create or update users and Study members",
        "resource": "study_members",
        "action": "write",
        "endpoints": ["GET /users", "POST /users", "PATCH /users/{user_id}", "PATCH /users/{user_id}/study-scope", "GET /studies/{study_id}/members", "POST /studies/{study_id}/members"],
    },
    {
        "module": "Patient Cohort",
        "operation": "Read patient records",
        "resource": "patients",
        "action": "read",
        "endpoints": ["GET /patients", "GET /patients/{patient_id}", "GET /patients/{patient_id}/panorama"],
    },
    {
        "module": "Patient Cohort",
        "operation": "Create or update patient records",
        "resource": "patients",
        "action": "write",
        "endpoints": ["POST /patients", "PUT /patients/{patient_id}", "DELETE /patients/{patient_id}"],
    },
    {
        "module": "Clinical Data Capture",
        "operation": "Read CRF and visits",
        "resource": "crf",
        "action": "read",
        "endpoints": ["GET /crf", "GET /visits", "GET /patients/{patient_id}/journey"],
    },
    {
        "module": "Clinical Data Capture",
        "operation": "Write CRF entries",
        "resource": "crf",
        "action": "write",
        "endpoints": ["POST /crf", "PUT /crf/{entry_id}"],
    },
    {
        "module": "Clinical Data Capture",
        "operation": "Write follow-up records",
        "resource": "follow_up_records",
        "action": "write",
        "endpoints": ["POST /follow-up-records", "PUT /follow-up-records/{record_id}"],
    },
    {
        "module": "System Management",
        "operation": "Configure CRF versions, fields, visit plans, and sites",
        "resource": "crf_config",
        "action": "write",
        "endpoints": [
            "POST /studies/{study_id}/visit-plans",
            "PUT /studies/{study_id}/visit-plans/{plan_id}",
            "POST /studies/{study_id}/crf-versions",
            "PUT /studies/{study_id}/crf-versions/{version_id}",
            "POST /studies/{study_id}/crf-fields",
            "PUT /studies/{study_id}/crf-fields/{field_id}",
            "POST /studies/{study_id}/crf-migrations",
            "POST /studies/{study_id}/crf-migrations/{migration_id}/approve",
            "POST /studies/{study_id}/crf-migrations/{migration_id}/apply",
            "POST /studies/{study_id}/sites",
            "POST /studies/{study_id}/sites/{site_id}/users",
        ],
    },
    {
        "module": "Informed Consent",
        "operation": "Read consent records",
        "resource": "consents",
        "action": "read",
        "endpoints": ["GET /consents"],
    },
    {
        "module": "Informed Consent",
        "operation": "Update consent records and request withdrawal or re-sign",
        "resource": "consents",
        "action": "write",
        "endpoints": ["PUT /consents/{consent_id}", "POST /consents/{consent_id}/withdrawal-request", "POST /consents/{consent_id}/resign-request"],
    },
    {
        "module": "Samples and Testing",
        "operation": "Write samples",
        "resource": "samples",
        "action": "write",
        "endpoints": ["POST /samples", "PUT /samples/{sample_id}"],
    },
    {
        "module": "Samples and Testing",
        "operation": "Write omics records",
        "resource": "omics",
        "action": "write",
        "endpoints": ["POST /omics", "PUT /omics/{omics_id}"],
    },
    {
        "module": "Files",
        "operation": "Upload, download, and archive files",
        "resource": "files",
        "action": "write",
        "endpoints": ["POST /files", "GET /files/{file_id}/download", "POST /files/{file_id}/archive"],
    },
    {
        "module": "Data Management",
        "operation": "Run quality checks and create Query",
        "resource": "quality",
        "action": "write",
        "endpoints": ["POST /quality/run", "POST /queries"],
    },
    {
        "module": "Data Management",
        "operation": "Export and download data",
        "resource": "exports",
        "action": "write",
        "endpoints": ["POST /exports", "GET /exports/{export_id}/download"],
    },
    {
        "module": "Approval Center",
        "operation": "Create, approve, reject, cancel, and complete approvals",
        "resource": "exports",
        "action": "write",
        "endpoints": ["POST /approvals", "POST /approvals/{approval_id}/approve", "POST /approvals/{approval_id}/reject", "POST /approvals/{approval_id}/cancel", "POST /approvals/{approval_id}/complete"],
    },
]


def permission_matrix() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in PERMISSION_MATRIX:
        rows.append(
            {
                **row,
                "allowed_roles": [role for role in ROLE_VALUES if role_can(role, row["resource"], row["action"])],
            }
        )
    return rows


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
