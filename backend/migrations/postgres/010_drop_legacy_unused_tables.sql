-- Remove legacy tables not used by the GA runtime API.

DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS crf_templates;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('010_drop_legacy_unused_tables', 'Drop legacy role_permissions and crf_templates tables from GA runtime', now())
ON CONFLICT (version) DO NOTHING;
