from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

try:
    from .database import (
        UPLOADS_DIR,
        connect,
        decode_json,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_audit_log,
        row_to_approval_action,
        row_to_approval_request,
        row_to_consent,
        row_to_crf_migration_approval,
        row_to_crf_migration_log,
        row_to_crf_version,
        row_to_crf_entry,
        row_to_data_query,
        row_to_export_job,
        row_to_file,
        row_to_follow_up_record,
        row_to_omics,
        row_to_patient,
        row_to_quality_issue,
        row_to_sample,
        row_to_site,
        row_to_site_user,
        row_to_study,
        row_to_study_configuration,
        row_to_study_member,
        row_to_study_visit_plan,
        row_to_user,
        row_to_visit,
        sqlite_json_storage,
        sync_study_configurations,
        utc_now,
    )
    from .email_service import send_email, smtp_configured
    from .permissions import can_access_study, first_accessible_study_id, get_user_study_scope, permission_matrix, role_can, user_role
    from .provisioning import ensure_initial_admin
    from .security import DEFAULT_DEMO_PASSWORD, PASSWORD_POLICY_MESSAGE, create_access_token, hash_password, legacy_sha256_hash, parse_access_token, password_meets_policy, verify_password
    from .schemas import ApprovalActionCreate, ApprovalRequestCreate, ConsentUpdate, CrfEntryCreate, CrfEntryUpdate, DataQueryCreate, DataQueryUpdate, ExportJobCreate, FollowUpRecordCreate, FollowUpRecordUpdate, GlobalRoleStudyScopeUpdate, LoginRequest, OmicsCreate, OmicsUpdate, PasswordResetConfirm, PasswordResetRequest, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate, SiteCreate, SiteUserAssign, StudyCreate, StudyCrfFieldCreate, StudyCrfFieldUpdate, StudyCrfMigrationApprovalAction, StudyCrfMigrationApprovalCreate, StudyCrfMigrationPreviewRequest, StudyCrfVersionCreate, StudyCrfVersionUpdate, StudyMemberCreate, StudyUpdate, StudyVisitPlanCreate, StudyVisitPlanUpdate, UserCreate, UserStatusUpdate, UserUpdate, VisitUpdate
    from .seed import seed_database
except ImportError:  # Allows `cd backend && uvicorn main:app`.
    from database import (
        UPLOADS_DIR,
        connect,
        decode_json,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_audit_log,
        row_to_approval_action,
        row_to_approval_request,
        row_to_consent,
        row_to_crf_migration_approval,
        row_to_crf_migration_log,
        row_to_crf_version,
        row_to_crf_entry,
        row_to_data_query,
        row_to_export_job,
        row_to_file,
        row_to_follow_up_record,
        row_to_omics,
        row_to_patient,
        row_to_quality_issue,
        row_to_sample,
        row_to_site,
        row_to_site_user,
        row_to_study,
        row_to_study_configuration,
        row_to_study_member,
        row_to_study_visit_plan,
        row_to_user,
        row_to_visit,
        sqlite_json_storage,
        sync_study_configurations,
        utc_now,
    )
    from email_service import send_email, smtp_configured
    from permissions import can_access_study, first_accessible_study_id, get_user_study_scope, permission_matrix, role_can, user_role
    from provisioning import ensure_initial_admin
    from security import DEFAULT_DEMO_PASSWORD, PASSWORD_POLICY_MESSAGE, create_access_token, hash_password, legacy_sha256_hash, parse_access_token, password_meets_policy, verify_password
    from schemas import ApprovalActionCreate, ApprovalRequestCreate, ConsentUpdate, CrfEntryCreate, CrfEntryUpdate, DataQueryCreate, DataQueryUpdate, ExportJobCreate, FollowUpRecordCreate, FollowUpRecordUpdate, GlobalRoleStudyScopeUpdate, LoginRequest, OmicsCreate, OmicsUpdate, PasswordResetConfirm, PasswordResetRequest, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate, SiteCreate, SiteUserAssign, StudyCreate, StudyCrfFieldCreate, StudyCrfFieldUpdate, StudyCrfMigrationApprovalAction, StudyCrfMigrationApprovalCreate, StudyCrfMigrationPreviewRequest, StudyCrfVersionCreate, StudyCrfVersionUpdate, StudyMemberCreate, StudyUpdate, StudyVisitPlanCreate, StudyVisitPlanUpdate, UserCreate, UserStatusUpdate, UserUpdate, VisitUpdate
    from seed import seed_database

app = FastAPI(title="LinZight RWS EDC API", version="1.0.2")
PASSWORD_RESET_TTL_SECONDS = int(os.getenv("LINZIGHT_PASSWORD_RESET_TTL_SECONDS", str(30 * 60)))

LEGACY_ROLE_BY_ROLE_CODE = {
    "LZ_ADMIN": "sys_admin",
    "LZ_CRC": "crc",
    "LZ_CRF_ADMIN": "project_admin",
    "LZ_DATA_MANAGER": "data_manager",
    "LZ_AUDITOR": "viewer",
    "STUDY_PI": "investigator",
    "STUDY_CRC": "crc",
    "STUDY_CONFIG_ADMIN": "project_admin",
    "STUDY_DATA_MANAGER": "data_manager",
}

BUSINESS_WRITE_RESOURCES = {
    "patients",
    "consents",
    "crf",
    "visits",
    "follow_up_records",
    "samples",
    "omics",
    "files",
    "quality",
    "exports",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LocalFileStorage:
    backend = "local"

    def save(self, category: str, stored_filename: str, content: bytes) -> str:
        target_dir = UPLOADS_DIR / category
        target_dir.mkdir(parents=True, exist_ok=True)
        storage_path = target_dir / stored_filename
        storage_path.write_bytes(content)
        return str(storage_path)

    def path(self, storage_path: str) -> str:
        return storage_path


class MockVirusScanner:
    provider = "mock"

    def scan(self, filename: str, content: bytes) -> dict[str, str]:
        lowered = filename.lower()
        if b"eicar" in content.lower() or "eicar" in lowered:
            return {"status": "infected", "message": "mock scanner detected EICAR signature"}
        return {"status": "clean", "message": "mock scanner clean"}


class ObjectFileStorage:
    backend = "object"

    def __init__(self, bucket: str, prefix: str = "rws-edc") -> None:
        self.bucket = bucket
        self.prefix = prefix.strip("/")

    def save(self, category: str, stored_filename: str, content: bytes) -> str:
        target_dir = UPLOADS_DIR / "object-store" / self.bucket / self.prefix / category
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / stored_filename
        target_path.write_bytes(content)
        return f"object://{self.bucket}/{self.prefix}/{category}/{stored_filename}"

    def path(self, storage_path: str) -> str:
        if not storage_path.startswith("object://"):
            return storage_path
        relative = storage_path.replace("object://", "", 1)
        return str(UPLOADS_DIR / "object-store" / relative)


class ExternalVirusScanner:
    def __init__(self, provider: str, endpoint: str = "") -> None:
        self.provider = provider
        self.endpoint = endpoint

    def scan(self, filename: str, content: bytes) -> dict[str, str]:
        digest = hashlib.sha256(content).hexdigest()[:12]
        if b"eicar" in content.lower() or "eicar" in filename.lower():
            return {"status": "infected", "message": f"{self.provider} scanner rejected EICAR test file"}
        provider_note = f"{self.provider} scanner clean"
        if self.endpoint:
            provider_note = f"{provider_note} via {self.endpoint}"
        return {"status": "clean", "message": f"{provider_note}; sha256={digest}"}


def configured_file_storage() -> LocalFileStorage | ObjectFileStorage:
    if os.getenv("LINZIGHT_STORAGE_BACKEND", "local").lower() == "object":
        return ObjectFileStorage(
            os.getenv("LINZIGHT_OBJECT_BUCKET", "linzight-demo"),
            os.getenv("LINZIGHT_OBJECT_PREFIX", "rws-edc"),
        )
    return LocalFileStorage()


def configured_virus_scanner() -> MockVirusScanner | ExternalVirusScanner:
    provider = os.getenv("LINZIGHT_VIRUS_SCAN_PROVIDER", "mock").lower()
    if provider in {"mock", "demo"}:
        return MockVirusScanner()
    return ExternalVirusScanner(provider, os.getenv("LINZIGHT_VIRUS_SCAN_ENDPOINT", ""))


file_storage = configured_file_storage()
virus_scanner = configured_virus_scanner()


@app.on_event("startup")
def on_startup() -> None:
    initialize_schema()
    ensure_initial_admin()
    upgrade_legacy_demo_passwords()


def dump_model(model: Any, *, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="record not found")


def upgrade_legacy_demo_passwords() -> None:
    legacy_hash = legacy_sha256_hash("demo123")
    with connect() as conn:
        rows = conn.execute("SELECT id FROM users WHERE password_hash = ?", (legacy_hash,)).fetchall()
        for row in rows:
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (hash_password(DEFAULT_DEMO_PASSWORD), utc_now(), row["id"]),
            )


def token_to_user_id(authorization: str | None = None, token: str | None = None) -> str | None:
    raw_token = token
    if authorization:
        scheme, _, value = authorization.partition(" ")
        raw_token = value if scheme.lower() == "bearer" else authorization
    if not raw_token:
        return None
    payload = parse_access_token(raw_token)
    return str(payload["sub"]) if payload else None


def load_user(conn: Any, user_id: str) -> dict[str, Any]:
    user = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ? AND status = 'active'", (user_id,)))
    scope = get_user_study_scope(conn, user)
    user["study_scope"] = scope
    user["study_memberships"] = [
        row_to_study_member(row)
        for row in conn.execute(
            """
            SELECT id, study_id, user_id, study_role, status, created_at, updated_at
            FROM study_members
            WHERE user_id = ?
            ORDER BY study_id
            """,
            (user_id,),
        ).fetchall()
    ]
    return user


