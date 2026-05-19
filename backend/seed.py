from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

try:
    from .database import ROLE_VALUES, connect, encode_json, initialize_schema, sqlite_json_storage, sync_study_configurations, utc_now
    from .security import DEFAULT_DEMO_PASSWORD, hash_password
except ImportError:  # Allows `cd backend && python seed.py`.
    from database import ROLE_VALUES, connect, encode_json, initialize_schema, sqlite_json_storage, sync_study_configurations, utc_now
    from security import DEFAULT_DEMO_PASSWORD, hash_password


DISEASES = ["NPSLE", "Non-NPSLE", "MS", "NMOSD", "HC"]
LUNG_RESISTANCE_DISEASES = ["NSCLC", "LUAD", "LUSC", "EGFR-TKI耐药", "ALK耐药"]
LUNG_RESISTANCE_STUDY_ID = "LZXK-01"
CRF_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "resource" / "sle-crf-v0.1.schema.json"
ASSAYS = ["WGS", "TCR/BCR", "Olink/Simoa", "蛋白组", "代谢组"]
LUNG_ASSAYS_BY_SAMPLE = {
    "血液": ["ctDNA", "NGS panel"],
    "组织": ["NGS panel", "病理复核"],
    "胸水": ["ctDNA"],
}
PLATFORMS = {
    "WGS": "NovaSeq 6000",
    "TCR/BCR": "MiSeq",
    "Olink/Simoa": "Olink Explore",
    "蛋白组": "Exploris 480",
    "代谢组": "Q-Exactive",
    "NGS panel": "NovaSeq 6000",
    "ctDNA": "NextSeq 2000",
    "病理复核": "Pathology Archive",
}
STUDY_ROWS = [
    ("LGL-1111", "LGL-1111", "免疫相关性神经系统疾病 RWD 研究", "NPSLE / MS / NMOSD / HC", "RWD", "active", "LinZight"),
    ("RWD-NMO-2026", "RWD-NMO-2026", "NMOSD 真实世界随访研究", "NMOSD / MS", "RWD", "active", "LinZight"),
    (LUNG_RESISTANCE_STUDY_ID, LUNG_RESISTANCE_STUDY_ID, "真实世界肺癌耐药研究", "NSCLC / EGFR-TKI resistance / ALK resistance", "RWD", "active", "LinZight"),
]
USER_ROWS = [
    ("USR-001", "pi@demo.linzight", "任约翰", "investigator", "STUDY_PI"),
    ("USR-002", "crc@demo.linzight", "林清妍", "crc", "STUDY_CRC"),
    ("USR-003", "dm@demo.linzight", "陈序", "data_manager", "STUDY_DATA_MANAGER"),
    ("USR-004", "config@demo.linzight", "顾明远", "project_admin", "STUDY_CONFIG_ADMIN"),
    ("USR-005", "admin@demo.linzight", "系统管理员", "sys_admin", "LZ_ADMIN"),
    ("USR-006", "lz-crc@demo.linzight", "中央 CRC", "crc", "LZ_CRC"),
    ("USR-007", "crf-admin@demo.linzight", "CRF 管理员", "project_admin", "LZ_CRF_ADMIN"),
    ("USR-008", "lz-dm@demo.linzight", "平台数据管理员", "data_manager", "LZ_DATA_MANAGER"),
    ("USR-009", "auditor@demo.linzight", "平台审计员", "viewer", "LZ_AUDITOR"),
    ("USR-010", "lung-pi@demo.linzight", "肺癌 PI", "investigator", "STUDY_PI"),
    ("USR-011", "lung-crc@demo.linzight", "肺癌 CRC", "crc", "STUDY_CRC"),
    ("USR-012", "lung-config@demo.linzight", "肺癌配置管理员", "project_admin", "STUDY_CONFIG_ADMIN"),
    ("USR-013", "lung-dm@demo.linzight", "肺癌数据管理员", "data_manager", "STUDY_DATA_MANAGER"),
]
STUDY_MEMBER_ROWS = [
    ("SMB-001", "LGL-1111", "USR-001", "STUDY_PI", "active"),
    ("SMB-002", "LGL-1111", "USR-002", "STUDY_CRC", "active"),
    ("SMB-003", "LGL-1111", "USR-003", "STUDY_DATA_MANAGER", "active"),
    ("SMB-004", "LGL-1111", "USR-004", "STUDY_CONFIG_ADMIN", "active"),
    ("SMB-005", "RWD-NMO-2026", "USR-004", "STUDY_CONFIG_ADMIN", "active"),
    ("SMB-006", "RWD-NMO-2026", "USR-008", "STUDY_DATA_MANAGER", "active"),
    ("SMB-007", LUNG_RESISTANCE_STUDY_ID, "USR-010", "STUDY_PI", "active"),
    ("SMB-008", LUNG_RESISTANCE_STUDY_ID, "USR-011", "STUDY_CRC", "active"),
    ("SMB-009", LUNG_RESISTANCE_STUDY_ID, "USR-012", "STUDY_CONFIG_ADMIN", "active"),
    ("SMB-010", LUNG_RESISTANCE_STUDY_ID, "USR-013", "STUDY_DATA_MANAGER", "active"),
]
GLOBAL_SCOPE_ROWS = [
    ("GSC-001", "USR-006", "LGL-1111"),
    ("GSC-002", "USR-006", "RWD-NMO-2026"),
    ("GSC-003", "USR-006", LUNG_RESISTANCE_STUDY_ID),
    ("GSC-004", "USR-007", "LGL-1111"),
    ("GSC-005", "USR-007", "RWD-NMO-2026"),
    ("GSC-006", "USR-007", LUNG_RESISTANCE_STUDY_ID),
    ("GSC-007", "USR-008", "RWD-NMO-2026"),
    ("GSC-008", "USR-009", "LGL-1111"),
    ("GSC-009", "USR-009", "RWD-NMO-2026"),
    ("GSC-010", "USR-009", LUNG_RESISTANCE_STUDY_ID),
]
STUDY_VISIT_PLAN_ROWS = [
    ("SVP-LGL-1111-V1", "LGL-1111", "V1", "V1 基线访视", "基线访视", 0, 0, 7, ["baseline"], ["血液", "CSF"], "active", 1),
    ("SVP-LGL-1111-V2", "LGL-1111", "V2", "V2 1月随访", "随访访视", 32, 7, 7, ["follow_up"], ["血液"], "active", 2),
    ("SVP-LGL-1111-V3", "LGL-1111", "V3", "V3 3月随访", "随访访视", 64, 14, 14, ["follow_up"], ["血液"], "active", 3),
    ("SVP-RWD-NMO-2026-V1", "RWD-NMO-2026", "V1", "V1 基线访视", "基线访视", 0, 0, 7, ["baseline"], ["血液", "CSF"], "active", 1),
    ("SVP-RWD-NMO-2026-V2", "RWD-NMO-2026", "V2", "V2 1月随访", "随访访视", 32, 7, 7, ["follow_up"], ["血液"], "active", 2),
    ("SVP-RWD-NMO-2026-V3", "RWD-NMO-2026", "V3", "V3 3月随访", "随访访视", 64, 14, 14, ["follow_up"], ["血液"], "active", 3),
    ("SVP-LZXK-01-V1", LUNG_RESISTANCE_STUDY_ID, "V1", "V1 基线访视", "基线访视", 0, 0, 7, ["baseline"], ["血液", "组织"], "active", 1),
    ("SVP-LZXK-01-V2", LUNG_RESISTANCE_STUDY_ID, "V2", "V2 1月耐药评估", "随访访视", 32, 7, 7, ["follow_up"], ["血液"], "active", 2),
    ("SVP-LZXK-01-V3", LUNG_RESISTANCE_STUDY_ID, "V3", "V3 3月疗效评估", "随访访视", 64, 14, 14, ["follow_up"], ["血液"], "active", 3),
]


