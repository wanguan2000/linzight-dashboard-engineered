from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


UserRole = Literal[
    "LZ_ADMIN",
    "LZ_CRC",
    "LZ_CRF_ADMIN",
    "LZ_DATA_MANAGER",
    "LZ_AUDITOR",
    "STUDY_PI",
    "STUDY_CRC",
    "STUDY_CONFIG_ADMIN",
    "STUDY_DATA_MANAGER",
]
StudyRole = Literal["STUDY_PI", "STUDY_CRC", "STUDY_CONFIG_ADMIN", "STUDY_DATA_MANAGER"]
StudyScopeType = Literal["all_studies", "assigned_studies", "own_studies"]
DiseaseType = str
Sex = Literal["男", "女"]
SampleType = str
SampleStatus = Literal["已采集", "已送检", "检测中", "结果回传", "待处理"]
OmicsStatus = Literal["样本接收", "文库构建", "测序完成", "数据分析", "结果归档"]
QcStatus = Literal["通过", "未通过", "待确认"]
ConsentStatus = Literal["待签署", "已签署", "撤回审批中", "已撤回", "重签审批中", "已重签"]
CrfStatus = Literal["draft", "submitted", "locked"]
FileCategory = Literal["consent", "clinical", "sample", "omics_result", "analysis_export", "other"]
ExportStatus = Literal["queued", "running", "ready", "failed"]
ApprovalType = Literal["export", "deidentified_export", "crf_publish", "econsent_withdrawal", "econsent_resign"]
ApprovalStatus = Literal["draft", "submitted", "approved", "rejected", "cancelled", "completed"]
QualitySeverity = Literal["info", "warning", "critical"]
QualityStatus = Literal["open", "resolved", "waived"]
VisitPlanStatus = Literal["active", "draft", "retired"]
StudyCrfFieldStatus = Literal["启用", "草稿", "停用"]
StudyCrfFieldType = Literal["Text", "Number", "Dropdown", "Boolean"]
FollowUpMethod = Literal["门诊", "电话", "线上", "家访", "其他"]
SurvivalStatus = Literal["存活", "死亡", "未知"]


class UserPublic(BaseModel):
    id: str
    username: str
    display_name: str
    role: UserRole
    legacy_role: str | None = None
    status: str = "active"
    last_login_at: str | None = None
    study_scope: dict[str, Any] | None = None
    study_memberships: list[dict[str, Any]] = Field(default_factory=list)


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordResetRequest(BaseModel):
    username: str


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=24)
    password: str = Field(min_length=8)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserCreate(BaseModel):
    id: str | None = None
    username: str = Field(min_length=3)
    display_name: str = Field(min_length=1)
    role: UserRole = "STUDY_CRC"
    password: str = Field(min_length=8)
    status: Literal["active", "disabled"] = "active"
    study_id: str | None = None
    member_status: Literal["active", "pending", "disabled"] = "pending"


class UserStatusUpdate(BaseModel):
    status: Literal["active", "disabled"]


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1)
    role: UserRole | None = None
    password: str | None = Field(default=None, min_length=8)
    status: Literal["active", "disabled"] | None = None


class GlobalRoleStudyScopeUpdate(BaseModel):
    study_ids: list[str] = Field(default_factory=list)


class GlobalConfigurationUpdate(BaseModel):
    disease_types: list[str] = Field(default_factory=list)
    sample_types: list[str] = Field(default_factory=list)
    detection_types: list[str] = Field(default_factory=list)
    quantity_units: list[str] = Field(default_factory=list)


class StudyConfigurationUpdate(BaseModel):
    disease_area: str | None = None
    active_crf_version_id: str | None = None
    visit_plan: dict[str, Any] | None = None
    consent_template: str | None = None
    testing_profile: dict[str, Any] | None = None
    follow_up_schema: dict[str, Any] | None = None


class PatientBase(BaseModel):
    study_id: str = "LGL-1111"
    patient_number: str | None = None
    patient_name: str = ""
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
    patient_number: str | None = None
    patient_name: str | None = None
    name: str | None = None
    hospital_no: str | None = None
    sex: Sex | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    disease_type: DiseaseType | None = None
    organs: list[str] | None = None
    note: str | None = None
    clinical_data: dict[str, Any] | None = None


class SampleBase(BaseModel):
    study_id: str | None = None
    patient_id: str
    patient_name: str
    hospital_no: str
    sample_type: SampleType
    visit: str
    collected_at: str
    storage: str
    initial_quantity: str = ""
    remaining_quantity: str = ""
    quantity_unit: str = ""
    note: str = ""
    status: SampleStatus
    linked_omics: list[str] = Field(default_factory=list)


class SampleCreate(SampleBase):
    id: str


