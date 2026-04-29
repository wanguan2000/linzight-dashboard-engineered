from __future__ import annotations

import hashlib
from datetime import date, timedelta

try:
    from .database import ROLE_VALUES, connect, encode_json, initialize_schema, utc_now
except ImportError:  # Allows `cd backend && python seed.py`.
    from database import ROLE_VALUES, connect, encode_json, initialize_schema, utc_now


DISEASES = ["NPSLE", "Non-NPSLE", "MS", "NMOSD", "HC"]
ASSAYS = ["WGS", "TCR/BCR", "Olink/Simoa", "蛋白组", "代谢组"]
PLATFORMS = {
    "WGS": "NovaSeq 6000",
    "TCR/BCR": "MiSeq",
    "Olink/Simoa": "Olink Explore",
    "蛋白组": "Exploris 480",
    "代谢组": "Q-Exactive",
}
USER_ROWS = [
    ("USR-001", "pi@demo.linzight", "约翰·伦格", "investigator"),
    ("USR-002", "crc@demo.linzight", "林清妍", "crc"),
    ("USR-003", "dm@demo.linzight", "陈序", "data_manager"),
    ("USR-004", "project@demo.linzight", "顾明远", "project_admin"),
    ("USR-005", "admin@demo.linzight", "系统管理员", "sys_admin"),
    ("USR-006", "viewer@demo.linzight", "审阅者", "viewer"),
]


def password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def patient_code(index: int) -> str:
    prefixes = ["LQH", "WYM", "ZXR", "CJY", "LYT", "HQN", "QML", "SYF", "ZYW", "GCH"]
    return f"{prefixes[index % len(prefixes)]}-{index + 101:03d}"


def organs_for_disease(disease: str, index: int) -> list[str]:
    if disease == "NPSLE":
        return ["神经系统", "皮肤"] if index % 2 else ["神经系统", "肾"]
    if disease == "Non-NPSLE":
        return ["皮肤", "肾"] if index % 3 else ["肾"]
    if disease in {"MS", "NMOSD"}:
        return ["神经系统"]
    return ["健康对照"]


def sample_plan(disease: str, index: int) -> list[str]:
    if disease == "HC":
        return ["血液"]
    if disease in {"MS", "NMOSD"}:
        return ["血液", "CSF"] if index % 2 else ["CSF"]
    if disease == "NPSLE":
        return ["血液", "CSF", "肾"] if index % 4 == 0 else ["血液", "CSF"]
    return ["血液", "肾"] if index % 3 == 0 else ["血液"]


def clinical_data(name: str, hospital_no: str, sex: str, age: int, disease: str, organs: list[str], completeness: int) -> dict[str, object]:
    disease_activity = 12 if disease == "NPSLE" else 7 if disease in {"MS", "NMOSD"} else 4 if disease == "Non-NPSLE" else 0
    return {
        "患者编号": name,
        "姓名": name,
        "性别": sex,
        "年龄": age,
        "住院号": hospital_no,
        "疾病类型": disease,
        "出院诊断": disease,
        "受累脏器": "、".join(organs),
        "SLEDAI评分": disease_activity,
        "PGA评分": 2 if disease != "HC" else 0,
        "数据完整度": completeness,
        "WBC": round(5.2 + (age % 8) * 0.61, 2),
        "HB(g/L)": 105 + (age % 28),
        "PLT(^10*9/L)": 180 + (age % 12) * 18,
        "C3(g/l)": round(0.62 + (age % 9) * 0.05, 2),
        "C4(g/l)": round(0.13 + (age % 7) * 0.03, 2),
    }


