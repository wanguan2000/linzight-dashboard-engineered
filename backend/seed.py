from __future__ import annotations

try:
    from .database import connect, encode_json, initialize_schema, utc_now
except ImportError:  # Allows `cd backend && python seed.py`.
    from database import connect, encode_json, initialize_schema, utc_now


PATIENTS = [
    ("PAT-001", "LGL-1111", "LQH-023", "23018456", "女", 33, "NPSLE", ["皮肤", "肾"], "近期采血，下次随访风险低", 96),
    ("PAT-002", "LGL-1111", "WYM-184", "24002391", "男", 31, "Non-NPSLE", ["皮肤"], "临床数据待补录", 76),
    ("PAT-003", "LGL-1111", "ZXR-512", "22091734", "女", 42, "NMOSD", ["神经系统"], "脑脊液样本已完成检测", 100),
    ("PAT-004", "LGL-1111", "CJY-308", "21056288", "男", 56, "MS", ["神经系统"], "下次随访需评估神经症状", 94),
    ("PAT-005", "LGL-1111", "LYT-447", "23047322", "女", 29, "NPSLE", ["皮肤", "神经系统"], "近期采血，等待多组学结果", 82),
    ("PAT-006", "LGL-1111", "HQN-065", "24011873", "男", 38, "Non-NPSLE", ["肾"], "肾样本已入库", 89),
]

SAMPLES = [
    ("SPL-2024-0501-001", "PAT-001", "LQH-023", "23018456", "血液", "V1 基线访视", "2024-05-01", "-80℃冰箱A1", "结果回传", ["WGS", "蛋白组"]),
    ("SPL-2024-0501-002", "PAT-001", "LQH-023", "23018456", "血液", "V1 基线访视", "2024-05-01", "-80℃冰箱A2", "结果回传", ["代谢组"]),
    ("SPL-2024-0501-003", "PAT-001", "LQH-023", "23018456", "CSF", "V1 基线访视", "2024-05-01", "液氮罐C1", "检测中", ["Olink/Simoa"]),
    ("SPL-2024-0601-004", "PAT-002", "WYM-184", "24002391", "血液", "V2 1月随访", "2024-06-01", "-80℃冰箱B1", "已送检", ["TCR/BCR"]),
    ("SPL-2024-0601-005", "PAT-003", "ZXR-512", "22091734", "CSF", "V2 1月随访", "2024-06-01", "液氮罐C2", "结果回传", ["Olink/Simoa"]),
    ("SPL-2024-0801-006", "PAT-004", "CJY-308", "21056288", "血液", "V3 3月随访", "2024-08-01", "-80℃冰箱A3", "检测中", ["WGS"]),
    ("SPL-2024-0801-007", "PAT-004", "CJY-308", "21056288", "CSF", "V3 3月随访", "2024-08-01", "液氮罐C3", "已采集", ["Olink/Simoa"]),
    ("SPL-2024-0901-008", "PAT-005", "LYT-447", "23047322", "血液", "V3 3月随访", "2024-09-01", "-80℃冰箱B2", "已送检", ["蛋白组"]),
    ("SPL-2024-0901-009", "PAT-006", "HQN-065", "24011873", "肾", "V1 基线访视", "2024-09-01", "病理库R1", "结果回传", ["代谢组"]),
    ("SPL-2024-1001-010", "PAT-001", "LQH-023", "23018456", "尿液", "V4 6月随访", "2024-10-01", "-80℃冰箱A4", "待处理", ["代谢组"]),
]

OMICS = [
    ("OMX-001", "PAT-001", "LQH-023", "SPL-2024-0501-001", "血液", "WGS", "NovaSeq 6000", "WGS-260423-A", "结果归档", "通过", "2024-04-20", "2024-04-26"),
    ("OMX-002", "PAT-001", "LQH-023", "SPL-2024-0501-002", "血液", "蛋白组", "Exploris 480", "PRO-260423-B", "结果归档", "通过", "2024-04-20", "2024-04-25"),
    ("OMX-003", "PAT-001", "LQH-023", "SPL-2024-0501-003", "CSF", "Olink/Simoa", "Olink Explore", "OL-260423-C", "数据分析", "待确认", "2024-04-22", "-"),
    ("OMX-004", "PAT-002", "WYM-184", "SPL-2024-0601-004", "血液", "TCR/BCR", "Illumina", "IR-260420-B", "测序完成", "通过", "2024-04-18", "2024-04-24"),
    ("OMX-005", "PAT-003", "ZXR-512", "SPL-2024-0601-005", "CSF", "Olink/Simoa", "Simoa HD-X", "SM-260418-A", "结果归档", "通过", "2024-04-18", "2024-04-22"),
    ("OMX-006", "PAT-004", "CJY-308", "SPL-2024-0801-006", "血液", "WGS", "NovaSeq", "WGS-260416-F", "数据分析", "待确认", "2024-04-16", "-"),
    ("OMX-007", "PAT-004", "CJY-308", "SPL-2024-0801-007", "CSF", "Olink/Simoa", "Olink Explore", "OL-260416-G", "文库构建", "待确认", "2024-04-16", "-"),
    ("OMX-008", "PAT-005", "LYT-447", "SPL-2024-0901-008", "血液", "蛋白组", "Exploris 480", "PRO-260417-D", "样本接收", "待确认", "2024-04-17", "-"),
    ("OMX-009", "PAT-006", "HQN-065", "SPL-2024-0901-009", "肾", "代谢组", "Q-Exactive", "MET-260418-E", "结果归档", "通过", "2024-04-18", "2024-04-23"),
    ("OMX-010", "PAT-001", "LQH-023", "SPL-2024-1001-010", "尿液", "代谢组", "Q-Exactive", "MET-260419-H", "样本接收", "待确认", "2024-04-19", "-"),
]


