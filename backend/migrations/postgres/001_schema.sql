-- LinZight RWD EDC PostgreSQL baseline schema.
-- Operator-reviewed RC baseline; run on an empty staging database before seed/demo import.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  indication TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'RWD',
  status TEXT NOT NULL DEFAULT 'active',
  owner_org TEXT NOT NULL DEFAULT 'LinZight',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  role_code TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS study_members (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  study_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, user_id)
);

CREATE TABLE IF NOT EXISTS crf_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS study_crf_versions (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES crf_templates(id) ON DELETE SET NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, version)
);

CREATE TABLE IF NOT EXISTS study_configurations (
  study_id TEXT PRIMARY KEY REFERENCES studies(id) ON DELETE CASCADE,
  disease_area TEXT NOT NULL,
  active_crf_version_id TEXT NOT NULL REFERENCES study_crf_versions(id) ON DELETE RESTRICT,
  visit_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_template TEXT NOT NULL,
  testing_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  hospital_no TEXT NOT NULL,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 0 AND 120),
  disease_type TEXT NOT NULL,
  organs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  clinical_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  clinical_data_version TEXT NOT NULL DEFAULT 'legacy',
  clinical_data_format TEXT NOT NULL DEFAULT 'jsonb',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (study_id, hospital_no)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE RESTRICT,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  diff_json JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
