-- LinZight RWD EDC PostgreSQL indexes.

CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);
CREATE INDEX IF NOT EXISTS idx_study_members_study_id ON study_members(study_id);
CREATE INDEX IF NOT EXISTS idx_study_members_user_id ON study_members(user_id);
CREATE INDEX IF NOT EXISTS idx_study_crf_versions_study_status ON study_crf_versions(study_id, status);
CREATE INDEX IF NOT EXISTS idx_study_configurations_active_crf ON study_configurations(active_crf_version_id);
CREATE INDEX IF NOT EXISTS idx_patients_study_id ON patients(study_id);
CREATE INDEX IF NOT EXISTS idx_patients_disease_type ON patients(disease_type);
CREATE INDEX IF NOT EXISTS idx_patients_clinical_data_gin ON patients USING GIN (clinical_data_json);
CREATE INDEX IF NOT EXISTS idx_audit_logs_study_created ON audit_logs(study_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
