from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import unquote

try:
    import psycopg2
except ImportError:  # SQLite is allowed only for isolated smoke/migration tooling.
    psycopg2 = None

try:
    from .permissions import ROLE_VALUES, normalize_role_code
except ImportError:  # Allows `cd backend && uvicorn main:app`.
    from permissions import ROLE_VALUES, normalize_role_code

DB_PATH = Path(__file__).with_name("linzight_demo.db")
DEFAULT_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR = Path(os.getenv("LINZIGHT_UPLOADS_DIR", str(DEFAULT_UPLOADS_DIR))).expanduser()
SQLITE_DATABASE_URL = f"sqlite:///{DB_PATH}"
POSTGRES_DATABASE_URL = os.getenv("LINZIGHT_POSTGRES_URL", "postgresql+psycopg2:///linzight_dashboard_engineered")
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("LINZIGHT_DATABASE_URL") or POSTGRES_DATABASE_URL
ALLOW_SQLITE_RUNTIME = os.getenv("LINZIGHT_ALLOW_SQLITE_RUNTIME") == "1"


class PostgresRow(dict):
    def __getitem__(self, key: str | int) -> Any:
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


class StaticCursor:
    def __init__(self, rows: list[dict[str, Any]] | None = None, rowcount: int = -1):
        self._rows = [PostgresRow(row) for row in rows or []]
        self.rowcount = rowcount

    def fetchone(self) -> PostgresRow | None:
        if not self._rows:
            return None
        return self._rows[0]

    def fetchall(self) -> list[PostgresRow]:
        return self._rows


class PostgresCursor:
    def __init__(self, cursor: Any):
        self._cursor = cursor

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def fetchone(self) -> PostgresRow | None:
        row = self._cursor.fetchone()
        if row is None:
            return None
        names = [column.name for column in self._cursor.description or []]
        return PostgresRow(dict(zip(names, (normalize_db_value(value) for value in row))))

    def fetchall(self) -> list[PostgresRow]:
        rows = self._cursor.fetchall()
        names = [column.name for column in self._cursor.description or []]
        return [PostgresRow(dict(zip(names, (normalize_db_value(value) for value in row)))) for row in rows]


def normalize_db_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


class PostgresConnection:
    def __init__(self, database_url: str):
        if psycopg2 is None:
            raise RuntimeError("PostgreSQL runtime requires psycopg2-binary. Install backend requirements first.")
        self._conn = psycopg2.connect(normalize_postgres_url(database_url))
        self.row_factory = None

    def __enter__(self) -> "PostgresConnection":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if exc_type is None:
            self.commit()
        else:
            self.rollback()
        self.close()

    def execute(self, query: str, params: Iterable[Any] | None = None) -> PostgresCursor | StaticCursor:
        special = self._execute_special(query, params)
        if special is not None:
            return special
        translated = translate_runtime_sql(query)
        cursor = self._conn.cursor()
        cursor.execute(translated, tuple(params or ()))
        return PostgresCursor(cursor)

    def executemany(self, query: str, params_seq: Iterable[Iterable[Any]]) -> StaticCursor:
        translated = translate_runtime_sql(query)
        total = 0
        with self._conn.cursor() as cursor:
            for params in params_seq:
                cursor.execute(translated, tuple(params))
                if cursor.rowcount > 0:
                    total += cursor.rowcount
        return StaticCursor(rowcount=total)

    def executescript(self, script: str) -> None:
        statements = split_sql_script(script)
        with self._conn.cursor() as cursor:
            for statement in statements:
                translated = translate_schema_sql(statement)
                if translated:
                    cursor.execute(translated)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()

    def _execute_special(self, query: str, params: Iterable[Any] | None) -> StaticCursor | None:
        normalized = " ".join(query.strip().split())
        if normalized.upper() == "PRAGMA FOREIGN_KEYS = ON":
            return StaticCursor()
        table_info = re.fullmatch(r"PRAGMA\s+table_info\(([\w_]+)\)", query.strip(), flags=re.IGNORECASE)
        if table_info:
            table = table_info.group(1)
            return self.execute(
                """
                SELECT column_name AS name, data_type AS type
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ?
                ORDER BY ordinal_position
                """,
                (table,),
            )
        return None


