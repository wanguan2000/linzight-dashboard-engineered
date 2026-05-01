from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).with_name("linzight_demo.db")
DEFAULT_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR = Path(os.getenv("LINZIGHT_UPLOADS_DIR", str(DEFAULT_UPLOADS_DIR))).expanduser()
SQLITE_DATABASE_URL = f"sqlite:///{DB_PATH}"
POSTGRES_DATABASE_URL = os.getenv("LINZIGHT_POSTGRES_URL", "postgresql://linzight:linzight@localhost:5432/linzight")
DATABASE_URL = os.getenv("LINZIGHT_DATABASE_URL", SQLITE_DATABASE_URL)

ROLE_VALUES = ("sys_admin", "project_admin", "investigator", "crc", "data_manager", "viewer")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    if not DATABASE_URL.startswith("sqlite:///"):
        raise RuntimeError(
            "Only SQLite is active in the demo runtime. "
            "Set LINZIGHT_DATABASE_URL to sqlite:///... or use LINZIGHT_POSTGRES_URL as the retained PostgreSQL config."
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_schema() -> None:
    with connect() as conn:
        conn.executescript(
            """
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
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS samples (
              id TEXT PRIMARY KEY,
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
              patient_id TEXT NOT NULL,
              status TEXT NOT NULL,
              version TEXT NOT NULL,
              signed_at TEXT NOT NULL DEFAULT '-',
              method TEXT NOT NULL DEFAULT '-',
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS visits (
              id TEXT PRIMARY KEY,
              patient_id TEXT NOT NULL,
              visit TEXT NOT NULL,
              visit_date TEXT NOT NULL,
              visit_type TEXT NOT NULL,
              sle_dai TEXT NOT NULL,
              medication TEXT NOT NULL,
              sample_collection TEXT NOT NULL,
              completeness INTEGER NOT NULL,
              status TEXT NOT NULL,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('sys_admin', 'project_admin', 'investigator', 'crc', 'data_manager', 'viewer')),
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

            CREATE TABLE IF NOT EXISTS crf_entries (
              id TEXT PRIMARY KEY,
              patient_id TEXT NOT NULL,
              visit_id TEXT,
              module TEXT NOT NULL,
              payload_json TEXT NOT NULL DEFAULT '{}',
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
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE,
              FOREIGN KEY (omics_id) REFERENCES omics_records(id) ON DELETE CASCADE,
              FOREIGN KEY (consent_id) REFERENCES consents(id) ON DELETE CASCADE,
              FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS export_jobs (
              id TEXT PRIMARY KEY,
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

            CREATE INDEX IF NOT EXISTS idx_patients_disease_type ON patients(disease_type);
            CREATE INDEX IF NOT EXISTS idx_samples_patient_id ON samples(patient_id);
            CREATE INDEX IF NOT EXISTS idx_omics_patient_id ON omics_records(patient_id);
            CREATE INDEX IF NOT EXISTS idx_crf_entries_patient_id ON crf_entries(patient_id);
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_patient_id ON uploaded_files(patient_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_quality_patient_status ON data_quality_issues(patient_id, status);
            """
        )
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def encode_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def decode_json(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def row_to_patient(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["organs"] = decode_json(item.pop("organs_json"), [])
    item["clinical_data"] = decode_json(item.pop("clinical_data_json"), {})
    return item


def row_to_sample(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["linked_omics"] = decode_json(item.pop("linked_omics_json"), [])
    return item


def row_to_omics(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_visit(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_consent(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_user(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item.pop("password_hash", None)
    return item


def row_to_crf_entry(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["payload"] = decode_json(item.pop("payload_json"), {})
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
