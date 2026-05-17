-- Minimal demo seed for staging connectivity checks.
-- Full 70-patient demo import should use `npm run export:postgres-migration`.

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20260516_postgres_rc_baseline', 'PostgreSQL RC baseline schema/index/constraint split', now())
ON CONFLICT (version) DO NOTHING;

INSERT INTO studies (id, code, name, indication, phase, status, owner_org, created_at, updated_at)
VALUES
  ('LGL-1111', 'LGL-1111', '免疫相关性神经系统疾病 RWD 研究', 'NPSLE / MS / NMOSD / HC', 'RWD', 'active', 'LinZight', now(), now()),
  ('LZXK-01', 'LZXK-01', '真实世界肺癌耐药研究', 'NSCLC / EGFR-TKI resistance / ALK resistance', 'RWD', 'active', 'LinZight', now(), now())
ON CONFLICT (id) DO NOTHING;
