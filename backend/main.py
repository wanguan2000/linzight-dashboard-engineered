from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import date, timedelta
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
        row_to_crf_version,
        row_to_crf_entry,
        row_to_export_job,
        row_to_file,
        row_to_follow_up_record,
        row_to_omics,
        row_to_patient,
        row_to_quality_issue,
        row_to_sample,
        row_to_study,
        row_to_study_member,
        row_to_study_visit_plan,
        row_to_user,
        row_to_visit,
        sqlite_json_storage,
        utc_now,
    )
    from .permissions import can_access_study, first_accessible_study_id, get_user_study_scope, role_can, user_role
    from .schemas import ConsentUpdate, CrfEntryCreate, CrfEntryUpdate, ExportJobCreate, FollowUpRecordCreate, FollowUpRecordUpdate, LoginRequest, OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate, StudyCrfVersionCreate, StudyMemberCreate, StudyVisitPlanCreate, StudyVisitPlanUpdate
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
        row_to_crf_version,
        row_to_crf_entry,
        row_to_export_job,
        row_to_file,
        row_to_follow_up_record,
        row_to_omics,
        row_to_patient,
        row_to_quality_issue,
        row_to_sample,
        row_to_study,
        row_to_study_member,
        row_to_study_visit_plan,
        row_to_user,
        row_to_visit,
        sqlite_json_storage,
        utc_now,
    )
    from permissions import can_access_study, first_accessible_study_id, get_user_study_scope, role_can, user_role
    from schemas import ConsentUpdate, CrfEntryCreate, CrfEntryUpdate, ExportJobCreate, FollowUpRecordCreate, FollowUpRecordUpdate, LoginRequest, OmicsCreate, OmicsUpdate, PatientCreate, PatientUpdate, SampleCreate, SampleUpdate, StudyCrfVersionCreate, StudyMemberCreate, StudyVisitPlanCreate, StudyVisitPlanUpdate
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


def patient_study_id(conn: Any, patient_id: str) -> str:
    row = fetch_one(conn, "SELECT study_id FROM patients WHERE id = ?", (patient_id,))
    return row["study_id"]


def visit_patient_scope(conn: Any, visit_id: str) -> dict[str, Any]:
    row = fetch_one(conn, "SELECT study_id, patient_id FROM visits WHERE id = ?", (visit_id,))
    return {"study_id": row["study_id"], "patient_id": row["patient_id"]}