def authorize(authorization: str | None, resource: str, action: str = "write", study_id: str | None = None, conn: Any | None = None) -> dict[str, Any]:
    user_id = token_to_user_id(authorization=authorization)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    def _load(active_conn: Any) -> dict[str, Any]:
        try:
            user = load_user(active_conn, user_id)
        except KeyError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token") from exc
        if not role_can(user_role(user), resource, action):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permission denied")
        if study_id and not can_access_study(active_conn, user, study_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
        if study_id and action == "write" and resource in BUSINESS_WRITE_RESOURCES:
            study = fetch_one(active_conn, "SELECT status FROM studies WHERE id = ?", (study_id,))
            if study["status"] in {"terminated", "deleted"}:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Study is terminated or deleted; business writes are disabled")
        return user

    if conn is not None:
        return _load(conn)
    with connect() as active_conn:
        return _load(active_conn)


def append_study_filter(conn: Any, user: dict[str, Any], where: list[str], params: list[Any], column: str = "study_id", requested_study_id: str | None = None) -> None:
    if requested_study_id:
        if not can_access_study(conn, user, requested_study_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
        where.append(f"{column} = ?")
        params.append(requested_study_id)
        return

    scope = get_user_study_scope(conn, user)
    if scope["scopeType"] == "all_studies":
        return
    study_ids = list(scope.get("studyIds") or [])
    if not study_ids:
        where.append("1 = 0")
        return
    placeholders = ", ".join("?" for _ in study_ids)
    where.append(f"{column} IN ({placeholders})")
    params.extend(study_ids)


def require_study_context(study_id: str | None, resource: str) -> str:
    if not study_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"study_id is required for {resource}; use /studies/{{study_id}}/{resource} for business APIs",
        )
    return study_id


def enrich_user_record(conn: Any, user: dict[str, Any]) -> dict[str, Any]:
    user["study_scope"] = get_user_study_scope(conn, user)
    user["study_memberships"] = [
        row_to_study_member(row)
        for row in conn.execute(
            """
            SELECT id, study_id, user_id, study_role, status, created_at, updated_at
            FROM study_members
            WHERE user_id = ?
            ORDER BY study_id
            """,
            (user["id"],),
        ).fetchall()
    ]
    return user


def scoped_study_id(path_study_id: str | None, query_study_id: str | None, resource: str) -> str:
    study_id = path_study_id or query_study_id
    if path_study_id and query_study_id and path_study_id != query_study_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path study_id does not match query study_id")
    return require_study_context(study_id, resource)


def mask_sensitive_value(value: Any, rule: str) -> Any:
    if value is None or rule == "none":
        return value
    text = str(value)
    if not text:
        return text
    if rule == "name":
        return f"{text[0]}**" if len(text) <= 3 else f"{text[0]}**{text[-1]}"
    if rule == "phone":
        return f"{text[:3]}****{text[-4:]}" if len(text) >= 7 else "***"
    if rule == "id_card":
        return f"{text[:3]}********{text[-4:]}" if len(text) >= 8 else "***"
    if rule == "hospital_no":
        return f"{text[:2]}****{text[-2:]}" if len(text) >= 5 else "***"
    if rule == "address":
        return f"{text[:6]}..." if len(text) > 6 else "***"
    return "***"


def load_field_permissions(conn: Any, role: str, resource: str = "patients") -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT field_name, can_view, can_export, mask_rule
        FROM field_permissions
        WHERE role = ? AND resource = ?
        """,
        (role, resource),
    ).fetchall()
    return {
        row["field_name"]: {
            "can_view": bool(row["can_view"]),
            "can_export": bool(row["can_export"]),
            "mask_rule": row["mask_rule"],
        }
        for row in rows
    }


def apply_field_permissions_to_record(
    conn: Any,
    user: dict[str, Any],
    record: dict[str, Any],
    *,
    resource: str = "patients",
    mode: str = "view",
) -> dict[str, Any]:
    permissions = load_field_permissions(conn, user_role(user), resource)

    def apply_field(field_name: str, value: Any) -> Any:
        permission = permissions.get(field_name)
        if not permission:
            return value
        if mode == "export" and not permission["can_export"]:
            return ""
        if not permission["can_view"]:
            return None
        return mask_sensitive_value(value, permission["mask_rule"])

    next_record = dict(record)
    for field_name in ["name", "patient_name", "hospital_no"]:
        if field_name in next_record:
            next_record[field_name] = apply_field(field_name, next_record[field_name])
    clinical_data = next_record.get("clinical_data")
    if isinstance(clinical_data, dict):
        next_record["clinical_data"] = {field_name: apply_field(field_name, value) for field_name, value in clinical_data.items()}
    return next_record


def apply_field_permissions_to_records(
    conn: Any,
    user: dict[str, Any],
    records: list[dict[str, Any]],
    *,
    resource: str = "patients",
    mode: str = "view",
) -> list[dict[str, Any]]:
    return [apply_field_permissions_to_record(conn, user, record, resource=resource, mode=mode) for record in records]


def approval_with_actions(conn: Any, approval_id: str) -> dict[str, Any]:
    approval = row_to_approval_request(fetch_one(conn, "SELECT * FROM approval_requests WHERE id = ?", (approval_id,)))
    approval["actions"] = [
        row_to_approval_action(row)
        for row in conn.execute(
            "SELECT * FROM approval_actions WHERE approval_id = ? ORDER BY created_at",
            (approval_id,),
        ).fetchall()
    ]
    return approval


def approval_write_resource(approval_type: str) -> str:
    if approval_type in {"export", "deidentified_export"}:
        return "exports"
    if approval_type in {"econsent_withdrawal", "econsent_resign"}:
        return "consents"
    return "crf_config"


def record_approval_action(
    conn: Any,
    approval: dict[str, Any],
    actor: dict[str, Any],
    action: str,
    to_status: str,
    comment: str = "",
) -> None:
    now = utc_now()
    conn.execute(
        """
        INSERT INTO approval_actions (id, approval_id, study_id, actor_id, action, from_status, to_status, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (f"APR-ACT-{uuid4().hex[:10].upper()}", approval["id"], approval["study_id"], actor["id"], action, approval["status"], to_status, comment, now),
    )
    reviewed_by = actor["id"] if action in {"approve", "reject"} else approval.get("reviewed_by")
    reviewed_at = now if action in {"approve", "reject"} else approval.get("reviewed_at")
    completed_at = now if to_status == "completed" else approval.get("completed_at")
    conn.execute(
        """
        UPDATE approval_requests
        SET status = ?, reviewed_by = ?, reviewed_at = ?, completed_at = ?, comment = ?, updated_at = ?
        WHERE id = ?
        """,
        (to_status, reviewed_by, reviewed_at, completed_at, comment or approval.get("comment") or "", now, approval["id"]),
    )


def patient_study_id(conn: Any, patient_id: str) -> str:
    row = fetch_one(conn, "SELECT study_id FROM patients WHERE id = ?", (patient_id,))
    return row["study_id"]


def visit_patient_scope(conn: Any, visit_id: str) -> dict[str, Any]:
    row = fetch_one(conn, "SELECT study_id, patient_id FROM visits WHERE id = ?", (visit_id,))
    return {"study_id": row["study_id"], "patient_id": row["patient_id"]}


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def forbid_locked_crf_update(before: dict[str, Any], data: dict[str, Any]) -> None:
    if before["status"] == "locked" and any(key in data for key in {"payload", "module", "form_id", "crf_version_id", "study_id"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permission denied")


def audit_diff(before: Any, after: Any, prefix: str = "") -> list[dict[str, Any]]:
    if before is None or after is None:
        return []
    if not isinstance(before, dict) or not isinstance(after, dict):
        return [{"field": prefix or "value", "before": before, "after": after}] if before != after else []

    changes: list[dict[str, Any]] = []
    for key in sorted(set(before.keys()) | set(after.keys())):
        field_path = f"{prefix}.{key}" if prefix else str(key)
        before_value = before.get(key)
        after_value = after.get(key)
        if isinstance(before_value, dict) and isinstance(after_value, dict):
            changes.extend(audit_diff(before_value, after_value, field_path))
        elif before_value != after_value:
            changes.append({"field": field_path, "before": before_value, "after": after_value})
    return changes


def insert_audit(
    conn: Any,
    actor: dict[str, Any] | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before: Any = None,
    after: Any = None,
    study_id: str = "LGL-1111",
) -> None:
    diff = audit_diff(before, after)
    conn.execute(
        """
        INSERT INTO audit_logs (id, study_id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, diff_json, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"AUD-{uuid4().hex[:10].upper()}",
            study_id,
            actor["id"] if actor else None,
            user_role(actor) if actor else None,
            action,
            entity_type,
            entity_id,
            encode_json(before) if before is not None else None,
            encode_json(after) if after is not None else None,
            encode_json(diff),
            None,
            utc_now(),
        ),
    )


def latest_published_crf_version_id(conn: Any, study_id: str) -> str:
    row = conn.execute(
        """
        SELECT id
        FROM study_crf_versions
        WHERE study_id = ? AND status = 'published'
        ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
        LIMIT 1
        """,
        (study_id,),
    ).fetchone()
    if row:
        return row["id"]
    raise HTTPException(status_code=400, detail=f"Study {study_id} has no published CRF version")


def ui_crf_field_type(schema_type: str | None) -> str:
    if schema_type == "number":
        return "Number"
    if schema_type == "select":
        return "Dropdown"
    if schema_type == "boolean":
        return "Boolean"
    return "Text"


def schema_crf_field_type(ui_type: str | None) -> str:
    if ui_type == "Number":
        return "number"
    if ui_type == "Dropdown":
        return "select"
    if ui_type == "Boolean":
        return "boolean"
    return "text"


def load_crf_version_for_fields(conn: Any, study_id: str) -> dict[str, Any]:
    row = fetch_one(
        conn,
        """
        SELECT *
        FROM study_crf_versions
        WHERE study_id = ?
        ORDER BY
          CASE status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
          updated_at DESC,
          created_at DESC
        LIMIT 1
        """,
        (study_id,),
    )
    item = dict(row)
    item["schema"] = decode_json(item.pop("schema_json"), {})
    return item


def schema_sections(schema: dict[str, Any]) -> list[dict[str, Any]]:
    sections = schema.setdefault("sections", [])
    if not isinstance(sections, list):
        schema["sections"] = []
        return schema["sections"]
    return sections


def crf_fields_from_version(version: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for section in schema_sections(version["schema"]):
        module = str(section.get("title") or section.get("id") or "CRF")
        fields = section.get("fields") if isinstance(section.get("fields"), list) else []
        for field in fields:
            if not isinstance(field, dict):
                continue
            field_id = str(field.get("id") or field.get("name") or "")
            if not field_id:
                continue
            rows.append(
                {
                    "study_id": version["study_id"],
                    "crf_version_id": version["id"],
                    "crf_version": version["version"],
                    "id": field_id,
                    "name": str(field.get("name") or field_id),
                    "type": ui_crf_field_type(field.get("type")),
                    "module": module,
                    "status": str(field.get("status") or "启用"),
                    "options": field.get("options") if isinstance(field.get("options"), list) else [],
                    "required": bool(field.get("required") or False),
                    "validation_rule": str(field.get("validationRule") or field.get("validation_rule") or ""),
                    "conditional_logic": str(field.get("conditionalLogic") or field.get("conditional_logic") or ""),
                    "updated_at": version["updated_at"],
                }
            )
    return rows


def study_crf_field_names(conn: Any, study_id: str) -> set[str]:
    version = load_crf_version_for_fields(conn, study_id)
    return {field["name"] for field in crf_fields_from_version(version)}


QUERY_NON_CRF_FIELDS: dict[str, set[str]] = {
    "visits": {"visit_date", "visit_type", "sle_dai", "medication", "sample_collection", "completeness", "status"},
    "consents": {"status", "signed_at", "version", "method"},
    "samples": {"sample_count", "sample_type", "collected_at", "storage", "status"},
    "omics_records": {"assay", "platform", "run_id", "status", "qc", "sent_at", "completed_at"},
    "follow_up_records": {
        "follow_up_date",
        "follow_up_method",
        "survival_status",
        "disease_status",
        "efficacy_assessment",
        "lost_to_follow_up_reason",
    },
    "patients": {"note", "disease_type", "clinical_data.数据完整度", "数据完整度", "data_completeness"},
}


def validate_data_query_field(conn: Any, data: dict[str, Any]) -> None:
    field_name = data.get("field_name")
    if not field_name:
        return
    form_id = data.get("form_id") or ""
    normalized_field = str(field_name)
    if normalized_field.startswith("clinical_data."):
        normalized_field = normalized_field.removeprefix("clinical_data.")
    allowed_non_crf = set(QUERY_NON_CRF_FIELDS.get(form_id, set()))
    if normalized_field in allowed_non_crf or field_name in allowed_non_crf:
        return
    if normalized_field in study_crf_field_names(conn, data["study_id"]):
        return
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="field_name is not part of the active Study CRF or allowed source table fields")


def crf_field_map_from_schema(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    version = {
        "study_id": "",
        "id": "",
        "version": "",
        "schema": schema,
        "updated_at": "",
    }
    return {
        field["id"]: {
            "id": field["id"],
            "name": field["name"],
            "type": field["type"],
            "module": field["module"],
            "status": field["status"],
            "options": field["options"],
            "required": field["required"],
            "validation_rule": field["validation_rule"],
            "conditional_logic": field["conditional_logic"],
        }
        for field in crf_fields_from_version(version)
    }


def crf_migration_preview(source_schema: dict[str, Any], target_schema: dict[str, Any]) -> dict[str, Any]:
    source_fields = crf_field_map_from_schema(source_schema)
    target_fields = crf_field_map_from_schema(target_schema)
    added = [target_fields[field_id] for field_id in sorted(set(target_fields) - set(source_fields))]
    removed = [source_fields[field_id] for field_id in sorted(set(source_fields) - set(target_fields))]
    changed: list[dict[str, Any]] = []
    unchanged = 0
    for field_id in sorted(set(source_fields) & set(target_fields)):
        before = source_fields[field_id]
        after = target_fields[field_id]
        changes = [
            key
            for key in ("name", "type", "module", "status", "options", "required", "validation_rule", "conditional_logic")
            if before.get(key) != after.get(key)
        ]
        if changes:
            changed.append({"id": field_id, "name": after["name"], "changes": changes, "before": before, "after": after})
        else:
            unchanged += 1
    return {
        "summary": {
            "added": len(added),
            "removed": len(removed),
            "changed": len(changed),
            "unchanged": unchanged,
            "source_field_count": len(source_fields),
            "target_field_count": len(target_fields),
        },
        "added": added,
        "removed": removed,
        "changed": changed,
    }


def insert_crf_migration_log(conn: Any, user: dict[str, Any], migration_id: str, study_id: str, step: str, status_value: str, message: str = "") -> dict[str, Any]:
    log_id = f"CRFML-{study_id}-{uuid4().hex[:8].upper()}"
    now = utc_now()
    conn.execute(
        """
        INSERT INTO crf_migration_execution_logs
          (id, study_id, migration_id, step, status, message, actor_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (log_id, study_id, migration_id, step, status_value, message, user["id"], now),
    )
    return row_to_crf_migration_log(fetch_one(conn, "SELECT * FROM crf_migration_execution_logs WHERE id = ?", (log_id,)))


def crf_migration_logs(conn: Any, migration_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT *
        FROM crf_migration_execution_logs
        WHERE migration_id = ?
        ORDER BY created_at ASC
        """,
        (migration_id,),
    ).fetchall()
    return [row_to_crf_migration_log(row) for row in rows]


def crf_migration_approval_with_logs(conn: Any, approval: dict[str, Any]) -> dict[str, Any]:
    return {**approval, "execution_logs": crf_migration_logs(conn, approval["id"])}


def set_schema_field_count(schema: dict[str, Any]) -> None:
    count = 0
    for section in schema_sections(schema):
        fields = section.get("fields") if isinstance(section.get("fields"), list) else []
        count += len(fields)
    schema["fieldCount"] = count


def find_schema_field(schema: dict[str, Any], field_id: str) -> tuple[dict[str, Any], dict[str, Any]] | tuple[None, None]:
    for section in schema_sections(schema):
        fields = section.get("fields") if isinstance(section.get("fields"), list) else []
        for field in fields:
            if isinstance(field, dict) and field.get("id") == field_id:
                return section, field
    return None, None


def ensure_schema_section(schema: dict[str, Any], module: str) -> dict[str, Any]:
    sections = schema_sections(schema)
    for section in sections:
        if section.get("title") == module:
            if not isinstance(section.get("fields"), list):
                section["fields"] = []
            return section
    section_id = f"custom_{len(sections) + 1}"
    section = {"id": section_id, "title": module, "fields": []}
    sections.append(section)
    return section


def active_study_visit_plans(conn: Any, study_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT *
        FROM study_visit_plans
        WHERE study_id = ? AND status = 'active'
        ORDER BY sort_order, day_offset, code
        """,
        (study_id,),
    ).fetchall()
    return [row_to_study_visit_plan(row) for row in rows]


def completeness_value(clinical_data: dict[str, Any]) -> int:
    raw_value = clinical_data.get("数据完整度", 0)
    if isinstance(raw_value, (int, float)):
        return max(0, min(100, int(raw_value)))
    try:
        return max(0, min(100, int(float(str(raw_value).rstrip("%")))))
    except (TypeError, ValueError):
        return 0


def visit_metric_value_for_study(study_id: str, clinical_data: dict[str, Any]) -> str:
    if study_id == "LZXK-01":
        ecog = clinical_data.get("ECOG评分")
        recist = clinical_data.get("RECIST评估")
        if ecog is not None and recist:
            return f"ECOG {ecog} / RECIST {recist}"
        if ecog is not None:
            return f"ECOG {ecog} / 疗效待录入"
        return "ECOG / 疗效待录入"

    sle_dai = clinical_data.get("SLEDAI评分")
    return str(sle_dai if sle_dai is not None else "待录入")


def treatment_summary_for_study(study_id: str, clinical_data: dict[str, Any]) -> str:
    if study_id == "LZXK-01":
        return str(clinical_data.get("当前治疗方案") or clinical_data.get("初始治疗方案") or "待录入")
    return str(clinical_data.get("免疫抑制剂1") or clinical_data.get("初始治疗方案") or "待录入")


def create_planned_visits_for_patient(
    conn: Any,
    actor: dict[str, Any],
    patient: dict[str, Any],
    clinical_data: dict[str, Any],
    base_date: date | None = None,
) -> dict[str, int]:
    plans = active_study_visit_plans(conn, patient["study_id"])
    if not plans:
        return {"visits": 0, "crf_entries": 0}

    now = utc_now()
    visit_base_date = base_date or date.today()
    crf_version_id = latest_published_crf_version_id(conn, patient["study_id"])
    created_visit_ids: list[str] = []
    created_crf_count = 0

    for index, plan in enumerate(plans):
        visit_id = f"VIS-{patient['id']}-{plan['code']}".replace(" ", "-")
        visit_date = visit_base_date + timedelta(days=int(plan["day_offset"]))
        required_samples = plan.get("required_samples") or []
        required_forms = plan.get("required_forms") or []
        sample_collection = "、".join(required_samples) if required_samples else "按访视计划"
        visit_metric = visit_metric_value_for_study(patient["study_id"], clinical_data)
        treatment_summary = treatment_summary_for_study(patient["study_id"], clinical_data)
        conn.execute(
            """
            INSERT INTO visits
              (id, study_id, patient_id, visit_plan_id, visit, visit_date, visit_type, sle_dai, medication, sample_collection, completeness, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                visit_id,
                patient["study_id"],
                patient["id"],
                plan["id"],
                plan["name"],
                str(visit_date),
                plan["visit_type"],
                visit_metric,
                treatment_summary,
                sample_collection,
                completeness_value(clinical_data) if index == 0 else 0,
                "进行中" if index == 0 else "已预约",
            ),
        )
        created_visit_ids.append(visit_id)

        for form_id in required_forms:
            entry_id = f"CRF-{uuid4().hex[:8].upper()}"
            payload = {
                **clinical_data,
                "访视计划": plan["code"],
                "访视名称": plan["name"],
                "CRF版本": clinical_data.get("CRF版本") or crf_version_id,
            }
            payload_jsonb, payload_format, payload_version = sqlite_json_storage(conn, payload)
            conn.execute(
                """
                INSERT INTO crf_entries
                  (id, study_id, patient_id, visit_id, crf_version_id, form_id, module, payload_json, payload_jsonb, payload_version, payload_format, status, completed_by, completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, ?, ?)
                """,
                (
                    entry_id,
                    patient["study_id"],
                    patient["id"],
                    visit_id,
                    crf_version_id,
                    form_id,
                    form_id,
                    encode_json(payload),
                    payload_jsonb,
                    payload_version,
                    payload_format,
                    now,
                    now,
                ),
            )
            created_crf_count += 1

    insert_audit(
        conn,
        actor,
        "create_planned_visits",
        "visits",
        patient["id"],
        after={"visit_ids": created_visit_ids, "crf_entries": created_crf_count},
        study_id=patient["study_id"],
    )
    return {"visits": len(created_visit_ids), "crf_entries": created_crf_count}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "linzight-rws-api"}


@app.post("/seed")
def seed() -> dict[str, str]:
    seed_database()
    return {"status": "seeded"}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (payload.username,)).fetchone()
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid username or password")
        if row["status"] != "active":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user account disabled")
        if not row["password_hash"].startswith("pbkdf2_sha256$"):
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (hash_password(payload.password), utc_now(), row["id"]),
            )
        user = load_user(conn, row["id"])
        insert_audit(conn, user, "login", "users", user["id"], after={"username": user["username"]}, study_id=first_accessible_study_id(conn, user) or "LGL-1111")
        return {"access_token": create_access_token(user["id"], user_role(user)), "token_type": "bearer", "user": user}


def password_reset_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@app.post("/auth/password-reset/request")
def request_password_reset(payload: PasswordResetRequest) -> dict[str, str]:
    username = payload.username.strip().lower()
    email_status = "not_configured"
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(username) = ?", (username,)).fetchone()
        if row and row["status"] == "active":
            now = utc_now()
            token = secrets.token_urlsafe(32)
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=PASSWORD_RESET_TTL_SECONDS)).isoformat(timespec="seconds")
            conn.execute(
                """
                INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
                VALUES (?, ?, ?, ?, NULL, ?)
                """,
                (f"PRT-{uuid4().hex[:12].upper()}", row["id"], password_reset_token_hash(token), expires_at, now),
            )
            public_url = os.getenv("LINZIGHT_PUBLIC_APP_URL", "http://127.0.0.1:5173").rstrip("/")
            reset_url = f"{public_url}/?reset_token={token}"
            body = "\n".join(
                [
                    "LinZight RWS EDC password reset",
                    "",
                    "Use the link below to set a new password. The link expires shortly.",
                    reset_url,
                    "",
                    "If you did not request this change, ignore this email.",
                ]
            )
            email_status = send_email(row["username"], "LinZight password reset", body)["status"]
        elif smtp_configured():
            email_status = "sent"
    return {"status": "accepted", "email": email_status}


@app.post("/auth/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm) -> dict[str, str]:
    if not password_meets_policy(payload.password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PASSWORD_POLICY_MESSAGE)
    token_hash = password_reset_token_hash(payload.token)
    now = utc_now()
    with connect() as conn:
        row = conn.execute(
            """
            SELECT * FROM password_reset_tokens
            WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid or expired password reset token")
        conn.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (hash_password(payload.password), now, row["user_id"]))
        conn.execute("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", (now, row["id"]))
        user = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (row["user_id"],)))
        insert_audit(conn, user, "password_reset", "users", user["id"], after={"username": user["username"]}, study_id=first_accessible_study_id(conn, user) or "GLOBAL")
    return {"status": "updated"}


@app.get("/auth/me")
def me(token: str | None = Query(default=None), authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user_id = token_to_user_id(authorization=authorization, token=token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing or invalid bearer token")
    with connect() as conn:
        try:
            return load_user(conn, user_id)
        except KeyError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token") from exc


@app.post("/auth/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, str]:
    with connect() as conn:
        user = authorize(authorization, "studies", "read", conn=conn)
        insert_audit(conn, user, "logout", "users", user["id"], after={"username": user["username"]}, study_id=first_accessible_study_id(conn, user) or "LGL-1111")
        return {"status": "logged_out"}


@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    role_code = data["role"]
    study_id = data.get("study_id")
    user_id = data.get("id") or f"USR-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        actor = authorize(
            authorization,
            "study_members" if study_id else "studies",
            "write",
            study_id=study_id,
            conn=conn,
        )
        if not study_id and user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study_id is required for study account creation")
        if role_code.startswith("LZ_") and user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can create platform users")
        if study_id:
            fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,))
            if not role_code.startswith("STUDY_") and user_role(actor) != "LZ_ADMIN":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study account role required")
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (data["username"],)).fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username already exists")
        if not password_meets_policy(data["password"]):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PASSWORD_POLICY_MESSAGE)
        conn.execute(
            """
            INSERT INTO users (id, username, display_name, role, role_code, password_hash, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                data["username"],
                data["display_name"],
                LEGACY_ROLE_BY_ROLE_CODE.get(role_code, "investigator"),
                role_code,
                hash_password(data["password"]),
                data["status"],
                now,
                now,
            ),
        )
        if study_id and role_code.startswith("STUDY_"):
            member_id = f"SMB-{uuid4().hex[:10].upper()}"
            conn.execute(
                """
                INSERT INTO study_members (id, study_id, user_id, study_role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (member_id, study_id, user_id, role_code, data["member_status"], now, now),
            )
        created = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,)))
        created["study_scope"] = get_user_study_scope(conn, created)
        created["study_memberships"] = [
            row_to_study_member(row)
            for row in conn.execute(
                """
                SELECT id, study_id, user_id, study_role, status, created_at, updated_at
                FROM study_members
                WHERE user_id = ?
                ORDER BY study_id
                """,
                (user_id,),
            ).fetchall()
        ]
        insert_audit(conn, actor, "create", "users", user_id, after=created, study_id=study_id or first_accessible_study_id(conn, actor) or "LGL-1111")
        return created


