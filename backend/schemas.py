from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


UserRole = Literal["sys_admin", "project_admin", "investigator", "crc", "data_manager", "viewer"]
DiseaseType = Literal["NPSLE", "Non-NPSLE", "MS", "NMOSD", "HC"]
Sex = Literal["男", "女"]
SampleType = Literal["血液", "CSF", "肾", "尿液"]
SampleStatus = Literal["已采集", "已送检", "检测中", "结果回传", "待处理"]
OmicsStatus = Literal["样本接收", "文库构建", "测序完成", "数据分析", "结果归档"]
QcStatus = Literal["通过", "未通过", "待确认"]
CrfStatus = Literal["draft", "submitted", "locked"]
FileCategory = Literal["consent", "clinical", "sample", "omics_result", "analysis_export", "other"]
ExportStatus = Literal["queued", "running", "ready", "failed"]
QualitySeverity = Literal["info", "warning", "critical"]
QualityStatus = Literal["open", "resolved", "waived"]


class UserPublic(BaseModel):
    id: str
    username: str
    display_name: str
    role: UserRole
    status: str = "active"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class PatientBase(BaseModel):
    study_id: str = "LGL-1111"
    name: str
    hospital_no: str
    sex: Sex
    age: int = Field(ge=0, le=120)
    disease_type: DiseaseType
    organs: list[str] = Field(default_factory=list)
    note: str = ""
    clinical_data: dict[str, Any] = Field(default_factory=dict)


class PatientCreate(PatientBase):
    id: str | None = None


class PatientUpdate(BaseModel):
    study_id: str | None = None
    name: str | None = None
    hospital_no: str | None = None
    sex: Sex | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    disease_type: DiseaseType | None = None
    organs: list[str] | None = None
    note: str | None = None
    clinical_data: dict[str, Any] | None = None


class SampleBase(BaseModel):
    patient_id: str
    patient_name: str
    hospital_no: str
    sample_type: SampleType
    visit: str
    collected_at: str
    storage: str
    status: SampleStatus
    linked_omics: list[str] = Field(default_factory=list)


class SampleCreate(SampleBase):
    id: str | None = None


class SampleUpdate(BaseModel):
    patient_id: str | None = None
    patient_name: str | None = None
    hospital_no: str | None = None
    sample_type: SampleType | None = None
    visit: str | None = None
    collected_at: str | None = None
    storage: str | None = None
    status: SampleStatus | None = None
    linked_omics: list[str] | None = None


class OmicsBase(BaseModel):
    patient_id: str
    patient_name: str
    sample_id: str
    sample_type: str
    assay: str
    platform: str
    run_id: str
    status: OmicsStatus
    qc: QcStatus
    sent_at: str
    completed_at: str = "-"


class OmicsCreate(OmicsBase):
    id: str | None = None


class OmicsUpdate(BaseModel):
    patient_id: str | None = None
    patient_name: str | None = None
    sample_id: str | None = None
    sample_type: str | None = None
    assay: str | None = None
    platform: str | None = None
    run_id: str | None = None
    status: OmicsStatus | None = None
    qc: QcStatus | None = None
    sent_at: str | None = None
    completed_at: str | None = None


class CrfEntryBase(BaseModel):
    patient_id: str
    visit_id: str | None = None
    module: str
    payload: dict[str, Any] = Field(default_factory=dict)
    status: CrfStatus = "draft"


class CrfEntryCreate(CrfEntryBase):
    id: str | None = None


class CrfEntryUpdate(BaseModel):
    visit_id: str | None = None
    module: str | None = None
    payload: dict[str, Any] | None = None
    status: CrfStatus | None = None
    completed_by: str | None = None
    completed_at: str | None = None


class FileMetadata(BaseModel):
    id: str
    patient_id: str | None = None
    sample_id: str | None = None
    omics_id: str | None = None
    consent_id: str | None = None
    category: FileCategory
    original_filename: str
    stored_filename: str
    storage_path: str
    content_type: str
    size_bytes: int
    sha256: str
    uploaded_by: str | None = None
    uploaded_at: str
    is_deidentified: bool = False


class ExportJobCreate(BaseModel):
    export_type: str
    scope: dict[str, Any] = Field(default_factory=dict)
    requested_by: str | None = None


class ExportJob(BaseModel):
    id: str
    requested_by: str | None = None
    export_type: str
    scope: dict[str, Any] = Field(default_factory=dict)
    status: ExportStatus
    file_id: str | None = None
    created_at: str
    completed_at: str | None = None


class DataQualityIssue(BaseModel):
    id: str
    patient_id: str
    source_table: str
    source_id: str
    field_name: str
    severity: QualitySeverity
    message: str
    status: QualityStatus
    created_at: str
    resolved_at: str | None = None


class AuditLog(BaseModel):
    id: str
    actor_id: str | None = None
    actor_role: UserRole | None = None
    action: str
    entity_type: str
    entity_id: str
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: str


class AnalysisSummary(BaseModel):
    patient_count: int
    disease_distribution: dict[str, int]
    sample_count: int
    omics_count: int
    completed_omics_count: int
    data_completeness_avg: float
