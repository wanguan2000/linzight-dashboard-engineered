-- GA patient-name privacy alignment.
-- `patient_name` stores the full patient name. Frontend defaults to initials,
-- and only authorized roles receive the full value from the backend.

ALTER TABLE IF EXISTS patients
  ADD COLUMN IF NOT EXISTS patient_name TEXT NOT NULL DEFAULT '';

INSERT INTO field_permissions (role, resource, field_name, can_view, can_export, mask_rule, created_at, updated_at)
VALUES
  ('LZ_ADMIN', 'patients', 'patient_name', 1, 1, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('STUDY_CONFIG_ADMIN', 'patients', 'patient_name', 1, 1, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('STUDY_CRC', 'patients', 'patient_name', 1, 1, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('LZ_CRC', 'patients', 'patient_name', 1, 1, 'none', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('LZ_CRF_ADMIN', 'patients', 'patient_name', 1, 0, 'pinyin_initials', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('LZ_DATA_MANAGER', 'patients', 'patient_name', 1, 0, 'pinyin_initials', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('LZ_AUDITOR', 'patients', 'patient_name', 1, 0, 'pinyin_initials', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('STUDY_PI', 'patients', 'patient_name', 1, 0, 'pinyin_initials', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('STUDY_DATA_MANAGER', 'patients', 'patient_name', 1, 0, 'pinyin_initials', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role, resource, field_name) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_export = EXCLUDED.can_export,
  mask_rule = EXCLUDED.mask_rule,
  updated_at = EXCLUDED.updated_at;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('006_patient_name_privacy', 'Add patient_name with pinyin-initial default display and role-based reveal', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