class SampleUpdate(BaseModel):
    study_id: str | None = None
    patient_id: str | None = None
    patient_name: str | None = None
    hospital_no: str | None = None
    sample_type: SampleType | None = None
    visit: str | None = None
    collected_at: str | None = None
    storage: str | None = None
    initial_quantity: str | None = None
    remaining_quantity: str | None = None
    quantity_unit: str | None = None
    note: str | None = None
    status: SampleStatus | None = None
    linked_omics: list[str] | None = None


class OmicsBase(BaseModel):
    study_id: str | None = None
    testing_project_id: str = "TP-SLE-OMICS"
    patient_id: str
    patient_name: str
    sample_id: str
    sample_ids: list[str] = Field(default_factory=list)
    sample_usage: dict[str, dict[str, str]] = Field(default_factory=dict)
    sample_type: str
    assay: str
    vendor: str = ""
    platform: str
    run_id: str
    status: OmicsStatus
    qc: QcStatus
    result_file_id: str | None = None
    sent_at: str
    completed_at: str = "-"


class OmicsCreate(OmicsBase):
    id: str | None = None


class OmicsUpdate(BaseModel):
    study_id: str | None = None
    testing_project_id: str | None = None
    patient_id: str | None = None
    patient_name: str | None = None
    sample_id: str | None = None
    sample_ids: list[str] | None = None
    sample_usage: dict[str, dict[str, str]] | None = None
    sample_type: str | None = None
    assay: str | None = None
    vendor: str | None = None
    platform: str | None = None
    run_id: str | None = None
    status: OmicsStatus | None = None
    qc: QcStatus | None = None
    result_file_id: str | None = None
    sent_at: str | None = None
    completed_at: str | None = None


class ConsentUpdate(BaseModel):
    status: ConsentStatus | None = None
    version: str | None = None
    signed_at: str | None = None
    method: Literal["电子", "纸质", "-"] | None = None


class CrfEntryBase(BaseModel):
    study_id: str | None = None
    patient_id: str
    visit_id: str | None = None
    crf_version_id: str | None = None
    form_id: str | None = None
    module: str
    payload: dict[str, Any] = Field(default_factory=dict)
    status: CrfStatus = "draft"


class CrfEntryCreate(CrfEntryBase):
    id: str | None = None


class CrfEntryUpdate(BaseModel):
    study_id: str | None = None
    visit_id: str | None = None
    crf_version_id: str | None = None
    form_id: str | None = None
    module: str | None = None
    payload: dict[str, Any] | None = None
    status: CrfStatus | None = None
    completed_by: str | None = None
    completed_at: str | None = None


class FollowUpRecordBase(BaseModel):
    study_id: str | None = None
    patient_id: str
    visit_id: str | None = None
    follow_up_date: str
    follow_up_method: FollowUpMethod
    followed_by: str
    survival_status: SurvivalStatus = "存活"
    disease_status: str
    symptoms_signs: str = ""
    imaging_lab_summary: str = ""
    efficacy_assessment: str = ""
    record_note: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    metastasis_status: str = ""
    adverse_events: str = ""
    quality_of_life: str = ""
    lost_to_follow_up_reason: str = ""
    recorded_at: str | None = None


class FollowUpRecordCreate(FollowUpRecordBase):
    id: str | None = None


class VisitUpdate(BaseModel):
    visit_date: str | None = None
    visit_type: str | None = None
    sle_dai: str | None = None
    medication: str | None = None
    sample_collection: str | None = None
    completeness: int | None = Field(default=None, ge=0, le=100)
    status: Literal["已完成", "进行中", "已预约"] | None = None


class FollowUpRecordUpdate(BaseModel):
    study_id: str | None = None
    visit_id: str | None = None
    follow_up_date: str | None = None
    follow_up_method: FollowUpMethod | None = None
    followed_by: str | None = None
    survival_status: SurvivalStatus | None = None
    disease_status: str | None = None
    symptoms_signs: str | None = None
    imaging_lab_summary: str | None = None
    efficacy_assessment: str | None = None
    record_note: str | None = None
    payload: dict[str, Any] | None = None
    metastasis_status: str | None = None
    adverse_events: str | None = None
    quality_of_life: str | None = None
    lost_to_follow_up_reason: str | None = None
    recorded_at: str | None = None


class FileMetadata(BaseModel):
    id: str
    study_id: str
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
    storage_backend: str = "local"
    scan_status: str = "pending"
    scan_message: str = ""
    archive_status: str = "active"
    archived_at: str | None = None
    retention_until: str | None = None


class ExportJobCreate(BaseModel):
    export_type: str
    scope: dict[str, Any] = Field(default_factory=dict)
    requested_by: str | None = None


