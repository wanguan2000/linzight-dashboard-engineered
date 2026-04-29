from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


DiseaseType = Literal["NPSLE", "Non-NPSLE", "MS", "NMOSD", "HC"]
Sex = Literal["男", "女"]
SampleType = Literal["血液", "CSF", "肾", "尿液"]
SampleStatus = Literal["已采集", "已送检", "检测中", "结果回传", "待处理"]
OmicsStatus = Literal["样本接收", "文库构建", "测序完成", "数据分析", "结果归档"]
QcStatus = Literal["通过", "未通过", "待确认"]


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