def load_crf_schema() -> dict[str, Any]:
    return json.loads(CRF_SCHEMA_PATH.read_text(encoding="utf-8"))


SLE_CRF_SCHEMA = load_crf_schema()
SLE_CRF_FIELDS = [field["name"] for section in SLE_CRF_SCHEMA["sections"] for field in section["fields"]]
SLE_CRF_DEFAULTS = {
    field: value
    for example_row in SLE_CRF_SCHEMA.get("exampleRows", [])
    for field, value in example_row.get("values", {}).items()
}
SLE_CRF_VERSION = SLE_CRF_SCHEMA["version"]
LUNG_CRF_FIELDS = [
    {"id": "LUNG-001", "name": "研究编号", "sourceName": "研究编号", "sourceColumn": 901, "type": "text"},
    {"id": "LUNG-002", "name": "研究名称", "sourceName": "研究名称", "sourceColumn": 902, "type": "text"},
    {"id": "LUNG-003", "name": "病种", "sourceName": "病种", "sourceColumn": 903, "type": "select"},
    {"id": "LUNG-004", "name": "分期", "sourceName": "分期", "sourceColumn": 904, "type": "select"},
    {"id": "LUNG-005", "name": "TNM分期", "sourceName": "TNM分期", "sourceColumn": 905, "type": "text"},
    {"id": "LUNG-006", "name": "ECOG评分", "sourceName": "ECOG评分", "sourceColumn": 906, "type": "number"},
    {"id": "LUNG-007", "name": "治疗线数", "sourceName": "治疗线数", "sourceColumn": 907, "type": "number"},
    {"id": "LUNG-008", "name": "当前治疗方案", "sourceName": "当前治疗方案", "sourceColumn": 908, "type": "text"},
    {"id": "LUNG-009", "name": "驱动基因突变", "sourceName": "驱动基因突变", "sourceColumn": 909, "type": "text"},
    {"id": "LUNG-010", "name": "耐药机制", "sourceName": "耐药机制", "sourceColumn": 910, "type": "text"},
    {"id": "LUNG-011", "name": "RECIST评估", "sourceName": "RECIST评估", "sourceColumn": 911, "type": "select"},
    {"id": "LUNG-012", "name": "ctDNA突变丰度", "sourceName": "ctDNA突变丰度", "sourceColumn": 912, "type": "text"},
    {"id": "LUNG-013", "name": "PFS（月）", "sourceName": "PFS（月）", "sourceColumn": 913, "type": "number"},
    {"id": "LUNG-014", "name": "ORR评估", "sourceName": "ORR评估", "sourceColumn": 914, "type": "select"},
    {"id": "LUNG-015", "name": "检测项目", "sourceName": "检测项目", "sourceColumn": 915, "type": "text"},
]


def lung_crf_schema() -> dict[str, Any]:
    sections = [
        {"id": "lung-basic", "title": "肺癌研究基本信息", "fields": LUNG_CRF_FIELDS[:5]},
        {"id": "lung-treatment-resistance", "title": "肺癌治疗与耐药评估", "fields": LUNG_CRF_FIELDS[5:11]},
        {"id": "lung-omics-endpoints", "title": "肺癌组学与疗效终点", "fields": LUNG_CRF_FIELDS[11:]},
    ]
    return {
        "version": "V1.0",
        "studyId": LUNG_RESISTANCE_STUDY_ID,
        "name": "真实世界肺癌耐药研究 CRF",
        "source": "lung-resistance-rwd-template",
        "fieldCount": len(LUNG_CRF_FIELDS),
        "sections": sections,
        "notes": [
            "Study-specific lung cancer resistance CRF for LZXK-01.",
        ],
    }


