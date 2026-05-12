# Frontend Function Gap Audit

Updated: 2026-05-11

This audit tracks front-end controls that looked actionable but were missing real behavior, backend linkage, complete English text, or stable bilingual layout. Priority definitions:

- P0: Misleading primary actions. Must either work, persist, or be clearly disabled/explained.
- P1: Existing backend API should be connected through `src/services/api.ts`.
- P2: Copy, i18n, and layout polish.

## Summary

| Module | Priority | Findings | Status |
| --- | --- | --- | --- |
| Home workbench | P2 | Quick action chips and insight links were navigational affordances but did not route to modules. Some dynamic text still relies on generic phrase translation. | Fixed this pass: Quick actions and card-level links now route to the relevant module; write-only shortcuts and System Admin shortcuts are disabled for roles without permission. Shared dashboard card labels/actions participate in runtime i18n. |
| Patient cohort | P1 | Search, filters, paging, and view worked. New/edit patient needed real persistence and role-aware write state. | Fixed this pass: New/Edit now opens an inline form and persists through `POST /patients` or `PUT /patients/{id}` via `src/services/api.ts` for write roles; read-only roles see disabled controls and a clear permission status. |
| Informed consent | P0 | Sign, view, withdraw, and re-sign buttons previously stopped propagation only. | Fixed this pass: actions now update UI state and call `updateConsentRecord()` when backend is available. |
| Clinical data capture | P0/P1 | Save draft and submit were visual buttons; CRF section Add appended placeholder pairs rather than one record; English CRF labels were incomplete. Visit/sample table edits were local only. | Fixed this pass: CRF save/submit updates patient state, tries `PUT /patients/{id}` and creates/updates `/crf`; Add appends one row; samples save through `/samples`; follow-up/visit rows now persist through `/follow-up-records` with Study scope and audit logs. |
| Samples & testing | P0/P1 | Add sample, add detection, table view/edit buttons were non-functional or local-only. File upload already used backend `/files`. | Fixed this pass for misleading actions: add/view update page state and attempt `/samples` or `/omics` API calls through `src/services/api.ts`; Edit now opens validated sample/test forms and Save persists through `/samples` or `/omics` instead of status-cycling. Legacy Sample Management Add/Save also attempts `/samples`. |
| Patient journey | P2 | Timeline filters, search, pagination, and reset work. Some detail actions are viewing-only by design. English text still had partial mixed Chinese for generated clinical descriptions. | Fixed this pass: generated journey titles, subtitles, descriptions, track labels, patient selector text, brush labels, stream pagination, and category labels now render through i18n; browser smoke for `en-US` leaves only the intentional `中 / EN` language toggle marker. |
| Data analysis | P1 | Export and quality validation already call backend APIs. Download of generated export was not exposed from the card after job creation, and read-only roles could still click write actions. | Fixed this pass: report cards keep the export job returned by backend and expose a ready-state download button wired to `/exports/{id}/download`; export and quality-run buttons are disabled with permission messaging for roles that cannot write. Report titles, scopes, download buttons, pipeline steps, and export/validation statuses now render through i18n. |
| System management | P0/P1 | Create account, edit/disable, add CRF field, field edit/details, CRF version publish, and add visit plan were visual-only or missing. Backend had Study member and visit-plan APIs but no account provisioning API. | Fixed for demo workflows: Create Account now calls `/users` and creates a real user plus Study membership; Study members load/upsert through `/studies/{study_id}/members`; member status toggles attempt backend sync; Study visit plans load/create through `/studies/{study_id}/visit-plans`; CRF fields load/create/update name/type/module/status/options/required/validation/conditional logic through `/studies/{study_id}/crf-fields`; CRF versions can create draft, preview migration, submit approval, approve, and apply through Study-scoped CRF version/migration APIs. Multi-Study platform roles now use a real Study selector that reloads the selected Study's members, fields, versions, migrations, and visit plans instead of showing a non-functional selector. |

## P0 Details

### Informed Consent

- Impact: Users could click sign, withdraw, view, or re-sign with no visible effect.
- Fix: Added `applyConsentUpdate()` flow in `ConsentManagementPage`.
- Backend: Uses existing `PUT /consents/{consent_id}` via `updateConsentRecord()` when available; Upload now opens a real file picker, stores the file through `/files` with `category=consent`, `patient_id`, and `consent_id`, then marks the consent signed through the same backend update path.
- English coverage: consent preview content, workflow, table actions, disease values, and upload status now render through runtime i18n. Browser smoke on `en-US` Informed Consent showed `Upload` available and no visible Chinese text outside the language toggle marker.
- Remaining: Production electronic signature, file preview/versioning, and virus/object-storage controls are still out of scope for this Demo.

