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
- `docs/frontend-function-gap-audit.md` tracking frontend button/API/i18n/layout gaps and fix status by module.
- GitHub Actions CI covering lint, build, backend compile, API smoke, OpenAPI export, static HTML export, UI smoke, release gate, and static export artifact upload.
- API and UI smoke scripts plus `npm test` as the combined beta validation entrypoint.
- OpenAPI schema export via `npm run export:openapi`, with `docs/openapi.json` tracked as the backend contract snapshot.
- Docker Compose Demo startup with frontend/backend images, SQLite and upload volumes, healthcheck, and first-run seed behavior.
- Docker frontend image build now includes the CRF schema file required by `src/data/crfTemplate.ts`.
- Docker smoke validation via `npm run smoke:docker`, wired into CI with automatic compose cleanup.
- `docs/deployment-ops.md` with environment variables, Docker Compose notes, Nginx reverse proxy example, and Demo backup/restore instructions.
- Demo SQLite/upload backup and restore scripts: `npm run backup:sqlite` and `npm run restore:sqlite -- backups/<dir>`.

### Changed

- Frontend demo fallback data now uses the same 70-patient, three-Study cohort shape as the SQLite seed.
- Clinical data capture and system CRF field configuration now read from the CRF V0.1 schema.
- SQLite CRF storage now prefers JSONB BLOB columns with explicit payload version and storage-format metadata, while retaining TEXT JSON compatibility columns.
- Backend list/detail routes now apply Study scope filtering, and the frontend filters menus plus local fallback data by the logged-in user's Study scope.
- Backend SQLite connections now honor `LINZIGHT_DATABASE_URL`, allowing smoke tests and local installs to use an isolated database path.
- Dashboard welcome copy now reflects the authenticated user instead of a hard-coded demo PI.
- Field-level privacy rules now mask direct identifiers for data-manager/auditor roles and remove non-exportable identifiers from CSV exports.
- Approval requests now use a persisted status machine for export, de-identified export, and CRF publish workflows, with action history and audit logs.
- File handling now goes through a local storage adapter with mock virus scanning, archive status fields, permission-checked downloads, and access audit logs.
- Database productionization now records schema versions, includes an optional PostgreSQL Compose profile, and provides a SQLite table export script for PostgreSQL migration rehearsals.
- Browser interaction regression scaffolding was added with a Playwright-first runner and explicit limitation reporting when Playwright is not installed.
- Previously inert or frontend-only buttons across cohort, consent, clinical data capture, samples/testing, analytics, and system management now either call backend APIs, create audit-backed records, export real files, or present an explicit disabled state.
- English locale coverage was expanded across login, module navigation, patient cohort, informed consent, clinical data capture, sample testing, patient journey, data analysis, and system management.
- Additional English-locale cleanup covers dashboard KPI helpers, workflow cards, enrollment trend, smart summary markers, sample/testing detail panels, omics result panels, data-analysis pipeline, and system-management overview text.
- Release hygiene now blocks accidental tracking of local env files, local databases, upload payloads, dependency folders, build caches, private keys, SQLite files, and large non-resource files.

### Fixed

- Study-scoped views now consistently use `study_id` boundaries so one Study does not see another Study's patients, visits, samples, omics records, consents, CRF versions, visit plans, exports, quality data, or members.
- CRF migration approval requires a separate reviewer; self-approval/self-apply are blocked in both backend and UI.
- Consent file upload persists through the backend file endpoint and links the uploaded artifact to the consent record.

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

- FastAPI backend is Demo-grade and uses local SQLite plus local HMAC-signed Bearer tokens.
- Production API hardening, managed authentication/secret rotation, field-level privacy controls, object storage, and full browser/component test coverage are still planned work.
