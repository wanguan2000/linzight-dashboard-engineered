-- GA Study-configurable follow-up JSON schema and payload storage.

ALTER TABLE IF EXISTS study_configurations
  ADD COLUMN IF NOT EXISTS follow_up_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  follow_up_schema_type TEXT;
BEGIN
  SELECT data_type INTO follow_up_schema_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'study_configurations'
    AND column_name = 'follow_up_schema_json';

  IF follow_up_schema_type = 'jsonb' THEN
    EXECUTE $sql$
      UPDATE study_configurations
      SET follow_up_schema_json = jsonb_build_object(
        'profile', COALESCE(visit_plan_json ->> 'profile', 'follow_up_v1'),
        'version', 'v1',
        'sections', jsonb_build_array(
          jsonb_build_object(
            'id', 'follow_up',
            'title', '患者随访',
            'fields', jsonb_build_array(
              jsonb_build_object('id', 'visit', 'name', '访视', 'type', 'Text', 'required', true),
              jsonb_build_object('id', 'date', 'name', '日期', 'type', 'Date', 'required', true),
              jsonb_build_object('id', 'type', 'name', '类型', 'type', 'Dropdown', 'required', true, 'options', jsonb_build_array('门诊', '电话', '线上', '家访', '其他')),
              jsonb_build_object('id', 'efficacy', 'name', '疗效评估', 'type', 'Text', 'required', false),
              jsonb_build_object('id', 'record', 'name', '记录', 'type', 'Textarea', 'required', false)
            )
          )
        )
      )
      WHERE follow_up_schema_json = '{}'::jsonb
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE study_configurations
      SET follow_up_schema_json = jsonb_build_object(
        'profile', 'follow_up_v1',
        'version', 'v1',
        'sections', jsonb_build_array(
          jsonb_build_object(
            'id', 'follow_up',
            'title', '患者随访',
            'fields', jsonb_build_array(
              jsonb_build_object('id', 'visit', 'name', '访视', 'type', 'Text', 'required', true),
              jsonb_build_object('id', 'date', 'name', '日期', 'type', 'Date', 'required', true),
              jsonb_build_object('id', 'type', 'name', '类型', 'type', 'Dropdown', 'required', true, 'options', jsonb_build_array('门诊', '电话', '线上', '家访', '其他')),
              jsonb_build_object('id', 'efficacy', 'name', '疗效评估', 'type', 'Text', 'required', false),
              jsonb_build_object('id', 'record', 'name', '记录', 'type', 'Textarea', 'required', false)
            )
          )
        )
      )::text
      WHERE follow_up_schema_json::text = '{}'
    $sql$;
  END IF;
END $$;

ALTER TABLE IF EXISTS follow_up_records
  ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payload_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS payload_version TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS payload_format TEXT NOT NULL DEFAULT 'jsonb';

DO $$
DECLARE
  payload_type TEXT;
BEGIN
  SELECT data_type INTO payload_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'follow_up_records'
    AND column_name = 'payload_json';

  IF payload_type = 'jsonb' THEN
    EXECUTE $sql$
      UPDATE follow_up_records
      SET payload_json = jsonb_build_object(
          '访视', COALESCE(visit_id, ''),
          '日期', follow_up_date,
          '类型', follow_up_method,
          '疗效评估', efficacy_assessment,
          '记录', record_note
        ),
        payload_jsonb = jsonb_build_object(
          '访视', COALESCE(visit_id, ''),
          '日期', follow_up_date,
          '类型', follow_up_method,
          '疗效评估', efficacy_assessment,
          '记录', record_note
        ),
        payload_version = 'v1',
        payload_format = 'jsonb'
      WHERE payload_json = '{}'::jsonb OR payload_jsonb IS NULL
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE follow_up_records
      SET payload_json = jsonb_build_object(
          '访视', COALESCE(visit_id, ''),
          '日期', follow_up_date,
          '类型', follow_up_method,
          '疗效评估', efficacy_assessment,
          '记录', record_note
        )::text,
        payload_jsonb = jsonb_build_object(
          '访视', COALESCE(visit_id, ''),
          '日期', follow_up_date,
          '类型', follow_up_method,
          '疗效评估', efficacy_assessment,
          '记录', record_note
        )::text,
        payload_version = 'v1',
        payload_format = 'json'
      WHERE payload_json::text = '{}' OR payload_jsonb IS NULL
    $sql$;
  END IF;
END $$;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('007_follow_up_json_schema', 'Add Study-configurable follow-up schema and JSON payload storage', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