def patient_code(index: int) -> str:
    prefixes = ["LQH", "WYM", "ZXR", "CJY", "LYT", "HQN", "QML", "SYF", "ZYW", "GCH"]
    if index >= 50:
        prefixes = ["LZXK", "LCAD", "LUSC", "EGFR", "ALKR"]
    return f"{prefixes[index % len(prefixes)]}-{index + 101:03d}"


def is_lung_resistance_disease(disease: str) -> bool:
    return disease in LUNG_RESISTANCE_DISEASES


def organs_for_disease(disease: str, index: int) -> list[str]:
    if is_lung_resistance_disease(disease):
        patterns = [
            ["肺", "纵隔淋巴结"],
            ["肺", "胸膜"],
            ["肺", "骨"],
            ["肺", "脑"],
            ["肺", "肝"],
        ]
        return patterns[index % len(patterns)]
    if disease == "NPSLE":
        return ["神经系统", "皮肤"] if index % 2 else ["神经系统", "肾"]
    if disease == "Non-NPSLE":
        return ["皮肤", "肾"] if index % 3 else ["肾"]
    if disease in {"MS", "NMOSD"}:
        return ["神经系统"]
    return ["健康对照"]


def sample_plan(disease: str, index: int) -> list[str]:
    if is_lung_resistance_disease(disease):
        if disease in {"EGFR-TKI耐药", "ALK耐药"} and index % 2 == 0:
            return ["血液", "组织", "胸水"]
        return ["血液", "组织"]
    if disease == "HC":
        return ["血液"]
    if disease in {"MS", "NMOSD"}:
        return ["血液", "CSF"] if index % 2 else ["CSF"]
    if disease == "NPSLE":
        return ["血液", "CSF", "肾"] if index % 4 == 0 else ["血液", "CSF"]
    return ["血液", "肾"] if index % 3 == 0 else ["血液"]


def disease_activity(disease: str) -> int:
    if is_lung_resistance_disease(disease):
        return 0
    if disease == "NPSLE":
        return 12
    if disease in {"MS", "NMOSD"}:
        return 7
    if disease == "Non-NPSLE":
        return 4
    return 0


def numeric_value(field: str, index: int, fallback: float) -> int | float:
    try:
        base = float(SLE_CRF_DEFAULTS.get(field, fallback))
    except ValueError:
        base = fallback
    value = round(base + ((index % 5) - 2) * 0.07, 2)
    return int(value) if value.is_integer() else value


def lung_resistance_context(index: int, disease: str, organs: list[str]) -> dict[str, object]:
    driver_gene = {
        "NSCLC": "EGFR exon19del",
        "LUAD": "EGFR L858R",
        "LUSC": "FGFR1 amplification",
        "EGFR-TKI耐药": "EGFR T790M / C797S",
        "ALK耐药": "ALK G1202R",
    }[disease]
    treatment = {
        "NSCLC": "含铂双药 + 免疫治疗",
        "LUAD": "奥希替尼一线治疗",
        "LUSC": "紫杉醇 + 卡铂 + PD-1",
        "EGFR-TKI耐药": "三代 EGFR-TKI 后耐药评估",
        "ALK耐药": "二代 ALK-TKI 后耐药评估",
    }[disease]
    resistance = {
        "NSCLC": "待复核",
        "LUAD": "MET 扩增疑似",
        "LUSC": "PIK3CA 通路激活",
        "EGFR-TKI耐药": "T790M / C797S 或旁路激活",
        "ALK耐药": "ALK 二级突变或旁路激活",
    }[disease]
    recist = ["SD", "PR", "PD", "NE"][index % 4]
    return {
        "研究编号": LUNG_RESISTANCE_STUDY_ID,
        "研究名称": "真实世界肺癌耐药研究",
        "病种": disease,
        "分期": ["IIIB", "IVA", "IVB"][index % 3],
        "TNM分期": ["T2N2M0", "T3N2M1a", "T4N3M1b"][index % 3],
        "ECOG评分": index % 3,
        "治疗线数": 1 + (index % 4),
        "当前治疗方案": treatment,
        "驱动基因突变": driver_gene,
        "耐药机制": resistance,
        "RECIST评估": recist,
        "ctDNA突变丰度": f"{round(0.8 + (index % 7) * 1.3, 1)}%",
        "PFS（月）": round(6.5 + (index % 9) * 1.4, 1),
        "ORR评估": recist,
        "检测项目": "NGS 520基因 panel + ctDNA 动态监测",
    }


