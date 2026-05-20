-- GA PostgreSQL-native JSONB storage for all JSON payload/schema columns.

CREATE OR REPLACE FUNCTION lz_convert_jsonb_column(
  p_table TEXT,
  p_column TEXT,
  p_default JSONB,
  p_not_null BOOLEAN
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', p_table, p_column);

  IF p_default IS NULL THEN
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE JSONB USING CASE WHEN %I IS NULL OR btrim(%I::text) = '''' THEN NULL ELSE %I::jsonb END',
      p_table,
      p_column,
      p_column,
      p_column,
      p_column
    );
  ELSE
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE JSONB USING CASE WHEN %I IS NULL OR btrim(%I::text) = '''' THEN %L::jsonb ELSE %I::jsonb END',
      p_table,
      p_column,
      p_column,
      p_column,
      p_default::text,
      p_column
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT %L::jsonb', p_table, p_column, p_default::text);
  END IF;

  IF p_not_null THEN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', p_table, p_column);
  ELSE
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', p_table, p_column);
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT lz_convert_jsonb_column('patients', 'organs_json', '[]'::jsonb, true);
SELECT lz_convert_jsonb_column('patients', 'clinical_data_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('patients', 'clinical_data_jsonb', NULL, false);

SELECT lz_convert_jsonb_column('study_visit_plans', 'required_forms_json', '[]'::jsonb, true);
SELECT lz_convert_jsonb_column('study_visit_plans', 'required_samples_json', '[]'::jsonb, true);

SELECT lz_convert_jsonb_column('study_configurations', 'visit_plan_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('study_configurations', 'testing_profile_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('study_configurations', 'follow_up_schema_json', '{}'::jsonb, true);

SELECT lz_convert_jsonb_column('samples', 'linked_omics_json', '[]'::jsonb, true);
SELECT lz_convert_jsonb_column('omics_records', 'sample_ids_json', '[]'::jsonb, true);
SELECT lz_convert_jsonb_column('omics_records', 'sample_usage_json', '{}'::jsonb, true);

SELECT lz_convert_jsonb_column('follow_up_records', 'payload_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('follow_up_records', 'payload_jsonb', NULL, false);

SELECT lz_convert_jsonb_column('crf_entries', 'payload_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('crf_entries', 'payload_jsonb', NULL, false);

SELECT lz_convert_jsonb_column('export_jobs', 'scope_json', '{}'::jsonb, true);

SELECT lz_convert_jsonb_column('crf_templates', 'schema_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('study_crf_versions', 'schema_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('crf_migration_approvals', 'preview_json', '{}'::jsonb, true);
SELECT lz_convert_jsonb_column('approval_requests', 'payload_json', '{}'::jsonb, true);

DROP FUNCTION lz_convert_jsonb_column(TEXT, TEXT, JSONB, BOOLEAN);

UPDATE patients
SET clinical_data_jsonb = clinical_data_json,
    clinical_data_format = 'jsonb'
WHERE clinical_data_jsonb IS NULL;

UPDATE crf_entries
SET payload_jsonb = payload_json,
    payload_format = 'jsonb'
WHERE payload_jsonb IS NULL;

UPDATE follow_up_records
SET payload_jsonb = payload_json,
    payload_format = 'jsonb'
WHERE payload_jsonb IS NULL;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('009_postgres_jsonb_columns', 'Convert all PostgreSQL JSON payload/schema columns to native JSONB', now())
ON CONFLICT (version) DO NOTHING;