def build_seed_rows() -> dict[str, list[tuple]]:
    base_date = date(2024, 5, 1)
    patients: list[tuple] = []
    samples: list[tuple] = []
    omics: list[tuple] = []
    consents: list[tuple] = []
    visits: list[tuple] = []
    crf_entries: list[tuple] = []

    for index in range(50):
        patient_id = f"PAT-{index + 1:03d}"
        disease = DISEASES[index % len(DISEASES)]
        name = patient_code(index)
        hospital_no = f"{23000000 + index * 137:08d}"
        sex = "女" if index % 2 == 0 else "男"
        age = 19 + (index * 7) % 48
        organs = organs_for_disease(disease, index)
        completeness = 68 + (index * 7) % 33
        note = "健康对照质控通过" if disease == "HC" else f"{disease} 队列随访中，完整度 {completeness}%"
        patient_date = base_date + timedelta(days=index * 3)

        patients.append(
            (
                patient_id,
                "LGL-1111",
                name,
                hospital_no,
                sex,
                age,
                disease,
                encode_json(organs),
                note,
                encode_json(clinical_data(name, hospital_no, sex, age, disease, organs, completeness)),
            )
        )
        consents.append(
            (
                f"CON-{index + 1:03d}",
                patient_id,
                "待签署" if index % 9 == 1 else "已撤回" if index % 17 == 3 else "已签署",
                "V1.0",
                "-" if index % 9 == 1 else str(patient_date),
                "-" if index % 9 == 1 else "电子" if index % 2 == 0 else "纸质",
            )
        )

        for visit_index, visit_name in enumerate(["V1 基线访视", "V2 1月随访", "V3 3月随访"]):
            visit_date = patient_date + timedelta(days=visit_index * 32)
            visit_status = "已完成" if visit_index < 2 or index % 3 else "进行中"
            visit_id = f"VIS-{index + 1:03d}-{visit_index + 1}"
            visits.append(
                (
                    visit_id,
                    patient_id,
                    visit_name,
                    str(visit_date),
                    "基线访视" if visit_index == 0 else "随访访视",
                    str(max(0, int(clinical_data(name, hospital_no, sex, age, disease, organs, completeness)["SLEDAI评分"]) - visit_index * 2)),
                    "HCQ" if disease != "HC" else "无",
                    "、".join(sample_plan(disease, index)) if visit_index == 0 else "血液",
                    max(0, completeness - visit_index * 4),
                    visit_status,
                )
            )
            crf_entries.append(
                (
                    f"CRF-{index + 1:03d}-{visit_index + 1}",
                    patient_id,
                    visit_id,
                    "baseline" if visit_index == 0 else "follow_up",
                    encode_json(clinical_data(name, hospital_no, sex, age, disease, organs, max(0, completeness - visit_index * 4))),
                    "submitted" if visit_status == "已完成" else "draft",
                    "USR-002",
                    str(visit_date) if visit_status == "已完成" else None,
                )
            )

        for sample_index, sample_type in enumerate(sample_plan(disease, index), start=1):
            sample_id = f"SPL-2024-{index + 1:03d}-{sample_index:02d}"
            collected_at = patient_date + timedelta(days=sample_index - 1)
            linked_omics = [ASSAYS[(index + sample_index) % len(ASSAYS)]]
            if disease != "HC" and sample_index == 1:
                linked_omics.append(ASSAYS[(index + sample_index + 2) % len(ASSAYS)])
            samples.append(
                (
                    sample_id,
                    patient_id,
                    name,
                    hospital_no,
                    sample_type,
                    "V1 基线访视",
                    str(collected_at),
                    "液氮罐C1" if sample_type == "CSF" else "病理库R1" if sample_type == "肾" else "-80℃冰箱A1",
                    "结果回传" if index % 4 else "检测中",
                    encode_json(linked_omics),
                )
            )
            for assay_index, assay in enumerate(linked_omics, start=1):
                status = "结果归档" if index % 4 else "数据分析"
                omics.append(
                    (
                        f"OMX-{index + 1:03d}-{sample_index}{assay_index}",
                        patient_id,
                        name,
                        sample_id,
                        sample_type,
                        assay,
                        PLATFORMS[assay],
                        f"{assay.replace('/', '')}-{260400 + index}-{sample_index}{assay_index}",
                        status,
                        "通过" if status == "结果归档" else "待确认",
                        str(collected_at + timedelta(days=1)),
                        str(collected_at + timedelta(days=7)) if status == "结果归档" else "-",
                    )
                )

    return {
        "patients": patients,
        "samples": samples,
        "omics": omics,
        "consents": consents,
        "visits": visits,
        "crf_entries": crf_entries,
    }


def seed_database() -> None:
    initialize_schema()
    now = utc_now()
    rows = build_seed_rows()
    with connect() as conn:
        conn.executescript(
            """
            DELETE FROM audit_logs;
            DELETE FROM data_quality_issues;
            DELETE FROM export_jobs;
            DELETE FROM uploaded_files;
            DELETE FROM crf_entries;
            DELETE FROM omics_records;
            DELETE FROM samples;
            DELETE FROM visits;
            DELETE FROM consents;
            DELETE FROM role_permissions;
            DELETE FROM users;
            DELETE FROM patients;
            """
        )
        conn.executemany(
            """
            INSERT INTO users (id, username, display_name, role, password_hash, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            [(user_id, username, display_name, role, password_hash("demo123"), now, now) for user_id, username, display_name, role in USER_ROWS],
        )
        conn.executemany(
            "INSERT INTO role_permissions (role, resource, action) VALUES (?, ?, ?)",
            [(role, resource, action) for role in ROLE_VALUES for resource in ["patients", "crf", "samples", "omics", "files", "exports"] for action in ["read", "write"]],
        )
        conn.executemany(
            """
            INSERT INTO patients
              (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*patient, now, now) for patient in rows["patients"]],
        )
        conn.executemany(
            """
            INSERT INTO consents (id, patient_id, status, version, signed_at, method)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            rows["consents"],
        )
        conn.executemany(
            """
            INSERT INTO visits
              (id, patient_id, visit, visit_date, visit_type, sle_dai, medication, sample_collection, completeness, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows["visits"],
        )
        conn.executemany(
            """
            INSERT INTO crf_entries
              (id, patient_id, visit_id, module, payload_json, status, completed_by, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*entry, now, now) for entry in rows["crf_entries"]],
        )
        conn.executemany(
            """
            INSERT INTO samples
              (id, patient_id, patient_name, hospital_no, sample_type, visit, collected_at, storage, status, linked_omics_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*sample, now, now) for sample in rows["samples"]],
        )
        conn.executemany(
            """
            INSERT INTO omics_records
              (id, patient_id, patient_name, sample_id, sample_type, assay, platform, run_id, status, qc, sent_at, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*record, now, now) for record in rows["omics"]],
        )
        conn.execute(
            """
            INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("AUD-SEED-001", "USR-005", "sys_admin", "seed", "database", "linzight_demo", None, encode_json({"patients": 50}), "127.0.0.1", now),
        )


if __name__ == "__main__":
    seed_database()
    print("Seeded LinZight demo database with 50 patients.")
