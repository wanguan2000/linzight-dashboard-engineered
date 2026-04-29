import type { OmicsRecord, SampleRecord } from '../data/operations';
import type { DiseaseType } from '../data/patientCohort';

export type ApiUserRole = 'sys_admin' | 'project_admin' | 'investigator' | 'crc' | 'data_manager' | 'viewer';

export type ApiUser = {
  id: string;
  username: string;
  display_name: string;
  role: ApiUserRole;
  status: string;
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
};

export type ApiSample = {
  id: string;
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

export type ApiConsent = {
  id: string;
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
  patient_id: string;
  visit_id: string | null;
  module: string;
  payload: Record<string, string | number | boolean | null>;
  status: 'draft' | 'submitted' | 'locked';
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiFileMetadata = {
  id: string;
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
  crf_entries?: ApiCrfEntry[];
  files?: ApiFileMetadata[];
};
