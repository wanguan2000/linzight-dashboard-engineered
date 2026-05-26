-- LinZight RWD EDC PostgreSQL indexes.

CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);
CREATE INDEX IF NOT EXISTS idx_study_members_study_id ON study_members(study_id);
CREATE INDEX IF NOT EXISTS idx_study_members_user_id ON study_members(user_id);
CREATE INDEX IF NOT EXISTS idx_study_crf_versions_study_status ON study_crf_versions(study_id, status);
CREATE INDEX IF NOT EXISTS idx_study_configurations_active_crf ON study_configurations(active_crf_version_id);
CREATE INDEX IF NOT EXISTS idx_patients_study_id ON patients(study_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_patients_study_hospital_no_present
  ON patients(study_id, hospital_no)
  WHERE hospital_no IS NOT NULL AND hospital_no <> '';
CREATE INDEX IF NOT EXISTS idx_patients_disease_type ON patients(disease_type);
CREATE INDEX IF NOT EXISTS idx_patients_clinical_data_gin ON patients USING GIN (clinical_data_json);
CREATE INDEX IF NOT EXISTS idx_visit_plans_study_id ON study_visit_plans(study_id);
CREATE INDEX IF NOT EXISTS idx_samples_patient_id ON samples(patient_id);
CREATE INDEX IF NOT EXISTS idx_samples_study_id ON samples(study_id);
CREATE INDEX IF NOT EXISTS idx_omics_patient_id ON omics_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_omics_sample_id ON omics_records(sample_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_records_patient_id ON follow_up_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_crf_entries_patient_id ON crf_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_patient_id ON uploaded_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_study_id ON export_jobs(study_id);
CREATE INDEX IF NOT EXISTS idx_quality_patient_status ON data_quality_issues(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_study_id ON operation_logs(study_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_actor_id ON operation_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_crf_migration_approvals_study_id ON crf_migration_approvals(study_id);
CREATE INDEX IF NOT EXISTS idx_crf_migration_execution_logs_migration_id ON crf_migration_execution_logs(migration_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_study_id ON approval_requests(study_id);
CREATE INDEX IF NOT EXISTS idx_approval_actions_approval_id ON approval_actions(approval_id);
CREATE INDEX IF NOT EXISTS idx_sites_study_id ON sites(study_id);
CREATE INDEX IF NOT EXISTS idx_site_users_study_site ON site_users(study_id, site_id);
CREATE INDEX IF NOT EXISTS idx_data_queries_study_id ON data_queries(study_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
