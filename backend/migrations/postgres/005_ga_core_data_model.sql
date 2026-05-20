-- GA core data model alignment for PostgreSQL runtime.
-- This migration keeps existing rows compatible while exposing the formal
-- patient/sample/omics/follow-up fields as first-class columns.

ALTER TABLE IF EXISTS patients
  ADD COLUMN IF NOT EXISTS patient_number TEXT NOT NULL DEFAULT '';

UPDATE patients
SET patient_number = name
WHERE patient_number = '' OR patient_number IS NULL;

ALTER TABLE IF EXISTS samples
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS samples
  ADD COLUMN IF NOT EXISTS initial_quantity TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS samples
  ADD COLUMN IF NOT EXISTS remaining_quantity TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS samples
  ADD COLUMN IF NOT EXISTS quantity_unit TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS omics_records
  ADD COLUMN IF NOT EXISTS vendor TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS omics_records
  ADD COLUMN IF NOT EXISTS sample_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS omics_records
  ADD COLUMN IF NOT EXISTS sample_usage_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE omics_records
SET sample_ids_json = to_jsonb(ARRAY[sample_id])
WHERE sample_ids_json = '[]'::jsonb OR sample_ids_json IS NULL;

ALTER TABLE IF EXISTS omics_records
  ADD COLUMN IF NOT EXISTS result_file_id TEXT;

ALTER TABLE IF EXISTS follow_up_records
  ADD COLUMN IF NOT EXISTS record_note TEXT NOT NULL DEFAULT '';

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('005_ga_core_data_model', 'Align GA patient, sample, omics, and follow-up columns', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