def clinical_data(name: str, hospital_no: str, sex: str, age: int, disease: str, organs: list[str], completeness: int) -> dict[str, object]:
    return {
        "姓名": name,
        "性别": sex,
        "年龄": age,
        "住院号": hospital_no,
        "疾病类型": disease,
        "受累脏器": "、".join(organs),
        "SLEDAI评分": 12 if disease == "NPSLE" else 4,
        "数据完整度": completeness,
        "WBC": 10.73,
        "HB(g/L)": 111,
        "PLT(^10*9/L)": 400,
        "C3(g/l)": 0.94,
        "C4(g/l)": 0.71,
    }


def seed_database() -> None:
    initialize_schema()
    now = utc_now()
    with connect() as conn:
        conn.executescript("DELETE FROM omics_records; DELETE FROM samples; DELETE FROM visits; DELETE FROM consents; DELETE FROM patients;")
        conn.executemany(
            """
            INSERT INTO patients
              (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    pid,
                    study,
                    name,
                    hospital_no,
                    sex,
                    age,
                    disease,
                    encode_json(organs),
                    note,
                    encode_json(clinical_data(name, hospital_no, sex, age, disease, organs, completeness)),
                    now,
                    now,
                )
                for pid, study, name, hospital_no, sex, age, disease, organs, note, completeness in PATIENTS
            ],
        )
        conn.executemany(
            """
            INSERT INTO samples
              (id, patient_id, patient_name, hospital_no, sample_type, visit, collected_at, storage, status, linked_omics_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*sample[:9], encode_json(sample[9]), now, now) for sample in SAMPLES],
        )
        conn.executemany(
            """
            INSERT INTO omics_records
              (id, patient_id, patient_name, sample_id, sample_type, assay, platform, run_id, status, qc, sent_at, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*record, now, now) for record in OMICS],
        )
        conn.executemany(
            "INSERT INTO consents (id, patient_id, status, version, signed_at, method) VALUES (?, ?, ?, ?, ?, ?)",
            [
                ("CON-001", "PAT-001", "已签署", "V1.0", "2026-04-23", "电子"),
                ("CON-002", "PAT-002", "待签署", "V1.0", "-", "-"),
                ("CON-003", "PAT-003", "已签署", "V1.0", "2026-04-20", "电子"),
                ("CON-004", "PAT-004", "已撤回", "V1.0", "2026-04-18", "纸质"),
                ("CON-005", "PAT-005", "已签署", "V1.0", "2026-04-18", "纸质"),
            ],
        )
        conn.executemany(
            """
            INSERT INTO visits
              (id, patient_id, visit, visit_date, visit_type, sle_dai, medication, sample_collection, completeness, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("VIS-001", "PAT-001", "V1 基线访视", "2024-05-01", "基线访视", "12", "MMF 1.0g/d", "血液、尿液", 92, "已完成"),
                ("VIS-002", "PAT-001", "V2 1月随访", "2024-06-01", "随访访视", "8", "MMF 1.5g/d", "血液、尿液", 90, "已完成"),
                ("VIS-003", "PAT-001", "V3 3月随访", "2024-08-01", "随访访视", "6", "MMF 1.5g/d + HCQ", "血液、尿液、CSF", 86, "进行中"),
                ("VIS-004", "PAT-001", "V4 6月随访", "2024-11-01", "随访访视", "--", "计划评估", "血液、尿液", 0, "已预约"),
            ],
        )


if __name__ == "__main__":
    seed_database()
    print("Seeded LinZight demo database.")
