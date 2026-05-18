# v1.0.0

Release date: 2026-05-18

## Scope

- GA functional-testing release for LinZight RWD EDC.
- Intended for formal feature testing, demo data entry, Study administration validation, and end-to-end workflow review.
- Not a real-patient production deployment until centralized identity, production object storage, PostgreSQL RLS, backup/restore drills, monitoring, security review, and compliance sign-off are completed.

## Highlights

- LZ System Management can create, terminate, and soft-delete Studies.
- Terminated or deleted Studies reject business writes for patients, CRF, visits, follow-up, samples, omics, files, quality checks, and exports.
- LZ Admin can manage platform-role Study scopes through `global_role_study_scope`.
- Study system administrators can manage their own Study members and assign `STUDY_CONFIG_ADMIN`.
- System Management UI now exposes Study lifecycle, Set Admin, and Scope actions.
- `LZXK-01` remains lung-cancer specific across CRF, consent, samples, Journey, data analysis, static export runtime smoke, and API smoke.
- OpenAPI, static HTML exports, release checklist, UAT package, and permission matrix are refreshed for the GA test package.

## Validation

- `python3 -m compileall -q backend`
- `npm run lint`
- `npm run build`
- `npm run smoke:api`
- `npm run smoke:crf-semantics`
- `npm run export:openapi`
- `npm run export:html`
- `npm run smoke:ui`
- `npm run smoke:static-runtime`
- `npm run release:check`
- `npm test`

## Test Accounts

| Role | Account | Scope |
| --- | --- | --- |
| LZ Admin | `admin@demo.linzight` | All Studies, Study lifecycle, users, scopes, approvals, audit |
| Lung Study CRC | `lung-crc@demo.linzight` | `LZXK-01` data entry and study workflow |
| Lung Study Data Manager | `lung-dm@demo.linzight` | `LZXK-01` quality, Query, export, approvals, audit |
| Lung Study Config Admin | `lung-config@demo.linzight` | `LZXK-01` Study configuration and member administration |

Default password for demo accounts remains `Demo1234!`.

## Known Limitations

- The backend remains a demo-grade API until production identity, managed secrets, TLS, object storage, PostgreSQL RLS, and backup/restore are live.
- Query management is functional for GA testing but still needs production reviewer worklists, SLA reporting, notifications, and dashboarding.
- eConsent withdraw/re-sign has approval states; production still needs final signed-file handling, scanning, retention, and formal audit reports.
- Multi-center/site administration has a first-pass API/UI and still needs full production roster lifecycle and identity-provider group mapping.