def sqlite_database_path(database_url: str = DATABASE_URL) -> Path:
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError(
            "Database URL must start with sqlite:/// for SQLite runtime."
        )
    raw_path = unquote(database_url.replace("sqlite:///", "", 1))
    return Path(raw_path).expanduser()


def is_postgres_database_url(database_url: str = DATABASE_URL) -> bool:
    return database_url.startswith(("postgresql://", "postgresql+psycopg2://"))


def normalize_postgres_url(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg2://", "postgresql://", 1)


def is_postgres_connection(conn: Any) -> bool:
    return isinstance(conn, PostgresConnection)


def replace_qmark_placeholders(query: str) -> str:
    output: list[str] = []
    in_single = False
    in_double = False
    index = 0
    while index < len(query):
        char = query[index]
        next_char = query[index + 1] if index + 1 < len(query) else ""
        if char == "'" and not in_double:
            output.append(char)
            if in_single and next_char == "'":
                output.append(next_char)
                index += 2
                continue
            in_single = not in_single
        elif char == '"' and not in_single:
            output.append(char)
            in_double = not in_double
        elif char == "?" and not in_single and not in_double:
            output.append("%s")
        else:
            output.append(char)
        index += 1
    return "".join(output)


def translate_insert_or_ignore(query: str) -> str:
    if not re.search(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", query, flags=re.IGNORECASE):
        return query
    translated = re.sub(r"\bINSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", query, count=1, flags=re.IGNORECASE)
    if re.search(r"\bON\s+CONFLICT\b", translated, flags=re.IGNORECASE):
        return translated
    return f"{translated.rstrip().rstrip(';')} ON CONFLICT DO NOTHING"


JSONB_ARRAY_COLUMNS = {"organs_json", "required_forms_json", "required_samples_json", "linked_omics_json", "sample_ids_json", "values_json"}
JSONB_NULLABLE_COLUMNS = {"clinical_data_jsonb", "payload_jsonb"}
JSONB_COLUMNS = {
    *JSONB_ARRAY_COLUMNS,
    *JSONB_NULLABLE_COLUMNS,
    "clinical_data_json",
    "visit_plan_json",
    "testing_profile_json",
    "follow_up_schema_json",
    "payload_json",
    "scope_json",
    "sample_usage_json",
    "schema_json",
    "preview_json",
    "before_json",
    "after_json",
    "diff_json",
    "request_context_json",
}


def postgres_jsonb_column_definition(column: str) -> str | None:
    if column not in JSONB_COLUMNS:
        return None
    if column in JSONB_NULLABLE_COLUMNS:
        return "JSONB"
    default = "[]" if column in JSONB_ARRAY_COLUMNS else "{}"
    return f"JSONB NOT NULL DEFAULT '{default}'::jsonb"


def translate_jsonb_column_definitions(sql: str) -> str:
    def replace_line(match: re.Match[str]) -> str:
        prefix, column, column_type, rest = match.groups()
        definition = postgres_jsonb_column_definition(column)
        if definition is None:
            return match.group(0)
        suffix = rest
        comma = ""
        semicolon = ""
        if suffix.endswith(","):
            comma = ","
            suffix = suffix[:-1]
        if suffix.endswith(";"):
            semicolon = ";"
            suffix = suffix[:-1]
        return f"{prefix}{column} {definition}{comma}{semicolon}"

    translated = re.sub(
        r"(?im)^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s+(TEXT|BLOB)\b([^\n]*)$",
        replace_line,
        sql,
    )

    def replace_add_column(match: re.Match[str]) -> str:
        prefix, column, column_type, rest = match.groups()
        definition = postgres_jsonb_column_definition(column)
        if definition is None:
            return match.group(0)
        return f"{prefix}{column} {definition}{rest}"

    return re.sub(
        r"(?i)\b(ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+)([A-Za-z_][A-Za-z0-9_]*)\s+(TEXT|BLOB)\b([^,;]*)",
        replace_add_column,
        translated,
    )


def translate_runtime_sql(query: str) -> str:
    translated = translate_insert_or_ignore(query)
    translated = translate_jsonb_column_definitions(translated)
    translated = re.sub(r"\bBLOB\b", "TEXT", translated, flags=re.IGNORECASE)
    return replace_qmark_placeholders(translated)


def split_sql_script(script: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single = False
    in_double = False
    for char in script:
        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double
        if char == ";" and not in_single and not in_double:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            continue
        current.append(char)
    statement = "".join(current).strip()
    if statement:
        statements.append(statement)
    return statements


def translate_schema_sql(statement: str) -> str:
    lines: list[str] = []
    for raw_line in statement.splitlines():
        if re.search(r"\bFOREIGN\s+KEY\b", raw_line, flags=re.IGNORECASE):
            continue
        line = re.sub(
            r"\s+REFERENCES\s+[\w_]+\s*\([^)]*\)(?:\s+ON\s+DELETE\s+\w+)?",
            "",
            raw_line,
            flags=re.IGNORECASE,
        )
        lines.append(line)
    translated = "\n".join(lines)
    translated = translate_jsonb_column_definitions(translated)
    translated = re.sub(r",\s*\)", "\n)", translated)
    return translate_runtime_sql(translated)

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection | PostgresConnection:
    if is_postgres_database_url():
        return PostgresConnection(DATABASE_URL)
    if not ALLOW_SQLITE_RUNTIME:
        raise RuntimeError(
            "Formal LinZight runtime requires PostgreSQL. Set DATABASE_URL or LINZIGHT_DATABASE_URL "
            "to a postgresql:// URL. Use LINZIGHT_ALLOW_SQLITE_RUNTIME=1 only for isolated smoke tests "
            "or legacy SQLite migration tooling."
        )
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
	              leading_pi_info TEXT NOT NULL DEFAULT '',
	              system_admin TEXT NOT NULL DEFAULT '',
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
              patient_number TEXT NOT NULL DEFAULT '',
              patient_name TEXT NOT NULL DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS study_configurations (
              study_id TEXT PRIMARY KEY,
              disease_area TEXT NOT NULL,
              active_crf_version_id TEXT NOT NULL,
              visit_plan_json TEXT NOT NULL DEFAULT '{}',
              consent_template TEXT NOT NULL,
              testing_profile_json TEXT NOT NULL DEFAULT '{}',
              follow_up_schema_json TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (active_crf_version_id) REFERENCES study_crf_versions(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS global_configurations (
              key TEXT PRIMARY KEY,
              values_json TEXT NOT NULL DEFAULT '[]',
              updated_at TEXT NOT NULL
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
              initial_quantity TEXT NOT NULL DEFAULT '',
              remaining_quantity TEXT NOT NULL DEFAULT '',
              quantity_unit TEXT NOT NULL DEFAULT '',
              note TEXT NOT NULL DEFAULT '',
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
              sample_ids_json TEXT NOT NULL DEFAULT '[]',
              sample_usage_json TEXT NOT NULL DEFAULT '{}',
              sample_type TEXT NOT NULL,
              assay TEXT NOT NULL,
              vendor TEXT NOT NULL DEFAULT '',
              platform TEXT NOT NULL,
              run_id TEXT NOT NULL,
              status TEXT NOT NULL,
              qc TEXT NOT NULL,
              result_file_id TEXT,
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
              record_note TEXT NOT NULL DEFAULT '',
              metastasis_status TEXT NOT NULL DEFAULT '',
              adverse_events TEXT NOT NULL DEFAULT '',
              quality_of_life TEXT NOT NULL DEFAULT '',
              lost_to_follow_up_reason TEXT NOT NULL DEFAULT '',
              payload_json TEXT NOT NULL DEFAULT '{}',
              payload_jsonb BLOB,
              payload_version TEXT NOT NULL DEFAULT 'legacy',
              payload_format TEXT NOT NULL DEFAULT 'json',
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
	              last_login_at TEXT,
	              created_at TEXT NOT NULL,
	              updated_at TEXT NOT NULL
	            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

            CREATE TABLE IF NOT EXISTS operation_logs (
              id TEXT PRIMARY KEY,
              study_id TEXT,
              actor_id TEXT,
              actor_role TEXT,
              action TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT NOT NULL,
              before_json TEXT NOT NULL DEFAULT '{}',
              after_json TEXT NOT NULL DEFAULT '{}',
              diff_json TEXT NOT NULL DEFAULT '[]',
              request_context_json TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE SET NULL,
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

            CREATE TABLE IF NOT EXISTS sites (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (study_id, code),
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS site_users (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              site_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              role TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE (site_id, user_id),
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS data_queries (
              id TEXT PRIMARY KEY,
              study_id TEXT NOT NULL,
              patient_id TEXT NOT NULL,
              visit_id TEXT,
              form_id TEXT NOT NULL DEFAULT '',
              field_name TEXT NOT NULL DEFAULT '',
              title TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'open',
              assigned_to TEXT,
              created_by TEXT,
              response TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              closed_at TEXT,
              FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
              FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
              FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
              FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
              FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_patients_disease_type ON patients(disease_type);
            CREATE INDEX IF NOT EXISTS idx_visit_plans_study_id ON study_visit_plans(study_id);
            CREATE INDEX IF NOT EXISTS idx_study_configurations_active_crf ON study_configurations(active_crf_version_id);
            CREATE INDEX IF NOT EXISTS idx_samples_patient_id ON samples(patient_id);
            CREATE INDEX IF NOT EXISTS idx_omics_patient_id ON omics_records(patient_id);
            CREATE INDEX IF NOT EXISTS idx_follow_up_records_patient_id ON follow_up_records(patient_id);
            CREATE INDEX IF NOT EXISTS idx_crf_entries_patient_id ON crf_entries(patient_id);
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_patient_id ON uploaded_files(patient_id);
            CREATE INDEX IF NOT EXISTS idx_quality_patient_status ON data_quality_issues(patient_id, status);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_study_id ON operation_logs(study_id);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity_type, entity_id);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_actor_id ON operation_logs(actor_id);
            CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_study_members_study_id ON study_members(study_id);
            CREATE INDEX IF NOT EXISTS idx_study_members_user_id ON study_members(user_id);
            CREATE INDEX IF NOT EXISTS idx_crf_migration_approvals_study_id ON crf_migration_approvals(study_id);
            CREATE INDEX IF NOT EXISTS idx_crf_migration_execution_logs_migration_id ON crf_migration_execution_logs(migration_id);
            CREATE INDEX IF NOT EXISTS idx_approval_requests_study_id ON approval_requests(study_id);
            CREATE INDEX IF NOT EXISTS idx_approval_actions_approval_id ON approval_actions(approval_id);
            CREATE INDEX IF NOT EXISTS idx_sites_study_id ON sites(study_id);
            CREATE INDEX IF NOT EXISTS idx_site_users_study_site ON site_users(study_id, site_id);
            CREATE INDEX IF NOT EXISTS idx_data_queries_study_id ON data_queries(study_id);
            CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
            """
        )
        migrate_study_schema(conn)
        migrate_json_storage(conn)
        seed_default_field_permissions(conn)
        sync_study_configurations(conn)
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
    patient_name_full_access_roles = {"LZ_ADMIN", "STUDY_CONFIG_ADMIN", "STUDY_CRC", "LZ_CRC"}
    rows = []
    for role in ROLE_VALUES:
        for resource, field_name, mask_rule in sensitive_fields:
            should_mask = role not in patient_name_full_access_roles if field_name == "patient_name" else role in masked_roles and role != "LZ_ADMIN"
            if field_name == "patient_name" and should_mask:
                mask_rule = "pinyin_initials"
            rows.append((role, resource, field_name, 1, 0 if should_mask else 1, mask_rule if should_mask else "none", now, now))
    conn.executemany(
        """
        INSERT OR IGNORE INTO field_permissions (role, resource, field_name, can_view, can_export, mask_rule, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    for role in ROLE_VALUES:
        should_mask = role not in patient_name_full_access_roles
        conn.execute(
            """
            UPDATE field_permissions
            SET can_view = 1, can_export = ?, mask_rule = ?, updated_at = ?
            WHERE role = ? AND resource = 'patients' AND field_name = 'patient_name'
            """,
            (0 if should_mask else 1, "pinyin_initials" if should_mask else "none", now, role),
        )


def record_schema_version(conn: sqlite3.Connection) -> None:
    versions = [
        ("20260512_001_auth_privacy_approvals_files", "Production-demo auth, field privacy, approvals, and file security baseline"),
        ("20260516_001_study_configuration_registry", "Study configuration registry for CRF, visit plan, consent template, and testing profile binding"),
    ]
    now = utc_now()
    conn.executemany(
        """
        INSERT OR IGNORE INTO schema_migrations (version, description, applied_at)
        VALUES (?, ?, ?)
        """,
        [(version, description, now) for version, description in versions],
    )


def study_configuration_defaults(study_id: str, indication: str, active_crf_version_id: str, visit_plans: list[dict[str, Any]]) -> dict[str, Any]:
    if study_id == "LZXK-01":
        return {
            "study_id": study_id,
            "disease_area": "lung_cancer_resistance",
            "active_crf_version_id": active_crf_version_id,
            "visit_plan": {
                "profile": "lung_resistance_v1",
                "active_plan_codes": [plan["code"] for plan in visit_plans],
            },
            "consent_template": "lung-cancer-rwd-consent-v1.0",
            "testing_profile": {
                "testing_project_id": "TP-LUNG-RESIST-OMICS",
                "sample_types": ["血液", "组织", "胸水"],
                "assays": ["NGS panel", "ctDNA", "病理复核"],
            },
            "follow_up_schema": default_follow_up_schema("lung_resistance_v1"),
        }
    return {
        "study_id": study_id,
        "disease_area": "immune_neurology",
        "active_crf_version_id": active_crf_version_id,
        "visit_plan": {
            "profile": "immune_neurology_v1",
            "active_plan_codes": [plan["code"] for plan in visit_plans],
        },
        "consent_template": "immune-neurology-consent-v20260423",
        "testing_profile": {
            "testing_project_id": "TP-SLE-OMICS",
            "sample_types": ["血液", "CSF", "肾", "尿液"],
            "assays": ["WGS", "TCR/BCR", "Olink/Simoa", "蛋白组", "代谢组"],
            "indication": indication,
        },
        "follow_up_schema": default_follow_up_schema("immune_neurology_v1"),
    }


def default_follow_up_schema(profile: str) -> dict[str, Any]:
    return {
        "profile": profile,
        "version": "v1",
        "sections": [
            {
                "id": "follow_up",
                "title": "患者随访",
                "fields": [
                    {"id": "visit", "name": "访视", "type": "Text", "required": True},
                    {"id": "date", "name": "日期", "type": "Date", "required": True},
                    {"id": "type", "name": "类型", "type": "Dropdown", "required": True, "options": ["门诊", "电话", "线上", "家访", "其他"]},
                    {"id": "efficacy", "name": "疗效评估", "type": "Text", "required": False},
                    {"id": "record", "name": "记录", "type": "Textarea", "required": False},
                ],
            }
        ],
    }


def sync_study_configurations(conn: sqlite3.Connection) -> None:
    now = utc_now()
    study_rows = conn.execute("SELECT id, indication FROM studies ORDER BY id").fetchall()
    for study in study_rows:
        version = conn.execute(
            """
            SELECT id
            FROM study_crf_versions
            WHERE study_id = ? AND status = 'published'
            ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
            LIMIT 1
            """,
            (study["id"],),
        ).fetchone()
        if not version:
            continue
        plans = [
            row_to_study_visit_plan(row)
            for row in conn.execute(
                """
                SELECT *
                FROM study_visit_plans
                WHERE study_id = ? AND status = 'active'
                ORDER BY sort_order, day_offset, code
                """,
                (study["id"],),
            ).fetchall()
        ]
        config = study_configuration_defaults(study["id"], study["indication"], version["id"], plans)
        conn.execute(
            """
            INSERT INTO study_configurations
              (study_id, disease_area, active_crf_version_id, visit_plan_json, consent_template, testing_profile_json, follow_up_schema_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(study_id) DO UPDATE SET
              disease_area = excluded.disease_area,
              active_crf_version_id = excluded.active_crf_version_id,
              visit_plan_json = excluded.visit_plan_json,
              consent_template = excluded.consent_template,
              testing_profile_json = excluded.testing_profile_json,
              follow_up_schema_json = excluded.follow_up_schema_json,
              updated_at = excluded.updated_at
            """,
            (
                config["study_id"],
                config["disease_area"],
                config["active_crf_version_id"],
                encode_json(config["visit_plan"]),
                config["consent_template"],
                encode_json(config["testing_profile"]),
                encode_json(config["follow_up_schema"]),
                now,
                now,
            ),
        )


def encode_json(value: Any) -> str:
    def default(item: Any) -> str:
        if isinstance(item, (date, datetime)):
            return item.isoformat()
        return str(item)

    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=default)


def sqlite_supports_jsonb(conn: sqlite3.Connection) -> bool:
    if is_postgres_connection(conn):
        return False
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
    if is_postgres_connection(conn):
        return json_text, "jsonb", version
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
    if is_postgres_connection(conn):
        conn.execute(
            """
            UPDATE patients
            SET
              clinical_data_jsonb = clinical_data_json,
              clinical_data_format = 'jsonb',
              clinical_data_version = COALESCE(clinical_data_version, 'legacy')
            WHERE clinical_data_jsonb IS NULL
            """
        )
        conn.execute(
            """
            UPDATE crf_entries
            SET
              payload_jsonb = payload_json,
              payload_format = 'jsonb',
              payload_version = COALESCE(payload_version, 'legacy')
            WHERE payload_jsonb IS NULL
            """
        )
        return

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
    ensure_columns(
        conn,
        "studies",
        [
            ("leading_pi_info", "TEXT NOT NULL DEFAULT ''"),
            ("system_admin", "TEXT NOT NULL DEFAULT ''"),
        ],
    )
    ensure_columns(conn, "users", [("role_code", "TEXT NOT NULL DEFAULT 'STUDY_PI'"), ("last_login_at", "TEXT")])
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

    ensure_columns(conn, "patients", [("patient_number", "TEXT NOT NULL DEFAULT ''"), ("patient_name", "TEXT NOT NULL DEFAULT ''")])
    conn.execute("UPDATE patients SET patient_number = name WHERE patient_number = '' OR patient_number IS NULL")
    ensure_columns(
        conn,
        "samples",
        [
            ("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"),
            ("initial_quantity", "TEXT NOT NULL DEFAULT ''"),
            ("remaining_quantity", "TEXT NOT NULL DEFAULT ''"),
            ("quantity_unit", "TEXT NOT NULL DEFAULT ''"),
            ("note", "TEXT NOT NULL DEFAULT ''"),
        ],
    )
    ensure_columns(
        conn,
        "omics_records",
        [
            ("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"),
            ("testing_project_id", "TEXT NOT NULL DEFAULT 'TP-SLE-OMICS'"),
            ("sample_ids_json", "TEXT"),
            ("sample_usage_json", "TEXT"),
            ("vendor", "TEXT NOT NULL DEFAULT ''"),
            ("result_file_id", "TEXT"),
        ],
    )
    ensure_columns(conn, "consents", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'")])
    ensure_columns(conn, "visits", [("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"), ("visit_plan_id", "TEXT")])
    ensure_columns(conn, "study_configurations", [("follow_up_schema_json", "TEXT NOT NULL DEFAULT '{}'")])
    ensure_columns(
        conn,
        "follow_up_records",
        [
            ("study_id", "TEXT NOT NULL DEFAULT 'LGL-1111'"),
            ("record_note", "TEXT NOT NULL DEFAULT ''"),
            ("payload_json", "TEXT NOT NULL DEFAULT '{}'"),
            ("payload_jsonb", "BLOB"),
            ("payload_version", "TEXT NOT NULL DEFAULT 'legacy'"),
            ("payload_format", "TEXT NOT NULL DEFAULT 'json'"),
        ],
    )
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
        INSERT INTO consents (id, study_id, patient_id, status, version, signed_at, method)
        SELECT 'CONS-' || p.id, p.study_id, p.id, '待签署', 'V1.0', '-', '-'
        FROM patients p
        WHERE NOT EXISTS (
          SELECT 1 FROM consents c WHERE c.patient_id = p.id
        )
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


def decode_json(value: Any, default: Any) -> Any:
    if not value:
        return default
    if isinstance(value, (dict, list)):
        return value
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
    item["patient_number"] = item.get("patient_number") or item.get("name")
    item["patient_name"] = item.get("patient_name") or ""
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
    item = dict(row)
    item["sample_ids"] = decode_json(item.pop("sample_ids_json", None), [])
    item["sample_usage"] = decode_json(item.pop("sample_usage_json", None), {})
    if not item["sample_ids"] and item.get("sample_id"):
        item["sample_ids"] = [item["sample_id"]]
    return item


def row_to_visit(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_study_visit_plan(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["required_forms"] = decode_json(item.pop("required_forms_json"), [])
    item["required_samples"] = decode_json(item.pop("required_samples_json"), [])
    return item


def row_to_study_configuration(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["visit_plan"] = decode_json(item.pop("visit_plan_json"), {})
    item["testing_profile"] = decode_json(item.pop("testing_profile_json"), {})
    item["follow_up_schema"] = decode_json(item.pop("follow_up_schema_json"), {})
    return item


def row_to_follow_up_record(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    payload_json = item.pop("payload_json", None)
    payload_jsonb = item.pop("payload_jsonb", None)
    payload = decode_json(payload_jsonb if payload_jsonb is not None else payload_json, {})
    item["payload"] = payload
    item["payload_version"] = item.get("payload_version") or json_payload_version(payload)
    item["payload_format"] = item.get("payload_format") or ("jsonb" if payload_jsonb is not None else "json")
    return item


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


def row_to_operation_log(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["before"] = decode_json(item.pop("before_json"), {})
    item["after"] = decode_json(item.pop("after_json"), {})
    item["diff"] = decode_json(item.pop("diff_json"), [])
    item["request_context"] = decode_json(item.pop("request_context_json"), {})
    return item


def row_to_site(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_site_user(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def row_to_data_query(row: sqlite3.Row) -> dict[str, Any]:
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


def fetch_one(conn: sqlite3.Connection, query: str, args: tuple[Any, ...]) -> sqlite3.Row:
    row = conn.execute(query, args).fetchone()
    if row is None:
        raise KeyError("record not found")
    return row
