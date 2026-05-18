-- LinZight RWD EDC PostgreSQL Demo release constraints.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_crf_versions_status_check') THEN
    ALTER TABLE study_crf_versions
      ADD CONSTRAINT study_crf_versions_status_check
      CHECK (status IN ('draft', 'published', 'retired'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_members_role_check') THEN
    ALTER TABLE study_members
      ADD CONSTRAINT study_members_role_check
      CHECK (study_role IN ('STUDY_PI', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_code_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_code_check
      CHECK (role_code IN ('LZ_ADMIN', 'LZ_CRC', 'LZ_CRF_ADMIN', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_PI', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_published_crf_per_study
  ON study_crf_versions(study_id)
  WHERE status = 'published';