def generated_clinical_value(field: str, index: int, name: str, hospital_no: str, sex: str, age: int, disease: str, organs: list[str]) -> object:
    activity = disease_activity(disease)
    medications = {
        "NPSLE": ("CD20", "MMF", "IVIG"),
        "Non-NPSLE": ("HCQ", "MMF", ""),
        "MS": ("激素冲击", "DMT", ""),
        "NMOSD": ("CD20", "AZA", ""),
        "HC": ("无", "", ""),
        "NSCLC": ("含铂双药", "PD-1", "抗血管生成"),
        "LUAD": ("奥希替尼", "培美曲塞", "贝伐珠单抗"),
        "LUSC": ("紫杉醇", "卡铂", "PD-1"),
        "EGFR-TKI耐药": ("奥希替尼", "MET抑制剂", "局部放疗"),
        "ALK耐药": ("阿来替尼", "洛拉替尼", "局部放疗"),
    }
    primary_medication, secondary_medication, other_medication = medications[disease]

    if field == "姓名":
        return name
    if field == "性别":
        return sex
    if field == "年龄":
        return age
    if field == "身高（cm）":
        return (156 + index % 9) if sex == "女" else (166 + index % 10)
    if field == "体重（Kg）":
        return (48 + index % 13) if sex == "女" else (60 + index % 15)
    if field == "病程（发病-使用CD20时）":
        if disease == "HC":
            return 0
        return 6 + (index * 2) % 36 if is_lung_resistance_disease(disease) else 8 + (index * 3) % 48
    if field == "住院号":
        return hospital_no
    if field == "出院诊断":
        return disease
    if field == "受累脏器":
        return "、".join(organs)
    if field == "SLEDAI评分":
        return activity
    if field == "RSLEDAI":
        return max(0, activity - 6)
    if field == "LN病理分型（如有）":
        if is_lung_resistance_disease(disease):
            return "-"
        return ["II", "III", "IV", "V"][index % 4] if "肾" in organs else "-"
    if field == "AI":
        if is_lung_resistance_disease(disease):
            return "-"
        return 4 + (index % 6) if "肾" in organs else "-"
    if field == "CI":
        if is_lung_resistance_disease(disease):
            return "-"
        return index % 4 if "肾" in organs else "-"
    if field == "PGA评分":
        return 0 if disease == "HC" else round(1.0 + (index % 4) * 0.4, 1) if is_lung_resistance_disease(disease) else round(0.8 + (index % 5) * 0.3, 1)
    if field == "MP mg/d":
        return 0 if disease == "HC" or is_lung_resistance_disease(disease) else [10, 20, 40, 80, 240][index % 5]
    if field == "免疫抑制剂1":
        return primary_medication
    if field == "免疫制剂2":
        return secondary_medication or "-"
    if field == "免疫制剂2（第2项）":
        return "CTX" if disease == "NPSLE" and index % 4 == 0 else "-"
    if field == "其他合并用药":
        return other_medication or "-"
    if field == "体温":
        return round(36.4 + (index % 4) * 0.2, 1)
    if field == "神经系统症状":
        return "有" if "神经系统" in organs else "无"
    if field in {"关节肿胀", "关节疼痛", "皮疹", "口腔溃疡", "脱发"}:
        return "无" if disease == "HC" else "有" if index % 3 == 0 else "无"
    if field == "其他":
        return "无" if disease == "HC" else "疲乏"
    if field == "ANA1:80为阳性（1-yes，0-none）":
        return 0 if disease == "HC" or is_lung_resistance_disease(disease) else 1
    if field == "滴度":
        return "-" if disease == "HC" or is_lung_resistance_disease(disease) else [80, 160, 320, 640][index % 4]
    if field == "核型":
        return "-" if disease == "HC" or is_lung_resistance_disease(disease) else ["均质型", "颗粒型", "核仁型"][index % 3]
    if field == "ENA1":
        return "-" if disease == "HC" or is_lung_resistance_disease(disease) else ["Sm", "SSA", "Ro-52"][index % 3]
    if field == "ENA2":
        return "-" if disease == "HC" or is_lung_resistance_disease(disease) else ["Ro-52", "SSB", "0"][index % 3]
    if field == "ENA3":
        return "-" if disease == "HC" or is_lung_resistance_disease(disease) else (["0", "RNP", ""][index % 3] or "-")
    if field == "其他阳性抗体":
        return "-" if disease == "HC" or is_lung_resistance_disease(disease) else "抗磷脂抗体" if index % 2 else "-"
    if field in {"胸膜炎", "心包炎", "肺动脉高压"}:
        if is_lung_resistance_disease(disease) and field == "胸膜炎":
            return "有" if "胸膜" in organs else "无"
        return "无" if disease == "HC" else "有" if index % 6 == 0 else "无"
    if field == "其他异常结果":
        return "无" if disease == "HC" else "肺部影像与耐药机制待复核" if is_lung_resistance_disease(disease) else "影像异常待复核" if index % 4 == 0 else "无"
    if "DNA" in field:
        return 0 if disease == "HC" else numeric_value(field, index, 35 if is_lung_resistance_disease(disease) else 60)
    if "WBC" in field:
        return numeric_value(field, index, 6.4)
    if "HB" in field:
        return 105 + (age % 28)
    if "PLT" in field:
        return 180 + (age % 12) * 18
    if "C3" in field:
        return numeric_value(field, index, 0.72)
    if "C4" in field:
        return numeric_value(field, index, 0.18)
    if "Ig" in field:
        return numeric_value(field, index, 7.6)
    if any(token in field for token in ["尿", "Cr", "BUN", "UA"]):
        return numeric_value(field, index, 1.2)
    if any(token in field for token in ["CD", "淋巴", "自然杀伤"]):
        return numeric_value(field, index, 12)
    return SLE_CRF_DEFAULTS.get(field, "已录入")


def clinical_data(index: int, name: str, hospital_no: str, sex: str, age: int, disease: str, organs: list[str], completeness: int) -> dict[str, object]:
    seed: dict[str, object] = {
        "姓名": name,
        "性别": sex,
        "年龄": age,
        "住院号": hospital_no,
        "出院诊断": disease,
        "受累脏器": "、".join(organs),
    }
    if is_lung_resistance_disease(disease):
        return {
            **seed,
            **lung_resistance_context(index, disease, organs),
            "CRF版本": "V1.0",
            "数据完整度": completeness,
        }

    filled_count = round((len(SLE_CRF_FIELDS) * completeness) / 100)
    payload = {
        field: seed.get(field, generated_clinical_value(field, index, name, hospital_no, sex, age, disease, organs))
        for field in SLE_CRF_FIELDS[:filled_count]
    }
    payload.update(seed)
    payload["CRF版本"] = SLE_CRF_VERSION
    payload["数据完整度"] = completeness
    return payload


