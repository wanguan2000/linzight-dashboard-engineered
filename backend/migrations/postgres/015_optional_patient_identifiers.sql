-- Allow patient name and hospital number to be omitted during intake.

ALTER TABLE patients
  ALTER COLUMN hospital_no DROP NOT NULL,
  ALTER COLUMN hospital_no SET DEFAULT NULL;

UPDATE patients
SET hospital_no = NULL
WHERE hospital_no = '';

ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_hospital_no_key;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_study_id_hospital_no_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_patients_study_hospital_no_present
  ON patients(study_id, hospital_no)
  WHERE hospital_no IS NOT NULL AND hospital_no <> '';

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('015_optional_patient_identifiers', 'Allow optional patient name and hospital number', now())
ON CONFLICT (version) DO NOTHING;
