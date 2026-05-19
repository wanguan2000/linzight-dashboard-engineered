-- LinZight RWD EDC PostgreSQL baseline schema.
-- Operator-reviewed RC baseline; run on an empty staging database before seed/demo import.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  indication TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'RWD',
  status TEXT NOT NULL DEFAULT 'active',
  owner_org TEXT NOT NULL DEFAULT 'LinZight',
  leading_pi_info TEXT NOT NULL DEFAULT '',
  system_admin TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  role_code TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS study_members (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, user_id)
);

CREATE TABLE IF NOT EXISTS study_crf_versions (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  template_id TEXT,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, version)
);

CREATE TABLE IF NOT EXISTS study_configurations (
  study_id TEXT PRIMARY KEY REFERENCES studies(id) ON DELETE CASCADE,
  disease_area TEXT NOT NULL,
  active_crf_version_id TEXT NOT NULL REFERENCES study_crf_versions(id) ON DELETE RESTRICT,
  visit_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_template TEXT NOT NULL,
  testing_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  follow_up_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS study_visit_plans (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  visit_type TEXT NOT NULL,
  day_offset INTEGER NOT NULL DEFAULT 0,
  window_before_days INTEGER NOT NULL DEFAULT 0,
  window_after_days INTEGER NOT NULL DEFAULT 0,
  required_forms_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_samples_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, code)
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_number TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  hospital_no TEXT NOT NULL,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
  disease_type TEXT NOT NULL,
  organs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  clinical_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  clinical_data_jsonb JSONB,
  clinical_data_version TEXT NOT NULL DEFAULT 'legacy',
  clinical_data_format TEXT NOT NULL DEFAULT 'jsonb',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, hospital_no)
);

CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  hospital_no TEXT NOT NULL,
  sample_type TEXT NOT NULL,
  visit TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  storage TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  linked_omics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS omics_records (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  testing_project_id TEXT NOT NULL DEFAULT 'TP-SLE-OMICS',
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  sample_type TEXT NOT NULL,
  assay TEXT NOT NULL,
  platform TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  qc TEXT NOT NULL,
  result_file_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '-',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  version TEXT NOT NULL,
  signed_at TEXT NOT NULL DEFAULT '-',
  method TEXT NOT NULL DEFAULT '-'
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_plan_id TEXT REFERENCES study_visit_plans(id) ON DELETE SET NULL,
  visit TEXT NOT NULL,
  visit_date DATE NOT NULL,
  visit_type TEXT NOT NULL,
  sle_dai TEXT NOT NULL,
  medication TEXT NOT NULL,
  sample_collection TEXT NOT NULL,
  completeness INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follow_up_records (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
  follow_up_date DATE NOT NULL,
  follow_up_method TEXT NOT NULL,
  followed_by TEXT NOT NULL,
  survival_status TEXT NOT NULL,
  disease_status TEXT NOT NULL,
  symptoms_signs TEXT NOT NULL DEFAULT '',
  imaging_lab_summary TEXT NOT NULL DEFAULT '',
  efficacy_assessment TEXT NOT NULL DEFAULT '',
  record_note TEXT NOT NULL DEFAULT '',
  metastasis_status TEXT NOT NULL DEFAULT '',
  adverse_events TEXT NOT NULL DEFAULT '',
  quality_of_life TEXT NOT NULL DEFAULT '',
  lost_to_follow_up_reason TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_jsonb JSONB,
  payload_version TEXT NOT NULL DEFAULT 'legacy',
  payload_format TEXT NOT NULL DEFAULT 'jsonb',
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS field_permissions (
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  field_name TEXT NOT NULL,
  can_view INTEGER NOT NULL DEFAULT 1,
  can_export INTEGER NOT NULL DEFAULT 1,
  mask_rule TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (role, resource, field_name)
);

CREATE TABLE IF NOT EXISTS crf_entries (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
  crf_version_id TEXT NOT NULL DEFAULT 'CRFV-LGL-1111-V0.1',
  form_id TEXT NOT NULL DEFAULT 'baseline',
  module TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_jsonb JSONB,
  payload_version TEXT NOT NULL DEFAULT 'legacy',
  payload_format TEXT NOT NULL DEFAULT 'jsonb',
  status TEXT NOT NULL DEFAULT 'draft',
  completed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  sample_id TEXT REFERENCES samples(id) ON DELETE CASCADE,
  omics_id TEXT REFERENCES omics_records(id) ON DELETE CASCADE,
  consent_id TEXT REFERENCES consents(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  is_deidentified INTEGER NOT NULL DEFAULT 0,
  storage_backend TEXT NOT NULL DEFAULT 'local',
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_message TEXT NOT NULL DEFAULT '',
  archive_status TEXT NOT NULL DEFAULT 'active',
  archived_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL,
  scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  file_id TEXT REFERENCES uploaded_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS data_quality_issues (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  study_id TEXT REFERENCES studies(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  request_context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS global_role_study_scope (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, study_id)
);

CREATE TABLE IF NOT EXISTS crf_migration_approvals (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  source_version_id TEXT NOT NULL REFERENCES study_crf_versions(id) ON DELETE CASCADE,
  target_version_id TEXT NOT NULL REFERENCES study_crf_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  preview_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS crf_migration_execution_logs (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  migration_id TEXT NOT NULL REFERENCES crf_migration_approvals(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, code)
);

CREATE TABLE IF NOT EXISTS site_users (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (site_id, user_id)
);

CREATE TABLE IF NOT EXISTS data_queries (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
  form_id TEXT NOT NULL DEFAULT '',
  field_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  response TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);
