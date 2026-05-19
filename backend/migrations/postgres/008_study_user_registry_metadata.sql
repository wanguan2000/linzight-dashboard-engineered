-- GA Study registry and account-list metadata.

ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS leading_pi_info TEXT NOT NULL DEFAULT '';

ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS system_admin TEXT NOT NULL DEFAULT '';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('008_study_user_registry_metadata', 'Add Study leading PI/admin metadata and user last login timestamp', now())
ON CONFLICT (version) DO NOTHING;
