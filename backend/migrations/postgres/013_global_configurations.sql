CREATE TABLE IF NOT EXISTS global_configurations (
  key TEXT PRIMARY KEY,
  values_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL
);
