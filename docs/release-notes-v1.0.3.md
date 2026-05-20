# LinZight RWD EDC v1.0.3

Release date: 2026-05-21

This release positions LinZight RWD EDC as an internal-pilot build for customer validation of real business scenarios in a controlled PostgreSQL-backed environment.

## Pilot Scope

- Intended for customer teams to validate Study setup, role separation, patient registration, informed consent, CRF capture, follow-up, sample ledger, multi-omics testing, file handling, Query/QC, approvals, exports, and operation logs.
- Formal runtime remains PostgreSQL. SQLite is limited to explicitly enabled smoke, backup, and migration-export utilities.
- Formal startup creates only the configured first LZ administrator. Studies, users, patients, samples, and testing records are created or imported by the pilot team.
- This is not an unrestricted real-patient production deployment. Real patient production use still requires compliance approval, centralized identity, managed secrets, production object storage, validated virus scanning, backup/restore rehearsal, monitoring, security review, and sign-off.

## Product Changes

- Added persistent LZ global configuration for disease, sample, testing, and unit dictionaries through `/global-configuration`.
- Updated patient-cohort and sample/testing workflows for real pilot operations: patient-focused sample review, storage location, initial and remaining quantity, mixed units, testing vendor, multi-sample testing selection, and per-sample usage capture.
- Kept platform users in the LZ global state by default, with global dashboard aggregation and Study-scoped business reads instead of implicit single-Study entry.
- New patient creation now creates patient master data and pending consent only; visits, CRF drafts, and Journey events must come from explicit Study data.
- Strengthened empty-state behavior so an empty Study or newly created patient does not display static demo Journey, sample, or testing records.

## Validation Gates

The release candidate must pass:

- `npm run lint`
- `npm run build`
- `python3 -m compileall -q backend`
- `npm test`
- `npm run browser:matrix`
- `npm run demo:e2e`
- `npm run smoke:performance`
- `npm run backup:postgres`
- `npm run release:check`

## Release Boundary

`v1.0.3` is for internal pilot and real business workflow validation in a controlled environment. It can be used to test real Study workflows and customer operating procedures, but it should not directly host unrestricted real patient production data until the production security, compliance, backup, identity, storage, and monitoring gates are signed off.
