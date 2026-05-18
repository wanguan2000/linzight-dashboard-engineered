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

export type ApiUserCreate = {
  username: string;
  display_name: string;
  role: ApiUserRole;
  password?: string;
  status?: 'active' | 'disabled';
  study_id?: string;
  member_status?: 'active' | 'pending' | 'disabled';
};

export type ApiUserStatusUpdate = {
  status: 'active' | 'disabled';
};

export type ApiUserUpdate = {
  display_name?: string;
  role?: ApiUserRole;
  password?: string;
  status?: 'active' | 'disabled';
};

export type ApiPermissionMatrixRow = {
  module: string;
  operation: string;
  resource: string;
  action: string;
  endpoints: string[];
  allowed_roles: ApiUserRole[];
};

export type ApiStudy = {
  id: string;
  code: string;
  name: string;
  indication: string;
  phase: string;
  status: 'draft' | 'active' | 'terminated' | 'deleted';
  owner_org: string;
  created_at: string;
  updated_at: string;
};

export type ApiStudyCreate = Pick<ApiStudy, 'id' | 'code' | 'name' | 'indication'> &
  Partial<Pick<ApiStudy, 'phase' | 'status' | 'owner_org'>>;

export type ApiStudyUpdate = Partial<Pick<ApiStudy, 'code' | 'name' | 'indication' | 'phase' | 'status' | 'owner_org'>>;

export type ApiLoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: ApiUser;
};

export type ApiPasswordResetRequest = {
  username: string;
};

export type ApiPasswordResetConfirm = {
  token: string;
  password: string;
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

export type ApiGlobalPatientIndex = {
  patient_id: string;
  masked_subject_code: string;
  study_id: string;
  study_name: string;
  disease_type: DiseaseType;
  status: string;
  last_updated: string;
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

export type ApiStudyConfiguration = {
  study_id: string;
  disease_area: string;
  active_crf_version_id: string;
  visit_plan: {
    profile?: string;
    active_plan_codes?: string[];
    [key: string]: unknown;
  };
  consent_template: string;
  testing_profile: {
    testing_project_id?: string;
    sample_types?: string[];
    assays?: string[];
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
};

export type ApiStudyMember = {
  id: string;
  study_id: string;
  user_id: string;
  username: string;
  display_name: string;
  study_role: 'STUDY_PI' | 'STUDY_CRC' | 'STUDY_CONFIG_ADMIN' | 'STUDY_DATA_MANAGER';
  status: string;
  created_at: string;
  updated_at: string;
};

export type ApiStudyCrfField = {
  study_id: string;
  crf_version_id: string;
  crf_version: string;
  id: string;
  name: string;
  type: 'Text' | 'Number' | 'Dropdown' | 'Boolean';
  module: string;
  status: '启用' | '草稿' | '停用';
  options: string[];
  required: boolean;
  validation_rule: string;
  conditional_logic: string;
  updated_at: string;
};

export type ApiStudyCrfVersion = {
  id: string;
  study_id: string;
  template_id?: string | null;
  version: string;
  status: 'draft' | 'published' | 'retired';
  schema: Record<string, unknown>;
  change_summary: string;
  created_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiCrfMigrationPreview = {
  study_id: string;
  source_version_id: string;
  source_version: string;
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    source_field_count: number;
    target_field_count: number;
  };
  added: ApiStudyCrfField[];
  removed: ApiStudyCrfField[];
  changed: Array<{
    id: string;
    name: string;
    changes: string[];
    before: Partial<ApiStudyCrfField>;
    after: Partial<ApiStudyCrfField>;
  }>;
};

export type ApiCrfMigrationApproval = {
  id: string;
  study_id: string;
  source_version_id: string;
  target_version_id: string;
  status: 'pending' | 'approved' | 'applied' | 'rejected';
  preview: ApiCrfMigrationPreview & {
    target_version_id?: string;
    target_version?: string;
  };
  note: string;
  requested_by?: string | null;
  approved_by?: string | null;
  requested_at: string;
  reviewed_at?: string | null;
  applied_at?: string | null;
  created_at: string;
  updated_at: string;
  execution_logs?: Array<{
    id: string;
    study_id: string;
    migration_id: string;
    step: string;
    status: string;
    message: string;
    actor_id?: string | null;
    created_at: string;
  }>;
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
  status: '待签署' | '已签署' | '撤回审批中' | '已撤回' | '重签审批中' | '已重签';
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
  storage_backend?: string;
  scan_status?: string;
  scan_message?: string;
  archive_status?: string;
  archived_at?: string | null;
  retention_until?: string | null;
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

export type ApiApprovalRequest = {
  id: string;
  study_id: string;
  approval_type: 'export' | 'deidentified_export' | 'crf_publish' | 'econsent_withdrawal' | 'econsent_resign';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  submitted_by?: string | null;
  reviewed_by?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  completed_at?: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
  actions?: Array<{
    id: string;
    approval_id: string;
    study_id: string;
    actor_id?: string | null;
    action: string;
    from_status?: string | null;
    to_status: string;
    comment: string;
    created_at: string;
  }>;
};

export type ApiStudySite = {
  id: string;
  study_id: string;
  code: string;
  name: string;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
};

export type ApiSiteUser = {
  id: string;
  study_id: string;
  site_id: string;
  user_id: string;
  role: string;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
};

export type ApiDataQuery = {
  id: string;
  study_id: string;
  patient_id: string;
  visit_id: string | null;
  form_id: string;
  field_name: string;
  title: string;
  description: string;
  status: 'open' | 'answered' | 'closed' | 'cancelled';
  assigned_to: string | null;
  created_by: string | null;
  response: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type ApiQualityIssue = {
  id: string;
  study_id: string;
  patient_id: string;
  source_table: string;
  source_id: string;
  field_name: string;
  severity: 'info' | 'warning' | 'critical' | string;
  message: string;
  status: 'open' | 'resolved' | string;
  created_at: string;
  resolved_at: string | null;
};

export type ApiAuditDiff = {
  field: string;
  before: unknown;
  after: unknown;
};

export type ApiAuditLog = {
  id: string;
  study_id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  diff: ApiAuditDiff[];
  ip_address: string | null;
  created_at: string;
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
