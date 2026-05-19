-- Backend operation log for GA create/update/delete traceability.

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  study_id TEXT REFERENCES studies(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  request_context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_study_id ON operation_logs(study_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_actor_id ON operation_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('012_operation_logs', 'Add backend operation logs for GA create/update/delete traceability', now())
ON CONFLICT (version) DO NOTHING;
