# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [1.0.2] - 2026-05-19

### Changed

- Formal backend runtime now rejects `sqlite:///...` database URLs unless `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` is explicitly set for isolated smoke tests or legacy migration tooling.
- Release, setup, deployment, architecture, API, and handoff docs now state PostgreSQL as the formal GA database and describe SQLite only as a test/export utility.
- Docker Compose now connects the backend to the host Homebrew PostgreSQL 17.10 `linzight_dashboard_engineered` database by default instead of starting an internal PostgreSQL 16 service.
- GA scope now keeps PostgreSQL RLS as a post-GA hardening item while preserving backend application-layer Study authorization.
- Frontend production pages no longer seed sample/omics/system-management state from static data when the backend is empty, and failed writes now remain failed instead of being marked as locally saved.
- GA PostgreSQL core data model now exposes formal patient, sample, omics, and follow-up fields: `patient_number`, sample `note`, omics `result_file_id`, and follow-up `record_note`.
- Patient master data now stores `patient_name` separately and defaults the UI to pinyin initials, with full-name reveal restricted by backend field permissions to LZ Admin, Study Admin, Study CRC, and LZ CRC.
- Follow-up records now store configurable JSON `payload` values governed by `study_configurations.follow_up_schema`, matching the existing Study-scoped CRF JSON model.
- PostgreSQL formal runtime now converts all JSON payload/schema/scope columns to native `JSONB` instead of text-backed JSON.
- Study Registry now stores and displays `leading_pi_info` and `system_admin`, while account/role lists display backend `last_login_at` instead of a hardcoded Last Login placeholder.
- Formal PostgreSQL runtime no longer creates legacy `role_permissions` and `crf_templates` tables; `010_drop_legacy_unused_tables` removes them from existing GA databases.
- Standalone audit log module was removed from the GA runtime; `011_drop_audit_module` drops `audit_logs`, backend write paths no longer call audit hooks, and frontend System Management no longer calls or displays Audit Diff.
- Backend operation logging was added through `operation_logs`; core create/update/delete/status/upload/export/approval actions now persist actor, Study, entity, before/after, diff, and timestamp JSONB records without restoring the frontend Audit Diff module.
- The `/seed` endpoint is disabled in formal PostgreSQL runtime by default; it is only open for isolated SQLite smoke runs or when explicitly enabled and called by an authorized LZ Admin.
- Operation log querying and CSV export were added through `/operation-logs` and `/studies/{study_id}/operation-logs`, with System Management showing backend-sourced logs under the current Study scope.
- Study-scoped Query and export creation now use `/studies/{study_id}/...` routes, with backend path/payload Study validation.

### Fixed

- Backend CRF entry creation now rejects Studies without a published CRF version instead of falling back to `CRFV-LGL-1111-V0.1`.
- Backend-authenticated users are no longer overwritten by matching local demo usernames.
- Omics result uploads now link the uploaded result file back to `omics_records.result_file_id`.
- Sample status options now align with the backend enum and no longer submit `检测完成` as a sample status.

## [1.0.1] - 2026-05-18

### Added

- Password reset request and confirmation APIs backed by SMTP configuration.
- First-run GA bootstrap that creates only the configured LZ system administrator.

### Changed

- Docker Compose GA startup no longer seeds Studies, patients, samples, visits, omics, or test users.
- Login UI now uses direct account email/password entry and formal authentication copy.
- Home dashboard empty states now show zero connected records instead of demo/API wait text.
- LZ System Management defaults to an empty Study registry with one initial administrator.
- Frontend API fallbacks no longer show local mock patients when the backend is empty or unavailable.

### Fixed

- Removed visible `Demo` labels from the login and system-management overview surfaces.
- Removed the automatic default `LGL-1111` Study insert from schema initialization.

## [1.0.0] - 2026-05-18

### Added

- GA functional-testing release for the LinZight RWD EDC workflow, intended for formal user testing, demo data entry, and end-to-end feature validation.
- LZ System Management Study lifecycle APIs: `POST /studies`, `PATCH /studies/{study_id}`, and `DELETE /studies/{study_id}` for create, update, terminate, and soft-delete lifecycle states.
- Business-write guard for `terminated` and `deleted` Studies across patient, CRF, visit, follow-up, sample, omics, file, quality, and export write paths.
- User-management APIs for GA testing: `GET /users`, `PATCH /users/{user_id}`, and `PATCH /users/{user_id}/study-scope`.
- Platform-role Study scope management through `global_role_study_scope`, restricted to `LZ_ADMIN`.
- Study system-admin assignment through `/studies/{study_id}/members` by setting a user to `STUDY_CONFIG_ADMIN`.
- System Management UI controls for Create Study, Terminate, Delete, Set Admin, and platform-role Scope actions.
- API smoke coverage for Study lifecycle, terminated-Study write rejection, Study member promotion, Study-scoped user edits, and platform-role Study scope updates.
- GA release notes, updated OpenAPI snapshot, refreshed static HTML exports, and release/UAT documentation aligned to `v1.0.0`.