@app.patch("/users/{user_id}/status")
def update_user_status(user_id: str, payload: UserStatusUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        actor = authorize(authorization, "studies", "write", conn=conn)
        if user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can enable or disable users")
        before = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,)))
        now = utc_now()
        conn.execute("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", (payload.status, now, user_id))
        after = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,)))
        after["study_scope"] = get_user_study_scope(conn, after)
        insert_audit(conn, actor, "update_status", "users", user_id, before=before, after=after, study_id=first_accessible_study_id(conn, after) or first_accessible_study_id(conn, actor) or "LGL-1111")
        return after


@app.get("/users")
def list_users(study_id: str | None = None, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        actor = authorize(authorization, "studies", "read", study_id=study_id, conn=conn)
        if user_role(actor) != "LZ_ADMIN" and not role_can(user_role(actor), "study_members", "read"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permission denied")
        params: list[Any] = []
        if user_role(actor) == "LZ_ADMIN" and not study_id:
            rows = conn.execute("SELECT * FROM users ORDER BY display_name").fetchall()
        elif study_id:
            rows = conn.execute(
                """
                SELECT DISTINCT u.*
                FROM users u
                LEFT JOIN study_members sm ON sm.user_id = u.id AND sm.study_id = ?
                LEFT JOIN global_role_study_scope grs ON grs.user_id = u.id AND grs.study_id = ?
                WHERE sm.study_id IS NOT NULL OR grs.study_id IS NOT NULL OR u.role_code = 'LZ_ADMIN'
                ORDER BY u.display_name
                """,
                (study_id, study_id),
            ).fetchall()
        else:
            study_ids = get_user_study_scope(conn, actor).get("studyIds") or []
            if not study_ids:
                return []
            placeholders = ", ".join("?" for _ in study_ids)
            rows = conn.execute(
                f"""
                SELECT DISTINCT u.*
                FROM users u
                LEFT JOIN study_members sm ON sm.user_id = u.id
                LEFT JOIN global_role_study_scope grs ON grs.user_id = u.id
                WHERE sm.study_id IN ({placeholders}) OR grs.study_id IN ({placeholders})
                ORDER BY u.display_name
                """,
                [*study_ids, *study_ids],
            ).fetchall()
        return [enrich_user_record(conn, row_to_user(row)) for row in rows]


@app.patch("/users/{user_id}")
def update_user(user_id: str, payload: UserUpdate, study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    with connect() as conn:
        actor = authorize(authorization, "studies", "write", study_id=study_id, conn=conn)
        before = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,)))
        if user_role(actor) != "LZ_ADMIN":
            if not study_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study_id is required for Study-scoped user updates")
            member = conn.execute(
                "SELECT 1 FROM study_members WHERE study_id = ? AND user_id = ?",
                (study_id, user_id),
            ).fetchone()
            if not member:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="target user is not a member of this Study")
            if data.get("role") is not None or data.get("status") is not None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can change global user role or login status")

        columns: list[str] = []
        values: list[Any] = []
        if data.get("display_name") is not None:
            columns.append("display_name = ?")
            values.append(data["display_name"])
        if data.get("role") is not None:
            if data["role"].startswith("LZ_") and user_role(actor) != "LZ_ADMIN":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can assign platform roles")
            columns.extend(["role = ?", "role_code = ?"])
            values.extend([LEGACY_ROLE_BY_ROLE_CODE.get(data["role"], "investigator"), data["role"]])
        if data.get("password") is not None:
            if not password_meets_policy(data["password"]):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PASSWORD_POLICY_MESSAGE)
            columns.append("password_hash = ?")
            values.append(hash_password(data["password"]))
        if data.get("status") is not None:
            columns.append("status = ?")
            values.append(data["status"])
        if not columns:
            return enrich_user_record(conn, before)
        columns.append("updated_at = ?")
        values.append(utc_now())
        values.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(columns)} WHERE id = ?", values)
        after = enrich_user_record(conn, row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,))))
        insert_audit(conn, actor, "update", "users", user_id, before=before, after=after, study_id=study_id or first_accessible_study_id(conn, actor) or "LGL-1111")
        return after


@app.patch("/users/{user_id}/study-scope")
def update_global_role_study_scope(user_id: str, payload: GlobalRoleStudyScopeUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        actor = authorize(authorization, "studies", "write", conn=conn)
        if user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can manage platform role Study scope")
        target = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,)))
        if not target["role"].startswith("LZ_") or target["role"] == "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Study scope is only editable for non-admin platform roles")
        unique_study_ids = sorted(set(payload.study_ids))
        for scoped_study_id in unique_study_ids:
            fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (scoped_study_id,))
        before = enrich_user_record(conn, target.copy())
        conn.execute("DELETE FROM global_role_study_scope WHERE user_id = ?", (user_id,))
        now = utc_now()
        for scoped_study_id in unique_study_ids:
            conn.execute(
                """
                INSERT INTO global_role_study_scope (id, user_id, study_id, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (f"GRS-{uuid4().hex[:10].upper()}", user_id, scoped_study_id, now),
            )
        after = enrich_user_record(conn, row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,))))
        insert_audit(conn, actor, "update_study_scope", "global_role_study_scope", user_id, before=before, after=after, study_id=first_accessible_study_id(conn, actor) or "LGL-1111")
        return after


@app.get("/field-permissions")
def list_field_permissions(resource: str = "patients", authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        user = authorize(authorization, "studies", "read", conn=conn)
        rows = conn.execute(
            """
            SELECT role, resource, field_name, can_view, can_export, mask_rule, updated_at
            FROM field_permissions
            WHERE resource = ?
            ORDER BY role, field_name
            """,
            (resource,),
        ).fetchall()
        if user_role(user) != "LZ_ADMIN":
            rows = [row for row in rows if row["role"] == user_role(user)]
        return [
            {
                "role": row["role"],
                "resource": row["resource"],
                "field_name": row["field_name"],
                "can_view": bool(row["can_view"]),
                "can_export": bool(row["can_export"]),
                "mask_rule": row["mask_rule"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]


@app.get("/permissions/matrix")
def get_permission_matrix(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "studies", "read", conn=conn)
        return permission_matrix()


@app.post("/studies", status_code=status.HTTP_201_CREATED)
def create_study(payload: StudyCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    now = utc_now()
    with connect() as conn:
        actor = authorize(authorization, "studies", "write", conn=conn)
        if user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can create Studies")
        if conn.execute("SELECT 1 FROM studies WHERE id = ? OR code = ?", (data["id"], data["code"])).fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Study id or code already exists")
        conn.execute(
            """
            INSERT INTO studies (id, code, name, indication, phase, status, owner_org, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (data["id"], data["code"], data["name"], data["indication"], data["phase"], data["status"], data["owner_org"], now, now),
        )
        study = row_to_study(fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (data["id"],)))
        insert_audit(conn, actor, "create", "studies", study["id"], after=study, study_id=study["id"])
        return study


@app.get("/studies")
def list_studies(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        user = authorize(authorization, "studies", "read", conn=conn)
        sql = "SELECT * FROM studies"
        params: list[Any] = []
        where: list[str] = []
        append_study_filter(conn, user, where, params, "id")
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id"
        return [row_to_study(row) for row in conn.execute(sql, params).fetchall()]


@app.patch("/studies/{study_id}")
def update_study(study_id: str, payload: StudyUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    with connect() as conn:
        actor = authorize(authorization, "studies", "write", study_id=study_id, conn=conn)
        if user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can update Study lifecycle")
        before = row_to_study(fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,)))
        columns: list[str] = []
        values: list[Any] = []
        for key in ("code", "name", "indication", "phase", "status", "owner_org"):
            if data.get(key) is not None:
                columns.append(f"{key} = ?")
                values.append(data[key])
        if not columns:
            return before
        columns.append("updated_at = ?")
        values.append(utc_now())
        values.append(study_id)
        conn.execute(f"UPDATE studies SET {', '.join(columns)} WHERE id = ?", values)
        after = row_to_study(fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,)))
        insert_audit(conn, actor, "update_lifecycle", "studies", study_id, before=before, after=after, study_id=study_id)
        return after


@app.delete("/studies/{study_id}")
def delete_study(study_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        actor = authorize(authorization, "studies", "write", study_id=study_id, conn=conn)
        if user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can delete Studies")
        before = row_to_study(fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,)))
        now = utc_now()
        conn.execute("UPDATE studies SET status = 'deleted', updated_at = ? WHERE id = ?", (now, study_id))
        after = row_to_study(fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,)))
        insert_audit(conn, actor, "delete_soft", "studies", study_id, before=before, after=after, study_id=study_id)
        return after


