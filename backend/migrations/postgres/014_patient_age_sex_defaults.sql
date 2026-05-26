-- Allow missing patient age and default unknown sex for pilot intake.

ALTER TABLE patients
  ALTER COLUMN age DROP NOT NULL,
  ALTER COLUMN age SET DEFAULT NULL,
  ALTER COLUMN sex SET DEFAULT 'unknown';

UPDATE patients
SET sex = 'unknown'
WHERE sex IS NULL OR sex = '';

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('014_patient_age_sex_defaults', 'Allow nullable patient age and default unknown sex', now())
ON CONFLICT (version) DO NOTHING;