### Changed

- Project package version promoted from `0.2.0-production-demo-rc1` to `1.0.0`.
- Release checklist now targets GA functional testing instead of private beta tagging.
- UAT package now points to the `v1.0.0` release notes and keeps the explicit limitation that real patient production use requires production identity, storage, database policy, backup, and compliance sign-off.

### Fixed

- Static export runtime smoke now handles the current login flow where a single-Study account may enter the Study Workspace directly after authentication.

## [0.2.0-production-demo-rc1] - 2026-05-12

### Added

- `study_configurations` Study 配置总表，绑定 disease area、当前 published CRF、访视计划、知情同意模板和检测 profile，并暴露 `/study-configurations` 与 `/studies/{study_id}/configuration`。
- `docs/07-production-release-candidate-workflows.md` documenting the eight release-candidate workstreams and explicit demo/private-beta limitations.
- Formal permission matrix via `docs/08-permission-matrix.md` and `/permissions/matrix`, with API smoke checks for key role/action decisions.
- Static export runtime smoke via `npm run smoke:static-runtime`, checking the `LZXK-01` 390px clinical capture path against visible SLE/immune field leakage.
- Query lifecycle coverage for create, reply, close, reopen and list filters by Study, patient, status, field and assignee.
- eConsent pending status machine for withdraw/re-sign approval before final consent state changes.
- PostgreSQL release-candidate migrations split into schema, indexes, constraints and seed under `backend/migrations/postgres/`.
- Staging dry-run deploy plan via `npm run deploy:staging`, UAT release package in `docs/09-uat-release-package.md`, and 70-patient performance smoke via `npm run smoke:performance`.
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

- New patient planned CRF generation now requires the current Study to have a published CRF and no longer falls back to the LGL default CRF.
- Frontend demo fallback data now uses the same 70-patient, three-Study cohort shape as the SQLite seed.
- Clinical data capture and system CRF field configuration now read from the CRF V0.1 schema.
- SQLite CRF storage now prefers JSONB BLOB columns with explicit payload version and storage-format metadata, while retaining TEXT JSON compatibility columns.
- Backend list/detail routes now apply Study scope filtering, and the frontend filters menus plus local fallback data by the logged-in user's Study scope.
- Backend SQLite connections now honor `LINZIGHT_DATABASE_URL`, allowing smoke tests and local installs to use an isolated database path.
- Dashboard welcome copy now reflects the authenticated user instead of a hard-coded demo PI.
- Field-level privacy rules now mask direct identifiers for data-manager/auditor roles and remove non-exportable identifiers from CSV exports.
- Approval requests now use a persisted status machine for export, de-identified export, and CRF publish workflows, with action history.
- File handling now goes through a local storage adapter with mock virus scanning, archive status fields, and permission-checked downloads.
- Database productionization now records schema versions, includes an optional PostgreSQL Compose profile, and provides a SQLite table export script for PostgreSQL migration rehearsals.
- Browser interaction regression scaffolding was added with a Playwright-first runner and explicit limitation reporting when Playwright is not installed.
- Product foundations now include Study-scoped Query management APIs, multi-site configuration/assignment APIs, and a monitoring/backup drill document.
- System Management now exposes full Query Management and Site Configuration panels wired to the Study-scoped Query, site, and site-user assignment APIs.
- Previously inert or frontend-only buttons across cohort, consent, clinical data capture, samples/testing, analytics, and system management now either call backend APIs, create persisted records, export real files, or present an explicit disabled state.
- Patient Journey no longer generates synthetic diagnosis/admission/treatment events or artificial biomarker trends in production views, and Dashboard export progress now reads `export_jobs` instead of reusing omics counts.
- Sample/testing result-file cells now resolve `omics_records.result_file_id` through `uploaded_files`, showing the real original filename plus scan/archive status instead of exposing the raw file id.
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
