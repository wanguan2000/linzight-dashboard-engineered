from __future__ import annotations

import csv
import hashlib
import json
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from .database import (
        UPLOADS_DIR,
        connect,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_audit_log,
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
    from .schemas import CrfEntryCreate, CrfEntryUpdate, ExportJobCreate, LoginRequest, OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate
    from .seed import seed_database
except ImportError:  # Allows `cd backend && uvicorn main:app`.
    from database import (
        UPLOADS_DIR,
        connect,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_audit_log,
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
    from schemas import CrfEntryCreate, CrfEntryUpdate, ExportJobCreate, LoginRequest, OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate
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
def me(token: str | None = Query(default=None)) -> dict[str, Any]:
    if not token or not token.startswith("demo-token-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing demo token")
    user_id = token.replace("demo-token-", "", 1)
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
def create_patient(payload: PatientCreate) -> dict[str, Any]:
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
            row = fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,))
            return row_to_patient(row)
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
def update_patient(patient_id: str, payload: PatientUpdate) -> dict[str, Any]:
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
        result = conn.execute(f"UPDATE patients SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        return row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))


@app.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: str) -> None:
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
def create_sample(payload: SampleCreate) -> dict[str, Any]:
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
            return row_to_sample(fetch_one(conn, "SELECT * FROM samples WHERE id = ?", (sample_id,)))
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
def update_sample(sample_id: str, payload: SampleUpdate) -> dict[str, Any]:
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
def delete_sample(sample_id: str) -> None:
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
def create_omics(payload: OmicsCreate) -> dict[str, Any]:
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
            return row_to_omics(fetch_one(conn, "SELECT * FROM omics_records WHERE id = ?", (record_id,)))
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
def update_omics(record_id: str, payload: OmicsUpdate) -> dict[str, Any]:
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
def delete_omics(record_id: str) -> None:
    with connect() as conn:
        result = conn.execute("DELETE FROM omics_records WHERE id = ?", (record_id,))
        if result.rowcount == 0:
            raise not_found()


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
def create_crf_entry(payload: CrfEntryCreate) -> dict[str, Any]:
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
            return row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/crf/{entry_id}")
def update_crf_entry(entry_id: str, payload: CrfEntryUpdate) -> dict[str, Any]:
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
        result = conn.execute(f"UPDATE crf_entries SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        return row_to_crf_entry(fetch_one(conn, "SELECT * FROM crf_entries WHERE id = ?", (entry_id,)))


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
) -> dict[str, Any]:
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
                uploaded_by,
                now,
                1 if is_deidentified else 0,
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
        return {
            "patient_count": conn.execute("SELECT COUNT(*) AS count FROM patients").fetchone()["count"],
            "disease_distribution": disease_distribution,
            "sample_count": conn.execute("SELECT COUNT(*) AS count FROM samples").fetchone()["count"],
            "omics_count": omics_count,
            "completed_omics_count": conn.execute("SELECT COUNT(*) AS count FROM omics_records WHERE status = '结果归档'").fetchone()["count"],
            "data_completeness_avg": round(sum(completeness_values) / len(completeness_values), 1) if completeness_values else 0,
        }


@app.post("/exports", status_code=status.HTTP_201_CREATED)
def create_export_job(payload: ExportJobCreate) -> dict[str, Any]:
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
                data["requested_by"],
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO export_jobs (id, requested_by, export_type, scope_json, status, file_id, created_at, completed_at)
            VALUES (?, ?, ?, ?, 'ready', ?, ?, ?)
            """,
            (export_id, data["requested_by"], data["export_type"], encode_json(data["scope"]), file_id, now, now),
        )
        return row_to_export_job(fetch_one(conn, "SELECT * FROM export_jobs WHERE id = ?", (export_id,)))


@app.get("/exports")
def list_export_jobs() -> list[dict[str, Any]]:
    with connect() as conn:
        return [row_to_export_job(row) for row in conn.execute("SELECT * FROM export_jobs ORDER BY created_at DESC").fetchall()]


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