### Clinical Data Capture

- Impact: Save draft and submit did not persist; Add added two synthetic placeholder rows.
- Fix: Save draft/submit now updates patient clinical data, clears edit mode, displays status, attempts patient update and CRF create/update through service functions. Add now appends exactly one row. Sample table Save attempts create/update through service functions. Follow-up/visit table Save now calls `saveVisitFollowUpRecord()` and writes to backend `follow_up_records`; saved local rows are rebound to the backend `FUP-*` id, and reloaded `follow_up_records` are merged back into the clinical follow-up table.
- Backend: Uses `PUT /patients/{patient_id}`, `/crf`, `/samples`, and `/follow-up-records` through `src/services/api.ts`. The actual planned `visits` table remains read-only, while factual follow-up data is persisted in `follow_up_records`.
- Remaining: If planned visit schedule editing is needed, add a separate role-gated visits endpoint; current clinical entry persistence uses the existing follow-up records table.

### Samples & Testing

- Impact: Add sample/add detection and table view/edit controls looked functional but did not do anything durable.
- Fix: Add sample/add detection now create local rows immediately and attempt backend sync. Edit opens explicit sample or test edit forms with Save/Cancel, required-field checks, status/QC/date/platform fields, and backend save through service helpers. View locates the row through filters and reports status. Browser smoke verified sample Save and omics/test Save both report successful backend sync.
- Backend: Uses existing `/samples` and `/omics` endpoints through service functions. The older Sample Management page now also creates and saves sample rows through the same service helpers.
- Remaining: Add delete/archive actions only after the product defines audit-safe deletion semantics.

### System Management

- Impact: Create Account, Edit, Disable, Add Field, and Add Visit were empty buttons.
- Fix: Buttons now mutate visible demo state and show status messages instead of silently doing nothing. Study member rows load from the current Study; Create Account creates a backend user through `/users` and joins it to the current Study; Disable/Enable attempts to sync member status to the Study member API. Visit plan rows are loaded from the current Study and Add Visit creates a backend visit-plan row when available. CRF field rows now load from the current Study CRF schema; Add Field creates a schema field, and Edit opens a real editor for field name, type, module, status, options, required, and validation rule with backend sync.
- Backend: Uses user provisioning, Study member, Study visit-plan, Study CRF field, Study CRF version, and Study CRF migration approval APIs. `POST /users` creates the account and optional Study membership; `POST /studies/{study_id}/members` returns joined `username/display_name`; `/studies/{study_id}/crf-fields` reads and writes `study_crf_versions.schema_json.sections[].fields[]`, including options/required/validation/conditional metadata; CRF migration preview compares current published schema with the target schema; CRF migration approvals persist pending/approved/applied status and apply publishes the target draft while retiring older published versions; requester self-approval/self-apply is blocked; approvals return `execution_logs`; all write paths enter `audit_logs`.
- Remaining: CRF field edit now covers common field properties, simple validation metadata, conditional logic, migration preview with field-level details, a persistent request/approve/apply workflow, self-review prevention in the UI, and execution-log summaries for request/approval/apply steps. Production hardening would add historical CRF payload remapping execution details.

### Patient Cohort

- Impact: New/Edit Patient looked like durable EDC workflow but did not create or update backend patient records from the cohort page.
- Fix: Added inline create/edit form with Save/Cancel state. Save calls `createPatientRecord()` or `updatePatientRecord()` from `src/services/api.ts`, preserves current `study_id`, and updates the table with the backend response. Read-only roles such as Study PI now see disabled write buttons and a visible permission message instead of a fake editable workflow.
- Backend: Uses existing `POST /patients` and `PUT /patients/{patient_id}`.
- Remaining: Add a richer patient detail editor for sample/omics metadata instead of keeping those fields in downstream modules.

### Data Analysis

- Impact: Export created a backend job but the user could not download the generated artifact from the report card.
- Fix: Added per-card export job state and a Download button enabled only after the backend job is ready. Export and quality-run actions are role-aware: Study PI can view reports but cannot trigger backend write jobs, so the buttons are disabled with a visible explanation path.
- Backend: Uses `POST /exports` and `GET /exports/{export_id}/download`.
- Remaining: Add a full export job history table if reports become long-running.

### Home Workbench

