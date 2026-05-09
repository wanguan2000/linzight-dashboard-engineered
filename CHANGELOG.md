# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## Unreleased

### Added

- SLE CRF V0.1 schema generated from `resource/SLE临床数据记录表.csv`, with 10 sections and 89 fields.
- 70-patient demo seed now writes versioned CRF payloads for patient `clinical_data` and `crf_entries`.
- `LZXK-01` real-world lung cancer resistance Study with 20 default patients, Study roles, lung resistance CRF fields, tissue/pleural-effusion samples, and `TP-LUNG-RESIST-OMICS` testing project records.
- Multi-Study RWD EDC permission model with `study_id` isolation, platform roles, Study roles, Study members, CRF version records, global Study scopes, and `testing_project_id` for sample testing projects.
- Study visit plan configuration via `study_visit_plans`, linked from `visits.visit_plan_id`, with automatic planned visit and CRF draft generation for newly created patients.
- Patient-owned follow-up records via `follow_up_records`, including follow-up method, follower, survival and disease status, efficacy, metastasis, adverse events, quality of life, and loss-to-follow-up reason.
- `docs/04-study-permissions.md` documenting the Study role and isolation model.
- `docs/05-beta-release-readiness.md` documenting beta release validation, security checks, CRUD smoke coverage, and remaining production-readiness work.

### Changed

- Frontend demo fallback data now uses the same 70-patient, three-Study cohort shape as the SQLite seed.
- Clinical data capture and system CRF field configuration now read from the CRF V0.1 schema.
- SQLite CRF storage now prefers JSONB BLOB columns with explicit payload version and storage-format metadata, while retaining TEXT JSON compatibility columns.
- Backend list/detail routes now apply Study scope filtering, and the frontend filters menus plus local fallback data by the logged-in user's Study scope.
- Backend SQLite connections now honor `LINZIGHT_DATABASE_URL`, allowing smoke tests and local installs to use an isolated database path.
- Dashboard welcome copy now reflects the authenticated user instead of a hard-coded demo PI.

## [0.0.1-beta.0] - 2026-05-01

### Added

- GitHub beta release preparation documents: `AGENTS.md`, `AI_HANDOFF.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `SETUP.md`, `ROADMAP.md`, `API.md`, `DEPLOYMENT.md`, and `SECURITY.md`.
- Root `.env.example` and improved backend environment example.
- MIT `LICENSE`.
- Static HTML export documentation for eight dashboard modules.

### Changed

- Project version normalized to `0.0.1-beta.0`.
- README updated as the primary GitHub entry point for future developers and AI agents.
- `.gitignore` expanded to exclude generated output, caches, local env files, local database files, uploads, and IDE/system files.

### Known Issues

- No dedicated `test` script is configured yet.
- FastAPI backend is Demo-grade and uses local SQLite plus demo token authentication.
- Production API, CI/CD, Docker deployment, and automated browser tests are still planned work.
