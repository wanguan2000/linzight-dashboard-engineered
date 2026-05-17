# v0.2.0-production-demo-rc1

Release date: 2026-05-12

## Scope

- Production-demo foundation for the LinZight SaaS EDC workflow.
- Real backend-linked authentication, Study isolation, field privacy, approvals, file storage, Query management, site configuration, OpenAPI export, CI/release gate, Docker smoke, API smoke, UI smoke, static runtime smoke, performance smoke, staging deploy plan, and Playwright regression scaffold.
- Frontend modules remain in the existing medical research dashboard style and keep bilingual zh-CN / en-US runtime support.

## Highlights

- System Management now includes Query Management with create, reply, and close actions through `/queries`.
- System Management now includes Site Configuration with Study site create and current-user assignment through `/studies/{study_id}/sites` and `/studies/{study_id}/sites/{site_id}/users`.
- Study configuration is now explicit through `study_configurations`, binding each Study to its disease area, published CRF, visit-plan profile, consent template, and testing profile.
- New patient CRF generation fails when a Study lacks a published CRF instead of silently falling back to LGL.
- Formal permission matrix is available in `docs/08-permission-matrix.md` and `/permissions/matrix`, with API smoke assertions for key role/action decisions.
- Query management now covers create, reply, close, reopen and Study/patient/status/field/assignee filters.
- eConsent withdraw/re-sign now moves through pending Approval Center states before final consent status changes.
- PostgreSQL RC migration scripts are split into schema, indexes, constraints and seed under `backend/migrations/postgres/`; `npm run deploy:staging` writes a dry-run staging deployment and rollback plan.
- Static export runtime smoke validates the `LZXK-01` lung-cancer clinical capture path at 390px without visible SLE/immune field leakage.
- Existing Study-scoped patient, consent, clinical capture, sample/testing, analytics, CRF, approval, file, and member flows remain intact.

## Validation Checklist

- `npm run lint`
- `npm run build`
- `npm run export:html`
- `npm run smoke:static-runtime`
- `npm run smoke:performance`
- `npm run deploy:staging`
- `npm test`
- `npm run regression:browser`
- `npm run smoke:docker`
- `python3 -m compileall -q backend`

## Known Limitations

- SQLite remains available as the local demo runtime database; real patient production use still requires PostgreSQL runtime activation after staging migration rehearsal.
- This RC is for customer demo and internal pilot only; real patient production use still requires production database, identity source, file storage, security audit, backup/restore, and UAT sign-off.
- Query management is a working RC panel, not yet a full production worklist with assignee pickers and report-grade dashboards.
- Site configuration supports Study sites and current-user assignment; full site deactivation and site-level roster management remain future work.
