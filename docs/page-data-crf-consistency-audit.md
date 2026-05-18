# Page, Data, and CRF Consistency Audit

Last checked: 2026-05-16

This audit tracks whether each demo page uses the same Study scope, backend data source, and Study-specific CRF semantics.

## Scope Rules

- `LZ_ADMIN` keeps an all-Study operational view on home, patient queue, samples, omics, journey, reports, and system management.
- Study roles are scoped to their assigned `study_id`; the LZXK-01 lung roles only see LZXK-01 patients, consents, CRF, samples, omics, journeys, and analytics.
- Every patient-facing row must carry `studyId` / `study_id` so admin views can explain why all-Study counts differ from a single-Study selection.
- LZXK-01 uses the lung resistance CRF only. It must not expose SLE/NPSLE consent copy, SLEDAI, C3, IgG, lupus medication, or SLE lab fields in the visible CRF page.

## Page Matrix

| Page | Data Source | Study Scope | CRF / Domain Check | Current Result |
| --- | --- | --- | --- | --- |
| Login | `src/data/auth.ts`, `/auth/login` | Role-selected Study or all-Study admin | Entry copy promises patients, CRF, samples, Journey, analytics, export | Pass. LZXK-01 role defaults to lung Study. |
| Home Workbench | `/analytics/summary` with optional `study_id` | Admin all-Study; Study roles scoped | Counts align with patient/sample/omics/visit backend rows | Pass. Admin shows 70 patients; lung CRC shows 20. Workflow uses export audit, not lock database. |
| Patient Queue | `/patients`, `/samples`, `/omics` through `fetchWorkspaceDataset()` | Admin can filter all/LGL/RWD/LZXK; Study roles scoped | Patient rows expose Study ID; disease mix follows selected Study | Pass. LZXK-01 queue shows NSCLC/LUAD/LUSC/EGFR-TKI/ALK lung cohort only. |
| Informed Consent | `/consents`, patient dataset | Admin Study filter; Study roles scoped | LZXK-01 renders lung resistance consent and ctDNA/NGS language | Pass. Preview print displays clear feedback when popup is blocked. |
| Clinical Data Capture | `/patients`, `/visits`, `/follow-up`, `/crf` | Current patient Study; Study roles scoped | LZXK-01 CRF fields are ECOG, TNM, treatment line, driver mutation, resistance, RECIST, ctDNA, PFS, ORR, testing item | Pass after fix. LZXK-01 no longer stores or displays SLE CRF fields. New field insertion uses the active Study's CRF group. |
| Sample & Testing | `/samples`, `/omics`, `/files` | Admin Study filter; Study roles scoped | LZXK-01 samples show blood/tissue/pleural effusion and assays show NGS panel, ctDNA, pathology review | Pass after fix. Add sample / add test now open editable forms with required-field checks. |
| Patient Journey | `/patient-panorama` or scoped dataset | Active patient Study | LZXK-01 timeline metrics use ECOG, ctDNA, PFS, ORR; header exposes Study ID | Pass after fix. Event stream remains clickable with right-side detail. |
| Data Analysis | `/analytics/summary`, `/exports`, `/quality/run` | Export Study selector respects role scope | Report cards include selected Study ID and generated export job Study ID | Pass. Study CRC can reach the page; export write remains role-controlled. |
| System Management | `/studies/{study_id}/members`, `/crf-fields`, `/crf-versions`, `/visit-plans`, `/queries`, `/approvals` | Admin can switch Study; Study config/admin roles scoped | CRF field table reflects the selected Study schema | Pass after fix. LZXK-01 fallback and seeded backend schema now both use the same 15 lung CRF fields. |

## Fixes Made In This Pass

- Replaced LZXK-01 backend CRF schema from "SLE template plus lung appendices" to a standalone 15-field lung resistance CRF.
- Regenerated LZXK-01 patient `clinical_data` so lung patients do not carry SLE CRF fields under the hood.
- Aligned front-end mock lung patient data with the same 15 CRF fields.
- Updated LZXK-01 sample/omics seed and mock data to use `NGS panel`, `ctDNA`, and `病理复核` instead of immune-disease WGS/TCR/Olink rotation.
- Made LZXK-01 visit metric values ECOG/RECIST based instead of assuming `SLEDAI评分`.
- Added explicit Study ID display to the Patient Journey header.
- Added explicit Study ID display to patient queue rows for both all-Study and single-Study roles.
- Added `npm run demo:e2e` to validate admin, lung CRC and lung data manager walkthroughs with Study-scoped CRF, eConsent, sample/testing, Journey, analytics, Query, approval and audit checks.
- Added `npm run smoke:crf-semantics` to block regressions where LZXK-01 patients, CRF payloads or Study CRF fields reintroduce SLE fields, and to verify lung Study rejects `SLEDAI评分` Query creation.

## Residual Product Gaps

- Data lock and de-identification approval remain internal-only and intentionally excluded from the visible release scope.
- Query management has first-pass field validation, create/reply/close and quality-to-Query flow; it still needs reviewer queue UX, SLA, notification and reporting.
- Visit-window alerts now surface in Data Analysis and can create Query; formal product still needs calendarized windows, reasons and center-level rules.
- Mobile table cardification covers the current main tables at 390px; formal release still needs screenshot baselines and wider device coverage.