def study_context_for_index(index: int) -> tuple[str, str, str, str]:
    if index >= 50:
        return (
            LUNG_RESISTANCE_STUDY_ID,
            "CRFV-LZXK-01-V1.0",
            "TP-LUNG-RESIST-OMICS",
            LUNG_RESISTANCE_DISEASES[(index - 50) % len(LUNG_RESISTANCE_DISEASES)],
        )
    study_id = "LGL-1111" if index < 36 else "RWD-NMO-2026"
    crf_version_id = "CRFV-LGL-1111-V0.1" if study_id == "LGL-1111" else "CRFV-RWD-NMO-2026-V1.0"
    testing_project_id = "TP-SLE-OMICS" if study_id == "LGL-1111" else "TP-NMO-OMICS"
    return study_id, crf_version_id, testing_project_id, DISEASES[index % len(DISEASES)]


def visit_plans_for_study(study_id: str) -> list[tuple]:
    return sorted(
        [row for row in STUDY_VISIT_PLAN_ROWS if row[1] == study_id and row[10] == "active"],
        key=lambda row: (row[11], row[5], row[2]),
    )


def medication_for_visit(disease: str, index: int) -> str:
    if disease == "HC":
        return "无"
    if is_lung_resistance_disease(disease):
        return {
            "NSCLC": "含铂双药",
            "LUAD": "奥希替尼",
            "LUSC": "紫杉醇 + 卡铂",
            "EGFR-TKI耐药": "三代 EGFR-TKI 后评估",
            "ALK耐药": "ALK-TKI 后评估",
        }[disease]
    return "HCQ"


def follow_up_summary(
    study_id: str,
    disease: str,
    organs: list[str],
    index: int,
    visit_index: int,
) -> dict[str, str]:
    efficacy_cycle = ["缓解", "稳定", "进展"]
    follow_up_organs = [organ for organ in organs if organ not in {"肺", "健康对照"}]

    if study_id == LUNG_RESISTANCE_STUDY_ID:
        efficacy = efficacy_cycle[(index + visit_index) % len(efficacy_cycle)]
        disease_status = "转移" if follow_up_organs and visit_index >= 2 else "进展" if efficacy == "进展" else "稳定"
        return {
            "survival_status": "存活",
            "disease_status": disease_status,
            "symptoms_signs": f"咳嗽/胸痛较前稳定，ECOG {index % 3}，耐药相关症状继续观察。",
            "imaging_lab_summary": "胸部CT提示靶病灶稳定；ctDNA 动态监测与 NGS 结果已同步复核。",
            "efficacy_assessment": efficacy,
            "metastasis_status": "、".join(follow_up_organs) if follow_up_organs else "未见新增转移",
            "adverse_events": "1级乏力" if index % 4 == 0 else "无明显不良事件",
            "quality_of_life": f"ECOG {index % 3}；日常活动基本可维持。",
            "lost_to_follow_up_reason": "电话未接通，待二次联系" if index % 29 == 0 and visit_index >= 2 else "-",
        }

    if disease == "HC":
        return {
            "survival_status": "存活",
            "disease_status": "无病",
            "symptoms_signs": "无明显症状与体征。",
            "imaging_lab_summary": "常规检验关键指标无明显异常。",
            "efficacy_assessment": "未评估",
            "metastasis_status": "-",
            "adverse_events": "无",
            "quality_of_life": "生活质量稳定。",
            "lost_to_follow_up_reason": "-",
        }

    efficacy = efficacy_cycle[(index + visit_index + 1) % len(efficacy_cycle)]
    return {
        "survival_status": "存活",
        "disease_status": "复发" if efficacy == "进展" and index % 5 == 0 else "稳定",
        "symptoms_signs": f"神经系统症状{'仍需观察' if '神经系统' in organs else '未见新发'}，疲乏程度可耐受。",
        "imaging_lab_summary": "影像/检验关键结论已复核，未见紧急安全风险。",
        "efficacy_assessment": efficacy,
        "metastasis_status": "-",
        "adverse_events": "轻度胃肠道反应" if index % 6 == 0 else "无",
        "quality_of_life": f"EQ-5D 0.{82 + index % 12}；生活质量较前稳定。",
        "lost_to_follow_up_reason": "电话未接通，待二次联系" if index % 31 == 0 and visit_index >= 2 else "-",
    }


def storage_for_sample(sample_type: str) -> str:
    if sample_type == "CSF":
        return "液氮罐C1"
    if sample_type == "肾":
        return "病理库R1"
    if sample_type == "组织":
        return "病理库-LUNG-T1"
    if sample_type == "胸水":
        return "液氮罐-LUNG-P1"
    return "-80℃冰箱A1"