- Impact: Quick actions and dashboard card links looked clickable but did not change module or state.
- Fix: `QuickActions`, Patient Journey, Omics TAT, Cohort Overview, and Smart Summary cards now accept navigation callbacks. Home routes these actions to Patient Cohort, Clinical Data Capture, Samples & Testing, Patient Journey, Analytics, or System Management. Quick write actions are disabled for read-only roles such as Study PI, and the System Admin shortcut is disabled for roles that cannot enter that module.
- Backend: No new backend support required; this is front-end navigation over existing modules.
- Remaining: If needed later, replace disabled quick write actions with role-specific “review queue” shortcuts for PI/data-manager workflows.

## i18n And Layout

- CRF card title/field/value/action rendering now explicitly calls `t()` so English no longer depends only on JSX runtime translation for dynamic schema labels.
- Added CRF field dictionary entries for the SLE CRF V0.1 groups and common fields.
- Added explicit English coverage for sample/testing action buttons, filters, stat tiles, pagination, status labels, table data values, topbar/sidebar role labels, and system-management account role rows. The Samples & Testing `en-US` page no longer leaves visible sample-type/status fragments such as `组织`, `胸水`, `基线visit`, or `已通过` in the main tables.
- Patient Cohort KPI labels, disease labels, organs, sample text, omics status, and generated cohort notes now call `t()` explicitly; lung cancer resistance notes no longer render as mixed fragments such as `总patient数` or `studyfollow-up中`.
- Login entry mode, Study selector, role selector, patient cohort embedded queue, cohort pagination/status text, lung cancer drug names, and CRF field values now render through i18n in `en-US`.
- Patient Journey dynamic event rendering now calls `t()` for generated titles, subtitles, descriptions, track labels, stream cards, brush aria labels, and patient selector summaries; the `en-US` browser snapshot no longer shows generated Chinese clinical fragments.
- Browser smoke checked zh-CN and en-US for Clinical Data Capture, Informed Consent, Samples & Testing, System Management, Home Workbench, Patient Cohort, Patient Journey, Data Analysis, and Login. Follow-up `en-US` scans for Patient Cohort, Clinical Data Capture, Informed Consent, Samples & Testing, Home Workbench, Patient Journey, Data Analysis, System Management, and Login showed no visible Chinese outside the language toggle marker `中 / EN`.

## Next P1 Backlog

1. Expand the current static UI smoke into real browser regression coverage for zh-CN/en-US button text and layout overflow once a browser test dependency is approved.
2. If this Demo needs production-style change control, extend the current CRF migration execution summary into historical CRF payload remapping reports.

## Automated Regression

- Added `npm run smoke:api` with an isolated temporary SQLite backend. It validates LZXK-01 login roles, patient Study isolation, cross-Study 403 enforcement, user provisioning permission behavior, CRF field update permission plus required/validation persistence, CRF migration preview, CRF version draft plus request/approve/apply migration publishing, audit logging, sample/omics creation through backend writes, and export permission behavior for PI vs data manager.
- Added `npm run smoke:ui` for static UI regression over `exports/html`: manifest completeness, all eight exported module pages, initial-module boot scripts, inline CSS/JS, key English action strings, CRF migration approval, execution logs, separate reviewer messaging, multi-Study selector copy, and asset path sanity.
- Added `npm run release:check` for release hygiene: required scripts/docs/CI gates, export manifest coverage, forbidden tracked files, and large-file guard.
- Added `npm test` as the standard combined smoke entrypoint: API smoke, static export, UI smoke, and release gate.
- Added Docker Compose Demo startup with frontend/backend images, SQLite/upload volumes, healthcheck, and release-check file presence guard.
- Added deployment operations notes and Demo SQLite/upload backup-restore scripts; `backups/` is ignored and release-check verifies the operations files.
- Added OpenAPI schema export via `npm run export:openapi`; `docs/openapi.json` is now part of the release contract snapshot.
- Cleaned additional en-US hardcoded UI text in dashboard KPI cards, workflow cards, enrollment trend, smart summary markers, sample/testing panels, omics detail panels, data-analysis pipeline, and system-management overview.
- Browser recheck on `sample-testing`, `system-management`, `data-analysis`, and `home-workbench` with `locale=en-US` found no visible Chinese text outside the language toggle.
- Converted remaining misleading no-op UI controls: AI prompt chips now fill the AI command bar and send records an explicit status; notification, consent study detail entry, legacy omics filters/file button, platform-account status toggles without backend support, and legacy home quick-action strip are disabled with explanatory tooltips.
- Docker Compose path is now validated end to end: frontend/backend images build, backend seeds demo data, health/login APIs respond, and the containerized frontend loads on `127.0.0.1:5173`.
- Added `npm run smoke:docker` so Docker build/up, backend health/login, and frontend app shell validation can run locally and in CI.
- Remaining: browser-level layout and click regression is still manual; add Playwright-style coverage once a browser test dependency is approved for the repo.
