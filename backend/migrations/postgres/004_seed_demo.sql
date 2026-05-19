-- No-op seed marker kept for migration ordering compatibility.
-- Formal GA databases must start without demo Study, patient, sample, or omics rows.
-- Full demo imports are explicit fixtures and should use `npm run export:postgres-migration`.

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260516_postgres_rc_baseline', 'PostgreSQL RC baseline schema/index/constraint split', now())
ON CONFLICT (version) DO NOTHING;
