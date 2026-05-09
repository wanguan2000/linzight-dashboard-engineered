import type { FollowUpRecord, OmicsRecord, SampleRecord } from '../data/operations';
import type { StudyMembership, StudyScope } from '../data/auth';
import type { DiseaseType } from '../data/patientCohort';

export type ApiUserRole =
  | 'LZ_ADMIN'
  | 'LZ_CRC'
  | 'LZ_CRF_ADMIN'
  | 'LZ_DATA_MANAGER'
  | 'LZ_AUDITOR'
  | 'STUDY_PI'
  | 'STUDY_CRC'
  | 'STUDY_CONFIG_ADMIN'
  | 'STUDY_DATA_MANAGER';

export type ApiUser = {
  id: string;
  username: string;
  display_name: string;
  role: ApiUserRole;
  legacy_role?: string | null;
  status: string;
  study_scope?: StudyScope;
  study_memberships?: StudyMembership[];
};

export type ApiLoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: ApiUser;
};

export type ApiPatient = {
  id: string;
  study_id: string;
  name: string;
  hospital_no: string;
  sex: '男' | '女';
  age: number;
  disease_type: DiseaseType;
  organs: string[];
  note: string;
  clinical_data: Record<string, string | number>;
  clinical_data_version?: string;
  clinical_data_format?: 'jsonb' | 'json' | 'legacy';
};

export type ApiSample = {
  id: string;
  study_id: string;
  patient_id: string;
  patient_name: string;
  hospital_no: string;
  sample_type: SampleRecord['sampleType'];
  visit: string;
  collected_at: string;
  storage: string;
  status: SampleRecord['status'];
  linked_omics: string[];
};

export type ApiOmics = {
  id: string;
  study_id: string;
  testing_project_id: string;
  patient_id: string;
  patient_name: string;
  sample_id: string;
  sample_type: string;
  assay: OmicsRecord['assay'];
  platform: string;
  run_id: string;
  status: OmicsRecord['status'];
  qc: OmicsRecord['qc'];
  sent_at: string;
  completed_at: string;
};

export type ApiVisit = {
  id: string;
  study_id: string;
  patient_id: string;
  visit_plan_id?: string | null;
  visit_plan_code?: string | null;
  plan_day_offset?: number | null;
  window_before_days?: number | null;
  window_after_days?: number | null;
  patient_name: string;
  visit: string;
  visit_date: string;
  visit_type: string;
  sle_dai: string;
  medication: string;
  sample_collection: string;
  completeness: number;
  status: '已完成' | '进行中' | '已预约';
};

export type ApiStudyVisitPlan = {
  id: string;
  study_id: string;
  code: string;
  name: string;
  visit_type: string;
  day_offset: number;
  window_before_days: number;
  window_after_days: number;
  required_forms: string[];
  required_samples: string[];
  status: 'active' | 'draft' | 'retired';
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ApiFollowUpRecord = {
  id: string;
  study_id: string;
  patient_id: string;
  visit_id?: string | null;
  patient_name: string;
  follow_up_date: string;
  follow_up_method: FollowUpRecord['followUpMethod'];
  followed_by: string;
  survival_status: FollowUpRecord['survivalStatus'];
  disease_status: string;
  symptoms_signs: string;
  imaging_lab_summary: string;
  efficacy_assessment: string;
  metastasis_status: string;
  adverse_events: string;
  quality_of_life: string;
  lost_to_follow_up_reason: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type ApiConsent = {
  id: string;
  study_id: string;
  patient_id: string;
  patient_name: string;
  hospital_no: string;
  disease_type: DiseaseType;
  status: '已签署' | '待签署' | '已撤回';
  version: string;
  signed_at: string;
  method: '电子' | '纸质' | '-';
};

export type ApiCrfEntry = {
  id: string;
  study_id: string;
  patient_id: string;
  visit_id: string | null;
  crf_version_id: string;
  form_id: string;
  module: string;
  payload: Record<string, string | number | boolean | null>;
  payload_version?: string;
  payload_format?: 'jsonb' | 'json' | 'legacy';
  status: 'draft' | 'submitted' | 'locked';
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiFileMetadata = {
  id: string;
  study_id: string;
  patient_id: string | null;
  sample_id: string | null;
  omics_id: string | null;
  consent_id: string | null;
  category: 'consent' | 'clinical' | 'sample' | 'omics_result' | 'analysis_export' | 'other';
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_by: string | null;
  uploaded_at: string;
  is_deidentified: boolean;
};

export type ApiExportJob = {
  id: string;
  study_id: string;
  requested_by: string | null;
  export_type: string;
  scope: Record<string, unknown>;
  status: 'queued' | 'running' | 'ready' | 'failed';
  file_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ApiAnalysisSummary = {
  patient_count: number;
  disease_distribution: Record<DiseaseType, number>;
  sample_count: number;
  omics_count: number;
  completed_omics_count: number;
  data_completeness_avg: number;
  visit_count?: number;
  crf_count?: number;
  consent_signed_count?: number;
  sample_patient_count?: number;
  active_patient_count?: number;
  completed_patient_count?: number;
};

export type ApiPanorama = {
  patient: ApiPatient;
  samples: ApiSample[];
  omics_records: ApiOmics[];
  visits?: ApiVisit[];
  follow_up_records?: ApiFollowUpRecord[];
  crf_entries?: ApiCrfEntry[];
  files?: ApiFileMetadata[];
};
