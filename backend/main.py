from __future__ import annotations

import csv
import hashlib
import io
import json
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

try:
    from .database import (
        UPLOADS_DIR,
        connect,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_audit_log,
        row_to_consent,
        row_to_crf_entry,
        row_to_export_job,
        row_to_file,
        row_to_omics,
        row_to_patient,
        row_to_quality_issue,
        row_to_sample,
        row_to_user,
        utc_now,
    )
    from .schemas import ConsentUpdate, CrfEntryCreate, CrfEntryUpdate, ExportJobCreate, LoginRequest, OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate
    from .seed import seed_database
except ImportError:  # Allows `cd backend && uvicorn main:app`.
    from database import (
        UPLOADS_DIR,
        connect,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_audit_log,
        row_to_consent,
        row_to_crf_entry,
        row_to_export_job,
        row_to_file,
        row_to_omics,
        row_to_patient,
        row_to_quality_issue,
        row_to_sample,
        row_to_user,
        utc_now,
    )
    from schemas import ConsentUpdate, CrfEntryCreate, CrfEntryUpdate, ExportJobCreate, LoginRequest, OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate
    from seed import seed_database

app = FastAPI(title="LinZight RWS Demo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    initialize_schema()


def dump_model(model: Any, *, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="record not found")


def password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def demo_token(user_id: str) -> str:
    return f"demo-token-{user_id}"


def token_to_user_id(authorization: str | None = None, token: str | None = None) -> str | None:
    raw_token = token
    if authorization:
        scheme, _, value = authorization.partition(" ")
        raw_token = value if scheme.lower() == "bearer" else authorization
    if not raw_token or not raw_token.startswith("demo-token-"):
        return None
    return raw_token.replace("demo-token-", "", 1)


def role_can(role: str, resource: str, action: str) -> bool:
    if role == "sys_admin":
        return True
    if action == "read":
        return True
    allowed: dict[str, set[str]] = {
        "project_admin": {"patients", "consents", "crf", "samples", "omics", "files", "exports", "quality"},
        "investigator": {"consents", "crf", "files"},
        "crc": {"patients", "consents", "crf", "samples", "omics", "files"},
        "data_manager": {"crf", "exports", "quality"},
        "viewer": set(),
    }
    return resource in allowed.get(role, set())


def authorize(authorization: str | None, resource: str, action: str = "write") -> dict[str, Any]:
    user_id = token_to_user_id(authorization=authorization)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    with connect() as conn:
        try:
            user = row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ? AND status = 'active'", (user_id,)))
        except KeyError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token") from exc
    if not role_can(user["role"], resource, action):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permission denied")
    return user


def insert_audit(
    conn: Any,
    actor: dict[str, Any] | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before: Any = None,
    after: Any = None,
) -> None:
    conn.execute(
        """
        INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"AUD-{uuid4().hex[:10].upper()}",
            actor["id"] if actor else None,
            actor["role"] if actor else None,
            action,
            entity_type,
            entity_id,
            encode_json(before) if before is not None else None,
            encode_json(after) if after is not None else None,
            None,
            utc_now(),
        ),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "linzight-demo-api"}


@app.post("/seed")
def seed() -> dict[str, str]:
    seed_database()
    return {"status": "seeded"}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ? AND status = 'active'", (payload.username,)).fetchone()
        if row is None or row["password_hash"] != password_hash(payload.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid username or password")
        user = row_to_user(row)
        return {"access_token": demo_token(user["id"]), "token_type": "bearer", "user": user}


@app.get("/auth/me")
def me(token: str | None = Query(default=None), authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user_id = token_to_user_id(authorization=authorization, token=token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing demo token")
    with connect() as conn:
        try:
            return row_to_user(fetch_one(conn, "SELECT * FROM users WHERE id = ?", (user_id,)))
        except KeyError as exc:
            raise not_found() from exc


@app.get("/patients")
def list_patients(q: str | None = Query(default=None), disease_type: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM patients"
    params: list[Any] = []
    where: list[str] = []
    if q:
        where.append("(name LIKE ? OR hospital_no LIKE ? OR disease_type LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if disease_type:
        where.append("disease_type = ?")
        params.append(disease_type)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY updated_at DESC"
    with connect() as conn:
        return [row_to_patient(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/patients", status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "patients")
    data = dump_model(payload)
    patient_id = data.pop("id") or f"PAT-{uuid4().hex[:8].upper()}"
    now = utc_now()
    try:
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO patients
                  (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    now,
                    now,
                ),
            )
            row = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
            insert_audit(conn, user, "create", "patients", patient_id, after=row)
            return row
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str) -> dict[str, Any]:
    with connect() as conn:
        try:
            return row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        except KeyError as exc:
            raise not_found() from exc


@app.put("/patients/{patient_id}")
def update_patient(patient_id: str, payload: PatientUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "patients")
    data = dump_model(payload, exclude_unset=True)
    columns: list[str] = []
    values: list[Any] = []
    for key, value in data.items():
        column = {"organs": "organs_json", "clinical_data": "clinical_data_json"}.get(key, key)
        values.append(encode_json(value) if key in {"organs", "clinical_data"} else value)
        columns.append(f"{column} = ?")
    if not columns:
        return get_patient(patient_id)
    columns.append("updated_at = ?")
    values.extend([utc_now(), patient_id])
    with connect() as conn:
        before = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        result = conn.execute(f"UPDATE patients SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        insert_audit(conn, user, "update", "patients", patient_id, before=before, after=after)
        return after


@app.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: str, authorization: str | None = Header(default=None)) -> None:
    authorize(authorization, "patients")
    with connect() as conn:
        result = conn.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/samples")
def list_samples(patient_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM samples"
    params: list[Any] = []
    if patient_id:
        sql += " WHERE patient_id = ?"
        params.append(patient_id)
    sql += " ORDER BY collected_at DESC"
    with connect() as conn:
        return [row_to_sample(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/samples", status_code=status.HTTP_201_CREATED)
def create_sample(payload: SampleCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "samples")
    data = dump_model(payload)
    sample_id = data.pop("id") or f"SPL-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        try:
            conn.execute(
                """
                INSERT INTO samples
                  (id, patient_id, patient_name, hospital_no, sample_type, visit, collected_at, storage, status, linked_omics_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sample_id,
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
            insert_audit(conn, user, "create", "samples", sample_id, after=row)
            return row
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/samples/{sample_id}")
def get_sample(sample_id: str) -> dict[str, Any]:
    with connect() as conn:
        try:
            return row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
        except KeyError as exc:
            raise not_found() from exc


@app.put("/samples/{sample_id}")
def update_sample(sample_id: str, payload: SampleUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    authorize(authorization, "samples")
    data = dump_model(payload, exclude_unset=True)
    columns: list[str] = []
    values: list[Any] = []
    for key, value in data.items():
        column = "linked_omics_json" if key == "linked_omics" else key
        values.append(encode_json(value) if key == "linked_omics" else value)
        columns.append(f"{column} = ?")
    if not columns:
        return get_sample(sample_id)
    columns.append("updated_at = ?")
    values.extend([utc_now(), sample_id])
    with connect() as conn:
        result = conn.execute(f"UPDATE samples SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        return row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))


@app.delete("/samples/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sample(sample_id: str, authorization: str | None = Header(default=None)) -> None:
    authorize(authorization, "samples")
    with connect() as conn:
        result = conn.execute("DELETE FROM samples WHERE id = ?", (sample_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/omics")
def list_omics(patient_id: str | None = None, sample_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM omics_records"
    params: list[Any] = []
    where: list[str] = []
    if patient_id:
        where.append("patient_id = ?")
        params.append(patient_id)
    if sample_id:
        where.append("sample_id = ?")
        params.append(sample_id)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY sent_at DESC"
    with connect() as conn:
        return [row_to_omics(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/omics", status_code=status.HTTP_201_CREATED)
def create_omics(payload: OmicsCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "omics")
    data = dump_model(payload)
    record_id = data.pop("id") or f"OMX-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        try:
            conn.execute(
                """
                INSERT INTO omics_records
                  (id, patient_id, patient_name, sample_id, sample_type, assay, platform, run_id, status, qc, sent_at, completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
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
            insert_audit(conn, user, "create", "omics_records", record_id, after=row)
            return row
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/omics/{record_id}")
def get_omics(record_id: str) -> dict[str, Any]:
    with connect() as conn:
        try:
            return row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
        except KeyError as exc:
            raise not_found() from exc


@app.put("/omics/{record_id}")
def update_omics(record_id: str, payload: OmicsUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    authorize(authorization, "omics")
    data = dump_model(payload, exclude_unset=True)
    if not data:
        return get_omics(record_id)
    columns = [f"{key} = ?" for key in data]
    values = list(data.values())
    columns.append("updated_at = ?")
    values.extend([utc_now(), record_id])
    with connect() as conn:
        result = conn.execute(f"UPDATE omics_records SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        return row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))


@app.delete("/omics/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_omics(record_id: str, authorization: str | None = Header(default=None)) -> None:
    authorize(authorization, "omics")
    with connect() as conn:
        result = conn.execute("DELETE FROM omics_records WHERE id = ?", (record_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/consents")
def list_consents(q: str | None = Query(default=None), status_filter: str | None = Query(default=None, alias="status")) -> list[dict[str, Any]]:
    sql = """
        SELECT
          c.id,
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
    if q:
        where.append("(p.name LIKE ? OR p.hospital_no LIKE ? OR p.disease_type LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if status_filter:
        where.append("c.status = ?")
        params.append(status_filter)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY p.id"
    with connect() as conn:
        return [row_to_consent(row) for row in conn.execute(sql, params).fetchall()]


@app.put("/consents/{consent_id}")
def update_consent(consent_id: str, payload: ConsentUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "consents")
    data = dump_model(payload, exclude_unset=True)
    if not data:
        with connect() as conn:
            return row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
    columns = [f"{key} = ?" for key in data]
    values = list(data.values())
    values.append(consent_id)
    with connect() as conn:
        before = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
        result = conn.execute(f"UPDATE consents SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_consent(fetch_one(conn, "SELECT * FROM consents WHERE id = ?", (consent_id,)))
        insert_audit(conn, user, "update", "consents", consent_id, before=before, after=after)
        joined = conn.execute(
            """
            SELECT
              c.id,
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
        return row_to_consent(joined)


@app.get("/crf")
def list_crf_entries(patient_id: str | None = None, status_filter: str | None = Query(default=None, alias="status")) -> list[dict[str, Any]]:
    sql = "SELECT * FROM crf_entries"
    params: list[Any] = []
    where: list[str] = []
    if patient_id:
        where.append("patient_id = ?")
        params.append(patient_id)
    if status_filter:
        where.append("status = ?")
        params.append(status_filter)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY updated_at DESC"
    with connect() as conn:
        return [row_to_crf_entry(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/crf", status_code=status.HTTP_201_CREATED)
def create_crf_entry(payload: CrfEntryCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "crf")
    data = dump_model(payload)
    entry_id = data.pop("id") or f"CRF-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        try:
            conn.execute(
                """
                INSERT INTO crf_entries
                  (id, patient_id, visit_id, module, payload_json, status, completed_by, completed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    data["patient_id"],
                    data["visit_id"],
                    data["module"],
                    encode_json(data["payload"]),
                    data["status"],
                    None,
                    None,
                    now,
                    now,
                ),
            )
            row = row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
            insert_audit(conn, user, "create", "crf_entries", entry_id, after=row)
            return row
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/crf/{entry_id}")
def update_crf_entry(entry_id: str, payload: CrfEntryUpdate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "crf")
    data = dump_model(payload, exclude_unset=True)
    columns: list[str] = []
    values: list[Any] = []
    for key, value in data.items():
        column = "payload_json" if key == "payload" else key
        values.append(encode_json(value) if key == "payload" else value)
        columns.append(f"{column} = ?")
    if not columns:
        with connect() as conn:
            return row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
    columns.append("updated_at = ?")
    values.extend([utc_now(), entry_id])
    with connect() as conn:
        before = row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
        result = conn.execute(f"UPDATE crf_entries SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
        insert_audit(conn, user, "update", "crf_entries", entry_id, before=before, after=after)
        return after


@app.get("/files")
def list_files(patient_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM uploaded_files"
    params: list[Any] = []
    if patient_id:
        sql += " WHERE patient_id = ?"
        params.append(patient_id)
    sql += " ORDER BY uploaded_at DESC"
    with connect() as conn:
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
    user = authorize(authorization, "files")
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
    target_dir = UPLOADS_DIR / category
    target_dir.mkdir(parents=True, exist_ok=True)
    storage_path = target_dir / stored_filename
    storage_path.write_bytes(content)
    now = utc_now()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO uploaded_files
              (id, patient_id, sample_id, omics_id, consent_id, category, original_filename, stored_filename, storage_path, content_type, size_bytes, sha256, uploaded_by, uploaded_at, is_deidentified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file_id,
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
            ),
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"AUD-{uuid4().hex[:10].upper()}",
                user["id"],
                user["role"],
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


@app.get("/analytics/summary")
def analytics_summary() -> dict[str, Any]:
    with connect() as conn:
        disease_distribution = {
            row["disease_type"]: row["count"]
            for row in conn.execute("SELECT disease_type, COUNT(*) AS count FROM patients GROUP BY disease_type").fetchall()
        }
        patient_rows = conn.execute("SELECT clinical_data_json FROM patients").fetchall()
        completeness_values = []
        for row in patient_rows:
            payload = json.loads(row["clinical_data_json"])
            value = payload.get("数据完整度", 0)
            completeness_values.append(float(value) if isinstance(value, (int, float)) else 0.0)
        omics_count = conn.execute("SELECT COUNT(*) AS count FROM omics_records").fetchone()["count"]
        patient_count = conn.execute("SELECT COUNT(*) AS count FROM patients").fetchone()["count"]
        visit_count = conn.execute("SELECT COUNT(*) AS count FROM visits").fetchone()["count"]
        crf_count = conn.execute("SELECT COUNT(*) AS count FROM crf_entries").fetchone()["count"]
        consent_signed_count = conn.execute("SELECT COUNT(*) AS count FROM consents WHERE status = '已签署'").fetchone()["count"]
        sample_patient_count = conn.execute("SELECT COUNT(DISTINCT patient_id) AS count FROM samples").fetchone()["count"]
        active_patient_count = conn.execute("SELECT COUNT(*) AS count FROM patients WHERE disease_type != 'HC'").fetchone()["count"]
        completed_patient_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM patients p
            WHERE EXISTS (
              SELECT 1 FROM omics_records o
              WHERE o.patient_id = p.id AND o.status = '结果归档'
            )
            """
        ).fetchone()["count"]
        return {
            "patient_count": patient_count,
            "disease_distribution": disease_distribution,
            "sample_count": conn.execute("SELECT COUNT(*) AS count FROM samples").fetchone()["count"],
            "omics_count": omics_count,
            "completed_omics_count": conn.execute("SELECT COUNT(*) AS count FROM omics_records WHERE status = '结果归档'").fetchone()["count"],
            "data_completeness_avg": round(sum(completeness_values) / len(completeness_values), 1) if completeness_values else 0,
            "visit_count": visit_count,
            "crf_count": crf_count,
            "consent_signed_count": consent_signed_count,
            "sample_patient_count": sample_patient_count,
            "active_patient_count": active_patient_count,
            "completed_patient_count": completed_patient_count,
        }


@app.get("/quality/issues")
def list_quality_issues(patient_id: str | None = None, status_filter: str | None = Query(default=None, alias="status")) -> list[dict[str, Any]]:
    sql = "SELECT * FROM data_quality_issues"
    params: list[Any] = []
    where: list[str] = []
    if patient_id:
        where.append("patient_id = ?")
        params.append(patient_id)
    if status_filter:
        where.append("status = ?")
        params.append(status_filter)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC"
    with connect() as conn:
        return [row_to_quality_issue(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/quality/run")
def run_quality_checks(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "quality")
    now = utc_now()
    issue_rows: list[tuple[Any, ...]] = []
    with connect() as conn:
        patients = [row_to_patient(row) for row in conn.execute("SELECT * FROM patients ORDER BY id").fetchall()]
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
        conn.execute("DELETE FROM data_quality_issues WHERE status = 'open'")
        conn.executemany(
            """
            INSERT INTO data_quality_issues
              (id, patient_id, source_table, source_id, field_name, severity, message, status, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            issue_rows,
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"AUD-{uuid4().hex[:10].upper()}",
                user["id"],
                user["role"],
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
    user = authorize(authorization, "exports")
    data = dump_model(payload)
    export_id = f"EXP-{uuid4().hex[:8].upper()}"
    file_id = f"FIL-{uuid4().hex[:10].upper()}"
    now = utc_now()
    export_dir = UPLOADS_DIR / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    export_path = export_dir / f"{export_id}.csv"
    with connect() as conn:
        patient_rows = conn.execute("SELECT id, name, hospital_no, sex, age, disease_type, note FROM patients ORDER BY id").fetchall()
        with export_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["id", "name", "hospital_no", "sex", "age", "disease_type", "note"])
            writer.writerows([tuple(row) for row in patient_rows])
        content = export_path.read_bytes()
        conn.execute(
            """
            INSERT INTO uploaded_files
              (id, category, original_filename, stored_filename, storage_path, content_type, size_bytes, sha256, uploaded_by, uploaded_at, is_deidentified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                file_id,
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
            INSERT INTO export_jobs (id, requested_by, export_type, scope_json, status, file_id, created_at, completed_at)
            VALUES (?, ?, ?, ?, 'ready', ?, ?, ?)
            """,
            (export_id, data["requested_by"] or user["id"], data["export_type"], encode_json(data["scope"]), file_id, now, now),
        )
        job = row_to_export_job(fetch_one(conn, "SELECT * FROM export_jobs WHERE id = ?", (export_id,)))
        insert_audit(conn, user, "export", "export_jobs", export_id, after=job)
        return job


@app.get("/exports")
def list_export_jobs() -> list[dict[str, Any]]:
    with connect() as conn:
        return [row_to_export_job(row) for row in conn.execute("SELECT * FROM export_jobs ORDER BY created_at DESC").fetchall()]


@app.get("/exports/{export_id}/download")
def download_export(export_id: str, authorization: str | None = Header(default=None)) -> FileResponse:
    authorize(authorization, "exports", "read")
    with connect() as conn:
        try:
            job = row_to_export_job(fetch_one(conn, "SELECT * FROM export_jobs WHERE id = ?", (export_id,)))
            file_row = row_to_file(fetch_one(conn, "SELECT * FROM uploaded_files WHERE id = ?", (job["file_id"],)))
        except KeyError as exc:
            raise not_found() from exc
    return FileResponse(file_row["storage_path"], media_type=file_row["content_type"], filename=file_row["original_filename"])


@app.post("/imports/patients", status_code=status.HTTP_201_CREATED)
async def import_patients(file: UploadFile = File(...), authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = authorize(authorization, "patients")
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    required = {"name", "hospital_no", "sex", "age", "disease_type"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail="CSV must include name,hospital_no,sex,age,disease_type")
    now = utc_now()
    imported = 0
    with connect() as conn:
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
                "数据完整度": 70,
            }
            conn.execute(
                """
                INSERT INTO patients
                  (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, created_at, updated_at)
                VALUES (?, 'LGL-1111', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  hospital_no = excluded.hospital_no,
                  sex = excluded.sex,
                  age = excluded.age,
                  disease_type = excluded.disease_type,
                  organs_json = excluded.organs_json,
                  note = excluded.note,
                  clinical_data_json = excluded.clinical_data_json,
                  updated_at = excluded.updated_at
                """,
                (
                    patient_id,
                    row["name"],
                    row["hospital_no"],
                    row["sex"],
                    int(row["age"]),
                    row["disease_type"],
                    encode_json(organs),
                    row.get("note") or "CSV 导入",
                    encode_json(clinical_data),
                    now,
                    now,
                ),
            )
            imported += 1
        conn.execute(
            """
            INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"AUD-{uuid4().hex[:10].upper()}",
                user["id"],
                user["role"],
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


@app.get("/audit-logs")
def list_audit_logs(entity_type: str | None = None, entity_id: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM audit_logs"
    params: list[Any] = []
    where: list[str] = []
    if entity_type:
        where.append("entity_type = ?")
        params.append(entity_type)
    if entity_id:
        where.append("entity_id = ?")
        params.append(entity_id)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC"
    with connect() as conn:
        return [row_to_audit_log(row) for row in conn.execute(sql, params).fetchall()]


@app.get("/patients/{patient_id}/panorama")
def patient_panorama(patient_id: str) -> dict[str, Any]:
    with connect() as conn:
        try:
            patient = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        except KeyError as exc:
            raise not_found() from exc
        sample_rows = [row_to_sample(row) for row in conn.execute("SELECT * FROM samples WHERE patient_id = ? ORDER BY collected_at", (patient_id,)).fetchall()]
        omics_rows = [row_to_omics(row) for row in conn.execute("SELECT * FROM omics_records WHERE patient_id = ? ORDER BY sent_at", (patient_id,)).fetchall()]
        consents = [dict(row) for row in conn.execute("SELECT * FROM consents WHERE patient_id = ?", (patient_id,)).fetchall()]
        visit_rows = [dict(row) for row in conn.execute("SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date", (patient_id,)).fetchall()]
        crf_rows = [row_to_crf_entry(row) for row in conn.execute("SELECT * FROM crf_entries WHERE patient_id = ? ORDER BY updated_at", (patient_id,)).fetchall()]
        file_rows = [row_to_file(row) for row in conn.execute("SELECT * FROM uploaded_files WHERE patient_id = ? ORDER BY uploaded_at", (patient_id,)).fetchall()]
        quality_rows = [row_to_quality_issue(row) for row in conn.execute("SELECT * FROM data_quality_issues WHERE patient_id = ? ORDER BY created_at", (patient_id,)).fetchall()]
        return {
            "patient": patient,
            "samples": sample_rows,
            "omics_records": omics_rows,
            "consents": consents,
            "visits": visit_rows,
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
def patient_journey(patient_id: str) -> dict[str, Any]:
    return patient_panorama(patient_id)
