-- Remove the standalone audit log module from the GA runtime.

DROP TABLE IF EXISTS audit_logs;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('011_drop_audit_module', 'Drop audit log module table from GA runtime', now())
ON CONFLICT (version) DO NOTHING;
