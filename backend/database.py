from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

try:
    from .permissions import ROLE_VALUES, normalize_role_code
except ImportError:  # Allows `cd backend && uvicorn main:app`.
    from permissions import ROLE_VALUES, normalize_role_code

DB_PATH = Path(__file__).with_name("linzight_demo.db")
DEFAULT_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR = Path(os.getenv("LINZIGHT_UPLOADS_DIR", str(DEFAULT_UPLOADS_DIR))).expanduser()
SQLITE_DATABASE_URL = f"sqlite:///{DB_PATH}"
POSTGRES_DATABASE_URL = os.getenv("LINZIGHT_POSTGRES_URL", "postgresql://linzight:linzight@localhost:5432/linzight")
DATABASE_URL = os.getenv("LINZIGHT_DATABASE_URL", SQLITE_DATABASE_URL)


def sqlite_database_path(database_url: str = DATABASE_URL) -> Path:
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError(
            "Only SQLite is active in the demo runtime. "
            "Set LINZIGHT_DATABASE_URL to sqlite:///... or use LINZIGHT_POSTGRES_URL as the retained PostgreSQL config."
        )
    raw_path = unquote(database_url.replace("sqlite:///", "", 1))
    return Path(raw_path).expanduser()

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    db_path = sqlite_database_path()
    if db_path.parent and str(db_path.parent) != ".":
        db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_schema() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS studies (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              indication TEXT NOT NULL,
              phase TEXT NOT NULL DEFAULT 'RWD',
              status TEXT NOT NULL DEFAULT 'active',
              owner_org TEXT NOT NULL DEFAULT 'LinZight',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              description TEXT NOT NULL,
              applied_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS patients (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              name TEXT NOT NULL UNIQUE,
              hospital_no TEXT NOT NULL UNIQUE,
              sex TEXT NOT NULL,
              age INTEGER NOT NULL,
              disease_type TEXT NOT NULL,
              organs_json TEXT NOT NULL,
              note TEXT NOT NULL DEFAULT '',
              clinical_data_json TEXT NOT NULL DEFAULT '{}',
              clinical_data_jsonb BLOB,
              clinical_data_version TEXT NOT NULL DEFAULT 'legacy',
              clinical_data_format TEXT NOT NULL DEFAULT 'json',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS study_visit_plans (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              visit_type TEXT NOT NULL,
              day_offset INTEGER NOT NULL DEFAULT 0,
              window_before_days INTEGER NOT NULL DEFAULT 0,
              window_after_days INTEGER NOT NULL DEFAULT 0,
              required_forms_json TEXT NOT NULL DEFAULT '[]',
              required_samples_json TEXT NOT NULL DEFAULT '[]',
              status TEXT NOT NULL DEFAULT 'active',
              sort_order INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (study_id, code),
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS samples (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT NOT NULL,
              patient_name TEXT NOT NULL,
              hospital_no TEXT NOT NULL,
              sample_type TEXT NOT NULL,
              visit TEXT NOT NULL,
              collected_at TEXT NOT NULL,
              storage TEXT NOT NULL,
              status TEXT NOT NULL,
              linked_omics_json TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS omics_records (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              testing_project_id TEXT NOT NULL DEFAULT 'TP-SLE-OMICS',
              patient_id TEXT NOT NULL,
              patient_name TEXT NOT NULL,
              sample_id TEXT NOT NULL,
              sample_type TEXT NOT NULL,
              assay TEXT NOT NULL,
              platform TEXT NOT NULL,
              run_id TEXT NOT NULL,
              status TEXT NOT NULL,
              qc TEXT NOT NULL,
              sent_at TEXT NOT NULL,
              completed_at TEXT NOT NULL DEFAULT '-',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS consents (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT NOT NULL,
              status TEXT NOT NULL,
              version TEXT NOT NULL,
              signed_at TEXT NOT NULL DEFAULT '-',
              method TEXT NOT NULL DEFAULT '-',
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS visits (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT NOT NULL,
              visit_plan_id TEXT,
              visit TEXT NOT NULL,
              visit_date TEXT NOT NULL,
              visit_type TEXT NOT NULL,
              sle_dai TEXT NOT NULL,
              medication TEXT NOT NULL,
              sample_collection TEXT NOT NULL,
              completeness INTEGER NOT NULL,
              status TEXT NOT NULL,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (visit_plan_id) REFERENCES study_visit_plans(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS follow_up_records (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT NOT NULL,
              visit_id TEXT,
              follow_up_date TEXT NOT NULL,
              follow_up_method TEXT NOT NULL,
              followed_by TEXT NOT NULL,
              survival_status TEXT NOT NULL,
              disease_status TEXT NOT NULL,
              symptoms_signs TEXT NOT NULL DEFAULT '',
              imaging_lab_summary TEXT NOT NULL DEFAULT '',
              efficacy_assessment TEXT NOT NULL DEFAULT '',
              metastasis_status TEXT NOT NULL DEFAULT '',
              adverse_events TEXT NOT NULL DEFAULT '',
              quality_of_life TEXT NOT NULL DEFAULT '',
              lost_to_follow_up_reason TEXT NOT NULL DEFAULT '',
              recorded_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'investigator',
              role_code TEXT NOT NULL DEFAULT 'STUDY_PI',
              password_hash TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
              role TEXT NOT NULL,
              resource TEXT NOT NULL,
              action TEXT NOT NULL,
              PRIMARY KEY (role, resource, action)
            );

            CREATE TABLE IF NOT EXISTS field_permissions (
              role TEXT NOT NULL,
              resource TEXT NOT NULL,
              field_name TEXT NOT NULL,
              can_view INTEGER NOT NULL DEFAULT 1,
              can_export INTEGER NOT NULL DEFAULT 1,
              mask_rule TEXT NOT NULL DEFAULT 'none',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (role, resource, field_name)
            );

            CREATE TABLE IF NOT EXISTS crf_entries (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT NOT NULL,
              visit_id TEXT,
              crf_version_id TEXT NOT NULL DEFAULT 'CRFV-LGL-1111-V0.1',
              form_id TEXT NOT NULL DEFAULT 'baseline',
              module TEXT NOT NULL,
              payload_json TEXT NOT NULL DEFAULT '{}',
              payload_jsonb BLOB,
              payload_version TEXT NOT NULL DEFAULT 'legacy',
              payload_format TEXT NOT NULL DEFAULT 'json',
              status TEXT NOT NULL DEFAULT 'draft',
              completed_by TEXT,
              completed_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
              FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS uploaded_files (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT,
              sample_id TEXT,
              omics_id TEXT,
              consent_id TEXT,
              category TEXT NOT NULL,
              original_filename TEXT NOT NULL,
              stored_filename TEXT NOT NULL,
              storage_path TEXT NOT NULL,
              content_type TEXT NOT NULL,
              size_bytes INTEGER NOT NULL,
              sha256 TEXT NOT NULL,
              uploaded_by TEXT,
              uploaded_at TEXT NOT NULL,
              is_deidentified INTEGER NOT NULL DEFAULT 0,
              storage_backend TEXT NOT NULL DEFAULT 'local',
              scan_status TEXT NOT NULL DEFAULT 'pending',
              scan_message TEXT NOT NULL DEFAULT '',
              archive_status TEXT NOT NULL DEFAULT 'active',
              archived_at TEXT,
              retention_until TEXT,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE,
              FOREIGN KEY (omics_id) REFERENCES omics_records(id) ON DELETE CASCADE,
              FOREIGN KEY (consent_id) REFERENCES consents(id) ON DELETE CASCADE,
              FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS export_jobs (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              requested_by TEXT,
              export_type TEXT NOT NULL,
              scope_json TEXT NOT NULL DEFAULT '{}',
              status TEXT NOT NULL DEFAULT 'queued',
              file_id TEXT,
              created_at TEXT NOT NULL,
              completed_at TEXT,
              FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS data_quality_issues (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              patient_id TEXT NOT NULL,
              source_table TEXT NOT NULL,
              source_id TEXT NOT NULL,
              field_name TEXT NOT NULL,
              severity TEXT NOT NULL,
              message TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'open',
              created_at TEXT NOT NULL,
              resolved_at TEXT,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL DEFAULT 'LGL-1111',
              actor_id TEXT,
              actor_role TEXT,
              action TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              before_json TEXT,
              after_json TEXT,
              ip_address TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS study_members (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              study_role TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (study_id, user_id),
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS global_role_study_scope (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              study_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              UNIQUE (user_id, study_id),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS crf_templates (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              version TEXT NOT NULL,
              schema_json TEXT NOT NULL DEFAULT '{}',
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS study_crf_versions (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              template_id TEXT,
              version TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'draft',
              schema_json TEXT NOT NULL DEFAULT '{}',
              change_summary TEXT NOT NULL DEFAULT '',
              created_by TEXT,
              published_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (study_id, version),
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (template_id) REFERENCES crf_templates(id) ON DELETE SET NULL,
              FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS crf_migration_approvals (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              source_version_id TEXT NOT NULL,
              target_version_id TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              preview_json TEXT NOT NULL DEFAULT '{}',
              note TEXT NOT NULL DEFAULT '',
              requested_by TEXT,
              approved_by TEXT,
              requested_at TEXT NOT NULL,
              reviewed_at TEXT,
              applied_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (source_version_id) REFERENCES study_crf_versions(id) ON DELETE CASCADE,
              FOREIGN KEY (target_version_id) REFERENCES study_crf_versions(id) ON DELETE CASCADE,
              FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS crf_migration_execution_logs (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              migration_id TEXT NOT NULL,
              step TEXT NOT NULL,
              status TEXT NOT NULL,
              message TEXT NOT NULL DEFAULT '',
              actor_id TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (migration_id) REFERENCES crf_migration_approvals(id) ON DELETE CASCADE,
              FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS approval_requests (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              approval_type TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'draft',
              entity_type TEXT NOT NULL DEFAULT '',
              entity_id TEXT NOT NULL DEFAULT '',
              payload_json TEXT NOT NULL DEFAULT '{}',
              submitted_by TEXT,
              reviewed_by TEXT,
              submitted_at TEXT,
              reviewed_at TEXT,
              completed_at TEXT,
              comment TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS approval_actions (
              id TEXT PRIMARY KEY,
              approval_id TEXT NOT NULL,
              study_id TEXT NOT NULL,
              actor_id TEXT,
              action TEXT NOT NULL,
              from_status TEXT,
              to_status TEXT NOT NULL,
              comment TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              FOREIGN KEY (approval_id) REFERENCES approval_requests(id) ON DELETE CASCADE,
              FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_patients_disease_type ON patients(disease_type);
            CREATE INDEX IF NOT EXISTS idx_visit_plans_study_id ON study_visit_plans(study_id);
            CREATE INDEX IF NOT EXISTS idx_samples_patient_id ON samples(patient_id);
            CREATE INDEX IF NOT EXISTS idx_omics_patient_id ON omics_records(patient_id);
            CREATE INDEX IF NOT EXISTS idx_follow_up_records_patient_id ON follow_up_records(patient_id);
            CREATE INDEX IF NOT EXISTS idx_crf_entries_patient_id ON crf_entries(patient_id);
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_patient_id ON uploaded_files(patient_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_quality_patient_status ON data_quality_issues(patient_id, status);
            CREATE INDEX IF NOT EXISTS idx_study_members_study_id ON study_members(study_id);
            CREATE INDEX IF NOT EXISTS idx_study_members_user_id ON study_members(user_id);
            CREATE INDEX IF NOT EXISTS idx_crf_migration_approvals_study_id ON crf_migration_approvals(study_id);
            CREATE INDEX IF NOT EXISTS idx_crf_migration_execution_logs_migration_id ON crf_migration_execution_logs(migration_id);
            CREATE INDEX IF NOT EXISTS idx_approval_requests_study_id ON approval_requests(study_id);
            CREATE INDEX IF NOT EXISTS idx_approval_actions_approval_id ON approval_actions(approval_id);
            """
        )
        migrate_study_schema(conn)
        migrate_json_storage(conn)
        seed_default_study(conn)
        seed_default_field_permissions(conn)
        record_schema_version(conn)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def seed_default_field_permissions(conn: sqlite3.Connection) -> None:
    now = utc_now()
    sensitive_fields = [
        ("patients", "name", "name"),
        ("patients", "patient_name", "name"),
        ("patients", "hospital_no", "hospital_no"),
        ("patients", "病历号", "hospital_no"),
        ("patients", "身份证号", "id_card"),
        ("patients", "手机号", "phone"),
        ("patients", "联系电话", "phone"),
        ("patients", "地址", "address"),
        ("patients", "住址", "address"),
    ]
    masked_roles = {"LZ_DATA_MANAGER", "LZ_AUDITOR", "STUDY_DATA_MANAGER"}
    rows = []
    for role in ROLE_VALUES:
        for resource, field_name, mask_rule in sensitive_fields:
            should_mask = role in masked_roles and role != "LZ_ADMIN"
            rows.append((role, resource, field_name, 1, 0 if should_mask else 1, mask_rule if should_mask else "none", now, now))
    conn.executemany(
        """
        INSERT OR IGNORE INTO field_permissions (role, resource, field_name, can_view, can_export, mask_rule, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def record_schema_version(conn: sqlite3.Connection) -> None:
    versions = [
        ("20260512_001_auth_privacy_approvals_files", "Production-demo auth, field privacy, approvals, and file security baseline"),
    ]
    now = utc_now()
    conn.executemany(
        """
        INSERT OR IGNORE INTO schema_migrations (version, description, applied_at)
        VALUES (?, ?, ?)
        """,
        [(version, description, now) for version, description in versions],
    )


def encode_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def sqlite_supports_jsonb(conn: sqlite3.Connection) -> bool:
    try:
        return conn.execute("SELECT typeof(jsonb('{}'))").fetchone()[0] == "blob"
    except sqlite3.Error:
        return False


def json_payload_version(value: Any) -> str:
    if isinstance(value, dict):
        version = value.get("CRF版本") or value.get("crf_version") or value.get("version")
        if version:
            return str(version)
    return "legacy"


def sqlite_json_storage(conn: sqlite3.Connection, value: Any) -> tuple[bytes | str, str, str]:
    json_text = encode_json(value)
    version = json_payload_version(value)
    if sqlite_supports_jsonb(conn):
        return conn.execute("SELECT jsonb(?)", (json_text,)).fetchone()[0], "jsonb", version
    return json_text, "json", version


def migrate_json_storage(conn: sqlite3.Connection) -> None:
    ensure_columns(
        conn,
        "patients",
        [
            ("clinical_data_jsonb", "BLOB"),
            ("clinical_data_version", "TEXT NOT NULL DEFAULT 'legacy'"),
            ("clinical_data_format", "TEXT NOT NULL DEFAULT 'json'"),
        ],
    )
    ensure_columns(
        conn,
        "crf_entries",
        [
            ("payload_jsonb", "BLOB"),
            ("payload_version", "TEXT NOT NULL DEFAULT 'legacy'"),
            ("payload_format", "TEXT NOT NULL DEFAULT 'json'"),
        ],
    )
    ensure_columns(
        conn,
        "uploaded_files",
        [
            ("storage_backend", "TEXT NOT NULL DEFAULT 'local'"),
            ("scan_status", "TEXT NOT NULL DEFAULT 'pending'"),
            ("scan_message", "TEXT NOT NULL DEFAULT ''"),
            ("archive_status", "TEXT NOT NULL DEFAULT 'active'"),
            ("archived_at", "TEXT"),
            ("retention_until", "TEXT"),
        ],
    )

    if sqlite_supports_jsonb(conn):
        conn.execute(
            """
            UPDATE patients
            SET
              clinical_data_jsonb = jsonb(clinical_data_json),
              clinical_data_format = 'jsonb',
              clinical_data_version = COALESCE(json_extract(clinical_data_json, '$."CRF版本"'), clinical_data_version, 'legacy')
            WHERE clinical_data_jsonb IS NULL
            """
        )
        conn.execute(
            """
            UPDATE crf_entries
            SET
              payload_jsonb = jsonb(payload_json),
              payload_format = 'jsonb',
              payload_version = COALESCE(json_extract(payload_json, '$."CRF版本"'), payload_version, 'legacy')
            WHERE payload_jsonb IS NULL
            """
        )
    else:
        conn.execute(
            """
            UPDATE patients
            SET
              clinical_data_jsonb = clinical_data_json,
              clinical_data_format = 'json',
              clinical_data_version = COALESCE(json_extract(clinical_data_json, '$."CRF版本"'), clinical_data_version, 'legacy')
            WHERE clinical_data_jsonb IS NULL
            """
        )
        conn.execute(
            """
            UPDATE crf_entries
            SET
              payload_jsonb = payload_json,
              payload_format = 'json',
              payload_version = COALESCE(json_extract(payload_json, '$."CRF版本"'), payload_version, 'legacy')
            WHERE payload_jsonb IS NULL
            """
        )


def migrate_study_schema(conn: sqlite3.Connection) -> None:
    ensure_columns(conn, "users", [("role_code", "TEXT NOT NULL DEFAULT 'STUDY_PI'")])
    conn.execute(
        """
        UPDATE users
        SET role_code = CASE role
          WHEN 'sys_admin' THEN 'LZ_ADMIN'
          WHEN 'project_admin' THEN 'STUDY_CONFIG_ADMIN'
          WHEN 'investigator' THEN 'STUDY_PI'
          WHEN 'crc' THEN 'STUDY_CRC'
          WHEN 'data_manager' THEN 'STUDY_DATA_MANAGER'
          WHEN 'viewer' THEN 'STUDY_PI'
          ELSE role_code
        END
        WHERE role_code IS NULL
          OR role_code = ''
          OR role_code IN ('sys_admin', 'project_admin', 'investigator', 'crc', 'data_manager', 'viewer')
        """
    )

    ensure_columns(
        conn,
        "samples",
        [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")],
    )
    ensure_columns(
        conn,
        "omics_records",
        [
            ("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"),
            ("testing_project_id", "TEXT NOT NULL DEFAULT 'TP-SLE-OMICS'"),
        ],
    )
    ensure_columns(conn, "consents", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])
    ensure_columns(conn, "visits", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"), ("visit_plan_id", "TEXT")])
    ensure_columns(conn, "follow_up_records", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])
    ensure_columns(
        conn,
        "crf_entries",
        [
            ("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"),
            ("crf_version_id", "TEXT NOT NULL DEFAULT 'CRFV-LGL-1111-V0.1'"),
            ("form_id", "TEXT NOT NULL DEFAULT 'baseline'"),
        ],
    )
    ensure_columns(conn, "uploaded_files", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])
    ensure_columns(conn, "export_jobs", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])
    ensure_columns(conn, "data_quality_issues", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])
    ensure_columns(conn, "audit_logs", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])

    for table in ("samples", "omics_records", "consents", "visits", "follow_up_records", "crf_entries", "uploaded_files", "data_quality_issues"):
        if table == "uploaded_files":
            conn.execute(
                """
                UPDATE uploaded_files
                SET study_id = COALESCE(
                  (SELECT study_id FROM patients WHERE patients.id = uploaded_files.patient_id),
                  study_id,
                  'LGL-1111'
                )
                WHERE patient_id IS NOT NULL
                """
            )
            continue
        conn.execute(
            f"""
            UPDATE {table}
            SET study_id = COALESCE(
              (SELECT study_id FROM patients WHERE patients.id = {table}.patient_id),
              study_id,
              'LGL-1111'
            )
            WHERE patient_id IS NOT NULL
            """
        )
    conn.execute(
        """
        UPDATE crf_entries
        SET
          form_id = COALESCE(NULLIF(form_id, ''), module),
          crf_version_id = CASE
            WHEN study_id = 'RWD-NMO-2026' THEN 'CRFV-RWD-NMO-2026-V1.0'
            WHEN study_id = 'LZXK-01' THEN 'CRFV-LZXK-01-V1.0'
            ELSE 'CRFV-LGL-1111-V0.1'
          END
        """
    )
    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_patients_study_id ON patients(study_id);
        CREATE INDEX IF NOT EXISTS idx_samples_study_id ON samples(study_id);
        CREATE INDEX IF NOT EXISTS idx_omics_study_id ON omics_records(study_id);
        CREATE INDEX IF NOT EXISTS idx_consents_study_id ON consents(study_id);
        CREATE INDEX IF NOT EXISTS idx_visits_study_id ON visits(study_id);
        CREATE INDEX IF NOT EXISTS idx_follow_up_records_study_id ON follow_up_records(study_id);
        CREATE INDEX IF NOT EXISTS idx_follow_up_records_patient_id ON follow_up_records(patient_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_up_records_unique_patient_date_method
          ON follow_up_records(study_id, patient_id, follow_up_date, follow_up_method);
        CREATE INDEX IF NOT EXISTS idx_crf_entries_study_id ON crf_entries(study_id);
        CREATE INDEX IF NOT EXISTS idx_uploaded_files_study_id ON uploaded_files(study_id);
        CREATE INDEX IF NOT EXISTS idx_export_jobs_study_id ON export_jobs(study_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_study_id ON audit_logs(study_id);
        CREATE INDEX IF NOT EXISTS idx_quality_study_id ON data_quality_issues(study_id);
        CREATE INDEX IF NOT EXISTS idx_visit_plans_study_id ON study_visit_plans(study_id);
        CREATE INDEX IF NOT EXISTS idx_visits_visit_plan_id ON visits(visit_plan_id);
        """
    )


def seed_default_study(conn: sqlite3.Connection) -> None:
    now = utc_now()
    conn.execute(
        """
        INSERT OR IGNORE INTO studies (id, code, name, indication, phase, status, owner_org, created_at, updated_at)
        VALUES ('LGL-1111', 'LGL-1111', '免疫相关性神经系统疾病 RWD 研究', 'NPSLE / MS / NMOSD / HC', 'RWD', 'active', 'LinZight', ?, ?)
        """,
        (now, now),
    )


def ensure_columns(conn: sqlite3.Connection, table: str, columns: list[tuple[str, str]]) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, definition in columns:
        if name not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def decode_json(value: str | bytes | bytearray | memoryview | None, default: Any) -> Any:
    if not value:
        return default
    if isinstance(value, (bytes, bytearray, memoryview)):
        return decode_sqlite_jsonb(bytes(value), default)
    return json.loads(value)


def decode_sqlite_jsonb(value: bytes, default: Any) -> Any:
    try:
        with sqlite3.connect(":memory:") as conn:
            json_text = conn.execute("SELECT json(?)", (sqlite3.Binary(value),)).fetchone()[0]
        return json.loads(json_text)
    except (sqlite3.Error, json.JSONDecodeError, UnicodeDecodeError):
        try:
            return json.loads(value.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return default


def row_to_patient(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["organs"] = decode_json(item.pop("organs_json"), [])
    clinical_data_json = item.pop("clinical_data_json", None)
    clinical_data_jsonb = item.pop("clinical_data_jsonb", None)
    clinical_data = decode_json(clinical_data_jsonb if clinical_data_jsonb is not None else clinical_data_json, {})
    item["clinical_data"] = clinical_data
    item["clinical_data_version"] = item.get("clinical_data_version") or json_payload_version(clinical_data)
    item["clinical_data_format"] = item.get("clinical_data_format") or ("jsonb" if clinical_data_jsonb is not None else "json")
    return item


def row_to_sample(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["linked_omics"] = decode_json(item.pop("linked_omics_json"), [])
    return item


def row_to_omics(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_visit(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_study_visit_plan(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["required_forms"] = decode_json(item.pop("required_forms_json"), [])
    item["required_samples"] = decode_json(item.pop("required_samples_json"), [])
    return item


def row_to_follow_up_record(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_consent(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_user(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item.pop("password_hash", None)
    role_code = item.pop("role_code", None)
    item["legacy_role"] = item.get("role")
    item["role"] = normalize_role_code(role_code or item.get("role"))
    return item


def row_to_study(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_study_member(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_crf_version(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["schema"] = decode_json(item.pop("schema_json"), {})
    return item


def row_to_crf_migration_approval(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["preview"] = decode_json(item.pop("preview_json"), {})
    return item


def row_to_approval_request(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["payload"] = decode_json(item.pop("payload_json"), {})
    return item


def row_to_approval_action(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_crf_migration_log(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_crf_entry(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    payload_json = item.pop("payload_json", None)
    payload_jsonb = item.pop("payload_jsonb", None)
    payload = decode_json(payload_jsonb if payload_jsonb is not None else payload_json, {})
    item["payload"] = payload
    item["payload_version"] = item.get("payload_version") or json_payload_version(payload)
    item["payload_format"] = item.get("payload_format") or ("jsonb" if payload_jsonb is not None else "json")
    return item


def row_to_file(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["is_deidentified"] = bool(item["is_deidentified"])
    return item


def row_to_export_job(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["scope"] = decode_json(item.pop("scope_json"), {})
    return item


def row_to_quality_issue(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_audit_log(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["before"] = decode_json(item.pop("before_json"), None)
    item["after"] = decode_json(item.pop("after_json"), None)
    return item


def fetch_one(conn: sqlite3.Connection, query: str, args: tuple[Any, ...]) -> sqlite3.Row:
    row = conn.execute(query, args).fetchone()
    if row is None:
        raise KeyError("record not found")
    return row