class ApprovalRequestCreate(BaseModel):
    study_id: str
    approval_type: ApprovalType
    entity_type: str = ""
    entity_id: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    comment: str = ""
    submit: bool = True


class ApprovalActionCreate(BaseModel):
    comment: str = ""


class SiteCreate(BaseModel):
    id: str | None = None
    code: str
    name: str
    status: Literal["active", "disabled"] = "active"


class SiteUserAssign(BaseModel):
    user_id: str
    role: str
    status: Literal["active", "disabled"] = "active"


class DataQueryCreate(BaseModel):
    study_id: str
    patient_id: str
    visit_id: str | None = None
    form_id: str = ""
    field_name: str = ""
    title: str
    description: str = ""
    assigned_to: str | None = None


class DataQueryUpdate(BaseModel):
    status: Literal["open", "answered", "closed", "cancelled"] | None = None
    assigned_to: str | None = None
    response: str | None = None


class ExportJob(BaseModel):
    id: str
    study_id: str
    requested_by: str | None = None
    export_type: str
    scope: dict[str, Any] = Field(default_factory=dict)
    status: ExportStatus
    file_id: str | None = None
    created_at: str
    completed_at: str | None = None


class DataQualityIssue(BaseModel):
    id: str
    study_id: str
    patient_id: str
    source_table: str
    source_id: str
    field_name: str
    severity: QualitySeverity
    message: str
    status: QualityStatus
    created_at: str
    resolved_at: str | None = None


class AnalysisSummary(BaseModel):
    patient_count: int
    disease_distribution: dict[str, int]
    sample_count: int
    omics_count: int
    completed_omics_count: int
    data_completeness_avg: float
    visit_count: int = 0
    crf_count: int = 0
    consent_signed_count: int = 0
    sample_patient_count: int = 0
    active_patient_count: int = 0
    completed_patient_count: int = 0
    export_count: int = 0
    ready_export_count: int = 0


class StudyCreate(BaseModel):
    id: str
    code: str
    name: str
    indication: str
    phase: str = "RWD"
    status: Literal["draft", "active", "terminated", "deleted"] = "active"
    owner_org: str = "LinZight"
    leading_pi_info: str = ""
    system_admin: str = ""


class StudyUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    indication: str | None = None
    phase: str | None = None
    status: Literal["draft", "active", "terminated", "deleted"] | None = None
    owner_org: str | None = None
    leading_pi_info: str | None = None
    system_admin: str | None = None


class StudyMemberCreate(BaseModel):
    user_id: str
    study_role: StudyRole
    status: str = "active"


class StudyVisitPlanCreate(BaseModel):
    id: str | None = None
    code: str
    name: str
    visit_type: str
    day_offset: int = 0
    window_before_days: int = Field(default=0, ge=0)
    window_after_days: int = Field(default=0, ge=0)
    required_forms: list[str] = Field(default_factory=list)
    required_samples: list[str] = Field(default_factory=list)
    status: VisitPlanStatus = "active"
    sort_order: int = 0


class StudyVisitPlanUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    visit_type: str | None = None
    day_offset: int | None = None
    window_before_days: int | None = Field(default=None, ge=0)
    window_after_days: int | None = Field(default=None, ge=0)
    required_forms: list[str] | None = None
    required_samples: list[str] | None = None
    status: VisitPlanStatus | None = None
    sort_order: int | None = None


class StudyCrfVersionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    version: str
    template_id: str | None = None
    status: Literal["draft", "published", "retired"] = "draft"
    schema_payload: dict[str, Any] = Field(default_factory=dict, alias="schema")
    change_summary: str = ""


class StudyCrfVersionUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["draft", "published", "retired"] | None = None
    schema_payload: dict[str, Any] | None = Field(default=None, alias="schema")
    change_summary: str | None = None


class StudyCrfMigrationPreviewRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_version_id: str | None = None
    schema_payload: dict[str, Any] = Field(default_factory=dict, alias="schema")


class StudyCrfMigrationApprovalCreate(BaseModel):
    source_version_id: str | None = None
    target_version_id: str
    note: str = ""


class StudyCrfMigrationApprovalAction(BaseModel):
    note: str = ""


class StudyCrfFieldCreate(BaseModel):
    id: str | None = None
    name: str
    type: StudyCrfFieldType = "Text"
    module: str
    status: StudyCrfFieldStatus = "草稿"
    options: list[str] = Field(default_factory=list)
    required: bool = False
    validation_rule: str = ""
    conditional_logic: str = ""


class StudyCrfFieldUpdate(BaseModel):
    name: str | None = None
    type: StudyCrfFieldType | None = None
    module: str | None = None
    status: StudyCrfFieldStatus | None = None
    options: list[str] | None = None
    required: bool | None = None
    validation_rule: str | None = None
    conditional_logic: str | None = None
