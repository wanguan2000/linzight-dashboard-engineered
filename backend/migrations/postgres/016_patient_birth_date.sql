-- Add patient birth date as the source for age display.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS birth_date DATE DEFAULT NULL;

UPDATE patients
SET birth_date = make_date((EXTRACT(YEAR FROM CURRENT_DATE)::int - age), 1, 1)
WHERE birth_date IS NULL
  AND age IS NOT NULL;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('016_patient_birth_date', 'Add patient birth date and backfill from age', now())
ON CONFLICT (version) DO NOTHING;
