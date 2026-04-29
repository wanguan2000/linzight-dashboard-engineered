from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

try:
    from .database import (
        connect,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_omics,
        row_to_patient,
        row_to_sample,
        utc_now,
    )
    from .schemas import OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate
    from .seed import seed_database
except ImportError:  # Allows `cd backend && uvicorn main:app`.
    from database import (
        connect,
        encode_json,
        fetch_one,
        initialize_schema,
        row_to_omics,
        row_to_patient,
        row_to_sample,
        utc_now,
    )
    from schemas import OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "linzight-demo-api"}


@app.post("/seed")
def seed() -> dict[str, str]:
    seed_database()
    return {"status": "seeded"}


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
        return {
            "patient": patient,
            "samples": sample_rows,
            "omics_records": omics_rows,
            "consents": consents,
            "visits": visit_rows,
            "summary": {
                "sample_count": len(sample_rows),
                "omics_count": len(omics_rows),
                "completed_omics_count": len([record for record in omics_rows if record["status"] == "结果归档"]),
                "latest_visit": visit_rows[-1]["visit"] if visit_rows else None,
            },
        }