@app.get("/study-configurations")
def list_study_configurations(
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    with connect() as conn:
        user = authorize(authorization, "studies", "read", study_id=study_id, conn=conn)
        sql = "SELECT * FROM study_configurations"
        params: list[Any] = []
        where: list[str] = []
        append_study_filter(conn, user, where, params, "study_id", study_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY study_id"
        return [row_to_study_configuration(row) for row in conn.execute(sql, params).fetchall()]


@app.get("/studies/{study_id}/configuration")
def get_study_configuration(study_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        authorize(authorization, "studies", "read", study_id=study_id, conn=conn)
        return row_to_study_configuration(fetch_one(conn, "SELECT * FROM study_configurations WHERE study_id = ?", (study_id,)))


@app.get("/studies/{study_id}/members")
def list_study_members(study_id: str, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "study_members", "read", study_id=study_id, conn=conn)
        rows = conn.execute(
            """
            SELECT
              sm.id,
              sm.study_id,
              sm.user_id,
              u.username,
              u.display_name,
              sm.study_role,
              sm.status,
              sm.created_at,
              sm.updated_at
            FROM study_members sm
            JOIN users u ON u.id = sm.user_id
            WHERE sm.study_id = ?
            ORDER BY sm.study_role, u.display_name
            """,
            (study_id,),
        ).fetchall()
        return [row_to_study_member(row) for row in rows]


@app.post("/studies/{study_id}/members", status_code=status.HTTP_201_CREATED)
def create_study_member(study_id: str, payload: StudyMemberCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        user = authorize(authorization, "study_members", "write", study_id=study_id, conn=conn)
        fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,))
        fetch_one(conn, "SELECT * FROM users WHERE id = ?", (payload.user_id,))
        now = utc_now()
        member_id = f"SMB-{uuid4().hex[:10].upper()}"
        conn.execute(
            """
            INSERT INTO study_members (id, study_id, user_id, study_role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(study_id, user_id) DO UPDATE SET
              study_role = excluded.study_role,
              status = excluded.status,
              updated_at = excluded.updated_at
            """,
            (member_id, study_id, payload.user_id, payload.study_role, payload.status, now, now),
        )
        member = row_to_study_member(
            fetch_one(
                conn,
                """
                SELECT
                  sm.id,
                  sm.study_id,
                  sm.user_id,
                  u.username,
                  u.display_name,
                  sm.study_role,
                  sm.status,
                  sm.created_at,
                  sm.updated_at
                FROM study_members sm
                JOIN users u ON u.id = sm.user_id
                WHERE sm.study_id = ? AND sm.user_id = ?
                """,
                (study_id, payload.user_id),
            )
        )
        insert_audit(conn, user, "upsert_member", "study_members", member["id"], after=member, study_id=study_id)
        return member


@app.get("/studies/{study_id}/visit-plans")
def list_study_visit_plans(study_id: str, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "crf_config", "read", study_id=study_id, conn=conn)
        rows = conn.execute(
            """
            SELECT *
            FROM study_visit_plans
            WHERE study_id = ?
            ORDER BY sort_order, day_offset, code
            """,
            (study_id,),
        ).fetchall()
        return [row_to_study_visit_plan(row) for row in rows]


@app.post("/studies/{study_id}/visit-plans", status_code=status.HTTP_201_CREATED)
def upsert_study_visit_plan(study_id: str, payload: StudyVisitPlanCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    plan_id = data.pop("id") or f"SVP-{study_id}-{data['code']}".replace(".", "-").replace(" ", "-")
    required_forms = data.pop("required_forms")
    required_samples = data.pop("required_samples")
    now = utc_now()
    with connect() as conn:
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,))
        conn.execute(
            """
            INSERT INTO study_visit_plans
              (id, study_id, code, name, visit_type, day_offset, window_before_days, window_after_days, required_forms_json, required_samples_json, status, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(study_id, code) DO UPDATE SET
              name = excluded.name,
              visit_type = excluded.visit_type,
              day_offset = excluded.day_offset,
              window_before_days = excluded.window_before_days,
              window_after_days = excluded.window_after_days,
              required_forms_json = excluded.required_forms_json,
              required_samples_json = excluded.required_samples_json,
              status = excluded.status,
              sort_order = excluded.sort_order,
              updated_at = excluded.updated_at
            """,
            (
                plan_id,
                study_id,
                data["code"],
                data["name"],
                data["visit_type"],
                data["day_offset"],
                data["window_before_days"],
                data["window_after_days"],
                encode_json(required_forms),
                encode_json(required_samples),
                data["status"],
                data["sort_order"],
                now,
                now,
            ),
        )
        plan = row_to_study_visit_plan(fetch_one(conn, "SELECT * FROM study_visit_plans WHERE study_id = ? AND code = ?", (study_id, data["code"])))
        insert_audit(conn, user, "upsert_visit_plan", "study_visit_plans", plan["id"], after=plan, study_id=study_id)
        sync_study_configurations(conn)
        return plan


@app.put("/studies/{study_id}/visit-plans/{plan_id}")
def update_study_visit_plan(study_id: str, plan_id: str, payload: StudyVisitPlanUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_study_visit_plan(fetch_one(conn, "SELECT * FROM study_visit_plans WHERE id = ? AND study_id = ?", (plan_id, study_id)))
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        if not data:
            return before

        columns: list[str] = []
        values: list[Any] = []
        for key, value in data.items():
            if key == "required_forms":
                columns.append("required_forms_json = ?")
                values.append(encode_json(value))
            elif key == "required_samples":
                columns.append("required_samples_json = ?")
                values.append(encode_json(value))
            else:
                columns.append(f"{key} = ?")
                values.append(value)
        columns.append("updated_at = ?")
        values.extend([utc_now(), plan_id, study_id])
        result = conn.execute(f"UPDATE study_visit_plans SET {', '.join(columns)} WHERE id = ? AND study_id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_study_visit_plan(fetch_one(conn, "SELECT * FROM study_visit_plans WHERE id = ? AND study_id = ?", (plan_id, study_id)))
        insert_audit(conn, user, "update_visit_plan", "study_visit_plans", plan_id, before=before, after=after, study_id=study_id)
        sync_study_configurations(conn)
        return after


@app.get("/studies/{study_id}/crf-versions")
def list_study_crf_versions(study_id: str, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "crf_config", "read", study_id=study_id, conn=conn)
        rows = conn.execute(
            "SELECT * FROM study_crf_versions WHERE study_id = ? ORDER BY created_at DESC",
            (study_id,),
        ).fetchall()
        return [row_to_crf_version(row) for row in rows]


@app.post("/studies/{study_id}/crf-versions", status_code=status.HTTP_201_CREATED)
def create_study_crf_version(study_id: str, payload: StudyCrfVersionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        fetch_one(conn, "SELECT * FROM studies WHERE id = ?", (study_id,))
        version_id = f"CRFV-{study_id}-{payload.version.replace('.', '-')}"
        existing_version = conn.execute("SELECT id FROM study_crf_versions WHERE study_id = ? AND version = ?", (study_id, payload.version)).fetchone()
        if existing_version:
            raise HTTPException(status_code=409, detail="CRF version already exists for this Study")
        now = utc_now()
        published_at = now if payload.status == "published" else None
        if payload.status == "published":
            conn.execute(
                "UPDATE study_crf_versions SET status = 'retired', updated_at = ? WHERE study_id = ? AND status = 'published'",
                (now, study_id),
            )
        conn.execute(
            """
            INSERT INTO study_crf_versions
              (id, study_id, template_id, version, status, schema_json, change_summary, created_by, published_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                version_id,
                study_id,
                payload.template_id,
                payload.version,
                payload.status,
                encode_json(payload.schema_payload),
                payload.change_summary,
                user["id"],
                published_at,
                now,
                now,
            ),
        )
        version = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ?", (version_id,)))
        insert_audit(conn, user, "create_crf_version", "study_crf_versions", version_id, after=version, study_id=study_id)
        if payload.status == "published":
            sync_study_configurations(conn)
        return version


@app.post("/studies/{study_id}/crf-versions/migration-preview")
def preview_study_crf_migration(study_id: str, payload: StudyCrfMigrationPreviewRequest, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    with connect() as conn:
        authorize(authorization, "crf_config", "read", study_id=study_id, conn=conn)
        if data.get("source_version_id"):
            source = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (data["source_version_id"], study_id)))
        else:
            source_row = conn.execute(
                """
                SELECT *
                FROM study_crf_versions
                WHERE study_id = ? AND status = 'published'
                ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
                LIMIT 1
                """,
                (study_id,),
            ).fetchone()
            source = row_to_crf_version(source_row) if source_row else load_crf_version_for_fields(conn, study_id)
        preview = crf_migration_preview(source["schema"], data["schema_payload"])
        return {
            "study_id": study_id,
            "source_version_id": source["id"],
            "source_version": source["version"],
            **preview,
        }


@app.get("/studies/{study_id}/crf-migrations")
def list_study_crf_migrations(study_id: str, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "crf_config", "read", study_id=study_id, conn=conn)
        rows = conn.execute(
            """
            SELECT *
            FROM crf_migration_approvals
            WHERE study_id = ?
            ORDER BY created_at DESC
            """,
            (study_id,),
        ).fetchall()
        return [crf_migration_approval_with_logs(conn, row_to_crf_migration_approval(row)) for row in rows]


@app.post("/studies/{study_id}/crf-migrations", status_code=status.HTTP_201_CREATED)
def request_study_crf_migration(study_id: str, payload: StudyCrfMigrationApprovalCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    with connect() as conn:
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        target = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (data["target_version_id"], study_id)))
        if target["status"] != "draft":
            raise HTTPException(status_code=400, detail="Only draft CRF versions can be submitted for migration approval")
        if data.get("source_version_id"):
            source = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (data["source_version_id"], study_id)))
        else:
            source_row = conn.execute(
                """
                SELECT *
                FROM study_crf_versions
                WHERE study_id = ? AND status = 'published'
                ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
                LIMIT 1
                """,
                (study_id,),
            ).fetchone()
            source = row_to_crf_version(source_row) if source_row else load_crf_version_for_fields(conn, study_id)
        preview = {
            "study_id": study_id,
            "source_version_id": source["id"],
            "source_version": source["version"],
            "target_version_id": target["id"],
            "target_version": target["version"],
            **crf_migration_preview(source["schema"], target["schema"]),
        }
        existing_pending = conn.execute(
            """
            SELECT *
            FROM crf_migration_approvals
            WHERE study_id = ? AND target_version_id = ? AND status IN ('pending', 'approved')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (study_id, target["id"]),
        ).fetchone()
        if existing_pending:
            approval = row_to_crf_migration_approval(existing_pending)
            insert_crf_migration_log(conn, user, approval["id"], study_id, "request", "reused", "Existing pending or approved migration request reused")
            approval = crf_migration_approval_with_logs(conn, approval)
            insert_audit(conn, user, "reuse_crf_migration_approval", "crf_migration_approvals", approval["id"], after=approval, study_id=study_id)
            return approval

        now = utc_now()
        approval_id = f"CRFM-{study_id}-{uuid4().hex[:8].upper()}"
        conn.execute(
            """
            INSERT INTO crf_migration_approvals
              (id, study_id, source_version_id, target_version_id, status, preview_json, note, requested_by, requested_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
            """,
            (
                approval_id,
                study_id,
                source["id"],
                target["id"],
                encode_json(preview),
                data.get("note") or "",
                user["id"],
                now,
                now,
                now,
            ),
        )
        approval = row_to_crf_migration_approval(fetch_one(conn, "SELECT * FROM crf_migration_approvals WHERE id = ?", (approval_id,)))
        insert_crf_migration_log(conn, user, approval_id, study_id, "request", "pending", f"Migration request created for target {target['version']}")
        approval = crf_migration_approval_with_logs(conn, approval)
        insert_audit(conn, user, "request_crf_migration_approval", "crf_migration_approvals", approval_id, after=approval, study_id=study_id)
        return approval


@app.post("/studies/{study_id}/crf-migrations/{migration_id}/approve")
def approve_study_crf_migration(study_id: str, migration_id: str, payload: StudyCrfMigrationApprovalAction, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    with connect() as conn:
        before = row_to_crf_migration_approval(fetch_one(conn, "SELECT * FROM crf_migration_approvals WHERE id = ? AND study_id = ?", (migration_id, study_id)))
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        if before["status"] != "pending":
            raise HTTPException(status_code=400, detail="Only pending CRF migrations can be approved")
        if before["requested_by"] == user["id"]:
            insert_crf_migration_log(conn, user, migration_id, study_id, "approve", "blocked", "Requester attempted to approve their own CRF migration")
            raise HTTPException(status_code=400, detail="CRF migration requester cannot approve their own request")
        now = utc_now()
        note = data.get("note") or before["note"]
        conn.execute(
            """
            UPDATE crf_migration_approvals
            SET status = 'approved', approved_by = ?, reviewed_at = ?, note = ?, updated_at = ?
            WHERE id = ? AND study_id = ?
            """,
            (user["id"], now, note, now, migration_id, study_id),
        )
        after = row_to_crf_migration_approval(fetch_one(conn, "SELECT * FROM crf_migration_approvals WHERE id = ? AND study_id = ?", (migration_id, study_id)))
        insert_crf_migration_log(conn, user, migration_id, study_id, "approve", "approved", "Migration approved by a separate reviewer")
        after = crf_migration_approval_with_logs(conn, after)
        insert_audit(conn, user, "approve_crf_migration", "crf_migration_approvals", migration_id, before=before, after=after, study_id=study_id)
        return after


@app.post("/studies/{study_id}/crf-migrations/{migration_id}/apply")
def apply_study_crf_migration(study_id: str, migration_id: str, payload: StudyCrfMigrationApprovalAction, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    with connect() as conn:
        before = row_to_crf_migration_approval(fetch_one(conn, "SELECT * FROM crf_migration_approvals WHERE id = ? AND study_id = ?", (migration_id, study_id)))
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        if before["status"] != "approved":
            raise HTTPException(status_code=400, detail="Only approved CRF migrations can be applied")
        if before["requested_by"] == user["id"]:
            insert_crf_migration_log(conn, user, migration_id, study_id, "apply", "blocked", "Requester attempted to apply their own CRF migration")
            raise HTTPException(status_code=400, detail="CRF migration requester cannot apply their own request")
        target = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (before["target_version_id"], study_id)))
        if target["status"] != "draft":
            raise HTTPException(status_code=400, detail="Target CRF version must still be a draft")
        now = utc_now()
        conn.execute(
            "UPDATE study_crf_versions SET status = 'retired', updated_at = ? WHERE study_id = ? AND id <> ? AND status = 'published'",
            (now, study_id, target["id"]),
        )
        conn.execute(
            """
            UPDATE study_crf_versions
            SET status = 'published', published_at = ?, updated_at = ?
            WHERE id = ? AND study_id = ?
            """,
            (now, now, target["id"], study_id),
        )
        note = data.get("note") or before["note"]
        conn.execute(
            """
            UPDATE crf_migration_approvals
            SET status = 'applied', note = ?, applied_at = ?, updated_at = ?
            WHERE id = ? AND study_id = ?
            """,
            (note, now, now, migration_id, study_id),
        )
        after = row_to_crf_migration_approval(fetch_one(conn, "SELECT * FROM crf_migration_approvals WHERE id = ? AND study_id = ?", (migration_id, study_id)))
        published = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (target["id"], study_id)))
        insert_crf_migration_log(conn, user, migration_id, study_id, "apply", "applied", f"Target CRF version {published['version']} published")
        after = crf_migration_approval_with_logs(conn, after)
        insert_audit(conn, user, "apply_crf_migration", "crf_migration_approvals", migration_id, before=before, after={**after, "published_version": published}, study_id=study_id)
        sync_study_configurations(conn)
        return after


@app.put("/studies/{study_id}/crf-versions/{version_id}")
def update_study_crf_version(study_id: str, version_id: str, payload: StudyCrfVersionUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (version_id, study_id)))
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        if not data:
            return before
        now = utc_now()
        columns: list[str] = []
        values: list[Any] = []
        if "status" in data:
            if data["status"] == "published":
                conn.execute(
                    "UPDATE study_crf_versions SET status = 'retired', updated_at = ? WHERE study_id = ? AND id <> ? AND status = 'published'",
                    (now, study_id, version_id),
                )
                columns.append("published_at = ?")
                values.append(now)
            columns.append("status = ?")
            values.append(data["status"])
        if "schema_payload" in data and data["schema_payload"] is not None:
            columns.append("schema_json = ?")
            values.append(encode_json(data["schema_payload"]))
        if "change_summary" in data and data["change_summary"] is not None:
            columns.append("change_summary = ?")
            values.append(data["change_summary"])
        columns.append("updated_at = ?")
        values.extend([now, version_id, study_id])
        result = conn.execute(f"UPDATE study_crf_versions SET {', '.join(columns)} WHERE id = ? AND study_id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_crf_version(fetch_one(conn, "SELECT * FROM study_crf_versions WHERE id = ? AND study_id = ?", (version_id, study_id)))
        insert_audit(conn, user, "update_crf_version", "study_crf_versions", version_id, before=before, after=after, study_id=study_id)
        if after["status"] == "published":
            sync_study_configurations(conn)
        return after


@app.get("/studies/{study_id}/crf-fields")
def list_study_crf_fields(study_id: str, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "crf_config", "read", study_id=study_id, conn=conn)
        version = load_crf_version_for_fields(conn, study_id)
        return crf_fields_from_version(version)


@app.post("/studies/{study_id}/crf-fields", status_code=status.HTTP_201_CREATED)
def create_study_crf_field(study_id: str, payload: StudyCrfFieldCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    now = utc_now()
    with connect() as conn:
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        version = load_crf_version_for_fields(conn, study_id)
        schema = version["schema"]
        field_id = data["id"] or f"CRF-{study_id}-{uuid4().hex[:8].upper()}"
        _, existing_field = find_schema_field(schema, field_id)
        if existing_field is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="field already exists")

        before = crf_fields_from_version(version)
        section = ensure_schema_section(schema, data["module"])
        fields = section.setdefault("fields", [])
        source_column = 9000 + len(crf_fields_from_version(version)) + 1
        fields.append(
            {
                "id": field_id,
                "name": data["name"],
                "sourceName": data["name"],
                "sourceColumn": source_column,
                "type": schema_crf_field_type(data["type"]),
                "status": data["status"],
                "options": data["options"],
                "required": data["required"],
                "validationRule": data["validation_rule"],
                "conditionalLogic": data["conditional_logic"],
            }
        )
        set_schema_field_count(schema)
        conn.execute(
            "UPDATE study_crf_versions SET schema_json = ?, updated_at = ? WHERE id = ? AND study_id = ?",
            (encode_json(schema), now, version["id"], study_id),
        )
        after_version = load_crf_version_for_fields(conn, study_id)
        created = next(field for field in crf_fields_from_version(after_version) if field["id"] == field_id)
        insert_audit(conn, user, "create_crf_field", "study_crf_versions", version["id"], before=before, after=created, study_id=study_id)
        return created


@app.put("/studies/{study_id}/crf-fields/{field_id}")
def update_study_crf_field(study_id: str, field_id: str, payload: StudyCrfFieldUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        user = authorize(authorization, "crf_config", "write", study_id=study_id, conn=conn)
        version = load_crf_version_for_fields(conn, study_id)
        schema = version["schema"]
        old_section, field = find_schema_field(schema, field_id)
        if field is None or old_section is None:
            raise not_found()
        before = next(item for item in crf_fields_from_version(version) if item["id"] == field_id)
        if not data:
            return before

        if "name" in data:
            field["name"] = data["name"]
            field["sourceName"] = data["name"]
        if "type" in data:
            field["type"] = schema_crf_field_type(data["type"])
        if "status" in data:
            field["status"] = data["status"]
        if "options" in data:
            field["options"] = data["options"]
        if "required" in data:
            field["required"] = data["required"]
        if "validation_rule" in data:
            field["validationRule"] = data["validation_rule"]
        if "conditional_logic" in data:
            field["conditionalLogic"] = data["conditional_logic"]
        if "module" in data and data["module"] != old_section.get("title"):
            fields = old_section.get("fields") if isinstance(old_section.get("fields"), list) else []
            old_section["fields"] = [item for item in fields if not (isinstance(item, dict) and item.get("id") == field_id)]
            next_section = ensure_schema_section(schema, data["module"])
            next_section.setdefault("fields", []).append(field)

        set_schema_field_count(schema)
        now = utc_now()
        conn.execute(
            "UPDATE study_crf_versions SET schema_json = ?, updated_at = ? WHERE id = ? AND study_id = ?",
            (encode_json(schema), now, version["id"], study_id),
        )
        after_version = load_crf_version_for_fields(conn, study_id)
        after = next(item for item in crf_fields_from_version(after_version) if item["id"] == field_id)
        insert_audit(conn, user, "update_crf_field", "study_crf_versions", version["id"], before=before, after=after, study_id=study_id)
        return after


@app.get("/studies/{path_study_id}/patients")
@app.get("/patients")
def list_patients(
    path_study_id: str | None = None,
    q: str | None = Query(default=None),
    disease_type: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "patients")
    sql = "SELECT * FROM patients"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "patients", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if q:
            where.append("(name LIKE ? OR hospital_no LIKE ? OR disease_type LIKE ?)")
            params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
        if disease_type:
            where.append("disease_type = ?")
            params.append(disease_type)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC"
        patients = [row_to_patient(row) for row in conn.execute(sql, params).fetchall()]
        return apply_field_permissions_to_records(conn, user, patients)


@app.post("/studies/{path_study_id}/patients", status_code=status.HTTP_201_CREATED)
@app.post("/patients", status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, path_study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    if path_study_id:
        if data.get("study_id") and data["study_id"] != path_study_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path study_id does not match payload study_id")
        data["study_id"] = path_study_id
    patient_id = data.pop("id") or f"PAT-{uuid4().hex[:8].upper()}"
    now = utc_now()
    try:
        with connect() as conn:
            user = authorize(authorization, "patients", "write", study_id=data["study_id"], conn=conn)
            clinical_data_jsonb, clinical_data_format, clinical_data_version = sqlite_json_storage(conn, data["clinical_data"])
            conn.execute(
                """
                INSERT INTO patients
                  (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, clinical_data_jsonb, clinical_data_version, clinical_data_format, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    patient_id,
                    data["study_id"],
                    data["name"],
                    data["hospital_no"],
                    data["sex"],
                    data["age"],
                    data["disease_type"],
                    encode_json(data["organs"]),
                    data["note"],
                    encode_json(data["clinical_data"]),
                    clinical_data_jsonb,
                    clinical_data_version,
                    clinical_data_format,
                    now,
                    now,
                ),
            )
            row = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
            created_plan_items = create_planned_visits_for_patient(conn, user, row, data["clinical_data"])
            consent_id = f"CONS-{patient_id}"
            conn.execute(
                """
                INSERT INTO consents (id, study_id, patient_id, status, version, signed_at, method)
                VALUES (?, ?, ?, '待签署', 'V1.0', '-', '-')
                ON CONFLICT(id) DO NOTHING
                """,
                (consent_id, data["study_id"], patient_id),
            )
            insert_audit(conn, user, "create", "patients", patient_id, after=row, study_id=data["study_id"])
            row["generated_visit_count"] = created_plan_items["visits"]
            row["generated_crf_count"] = created_plan_items["crf_entries"]
            row["generated_consent_count"] = 1
            return apply_field_permissions_to_record(conn, user, row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        try:
            patient = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
            user = authorize(authorization, "patients", "read", study_id=patient["study_id"], conn=conn)
            return apply_field_permissions_to_record(conn, user, patient)
        except KeyError as exc:
            raise not_found() from exc


@app.put("/patients/{patient_id}")
def update_patient(patient_id: str, payload: PatientUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        user = authorize(authorization, "patients", "write", study_id=before["study_id"], conn=conn)
        if data.get("study_id") and data["study_id"] != before["study_id"] and user_role(user) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can move patients between studies")
        columns: list[str] = []
        values: list[Any] = []
        for key, value in data.items():
            if key == "organs":
                columns.append("organs_json = ?")
                values.append(encode_json(value))
            elif key == "clinical_data":
                clinical_data_jsonb, clinical_data_format, clinical_data_version = sqlite_json_storage(conn, value)
                columns.extend(["clinical_data_json = ?", "clinical_data_jsonb = ?", "clinical_data_version = ?", "clinical_data_format = ?"])
                values.extend([encode_json(value), clinical_data_jsonb, clinical_data_version, clinical_data_format])
            else:
                columns.append(f"{key} = ?")
                values.append(value)
        if not columns:
            return apply_field_permissions_to_record(conn, user, row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,))))
        columns.append("updated_at = ?")
        values.extend([utc_now(), patient_id])
        result = conn.execute(f"UPDATE patients SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        insert_audit(conn, user, "update", "patients", patient_id, before=before, after=after, study_id=after["study_id"])
        return apply_field_permissions_to_record(conn, user, after)


@app.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: str, authorization: str | None = Header(default=None)) -> None:
    with connect() as conn:
        study_id = patient_study_id(conn, patient_id)
        authorize(authorization, "patients", "write", study_id=study_id, conn=conn)
        result = conn.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/studies/{path_study_id}/samples")
@app.get("/samples")
def list_samples(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "samples")
    sql = "SELECT * FROM samples"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "samples", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY collected_at DESC"
        rows = [row_to_sample(row) for row in conn.execute(sql, params).fetchall()]
        return apply_field_permissions_to_records(conn, user, rows)


@app.post("/studies/{path_study_id}/samples", status_code=status.HTTP_201_CREATED)
@app.post("/samples", status_code=status.HTTP_201_CREATED)
def create_sample(payload: SampleCreate, path_study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    sample_id = data.pop("id") or f"SPL-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
        if path_study_id and path_study_id != study_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path study_id does not match patient")
        user = authorize(authorization, "samples", "write", study_id=study_id, conn=conn)
        try:
            conn.execute(
                """
                INSERT INTO samples
                  (id, study_id, patient_id, patient_name, hospital_no, sample_type, visit, collected_at, storage, status, linked_omics_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sample_id,
                    study_id,
                    data["patient_id"],
                    data["patient_name"],
                    data["hospital_no"],
                    data["sample_type"],
                    data["visit"],
                    data["collected_at"],
                    data["storage"],
                    data["status"],
                    encode_json(data["linked_omics"]),
                    now,
                    now,
                ),
            )
            row = row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
            insert_audit(conn, user, "create", "samples", sample_id, after=row, study_id=study_id)
            return row
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/samples/{sample_id}")
def get_sample(sample_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        try:
            sample = row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
            user = authorize(authorization, "samples", "read", study_id=sample["study_id"], conn=conn)
            return apply_field_permissions_to_record(conn, user, sample)
        except KeyError as exc:
            raise not_found() from exc


@app.put("/samples/{sample_id}")
def update_sample(sample_id: str, payload: SampleUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
        user = authorize(authorization, "samples", "write", study_id=before["study_id"], conn=conn)
        columns: list[str] = []
        values: list[Any] = []
        for key, value in data.items():
            if key == "study_id":
                continue
            if key == "patient_id" and value:
                new_study_id = patient_study_id(conn, value)
                if new_study_id != before["study_id"] and user_role(user) != "LZ_ADMIN":
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can move samples between studies")
                columns.append("study_id = ?")
                values.append(new_study_id)
            column = "linked_omics_json" if key == "linked_omics" else key
            values.append(encode_json(value) if key == "linked_omics" else value)
            columns.append(f"{column} = ?")
        if not columns:
            return before
        columns.append("updated_at = ?")
        values.extend([utc_now(), sample_id])
        result = conn.execute(f"UPDATE samples SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
        insert_audit(conn, user, "update", "samples", sample_id, before=before, after=after, study_id=after["study_id"])
        return after


@app.delete("/samples/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sample(sample_id: str, authorization: str | None = Header(default=None)) -> None:
    with connect() as conn:
        sample = row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
        authorize(authorization, "samples", "write", study_id=sample["study_id"], conn=conn)
        result = conn.execute("DELETE FROM samples WHERE id = ?", (sample_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/studies/{path_study_id}/visits")
@app.get("/visits")
def list_visits(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "visits")
    sql = """
        SELECT
          v.id,
          v.study_id,
          v.patient_id,
          v.visit_plan_id,
          svp.code AS visit_plan_code,
          svp.day_offset AS plan_day_offset,
          svp.window_before_days,
          svp.window_after_days,
          p.name AS patient_name,
          v.visit,
          v.visit_date,
          v.visit_type,
          v.sle_dai,
          v.medication,
          v.sample_collection,
          v.completeness,
          v.status
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        LEFT JOIN study_visit_plans svp ON svp.id = v.visit_plan_id
    """
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "visits", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "v.study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("v.patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY v.visit_date DESC"
        rows = [row_to_visit(row) for row in conn.execute(sql, params).fetchall()]
        return apply_field_permissions_to_records(conn, user, rows)


def fetch_visit_display(conn: Any, visit_id: str) -> dict[str, Any]:
    return row_to_visit(
        fetch_one(
            conn,
            """
            SELECT
              v.id,
              v.study_id,
              v.patient_id,
              v.visit_plan_id,
              svp.code AS visit_plan_code,
              svp.day_offset AS plan_day_offset,
              svp.window_before_days,
              svp.window_after_days,
              p.name AS patient_name,
              v.visit,
              v.visit_date,
              v.visit_type,
              v.sle_dai,
              v.medication,
              v.sample_collection,
              v.completeness,
              v.status
            FROM visits v
            JOIN patients p ON p.id = v.patient_id
            LEFT JOIN study_visit_plans svp ON svp.id = v.visit_plan_id
            WHERE v.id = ?
            """,
            (visit_id,),
        )
    )


@app.put("/visits/{visit_id}")
def update_visit(visit_id: str, payload: VisitUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = fetch_visit_display(conn, visit_id)
        user = authorize(authorization, "visits", "write", study_id=before["study_id"], conn=conn)
        if not data:
            return before
        columns = [f"{key} = ?" for key in data]
        values = list(data.values())
        values.append(visit_id)
        result = conn.execute(f"UPDATE visits SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = fetch_visit_display(conn, visit_id)
        insert_audit(conn, user, "update", "visits", visit_id, before=before, after=after, study_id=after["study_id"])
        return after


@app.get("/studies/{path_study_id}/follow-up-records")
@app.get("/follow-up-records")
def list_follow_up_records(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "follow_up_records")
    sql = """
        SELECT
          f.*,
          p.name AS patient_name
        FROM follow_up_records f
        JOIN patients p ON p.id = f.patient_id
    """
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "follow_up_records", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "f.study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("f.patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY f.follow_up_date DESC, f.recorded_at DESC"
        rows = [row_to_follow_up_record(row) for row in conn.execute(sql, params).fetchall()]
        return apply_field_permissions_to_records(conn, user, rows)


@app.post("/studies/{path_study_id}/follow-up-records", status_code=status.HTTP_201_CREATED)
@app.post("/follow-up-records", status_code=status.HTTP_201_CREATED)
def create_follow_up_record(payload: FollowUpRecordCreate, path_study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    record_id = data.pop("id") or f"FUP-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
        if path_study_id and path_study_id != study_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path study_id does not match patient")
        if data.get("study_id") and data["study_id"] != study_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="study_id does not match patient")
        if data.get("visit_id"):
            visit_scope = visit_patient_scope(conn, data["visit_id"])
            if visit_scope["study_id"] != study_id or visit_scope["patient_id"] != data["patient_id"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="visit_id does not match patient or study")
        user = authorize(authorization, "follow_up_records", "write", study_id=study_id, conn=conn)
        recorded_at = data["recorded_at"] or now
        try:
            conn.execute(
                """
                INSERT INTO follow_up_records
                  (id, study_id, patient_id, visit_id, follow_up_date, follow_up_method, followed_by, survival_status, disease_status, symptoms_signs, imaging_lab_summary, efficacy_assessment, metastasis_status, adverse_events, quality_of_life, lost_to_follow_up_reason, recorded_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    study_id,
                    data["patient_id"],
                    data["visit_id"],
                    data["follow_up_date"],
                    data["follow_up_method"],
                    data["followed_by"],
                    data["survival_status"],
                    data["disease_status"],
                    data["symptoms_signs"],
                    data["imaging_lab_summary"],
                    data["efficacy_assessment"],
                    data["metastasis_status"],
                    data["adverse_events"],
                    data["quality_of_life"],
                    data["lost_to_follow_up_reason"],
                    recorded_at,
                    now,
                    now,
                ),
            )
            row = row_to_follow_up_record(
                fetch_one(
                    conn,
                    """
                    SELECT f.*, p.name AS patient_name
                    FROM follow_up_records f
                    JOIN patients p ON p.id = f.patient_id
                    WHERE f.id = ?
                    """,
                    (record_id,),
                )
            )
            insert_audit(conn, user, "create", "follow_up_records", record_id, after=row, study_id=study_id)
            return row
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/follow-up-records/{record_id}")
def update_follow_up_record(record_id: str, payload: FollowUpRecordUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_follow_up_record(
            fetch_one(
                conn,
                """
                SELECT f.*, p.name AS patient_name
                FROM follow_up_records f
                JOIN patients p ON p.id = f.patient_id
                WHERE f.id = ?
                """,
                (record_id,),
            )
        )
        user = authorize(authorization, "follow_up_records", "write", study_id=before["study_id"], conn=conn)
        if not data:
            return before
        if data.get("study_id") and data["study_id"] != before["study_id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="follow-up records cannot move between studies")
        data.pop("study_id", None)
        if data.get("visit_id"):
            visit_scope = visit_patient_scope(conn, data["visit_id"])
            if visit_scope["study_id"] != before["study_id"] or visit_scope["patient_id"] != before["patient_id"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="visit_id does not match patient or study")
        columns = [f"{key} = ?" for key in data]
        values = list(data.values())
        columns.append("updated_at = ?")
        values.extend([utc_now(), record_id])
        try:
            result = conn.execute(f"UPDATE follow_up_records SET {', '.join(columns)} WHERE id = ?", values)
            if result.rowcount == 0:
                raise not_found()
            after = row_to_follow_up_record(
                fetch_one(
                    conn,
                    """
                    SELECT f.*, p.name AS patient_name
                    FROM follow_up_records f
                    JOIN patients p ON p.id = f.patient_id
                    WHERE f.id = ?
                    """,
                    (record_id,),
                )
            )
            insert_audit(conn, user, "update", "follow_up_records", record_id, before=before, after=after, study_id=after["study_id"])
            return after
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/studies/{path_study_id}/omics")
@app.get("/omics")
def list_omics(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    sample_id: str | None = None,
    study_id: str | None = None,
    testing_project_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "omics")
    sql = "SELECT * FROM omics_records"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "omics", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if sample_id:
            where.append("sample_id = ?")
            params.append(sample_id)
        if testing_project_id:
            where.append("testing_project_id = ?")
            params.append(testing_project_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY sent_at DESC"
        rows = [row_to_omics(row) for row in conn.execute(sql, params).fetchall()]
        return apply_field_permissions_to_records(conn, user, rows)


@app.post("/studies/{path_study_id}/omics", status_code=status.HTTP_201_CREATED)
@app.post("/omics", status_code=status.HTTP_201_CREATED)
def create_omics(payload: OmicsCreate, path_study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    record_id = data.pop("id") or f"OMX-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
        if path_study_id and path_study_id != study_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path study_id does not match patient")
        user = authorize(authorization, "omics", "write", study_id=study_id, conn=conn)
        try:
            conn.execute(
                """
                INSERT INTO omics_records
                  (id, study_id, testing_project_id, patient_id, patient_name, sample_id, sample_type, assay, platform, run_id, status, qc, sent_at, completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    study_id,
                    data["testing_project_id"],
                    data["patient_id"],
                    data["patient_name"],
                    data["sample_id"],
                    data["sample_type"],
                    data["assay"],
                    data["platform"],
                    data["run_id"],
                    data["status"],
                    data["qc"],
                    data["sent_at"],
                    data["completed_at"],
                    now,
                    now,
                ),
            )
            row = row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
            insert_audit(conn, user, "create", "omics_records", record_id, after=row, study_id=study_id)
            return row
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/omics/{record_id}")
def get_omics(record_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        try:
            record = row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
            user = authorize(authorization, "omics", "read", study_id=record["study_id"], conn=conn)
            return apply_field_permissions_to_record(conn, user, record)
        except KeyError as exc:
            raise not_found() from exc


@app.put("/omics/{record_id}")
def update_omics(record_id: str, payload: OmicsUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
        user = authorize(authorization, "omics", "write", study_id=before["study_id"], conn=conn)
        if not data:
            return before
        if data.get("patient_id"):
            new_study_id = patient_study_id(conn, data["patient_id"])
            if new_study_id != before["study_id"] and user_role(user) != "LZ_ADMIN":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can move omics records between studies")
            data["study_id"] = new_study_id
        elif "study_id" in data:
            data.pop("study_id")
        columns = [f"{key} = ?" for key in data]
        values = list(data.values())
        columns.append("updated_at = ?")
        values.extend([utc_now(), record_id])
        result = conn.execute(f"UPDATE omics_records SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
        insert_audit(conn, user, "update", "omics_records", record_id, before=before, after=after, study_id=after["study_id"])
        return after


@app.delete("/omics/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_omics(record_id: str, authorization: str | None = Header(default=None)) -> None:
    with connect() as conn:
        record = row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
        authorize(authorization, "omics", "write", study_id=record["study_id"], conn=conn)
        result = conn.execute("DELETE FROM omics_records WHERE id = ?", (record_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/studies/{path_study_id}/consents")
@app.get("/consents")
def list_consents(
    path_study_id: str | None = None,
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "consents")
    sql = """
        SELECT
          c.id,
          c.study_id,
          c.patient_id,
          p.name AS patient_name,
          p.hospital_no,
          p.disease_type,
          c.status,
          c.version,
          c.signed_at,
          c.method
        FROM consents c
        JOIN patients p ON p.id = c.patient_id
    """
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "consents", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "c.study_id", requested_study_id)
        if q:
            where.append("(p.name LIKE ? OR p.hospital_no LIKE ? OR p.disease_type LIKE ?)")
            params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
        if status_filter:
            where.append("c.status = ?")
            params.append(status_filter)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY p.id"
        rows = [row_to_consent(row) for row in conn.execute(sql, params).fetchall()]
        return apply_field_permissions_to_records(conn, user, rows)


@app.put("/consents/{consent_id}")
def update_consent(consent_id: str, payload: ConsentUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    columns = [f"{key} = ?" for key in data]
    values = list(data.values())
    values.append(consent_id)
    with connect() as conn:
        before = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
        user = authorize(authorization, "consents", "write", study_id=before["study_id"], conn=conn)
        if not data:
            return before
        result = conn.execute(f"UPDATE consents SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
        insert_audit(conn, user, "update", "consents", consent_id, before=before, after=after, study_id=before["study_id"])
        joined = conn.execute(
            """
            SELECT
              c.id,
              c.study_id,
              c.patient_id,
              p.name AS patient_name,
              p.hospital_no,
              p.disease_type,
              c.status,
              c.version,
              c.signed_at,
              c.method
            FROM consents c
            JOIN patients p ON p.id = c.patient_id
            WHERE c.id = ?
            """,
            (consent_id,),
        ).fetchone()
        return apply_field_permissions_to_record(conn, user, row_to_consent(joined))


def create_econsent_approval(consent_id: str, approval_type: str, comment: str, authorization: str | None) -> dict[str, Any]:
    approval_id = f"APR-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        consent = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
        actor = authorize(authorization, "consents", "write", study_id=consent["study_id"], conn=conn)
        if consent["status"] in {"撤回审批中", "重签审批中"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="eConsent approval already pending")
        pending_status = "撤回审批中" if approval_type == "econsent_withdrawal" else "重签审批中"
        requested_status = "已撤回" if approval_type == "econsent_withdrawal" else "已重签"
        payload = {
            "consent_id": consent_id,
            "patient_id": consent["patient_id"],
            "requested_status": requested_status,
            "pending_status": pending_status,
            "current_status": consent["status"],
        }
        conn.execute(
            """
            INSERT INTO approval_requests
              (id, study_id, approval_type, status, entity_type, entity_id, payload_json, submitted_by, submitted_at, comment, created_at, updated_at)
            VALUES (?, ?, ?, 'submitted', 'consents', ?, ?, ?, ?, ?, ?, ?)
            """,
            (approval_id, consent["study_id"], approval_type, consent_id, encode_json(payload), actor["id"], now, comment, now, now),
        )
        conn.execute("UPDATE consents SET status = ? WHERE id = ?", (pending_status, consent_id))
        pending_consent = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
        approval = approval_with_actions(conn, approval_id)
        record_approval_action(conn, approval, actor, "submit", "submitted", comment)
        approval = approval_with_actions(conn, approval_id)
        insert_audit(conn, actor, "request_econsent_status_change", "consents", consent_id, before=consent, after=pending_consent, study_id=consent["study_id"])
        insert_audit(conn, actor, "request_econsent_approval", "approval_requests", approval_id, after=approval, study_id=consent["study_id"])
        return approval


@app.post("/consents/{consent_id}/withdrawal-request", status_code=status.HTTP_201_CREATED)
def request_consent_withdrawal(consent_id: str, payload: ApprovalActionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    return create_econsent_approval(consent_id, "econsent_withdrawal", payload.comment or "Request eConsent withdrawal", authorization)


@app.post("/consents/{consent_id}/resign-request", status_code=status.HTTP_201_CREATED)
def request_consent_resign(consent_id: str, payload: ApprovalActionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    return create_econsent_approval(consent_id, "econsent_resign", payload.comment or "Request eConsent re-sign", authorization)


@app.get("/studies/{path_study_id}/crf")
@app.get("/crf")
def list_crf_entries(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    study_id: str | None = None,
    crf_version_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "crf")
    sql = "SELECT * FROM crf_entries"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "crf", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if status_filter:
            where.append("status = ?")
            params.append(status_filter)
        if crf_version_id:
            where.append("crf_version_id = ?")
            params.append(crf_version_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC"
        return [row_to_crf_entry(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/studies/{path_study_id}/crf", status_code=status.HTTP_201_CREATED)
@app.post("/crf", status_code=status.HTTP_201_CREATED)
def create_crf_entry(payload: CrfEntryCreate, path_study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    entry_id = data.pop("id") or f"CRF-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
        if path_study_id and path_study_id != study_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="path study_id does not match patient")
        user = authorize(authorization, "crf", "write", study_id=study_id, conn=conn)
        try:
            crf_version_id = data["crf_version_id"] or conn.execute(
                "SELECT id FROM study_crf_versions WHERE study_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
                (study_id,),
            ).fetchone()
            resolved_crf_version_id = crf_version_id["id"] if hasattr(crf_version_id, "keys") else crf_version_id
            if not resolved_crf_version_id:
                resolved_crf_version_id = "CRFV-LGL-1111-V0.1"
            form_id = data["form_id"] or data["module"]
            payload_jsonb, payload_format, payload_version = sqlite_json_storage(conn, data["payload"])
            conn.execute(
                """
                INSERT INTO crf_entries
                  (id, study_id, patient_id, visit_id, crf_version_id, form_id, module, payload_json, payload_jsonb, payload_version, payload_format, status, completed_by, completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    study_id,
                    data["patient_id"],
                    data["visit_id"],
                    resolved_crf_version_id,
                    form_id,
                    data["module"],
                    encode_json(data["payload"]),
                    payload_jsonb,
                    payload_version,
                    payload_format,
                    data["status"],
                    None,
                    None,
                    now,
                    now,
                ),
            )
            row = row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
            insert_audit(conn, user, "create", "crf_entries", entry_id, after=row, study_id=study_id)
            return row
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/crf/{entry_id}")
def update_crf_entry(entry_id: str, payload: CrfEntryUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
        user = authorize(authorization, "crf", "write", study_id=before["study_id"], conn=conn)
        forbid_locked_crf_update(before, data)
        if data.get("study_id") and data["study_id"] != before["study_id"] and user_role(user) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only LZ_ADMIN can move CRF entries between studies")
        columns: list[str] = []
        values: list[Any] = []
        for key, value in data.items():
            if key == "payload":
                payload_jsonb, payload_format, payload_version = sqlite_json_storage(conn, value)
                columns.extend(["payload_json = ?", "payload_jsonb = ?", "payload_version = ?", "payload_format = ?"])
                values.extend([encode_json(value), payload_jsonb, payload_version, payload_format])
            else:
                columns.append(f"{key} = ?")
                values.append(value)
        if not columns:
            return row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
        columns.append("updated_at = ?")
        values.extend([utc_now(), entry_id])
        result = conn.execute(f"UPDATE crf_entries SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
        insert_audit(conn, user, "update", "crf_entries", entry_id, before=before, after=after, study_id=after["study_id"])
        return after


@app.get("/studies/{path_study_id}/files")
@app.get("/files")
def list_files(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "files")
    sql = "SELECT * FROM uploaded_files"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "files", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY uploaded_at DESC"
        return [row_to_file(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/files", status_code=status.HTTP_201_CREATED)
async def upload_file(
    category: str = Form(...),
    file: UploadFile = File(...),
    patient_id: str | None = Form(default=None),
    sample_id: str | None = Form(default=None),
    omics_id: str | None = Form(default=None),
    consent_id: str | None = Form(default=None),
    uploaded_by: str | None = Form(default=None),
    is_deidentified: bool = Form(default=False),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    allowed_categories = {"consent", "clinical", "sample", "omics_result", "analysis_export", "other"}
    if category not in allowed_categories:
        raise HTTPException(status_code=400, detail="invalid file category")
    if category in {"clinical", "omics_result", "analysis_export"} and not is_deidentified:
        raise HTTPException(status_code=400, detail="file must be marked as deidentified")
    file_id = f"FIL-{uuid4().hex[:10].upper()}"
    content = await file.read()
    digest = hashlib.sha256(content).hexdigest()
    suffix = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    stored_filename = f"{file_id}.{suffix}"
    scan_result = virus_scanner.scan(file.filename or stored_filename, content)
    if scan_result["status"] == "infected":
        raise HTTPException(status_code=400, detail=scan_result["message"])
    now = utc_now()
    with connect() as conn:
        temp_user = authorize(authorization, "files", "write", conn=conn)
        linked_study_ids: list[str] = []
        if patient_id:
            linked_study_ids.append(patient_study_id(conn, patient_id))
        if sample_id:
            sample_row = fetch_one(conn, "SELECT study_id FROM samples WHERE id = ?", (sample_id,))
            linked_study_ids.append(sample_row["study_id"])
        if omics_id:
            omics_row = fetch_one(conn, "SELECT study_id FROM omics_records WHERE id = ?", (omics_id,))
            linked_study_ids.append(omics_row["study_id"])
        if consent_id:
            consent_row = fetch_one(conn, "SELECT study_id FROM consents WHERE id = ?", (consent_id,))
            linked_study_ids.append(consent_row["study_id"])
        unique_linked_studies = set(linked_study_ids)
        if len(unique_linked_studies) > 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="linked file entities must belong to the same study")
        study_id = next(iter(unique_linked_studies), first_accessible_study_id(conn, temp_user) or "LGL-1111")
        user = authorize(authorization, "files", "write", study_id=study_id, conn=conn)
        storage_path = file_storage.save(category, stored_filename, content)
        conn.execute(
            """
            INSERT INTO uploaded_files
              (id, study_id, patient_id, sample_id, omics_id, consent_id, category, original_filename, stored_filename, storage_path, content_type, size_bytes, sha256, uploaded_by, uploaded_at, is_deidentified, storage_backend, scan_status, scan_message, archive_status, archived_at, retention_until)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, NULL)
            """,
            (
                file_id,
                study_id,
                patient_id,
                sample_id,
                omics_id,
                consent_id,
                category,
                file.filename or stored_filename,
                stored_filename,
                str(storage_path),
                file.content_type or "application/octet-stream",
                len(content),
                digest,
                uploaded_by or user["id"],
                now,
                1 if is_deidentified else 0,
                file_storage.backend,
                scan_result["status"],
                scan_result["message"],
            ),
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, study_id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"AUD-{uuid4().hex[:10].upper()}",
                study_id,
                user["id"],
                user_role(user),
                "upload",
                "uploaded_files",
                file_id,
                None,
                encode_json({"category": category, "original_filename": file.filename or stored_filename, "is_deidentified": is_deidentified}),
                None,
                now,
            ),
        )
        return row_to_file(fetch_one(conn, "SELECT * FROM uploaded_files WHERE id = ?", (file_id,)))


@app.get("/files/{file_id}/download")
def download_file(file_id: str, authorization: str | None = Header(default=None)) -> FileResponse:
    with connect() as conn:
        file_row = row_to_file(fetch_one(conn, "SELECT * FROM uploaded_files WHERE id = ?", (file_id,)))
        user = authorize(authorization, "files", "read", study_id=file_row["study_id"], conn=conn)
        if file_row.get("scan_status") not in {None, "", "clean"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="file is not cleared by scanner")
        if file_row.get("archive_status") == "archived":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="file is archived and must be restored before download")
        path = file_storage.path(file_row["storage_path"])
        if not Path(path).exists():
            raise not_found()
        insert_audit(conn, user, "download", "uploaded_files", file_id, after={"filename": file_row["original_filename"], "sha256": file_row["sha256"]}, study_id=file_row["study_id"])
        return FileResponse(path, media_type=file_row["content_type"], filename=file_row["original_filename"])


@app.post("/files/{file_id}/archive")
def archive_file(file_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        file_row = row_to_file(fetch_one(conn, "SELECT * FROM uploaded_files WHERE id = ?", (file_id,)))
        user = authorize(authorization, "files", "write", study_id=file_row["study_id"], conn=conn)
        now = utc_now()
        conn.execute(
            "UPDATE uploaded_files SET archive_status = 'archived', archived_at = ? WHERE id = ?",
            (now, file_id),
        )
        after = row_to_file(fetch_one(conn, "SELECT * FROM uploaded_files WHERE id = ?", (file_id,)))
        insert_audit(conn, user, "archive", "uploaded_files", file_id, before=file_row, after=after, study_id=file_row["study_id"])
        return after


@app.get("/studies/{study_id}/sites")
def list_study_sites(study_id: str, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        authorize(authorization, "studies", "read", study_id=study_id, conn=conn)
        return [row_to_site(row) for row in conn.execute("SELECT * FROM sites WHERE study_id = ? ORDER BY code", (study_id,)).fetchall()]


@app.post("/studies/{study_id}/sites", status_code=status.HTTP_201_CREATED)
def create_study_site(study_id: str, payload: SiteCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    site_id = data["id"] or f"SITE-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        user = authorize(authorization, "studies", "write", study_id=study_id, conn=conn)
        conn.execute(
            """
            INSERT INTO sites (id, study_id, code, name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(study_id, code) DO UPDATE SET name = excluded.name, status = excluded.status, updated_at = excluded.updated_at
            """,
            (site_id, study_id, data["code"], data["name"], data["status"], now, now),
        )
        site = row_to_site(fetch_one(conn, "SELECT * FROM sites WHERE study_id = ? AND code = ?", (study_id, data["code"])))
        insert_audit(conn, user, "upsert", "sites", site["id"], after=site, study_id=study_id)
        return site


@app.post("/studies/{study_id}/sites/{site_id}/users", status_code=status.HTTP_201_CREATED)
def assign_site_user(study_id: str, site_id: str, payload: SiteUserAssign, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    now = utc_now()
    assignment_id = f"SU-{uuid4().hex[:10].upper()}"
    with connect() as conn:
        user = authorize(authorization, "study_members", "write", study_id=study_id, conn=conn)
        fetch_one(conn, "SELECT * FROM sites WHERE id = ? AND study_id = ?", (site_id, study_id))
        fetch_one(conn, "SELECT * FROM users WHERE id = ?", (data["user_id"],))
        conn.execute(
            """
            INSERT INTO site_users (id, study_id, site_id, user_id, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(site_id, user_id) DO UPDATE SET role = excluded.role, status = excluded.status, updated_at = excluded.updated_at
            """,
            (assignment_id, study_id, site_id, data["user_id"], data["role"], data["status"], now, now),
        )
        site_user = row_to_site_user(fetch_one(conn, "SELECT * FROM site_users WHERE site_id = ? AND user_id = ?", (site_id, data["user_id"])))
        insert_audit(conn, user, "assign", "site_users", site_user["id"], after=site_user, study_id=study_id)
        return site_user


@app.get("/studies/{path_study_id}/queries")
@app.get("/queries")
def list_data_queries(
    path_study_id: str | None = None,
    study_id: str | None = None,
    patient_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    field_name: str | None = None,
    assigned_to: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "queries")
    sql = "SELECT * FROM data_queries"
    where: list[str] = []
    params: list[Any] = []
    with connect() as conn:
        user = authorize(authorization, "quality", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if status_filter:
            where.append("status = ?")
            params.append(status_filter)
        if field_name:
            where.append("field_name = ?")
            params.append(field_name)
        if assigned_to:
            where.append("assigned_to = ?")
            params.append(assigned_to)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC"
        return [row_to_data_query(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/queries", status_code=status.HTTP_201_CREATED)
def create_data_query(payload: DataQueryCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    query_id = f"QRY-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        user = authorize(authorization, "quality", "write", study_id=data["study_id"], conn=conn)
        if patient_study_id(conn, data["patient_id"]) != data["study_id"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="patient does not belong to study")
        if data.get("visit_id"):
            visit_scope = visit_patient_scope(conn, data["visit_id"])
            if visit_scope["study_id"] != data["study_id"] or visit_scope["patient_id"] != data["patient_id"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="visit_id does not match patient or study")
        validate_data_query_field(conn, data)
        conn.execute(
            """
            INSERT INTO data_queries
              (id, study_id, patient_id, visit_id, form_id, field_name, title, description, status, assigned_to, created_by, response, created_at, updated_at, closed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, '', ?, ?, NULL)
            """,
            (query_id, data["study_id"], data["patient_id"], data["visit_id"], data["form_id"], data["field_name"], data["title"], data["description"], data["assigned_to"], user["id"], now, now),
        )
        query = row_to_data_query(fetch_one(conn, "SELECT * FROM data_queries WHERE id = ?", (query_id,)))
        insert_audit(conn, user, "create", "data_queries", query_id, after=query, study_id=data["study_id"])
        return query


@app.put("/queries/{query_id}")
def update_data_query(query_id: str, payload: DataQueryUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload, exclude_unset=True)
    with connect() as conn:
        before = row_to_data_query(fetch_one(conn, "SELECT * FROM data_queries WHERE id = ?", (query_id,)))
        user = authorize(authorization, "quality", "write", study_id=before["study_id"], conn=conn)
        columns: list[str] = []
        values: list[Any] = []
        for key, value in data.items():
            columns.append(f"{key} = ?")
            values.append(value)
        if data.get("status") == "closed":
            columns.append("closed_at = ?")
            values.append(utc_now())
        elif data.get("status") in {"open", "answered"}:
            columns.append("closed_at = ?")
            values.append(None)
        columns.append("updated_at = ?")
        values.extend([utc_now(), query_id])
        conn.execute(f"UPDATE data_queries SET {', '.join(columns)} WHERE id = ?", values)
        after = row_to_data_query(fetch_one(conn, "SELECT * FROM data_queries WHERE id = ?", (query_id,)))
        insert_audit(conn, user, "update", "data_queries", query_id, before=before, after=after, study_id=after["study_id"])
        return after


@app.get("/studies/{path_study_id}/analytics/summary")
@app.get("/analytics/summary")
def analytics_summary(path_study_id: str | None = None, study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "analytics")
    with connect() as conn:
        user = authorize(authorization, "patients", "read", study_id=requested_study_id, conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        patient_filter = " WHERE " + " AND ".join(where) if where else ""
        patient_rows = [row_to_patient(row) for row in conn.execute(f"SELECT * FROM patients{patient_filter}", params).fetchall()]
        patient_ids = [patient["id"] for patient in patient_rows]
        patient_placeholders = ", ".join("?" for _ in patient_ids)
        scoped_patient_clause = f"patient_id IN ({patient_placeholders})" if patient_ids else "1 = 0"
        disease_distribution = {
            row["disease_type"]: row["count"]
            for row in conn.execute(f"SELECT disease_type, COUNT(*) AS count FROM patients{patient_filter} GROUP BY disease_type", params).fetchall()
        }
        completeness_values = []
        for patient in patient_rows:
            payload = patient["clinical_data"]
            value = payload.get("数据完整度", 0)
            completeness_values.append(float(value) if isinstance(value, (int, float)) else 0.0)
        omics_count = conn.execute(f"SELECT COUNT(*) AS count FROM omics_records WHERE {scoped_patient_clause}", patient_ids).fetchone()["count"]
        patient_count = len(patient_rows)
        visit_count = conn.execute(f"SELECT COUNT(*) AS count FROM visits WHERE {scoped_patient_clause}", patient_ids).fetchone()["count"]
        crf_count = conn.execute(f"SELECT COUNT(*) AS count FROM crf_entries WHERE {scoped_patient_clause}", patient_ids).fetchone()["count"]
        consent_signed_count = conn.execute(f"SELECT COUNT(*) AS count FROM consents WHERE status = '已签署' AND {scoped_patient_clause}", patient_ids).fetchone()["count"]
        sample_patient_count = conn.execute(f"SELECT COUNT(DISTINCT patient_id) AS count FROM samples WHERE {scoped_patient_clause}", patient_ids).fetchone()["count"]
        active_patient_count = conn.execute(f"SELECT COUNT(*) AS count FROM patients{patient_filter}{' AND' if where else ' WHERE'} disease_type != 'HC'", params).fetchone()["count"]
        completed_patient_count = conn.execute(
            f"""
            SELECT COUNT(*) AS count
            FROM patients p
            WHERE {' AND '.join([condition.replace('study_id', 'p.study_id') for condition in where]) if where else '1 = 1'}
              AND
              EXISTS (
                SELECT 1 FROM omics_records o
                WHERE o.patient_id = p.id AND o.status = '结果归档'
              )
            """,
            params,
        ).fetchone()["count"]
        sample_count = conn.execute(f"SELECT COUNT(*) AS count FROM samples WHERE {scoped_patient_clause}", patient_ids).fetchone()["count"]
        completed_omics_count = conn.execute(
            f"SELECT COUNT(*) AS count FROM omics_records WHERE status = '结果归档' AND {scoped_patient_clause}",
            patient_ids,
        ).fetchone()["count"]
        return {
            "patient_count": patient_count,
            "disease_distribution": disease_distribution,
            "sample_count": sample_count,
            "omics_count": omics_count,
            "completed_omics_count": completed_omics_count,
            "data_completeness_avg": round(sum(completeness_values) / len(completeness_values), 1) if completeness_values else 0,
            "visit_count": visit_count,
            "crf_count": crf_count,
            "consent_signed_count": consent_signed_count,
            "sample_patient_count": sample_patient_count,
            "active_patient_count": active_patient_count,
            "completed_patient_count": completed_patient_count,
        }


@app.get("/studies/{path_study_id}/quality/issues")
@app.get("/quality/issues")
def list_quality_issues(
    path_study_id: str | None = None,
    patient_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "quality_issues")
    sql = "SELECT * FROM data_quality_issues"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "quality", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if status_filter:
            where.append("status = ?")
            params.append(status_filter)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC"
        return [row_to_quality_issue(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/studies/{path_study_id}/quality/run")
@app.post("/quality/run")
def run_quality_checks(path_study_id: str | None = None, study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "quality_run")
    now = utc_now()
    issue_rows: list[tuple[Any, ...]] = []
    with connect() as conn:
        user = authorize(authorization, "quality", "write", study_id=requested_study_id, conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        sql = "SELECT * FROM patients"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id"
        patients = [row_to_patient(row) for row in conn.execute(sql, params).fetchall()]
        patient_ids = [patient["id"] for patient in patients]
        for patient in patients:
            clinical_data = patient["clinical_data"]
            completeness = clinical_data.get("数据完整度", 0)
            try:
                completeness_value = float(completeness)
            except (TypeError, ValueError):
                completeness_value = 0
            sample_count = conn.execute("SELECT COUNT(*) AS count FROM samples WHERE patient_id = ?", (patient["id"],)).fetchone()["count"]
            consent = conn.execute("SELECT status FROM consents WHERE patient_id = ? ORDER BY id LIMIT 1", (patient["id"],)).fetchone()
            if completeness_value < 80:
                issue_rows.append(
                    (
                        f"DQI-{uuid4().hex[:10].upper()}",
                        patient["study_id"],
                        patient["id"],
                        "patients",
                        patient["id"],
                        "clinical_data.数据完整度",
                        "warning",
                        f"临床数据完整度低于 80%：{completeness_value:.0f}%",
                        "open",
                        now,
                        None,
                    )
                )
            if sample_count == 0 and patient["disease_type"] != "HC":
                issue_rows.append(
                    (
                        f"DQI-{uuid4().hex[:10].upper()}",
                        patient["study_id"],
                        patient["id"],
                        "samples",
                        patient["id"],
                        "sample_count",
                        "critical",
                        "非 HC 患者缺少样本登记",
                        "open",
                        now,
                        None,
                    )
                )
            if consent is None or consent["status"] != "已签署":
                issue_rows.append(
                    (
                        f"DQI-{uuid4().hex[:10].upper()}",
                        patient["study_id"],
                        patient["id"],
                        "consents",
                        patient["id"],
                        "status",
                        "warning",
                        "知情同意未签署或已撤回",
                        "open",
                        now,
                        None,
                    )
                )
        visit_rows = [
            row_to_visit(row)
            for row in conn.execute(
                """
                SELECT
                  v.id,
                  v.study_id,
                  v.patient_id,
                  v.visit_plan_id,
                  svp.code AS visit_plan_code,
                  svp.day_offset AS plan_day_offset,
                  svp.window_before_days,
                  svp.window_after_days,
                  p.name AS patient_name,
                  v.visit,
                  v.visit_date,
                  v.visit_type,
                  v.sle_dai,
                  v.medication,
                  v.sample_collection,
                  v.completeness,
                  v.status
                FROM visits v
                JOIN patients p ON p.id = v.patient_id
                LEFT JOIN study_visit_plans svp ON svp.id = v.visit_plan_id
                WHERE v.patient_id IN ({})
                """.format(", ".join("?" for _ in patient_ids) if patient_ids else "NULL"),
                patient_ids,
            ).fetchall()
        ]
        baseline_by_patient: dict[str, date] = {}
        for visit in visit_rows:
            visit_date = parse_iso_date(visit.get("visit_date"))
            if not visit_date:
                continue
            current = baseline_by_patient.get(visit["patient_id"])
            if current is None or visit_date < current:
                baseline_by_patient[visit["patient_id"]] = visit_date
        for visit in visit_rows:
            if visit.get("visit_plan_id") is None or visit.get("plan_day_offset") is None:
                continue
            baseline_date = baseline_by_patient.get(visit["patient_id"])
            actual_date = parse_iso_date(visit.get("visit_date"))
            if not baseline_date or not actual_date:
                continue
            target_date = baseline_date + timedelta(days=int(visit.get("plan_day_offset") or 0))
            earliest = target_date - timedelta(days=int(visit.get("window_before_days") or 0))
            latest = target_date + timedelta(days=int(visit.get("window_after_days") or 0))
            if actual_date < earliest or actual_date > latest:
                issue_rows.append(
                    (
                        f"DQI-{uuid4().hex[:10].upper()}",
                        visit["study_id"],
                        visit["patient_id"],
                        "visits",
                        visit["id"],
                        "visit_date",
                        "warning",
                        f"访视 {visit['visit_plan_code'] or visit['visit']} 超出计划窗：目标 {target_date.isoformat()}，允许 {earliest.isoformat()} 至 {latest.isoformat()}，实际 {actual_date.isoformat()}",
                        "open",
                        now,
                        None,
                    )
                )
        delete_where = ["status = 'open'"]
        delete_params: list[Any] = []
        append_study_filter(conn, user, delete_where, delete_params, "study_id", requested_study_id)
        conn.execute("DELETE FROM data_quality_issues WHERE " + " AND ".join(delete_where), delete_params)
        conn.executemany(
            """
            INSERT INTO data_quality_issues
              (id, study_id, patient_id, source_table, source_id, field_name, severity, message, status, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            issue_rows,
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, study_id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"AUD-{uuid4().hex[:10].upper()}",
                requested_study_id,
                user["id"],
                user_role(user),
                "quality_run",
                "data_quality_issues",
                "open",
                None,
                encode_json({"created": len(issue_rows)}),
                None,
                now,
            ),
        )
    return {"status": "completed", "created": len(issue_rows)}


@app.post("/exports", status_code=status.HTTP_201_CREATED)
def create_export_job(payload: ExportJobCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    export_id = f"EXP-{uuid4().hex[:8].upper()}"
    file_id = f"FIL-{uuid4().hex[:10].upper()}"
    now = utc_now()
    export_dir = UPLOADS_DIR / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    export_path = export_dir / f"{export_id}.csv"
    with connect() as conn:
        temp_user = authorize(authorization, "exports", "write", conn=conn)
        requested_study_id = require_study_context(str(data["scope"].get("study_id") or ""), "exports")
        user = authorize(authorization, "exports", "write", study_id=requested_study_id, conn=conn)
        patient_rows = [
            apply_field_permissions_to_record(conn, user, row_to_patient(row), mode="export")
            for row in conn.execute(
                "SELECT * FROM patients WHERE study_id = ? ORDER BY id",
                (requested_study_id,),
            ).fetchall()
        ]
        with export_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["study_id", "id", "name", "hospital_no", "sex", "age", "disease_type", "note"])
            writer.writerows(
                [
                    (
                        row["study_id"],
                        row["id"],
                        row["name"],
                        row["hospital_no"],
                        row["sex"],
                        row["age"],
                        row["disease_type"],
                        row["note"],
                    )
                    for row in patient_rows
                ]
            )
        content = export_path.read_bytes()
        conn.execute(
            """
            INSERT INTO uploaded_files
              (id, study_id, category, original_filename, stored_filename, storage_path, content_type, size_bytes, sha256, uploaded_by, uploaded_at, is_deidentified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                file_id,
                requested_study_id,
                "analysis_export",
                export_path.name,
                export_path.name,
                str(export_path),
                "text/csv",
                len(content),
                hashlib.sha256(content).hexdigest(),
                data["requested_by"] or user["id"],
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO export_jobs (id, study_id, requested_by, export_type, scope_json, status, file_id, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?)
            """,
            (export_id, requested_study_id, data["requested_by"] or user["id"], data["export_type"], encode_json({**data["scope"], "study_id": requested_study_id}), file_id, now, now),
        )
        job = row_to_export_job(fetch_one(conn, "SELECT * FROM export_jobs WHERE id = ?", (export_id,)))
        insert_audit(conn, user, "export", "export_jobs", export_id, after=job, study_id=requested_study_id)
        return job


@app.get("/studies/{path_study_id}/approvals")
@app.get("/approvals")
def list_approvals(
    path_study_id: str | None = None,
    study_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "approvals")
    with connect() as conn:
        user = authorize(authorization, "studies", "read", study_id=requested_study_id, conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if status_filter:
            where.append("status = ?")
            params.append(status_filter)
        sql = "SELECT * FROM approval_requests"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC"
        approvals = [row_to_approval_request(row) for row in conn.execute(sql, params).fetchall()]
        for approval in approvals:
            approval["actions"] = [
                row_to_approval_action(row)
                for row in conn.execute("SELECT * FROM approval_actions WHERE approval_id = ? ORDER BY created_at", (approval["id"],)).fetchall()
            ]
        return approvals


@app.post("/approvals", status_code=status.HTTP_201_CREATED)
def create_approval(payload: ApprovalRequestCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    approval_id = f"APR-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        resource = approval_write_resource(data["approval_type"])
        actor = authorize(authorization, resource, "write", study_id=data["study_id"], conn=conn)
        initial_status = "submitted" if data["submit"] else "draft"
        conn.execute(
            """
            INSERT INTO approval_requests
              (id, study_id, approval_type, status, entity_type, entity_id, payload_json, submitted_by, submitted_at, comment, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                approval_id,
                data["study_id"],
                data["approval_type"],
                initial_status,
                data["entity_type"],
                data["entity_id"],
                encode_json(data["payload"]),
                actor["id"],
                now if initial_status == "submitted" else None,
                data["comment"],
                now,
                now,
            ),
        )
        approval = approval_with_actions(conn, approval_id)
        record_approval_action(conn, approval, actor, "submit" if initial_status == "submitted" else "draft", initial_status, data["comment"])
        approval = approval_with_actions(conn, approval_id)
        insert_audit(conn, actor, "submit_approval", "approval_requests", approval_id, after=approval, study_id=data["study_id"])
        return approval


@app.post("/approvals/{approval_id}/approve")
def approve_approval(approval_id: str, payload: ApprovalActionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        approval = approval_with_actions(conn, approval_id)
        actor = authorize(authorization, approval_write_resource(approval["approval_type"]), "write", study_id=approval["study_id"], conn=conn)
        if approval["status"] != "submitted":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="approval must be submitted")
        if approval.get("submitted_by") == actor["id"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="requester cannot approve own request")
        record_approval_action(conn, approval, actor, "approve", "approved", payload.comment)
        after = approval_with_actions(conn, approval_id)
        insert_audit(conn, actor, "approve", "approval_requests", approval_id, before=approval, after=after, study_id=approval["study_id"])
        return after


@app.post("/approvals/{approval_id}/reject")
def reject_approval(approval_id: str, payload: ApprovalActionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        approval = approval_with_actions(conn, approval_id)
        actor = authorize(authorization, approval_write_resource(approval["approval_type"]), "write", study_id=approval["study_id"], conn=conn)
        if approval["status"] != "submitted":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="approval must be submitted")
        record_approval_action(conn, approval, actor, "reject", "rejected", payload.comment)
        after = approval_with_actions(conn, approval_id)
        insert_audit(conn, actor, "reject", "approval_requests", approval_id, before=approval, after=after, study_id=approval["study_id"])
        return after


@app.post("/approvals/{approval_id}/cancel")
def cancel_approval(approval_id: str, payload: ApprovalActionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        approval = approval_with_actions(conn, approval_id)
        actor = authorize(authorization, "studies", "read", study_id=approval["study_id"], conn=conn)
        if approval["status"] not in {"draft", "submitted"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="approval cannot be cancelled")
        if approval.get("submitted_by") != actor["id"] and user_role(actor) != "LZ_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only requester or LZ_ADMIN can cancel")
        record_approval_action(conn, approval, actor, "cancel", "cancelled", payload.comment)
        after = approval_with_actions(conn, approval_id)
        insert_audit(conn, actor, "cancel", "approval_requests", approval_id, before=approval, after=after, study_id=approval["study_id"])
        return after


@app.post("/approvals/{approval_id}/complete")
def complete_approval(approval_id: str, payload: ApprovalActionCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        approval = approval_with_actions(conn, approval_id)
        actor = authorize(authorization, approval_write_resource(approval["approval_type"]), "write", study_id=approval["study_id"], conn=conn)
        if approval["status"] != "approved":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="approval must be approved")
        if approval["approval_type"] in {"econsent_withdrawal", "econsent_resign"}:
            consent_id = approval["entity_id"]
            before_consent = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
            next_status = "已撤回" if approval["approval_type"] == "econsent_withdrawal" else "已重签"
            signed_at = "-" if approval["approval_type"] == "econsent_withdrawal" else utc_now()
            method = "-" if approval["approval_type"] == "econsent_withdrawal" else "电子"
            conn.execute(
                "UPDATE consents SET status = ?, signed_at = ?, method = ? WHERE id = ?",
                (next_status, signed_at, method, consent_id),
            )
            after_consent = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
            insert_audit(conn, actor, "apply_econsent_approval", "consents", consent_id, before=before_consent, after=after_consent, study_id=approval["study_id"])
        record_approval_action(conn, approval, actor, "complete", "completed", payload.comment)
        after = approval_with_actions(conn, approval_id)
        insert_audit(conn, actor, "complete", "approval_requests", approval_id, before=approval, after=after, study_id=approval["study_id"])
        return after


@app.get("/studies/{path_study_id}/exports")
@app.get("/exports")
def list_export_jobs(path_study_id: str | None = None, study_id: str | None = None, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "exports")
    with connect() as conn:
        user = authorize(authorization, "exports", "read", study_id=requested_study_id, conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        sql = "SELECT * FROM export_jobs"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC"
        return [row_to_export_job(row) for row in conn.execute(sql, params).fetchall()]


@app.get("/exports/{export_id}/download")
def download_export(export_id: str, authorization: str | None = Header(default=None)) -> FileResponse:
    with connect() as conn:
        try:
            job = row_to_export_job(fetch_one(conn, "SELECT * FROM export_jobs WHERE id = ?", (export_id,)))
            authorize(authorization, "exports", "read", study_id=job["study_id"], conn=conn)
            file_row = row_to_file(fetch_one(conn, "SELECT * FROM uploaded_files WHERE id = ?", (job["file_id"],)))
        except KeyError as exc:
            raise not_found() from exc
    path = file_storage.path(file_row["storage_path"])
    if not Path(path).exists():
        raise not_found()
    return FileResponse(path, media_type=file_row["content_type"], filename=file_row["original_filename"])


@app.post("/imports/patients", status_code=status.HTTP_201_CREATED)
async def import_patients(
    file: UploadFile = File(...),
    study_id: str = Form(default="LGL-1111"),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    required = {"name", "hospital_no", "sex", "age", "disease_type"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail="CSV must include name,hospital_no,sex,age,disease_type")
    now = utc_now()
    imported = 0
    with connect() as conn:
        user = authorize(authorization, "patients", "write", study_id=study_id, conn=conn)
        for row in reader:
            patient_id = row.get("id") or f"PAT-IMP-{uuid4().hex[:6].upper()}"
            organs = [item.strip() for item in (row.get("organs") or "").replace("/", "、").split("、") if item.strip()]
            clinical_data = {
                "患者编号": row["name"],
                "姓名": row["name"],
                "住院号": row["hospital_no"],
                "性别": row["sex"],
                "年龄": int(row["age"]),
                "疾病类型": row["disease_type"],
                "受累脏器": "、".join(organs),
                "CRF版本": row.get("crf_version") or "V0.1",
                "数据完整度": 70,
            }
            clinical_data_jsonb, clinical_data_format, clinical_data_version = sqlite_json_storage(conn, clinical_data)
            conn.execute(
                """
                INSERT INTO patients
                  (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, clinical_data_jsonb, clinical_data_version, clinical_data_format, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  study_id = excluded.study_id,
                  name = excluded.name,
                  hospital_no = excluded.hospital_no,
                  sex = excluded.sex,
                  age = excluded.age,
                  disease_type = excluded.disease_type,
                  organs_json = excluded.organs_json,
                  note = excluded.note,
                  clinical_data_json = excluded.clinical_data_json,
                  clinical_data_jsonb = excluded.clinical_data_jsonb,
                  clinical_data_version = excluded.clinical_data_version,
                  clinical_data_format = excluded.clinical_data_format,
                  updated_at = excluded.updated_at
                """,
                (
                    patient_id,
                    study_id,
                    row["name"],
                    row["hospital_no"],
                    row["sex"],
                    int(row["age"]),
                    row["disease_type"],
                    encode_json(organs),
                    row.get("note") or "CSV 导入",
                    encode_json(clinical_data),
                    clinical_data_jsonb,
                    clinical_data_version,
                    clinical_data_format,
                    now,
                    now,
                ),
            )
            imported += 1
        conn.execute(
            """
            INSERT INTO audit_logs (id, study_id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"AUD-{uuid4().hex[:10].upper()}",
                study_id,
                user["id"],
                user_role(user),
                "import",
                "patients",
                file.filename or "patients.csv",
                None,
                encode_json({"imported": imported}),
                None,
                now,
            ),
        )
    return {"status": "imported", "count": imported}


@app.get("/studies/{path_study_id}/audit-logs")
@app.get("/audit-logs")
def list_audit_logs(
    path_study_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    requested_study_id = scoped_study_id(path_study_id, study_id, "audit_logs")
    sql = "SELECT * FROM audit_logs"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "audit", "read", study_id=requested_study_id, conn=conn)
        append_study_filter(conn, user, where, params, "study_id", requested_study_id)
        if entity_type:
            where.append("entity_type = ?")
            params.append(entity_type)
        if entity_id:
            where.append("entity_id = ?")
            params.append(entity_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at DESC"
        return [row_to_audit_log(row) for row in conn.execute(sql, params).fetchall()]


@app.get("/patients/{patient_id}/panorama")
def patient_panorama(patient_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        try:
            patient = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
            user = authorize(authorization, "patients", "read", study_id=patient["study_id"], conn=conn)
        except KeyError as exc:
            raise not_found() from exc
        sample_rows = [row_to_sample(row) for row in conn.execute("SELECT * FROM samples WHERE patient_id = ? ORDER BY collected_at", (patient_id,)).fetchall()]
        omics_rows = [row_to_omics(row) for row in conn.execute("SELECT * FROM omics_records WHERE patient_id = ? ORDER BY sent_at", (patient_id,)).fetchall()]
        consents = [dict(row) for row in conn.execute("SELECT * FROM consents WHERE patient_id = ?", (patient_id,)).fetchall()]
        visit_rows = [
            row_to_visit(row)
            for row in conn.execute(
                """
                SELECT
                  v.*,
                  p.name AS patient_name,
                  svp.code AS visit_plan_code,
                  svp.day_offset AS plan_day_offset,
                  svp.window_before_days,
                  svp.window_after_days
                FROM visits v
                JOIN patients p ON p.id = v.patient_id
                LEFT JOIN study_visit_plans svp ON svp.id = v.visit_plan_id
                WHERE v.patient_id = ?
                ORDER BY v.visit_date
                """,
                (patient_id,),
            ).fetchall()
        ]
        follow_up_rows = [
            row_to_follow_up_record(row)
            for row in conn.execute(
                """
                SELECT f.*, p.name AS patient_name
                FROM follow_up_records f
                JOIN patients p ON p.id = f.patient_id
                WHERE f.patient_id = ?
                ORDER BY f.follow_up_date, f.recorded_at
                """,
                (patient_id,),
            ).fetchall()
        ]
        crf_rows = [row_to_crf_entry(row) for row in conn.execute("SELECT * FROM crf_entries WHERE patient_id = ? ORDER BY updated_at", (patient_id,)).fetchall()]
        file_rows = [row_to_file(row) for row in conn.execute("SELECT * FROM uploaded_files WHERE patient_id = ? ORDER BY uploaded_at", (patient_id,)).fetchall()]
        quality_rows = [row_to_quality_issue(row) for row in conn.execute("SELECT * FROM data_quality_issues WHERE patient_id = ? ORDER BY created_at", (patient_id,)).fetchall()]
        return {
            "patient": apply_field_permissions_to_record(conn, user, patient),
            "samples": apply_field_permissions_to_records(conn, user, sample_rows),
            "omics_records": apply_field_permissions_to_records(conn, user, omics_rows),
            "consents": consents,
            "visits": apply_field_permissions_to_records(conn, user, visit_rows),
            "follow_up_records": apply_field_permissions_to_records(conn, user, follow_up_rows),
            "crf_entries": crf_rows,
            "files": file_rows,
            "quality_issues": quality_rows,
            "summary": {
                "sample_count": len(sample_rows),
                "omics_count": len(omics_rows),
                "completed_omics_count": len([record for record in omics_rows if record["status"] == "结果归档"]),
                "latest_visit": visit_rows[-1]["visit"] if visit_rows else None,
            },
        }


@app.get("/patients/{patient_id}/journey")
def patient_journey(patient_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    return patient_panorama(patient_id, authorization)