def forbid_locked_crf_update(before: dict[str, Any], data: dict[str, Any]) -> None:
    if before["status"] == "locked" and any(key in data for key in {"payload", "module", "form_id", "crf_version_id", "study_id"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="permission denied")


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
    conn.execute(
        """
        INSERT INTO audit_logs (id, study_id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    return "CRFV-LGL-1111-V0.1"


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
        sle_dai = clinical_data.get("SLEDAI评分")
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
                str(sle_dai if sle_dai is not None else "待录入"),
                str(clinical_data.get("免疫抑制剂1") or clinical_data.get("初始治疗方案") or "待录入"),
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
        user = load_user(conn, row["id"])
        return {"access_token": demo_token(user["id"]), "token_type": "bearer", "user": user}


@app.get("/auth/me")
def me(token: str | None = Query(default=None), authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user_id = token_to_user_id(authorization=authorization, token=token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing demo token")
    with connect() as conn:
        try:
            return load_user(conn, user_id)
        except KeyError as exc:
            raise not_found() from exc


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
        member = row_to_study_member(fetch_one(conn, "SELECT * FROM study_members WHERE study_id = ? AND user_id = ?", (study_id, payload.user_id)))
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
        now = utc_now()
        published_at = now if payload.status == "published" else None
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
        return version


@app.get("/patients")
def list_patients(
    q: str | None = Query(default=None),
    disease_type: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM patients"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "patients", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
        if q:
            where.append("(name LIKE ? OR hospital_no LIKE ? OR disease_type LIKE ?)")
            params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
        if disease_type:
            where.append("disease_type = ?")
            params.append(disease_type)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC"
        return [row_to_patient(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/patients", status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
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
            insert_audit(conn, user, "create", "patients", patient_id, after=row, study_id=data["study_id"])
            row["generated_visit_count"] = created_plan_items["visits"]
            row["generated_crf_count"] = created_plan_items["crf_entries"]
            return row
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        try:
            patient = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
            authorize(authorization, "patients", "read", study_id=patient["study_id"], conn=conn)
            return patient
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
            return row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        columns.append("updated_at = ?")
        values.extend([utc_now(), patient_id])
        result = conn.execute(f"UPDATE patients SET {', '.join(columns)} WHERE id = ?", values)
        if result.rowcount == 0:
            raise not_found()
        after = row_to_patient(fetch_one(conn, "SELECT * FROM patients WHERE id = ?", (patient_id,)))
        insert_audit(conn, user, "update", "patients", patient_id, before=before, after=after, study_id=after["study_id"])
        return after


@app.delete("/patients/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: str, authorization: str | None = Header(default=None)) -> None:
    with connect() as conn:
        study_id = patient_study_id(conn, patient_id)
        authorize(authorization, "patients", "write", study_id=study_id, conn=conn)
        result = conn.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        if result.rowcount == 0:
            raise not_found()


@app.get("/samples")
def list_samples(
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM samples"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "samples", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY collected_at DESC"
        return [row_to_sample(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/samples", status_code=status.HTTP_201_CREATED)
def create_sample(payload: SampleCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    sample_id = data.pop("id") or f"SPL-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
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
            authorize(authorization, "samples", "read", study_id=sample["study_id"], conn=conn)
            return sample
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


@app.get("/visits")
def list_visits(
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
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
        user = authorize(authorization, "visits", "read", conn=conn)
        append_study_filter(conn, user, where, params, "v.study_id", study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("v.patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY v.visit_date DESC"
        return [row_to_visit(row) for row in conn.execute(sql, params).fetchall()]


@app.get("/follow-up-records")
def list_follow_up_records(
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
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
        user = authorize(authorization, "follow_up_records", "read", conn=conn)
        append_study_filter(conn, user, where, params, "f.study_id", study_id)
        if patient_id:
            patient_scope = patient_study_id(conn, patient_id)
            if not can_access_study(conn, user, patient_scope):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="study access denied")
            where.append("f.patient_id = ?")
            params.append(patient_id)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY f.follow_up_date DESC, f.recorded_at DESC"
        return [row_to_follow_up_record(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/follow-up-records", status_code=status.HTTP_201_CREATED)
def create_follow_up_record(payload: FollowUpRecordCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    record_id = data.pop("id") or f"FUP-{uuid4().hex[:10].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
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


@app.get("/omics")
def list_omics(
    patient_id: str | None = None,
    sample_id: str | None = None,
    study_id: str | None = None,
    testing_project_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM omics_records"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "omics", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
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
        return [row_to_omics(row) for row in conn.execute(sql, params).fetchall()]


@app.post("/omics", status_code=status.HTTP_201_CREATED)
def create_omics(payload: OmicsCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    record_id = data.pop("id") or f"OMX-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
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
            authorize(authorization, "omics", "read", study_id=record["study_id"], conn=conn)
            return record
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


@app.get("/consents")
def list_consents(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
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
        user = authorize(authorization, "consents", "read", conn=conn)
        append_study_filter(conn, user, where, params, "c.study_id", study_id)
        if q:
            where.append("(p.name LIKE ? OR p.hospital_no LIKE ? OR p.disease_type LIKE ?)")
            params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
        if status_filter:
            where.append("c.status = ?")
            params.append(status_filter)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY p.id"
        return [row_to_consent(row) for row in conn.execute(sql, params).fetchall()]


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
        return row_to_consent(joined)


@app.get("/crf")
def list_crf_entries(
    patient_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    study_id: str | None = None,
    crf_version_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM crf_entries"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "crf", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
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


@app.post("/crf", status_code=status.HTTP_201_CREATED)
def create_crf_entry(payload: CrfEntryCreate, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    data = dump_model(payload)
    entry_id = data.pop("id") or f"CRF-{uuid4().hex[:8].upper()}"
    now = utc_now()
    with connect() as conn:
        study_id = patient_study_id(conn, data["patient_id"])
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


@app.get("/files")
def list_files(
    patient_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM uploaded_files"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "files", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
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
    target_dir = UPLOADS_DIR / category
    target_dir.mkdir(parents=True, exist_ok=True)
    storage_path = target_dir / stored_filename
    storage_path.write_bytes(content)
    now = utc_now()
    with connect() as conn:
        study_id = "LGL-1111"
        if patient_id:
            study_id = patient_study_id(conn, patient_id)
        elif sample_id:
            sample_row = fetch_one(conn, "SELECT study_id FROM samples WHERE id = ?", (sample_id,))
            study_id = sample_row["study_id"]
        elif omics_id:
            omics_row = fetch_one(conn, "SELECT study_id FROM omics_records WHERE id = ?", (omics_id,))
            study_id = omics_row["study_id"]
        elif consent_id:
            consent_row = fetch_one(conn, "SELECT study_id FROM consents WHERE id = ?", (consent_id,))
            study_id = consent_row["study_id"]
        user = authorize(authorization, "files", "write", study_id=study_id, conn=conn)
        conn.execute(
            """
            INSERT INTO uploaded_files
              (id, study_id, patient_id, sample_id, omics_id, consent_id, category, original_filename, stored_filename, storage_path, content_type, size_bytes, sha256, uploaded_by, uploaded_at, is_deidentified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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


@app.get("/analytics/summary")
def analytics_summary(study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    with connect() as conn:
        user = authorize(authorization, "patients", "read", conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", study_id)
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


@app.get("/quality/issues")
def list_quality_issues(
    patient_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM data_quality_issues"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "quality", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
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


@app.post("/quality/run")
def run_quality_checks(study_id: str | None = None, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    now = utc_now()
    issue_rows: list[tuple[Any, ...]] = []
    with connect() as conn:
        user = authorize(authorization, "quality", "write", conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", study_id)
        sql = "SELECT * FROM patients"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY id"
        patients = [row_to_patient(row) for row in conn.execute(sql, params).fetchall()]
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
        delete_where = ["status = 'open'"]
        delete_params: list[Any] = []
        append_study_filter(conn, user, delete_where, delete_params, "study_id", study_id)
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
                study_id or first_accessible_study_id(conn, user) or "LGL-1111",
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
        requested_study_id = str(data["scope"].get("study_id") or first_accessible_study_id(conn, temp_user) or "LGL-1111")
        user = authorize(authorization, "exports", "write", study_id=requested_study_id, conn=conn)
        patient_rows = conn.execute(
            "SELECT study_id, id, name, hospital_no, sex, age, disease_type, note FROM patients WHERE study_id = ? ORDER BY id",
            (requested_study_id,),
        ).fetchall()
        with export_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["study_id", "id", "name", "hospital_no", "sex", "age", "disease_type", "note"])
            writer.writerows([tuple(row) for row in patient_rows])
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


@app.get("/exports")
def list_export_jobs(study_id: str | None = None, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    with connect() as conn:
        user = authorize(authorization, "exports", "read", conn=conn)
        where: list[str] = []
        params: list[Any] = []
        append_study_filter(conn, user, where, params, "study_id", study_id)
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
    return FileResponse(file_row["storage_path"], media_type=file_row["content_type"], filename=file_row["original_filename"])


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


@app.get("/audit-logs")
def list_audit_logs(
    entity_type: str | None = None,
    entity_id: str | None = None,
    study_id: str | None = None,
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM audit_logs"
    params: list[Any] = []
    where: list[str] = []
    with connect() as conn:
        user = authorize(authorization, "audit", "read", conn=conn)
        append_study_filter(conn, user, where, params, "study_id", study_id)
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
            authorize(authorization, "patients", "read", study_id=patient["study_id"], conn=conn)
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
            "patient": patient,
            "samples": sample_rows,
            "omics_records": omics_rows,
            "consents": consents,
            "visits": visit_rows,
            "follow_up_records": follow_up_rows,
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