def build_seed_rows() -> dict[str, list[tuple]]:
    base_date = date(2024, 5, 1)
    patients: list[tuple] = []
    samples: list[tuple] = []
    omics: list[tuple] = []
    consents: list[tuple] = []
    visits: list[tuple] = []
    follow_up_records: list[tuple] = []
    crf_entries: list[tuple] = []

    for index in range(70):
        patient_id = f"PAT-{index + 1:03d}"
        study_id, crf_version_id, testing_project_id, disease = study_context_for_index(index)
        name = patient_code(index)
        hospital_no = f"{23000000 + index * 137:08d}"
        sex = "女" if index % 2 == 0 else "男"
        age = 19 + (index * 7) % 48
        organs = organs_for_disease(disease, index)
        completeness = 68 + (index * 7) % 33
        note = (
            f"真实世界肺癌耐药研究随访中，耐药机制与组学检测已生成，完整度 {completeness}%"
            if is_lung_resistance_disease(disease)
            else "健康对照质控通过"
            if disease == "HC"
            else f"{disease} 队列随访中，完整度 {completeness}%"
        )
        patient_date = base_date + timedelta(days=index * 3)

        patients.append(
            (
                patient_id,
                study_id,
                name,
                hospital_no,
                sex,
                age,
                disease,
                encode_json(organs),
                note,
                clinical_data(index, name, hospital_no, sex, age, disease, organs, completeness),
            )
        )
        consents.append(
            (
                f"CON-{index + 1:03d}",
                study_id,
                patient_id,
                "待签署" if index % 9 == 1 else "已撤回" if index % 17 == 3 else "已签署",
                "V1.0",
                "-" if index % 9 == 1 else str(patient_date),
                "-" if index % 9 == 1 else "电子" if index % 2 == 0 else "纸质",
            )
        )

        for visit_index, visit_plan in enumerate(visit_plans_for_study(study_id)):
            (
                visit_plan_id,
                _plan_study_id,
                visit_code,
                visit_name,
                visit_type,
                day_offset,
                window_before_days,
                window_after_days,
                required_forms,
                required_samples,
                _plan_status,
                _sort_order,
            ) = visit_plan
            visit_date = patient_date + timedelta(days=day_offset)
            if visit_index > 0 and index % 13 == 2:
                visit_date = visit_date + timedelta(days=window_after_days + 8)
            visit_status = "已完成" if visit_index < 2 or index % 3 else "进行中"
            visit_id = f"VIS-{index + 1:03d}-{visit_index + 1}"
            visit_payload = clinical_data(index, name, hospital_no, sex, age, disease, organs, max(0, completeness - visit_index * 4))
            visit_metric = (
                f"ECOG {visit_payload.get('ECOG评分', 1)} / {visit_payload.get('RECIST评估', '待评估')}"
                if study_id == LUNG_RESISTANCE_STUDY_ID
                else str(max(0, int(visit_payload["SLEDAI评分"]) - visit_index * 2))
            )
            visits.append(
                (
                    visit_id,
                    study_id,
                    patient_id,
                    visit_plan_id,
                    visit_name,
                    str(visit_date),
                    visit_type,
                    visit_metric,
                    medication_for_visit(disease, index),
                    "、".join(sample_plan(disease, index)) if visit_code == "V1" else "、".join(required_samples or ["血液"]),
                    max(0, completeness - visit_index * 4),
                    visit_status,
                )
            )
            crf_entries.append(
                (
                    f"CRF-{index + 1:03d}-{visit_index + 1}",
                    study_id,
                    patient_id,
                    visit_id,
                    crf_version_id,
                    required_forms[0] if required_forms else ("baseline" if visit_code == "V1" else "follow_up"),
                    required_forms[0] if required_forms else ("baseline" if visit_code == "V1" else "follow_up"),
                    {**visit_payload, "访视计划": visit_code, "访视名称": visit_name},
                    "submitted" if visit_status == "已完成" else "draft",
                    "USR-011" if study_id == LUNG_RESISTANCE_STUDY_ID else "USR-002",
                    str(visit_date) if visit_status == "已完成" else None,
                )
            )
            if visit_code != "V1":
                follow_up = follow_up_summary(study_id, disease, organs, index, visit_index)
                method = ["门诊", "电话", "线上", "家访"][(index + visit_index) % 4]
                recorded_at = f"{visit_date}T10:00:00+00:00"
                follow_up_records.append(
                    (
                        f"FUP-{index + 1:03d}-{visit_index + 1}",
                        study_id,
                        patient_id,
                        visit_id,
                        str(visit_date),
                        method,
                        "肺癌 CRC" if study_id == LUNG_RESISTANCE_STUDY_ID else "林清妍",
                        follow_up["survival_status"],
                        follow_up["disease_status"],
                        follow_up["symptoms_signs"],
                        follow_up["imaging_lab_summary"],
                        follow_up["efficacy_assessment"],
                        follow_up["metastasis_status"],
                        follow_up["adverse_events"],
                        follow_up["quality_of_life"],
                        follow_up["lost_to_follow_up_reason"],
                        recorded_at,
                    )
                )

        for sample_index, sample_type in enumerate(sample_plan(disease, index), start=1):
            sample_id = f"SPL-2024-{index + 1:03d}-{sample_index:02d}"
            collected_at = patient_date + timedelta(days=sample_index - 1)
            linked_omics = LUNG_ASSAYS_BY_SAMPLE[sample_type] if is_lung_resistance_disease(disease) else [ASSAYS[(index + sample_index) % len(ASSAYS)]]
            if not is_lung_resistance_disease(disease) and disease != "HC" and sample_index == 1:
                linked_omics.append(ASSAYS[(index + sample_index + 2) % len(ASSAYS)])
            samples.append(
                (
                    sample_id,
                    study_id,
                    patient_id,
                    name,
                    hospital_no,
                    sample_type,
                    "V1 基线访视",
                    str(collected_at),
                    storage_for_sample(sample_type),
                    "结果回传" if index % 4 else "检测中",
                    encode_json(linked_omics),
                )
            )
            for assay_index, assay in enumerate(linked_omics, start=1):
                status = "结果归档" if index % 4 else "数据分析"
                omics.append(
                    (
                        f"OMX-{index + 1:03d}-{sample_index}{assay_index}",
                        study_id,
                        testing_project_id,
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
        "follow_up_records": follow_up_records,
        "crf_entries": crf_entries,
    }


def seed_database() -> None:
    initialize_schema()
    now = utc_now()
    rows = build_seed_rows()
    with connect() as conn:
        conn.executescript(
            """
            DELETE FROM operation_logs;
            DELETE FROM approval_actions;
            DELETE FROM approval_requests;
            DELETE FROM data_queries;
            DELETE FROM data_quality_issues;
            DELETE FROM export_jobs;
            DELETE FROM uploaded_files;
            DELETE FROM crf_entries;
            DELETE FROM follow_up_records;
            DELETE FROM omics_records;
            DELETE FROM samples;
            DELETE FROM visits;
            DELETE FROM study_visit_plans;
            DELETE FROM consents;
            DELETE FROM field_permissions;
            DELETE FROM password_reset_tokens;
            DELETE FROM global_role_study_scope;
            DELETE FROM study_members;
            DELETE FROM study_configurations;
            DELETE FROM study_crf_versions;
            DELETE FROM users;
            DELETE FROM patients;
            DELETE FROM studies;
            """
        )
        conn.executemany(
            """
            INSERT INTO studies (id, code, name, indication, phase, status, owner_org, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*study, now, now) for study in STUDY_ROWS],
        )
        conn.executemany(
            """
            INSERT INTO study_visit_plans
              (id, study_id, code, name, visit_type, day_offset, window_before_days, window_after_days, required_forms_json, required_samples_json, status, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    plan_id,
                    study_id,
                    code,
                    name,
                    visit_type,
                    day_offset,
                    window_before_days,
                    window_after_days,
                    encode_json(required_forms),
                    encode_json(required_samples),
                    plan_status,
                    sort_order,
                    now,
                    now,
                )
                for (
                    plan_id,
                    study_id,
                    code,
                    name,
                    visit_type,
                    day_offset,
                    window_before_days,
                    window_after_days,
                    required_forms,
                    required_samples,
                    plan_status,
                    sort_order,
                ) in STUDY_VISIT_PLAN_ROWS
            ],
        )
        conn.executemany(
            """
            INSERT INTO users (id, username, display_name, role, role_code, password_hash, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            [
                (user_id, username, display_name, legacy_role, role_code, hash_password(DEFAULT_DEMO_PASSWORD), now, now)
                for user_id, username, display_name, legacy_role, role_code in USER_ROWS
            ],
        )
        conn.executemany(
            """
            INSERT INTO study_members (id, study_id, user_id, study_role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [(*member, now, now) for member in STUDY_MEMBER_ROWS],
        )
        conn.executemany(
            """
            INSERT INTO global_role_study_scope (id, user_id, study_id, created_at)
            VALUES (?, ?, ?, ?)
            """,
            [(*scope, now) for scope in GLOBAL_SCOPE_ROWS],
        )
        field_permission_rows = []
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
        for role in ROLE_VALUES:
            for resource, field_name, mask_rule in sensitive_fields:
                can_export = 0 if role in masked_roles else 1
                field_permission_rows.append((role, resource, field_name, 1, can_export, "none" if role == "LZ_ADMIN" or role not in masked_roles else mask_rule, now, now))
        conn.executemany(
            """
            INSERT INTO field_permissions (role, resource, field_name, can_view, can_export, mask_rule, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            field_permission_rows,
        )
        conn.executemany(
            """
            INSERT INTO study_crf_versions
              (id, study_id, template_id, version, status, schema_json, change_summary, created_by, published_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
	                (
	                    "CRFV-LGL-1111-V0.1",
	                    "LGL-1111",
	                    None,
                    SLE_CRF_VERSION,
                    "published",
                    encode_json(SLE_CRF_SCHEMA),
                    "Initial SLE CRF V0.1 copied from template.",
                    "USR-007",
                    now,
                    now,
                    now,
                ),
	                (
	                    "CRFV-RWD-NMO-2026-V1.0",
	                    "RWD-NMO-2026",
	                    None,
                    "V1.0",
                    "published",
                    encode_json({**SLE_CRF_SCHEMA, "version": "V1.0", "studyId": "RWD-NMO-2026"}),
                    "Study-specific NMOSD CRF version forked from template.",
                    "USR-007",
                    now,
                    now,
                    now,
                ),
	                (
	                    "CRFV-LZXK-01-V1.0",
	                    LUNG_RESISTANCE_STUDY_ID,
	                    None,
                    "V1.0",
                    "published",
                    encode_json(lung_crf_schema()),
                    "Study-specific lung cancer resistance CRF version with 15 fields.",
                    "USR-012",
                    now,
                    now,
                    now,
                ),
            ],
        )
        sync_study_configurations(conn)
        patient_insert_rows = []
        for patient in rows["patients"]:
            clinical_payload = patient[-1]
            clinical_jsonb, clinical_format, clinical_version = sqlite_json_storage(conn, clinical_payload)
            patient_insert_rows.append((*patient[:-1], encode_json(clinical_payload), clinical_jsonb, clinical_version, clinical_format, now, now))
        conn.executemany(
            """
            INSERT INTO patients
              (id, study_id, name, hospital_no, sex, age, disease_type, organs_json, note, clinical_data_json, clinical_data_jsonb, clinical_data_version, clinical_data_format, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            patient_insert_rows,
        )
        conn.executemany(
            """
            INSERT INTO consents (id, study_id, patient_id, status, version, signed_at, method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows["consents"],
        )
        conn.executemany(
            """
            INSERT INTO visits
              (id, study_id, patient_id, visit_plan_id, visit, visit_date, visit_type, sle_dai, medication, sample_collection, completeness, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows["visits"],
        )
        conn.executemany(
            """
            INSERT INTO follow_up_records
              (id, study_id, patient_id, visit_id, follow_up_date, follow_up_method, followed_by, survival_status, disease_status, symptoms_signs, imaging_lab_summary, efficacy_assessment, metastasis_status, adverse_events, quality_of_life, lost_to_follow_up_reason, recorded_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*record, now, now) for record in rows["follow_up_records"]],
        )
        conn.executemany(
            """
            INSERT INTO crf_entries
              (id, study_id, patient_id, visit_id, crf_version_id, form_id, module, payload_json, payload_jsonb, payload_version, payload_format, status, completed_by, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    entry[0],
                    entry[1],
                    entry[2],
                    entry[3],
                    entry[4],
                    entry[5],
                    entry[6],
                    encode_json(entry[7]),
                    crf_payload_jsonb,
                    crf_payload_version,
                    crf_payload_format,
                    entry[8],
                    entry[9],
                    entry[10],
                    now,
                    now,
                )
                for entry in rows["crf_entries"]
                for crf_payload_jsonb, crf_payload_format, crf_payload_version in [sqlite_json_storage(conn, entry[7])]
            ],
        )
        conn.executemany(
            """
            INSERT INTO samples
              (id, study_id, patient_id, patient_name, hospital_no, sample_type, visit, collected_at, storage, status, linked_omics_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*sample, now, now) for sample in rows["samples"]],
        )
        conn.executemany(
            """
            INSERT INTO omics_records
              (id, study_id, testing_project_id, patient_id, patient_name, sample_id, sample_type, assay, platform, run_id, status, qc, sent_at, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(*record, now, now) for record in rows["omics"]],
        )
        conn.executemany(
            """
            INSERT INTO data_queries
              (id, study_id, patient_id, visit_id, form_id, field_name, title, description, status, assigned_to, created_by, response, created_at, updated_at, closed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "DQ-LGL-001",
                    "LGL-1111",
                    "PAT-003",
                    "VIS-003-2",
                    "follow_up",
                    "SLEDAI评分",
                    "SLEDAI 与随访记录不一致",
                    "V2 随访记录 SLEDAI 下降幅度与 CRF payload 不一致，请 CRC 核对源记录。",
                    "open",
                    "USR-002",
                    "USR-003",
                    "",
                    now,
                    now,
                    None,
                ),
                (
                    "DQ-LGL-002",
                    "LGL-1111",
                    "PAT-006",
                    "VIS-006-1",
                    "baseline",
                    "数据完整度",
                    "基线 CRF 必填项缺失",
                    "基线表缺少 PGA/用药字段，影响分析导出完整性。",
                    "answered",
                    "USR-002",
                    "USR-003",
                    "CRC 已回填用药字段，等待数据管理员复核关闭。",
                    now,
                    now,
                    None,
                ),
                (
                    "DQ-LZXK-001",
                    LUNG_RESISTANCE_STUDY_ID,
                    "PAT-051",
                    "VIS-051-2",
                    "follow_up",
                    "ECOG评分",
                    "ECOG 评分需复核",
                    "肺癌随访记录 ECOG 与疗效评估字段不一致，请核对门诊病历。",
                    "open",
                    "USR-010",
                    "USR-012",
                    "",
                    now,
                    now,
                    None,
                ),
            ],
        )
        conn.executemany(
            """
            INSERT INTO approval_requests
              (id, study_id, approval_type, status, entity_type, entity_id, payload_json, submitted_by, reviewed_by, submitted_at, reviewed_at, completed_at, comment, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "APR-SEED-ECONSENT-001",
                    "LGL-1111",
                    "econsent_withdrawal",
                    "submitted",
                    "consents",
                    "CON-004",
                    encode_json({"consent_id": "CON-004", "patient_id": "PAT-004", "requested_status": "已撤回", "current_status": "已签署"}),
                    "USR-002",
                    None,
                    now,
                    None,
                    None,
                    "患者要求撤回知情同意，等待独立审批。",
                    now,
                    now,
                ),
                (
                    "APR-SEED-ECONSENT-002",
                    LUNG_RESISTANCE_STUDY_ID,
                    "econsent_resign",
                    "approved",
                    "consents",
                    "CON-055",
                    encode_json({"consent_id": "CON-055", "patient_id": "PAT-055", "requested_status": "待签署", "current_status": "已撤回"}),
                    "USR-010",
                    "USR-005",
                    now,
                    now,
                    None,
                    "肺癌研究患者撤回后重新签署，已批准待完成。",
                    now,
                    now,
                ),
            ],
        )
        conn.executemany(
            """
            INSERT INTO approval_actions
              (id, approval_id, study_id, actor_id, action, from_status, to_status, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("APR-ACT-SEED-001", "APR-SEED-ECONSENT-001", "LGL-1111", "USR-002", "submit", "draft", "submitted", "患者要求撤回知情同意。", now),
                ("APR-ACT-SEED-002", "APR-SEED-ECONSENT-002", LUNG_RESISTANCE_STUDY_ID, "USR-010", "submit", "draft", "submitted", "申请重新签署。", now),
                ("APR-ACT-SEED-003", "APR-SEED-ECONSENT-002", LUNG_RESISTANCE_STUDY_ID, "USR-005", "approve", "submitted", "approved", "同意重新签署。", now),
            ],
        )


if __name__ == "__main__":
    seed_database()
    print("Seeded LinZight demo database with 70 patients across 3 studies.")
