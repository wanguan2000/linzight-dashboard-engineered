from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).with_name("linzight_demo.db")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
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
            """
        )


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


def fetch_one(conn: sqlite3.Connection, query: str, args: tuple[Any, ...]) -> sqlite3.Row:
    row = conn.execute(query, args).fetchone()
    if row is None:
        raise KeyError("record not found")
    return row
