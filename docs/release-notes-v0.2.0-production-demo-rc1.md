# v0.2.0-production-demo-rc1

Release date: 2026-05-12

## Scope

- Production-demo foundation for the LinZight SaaS EDC workflow.
- Real backend-linked authentication, Study isolation, field privacy, approvals, file storage, Query management, site configuration, OpenAPI export, CI/release gate, Docker smoke, API smoke, UI smoke, and Playwright regression scaffold.
- Frontend modules remain in the existing medical research dashboard style and keep bilingual zh-CN / en-US runtime support.

## Highlights

- System Management now includes Query Management with create, reply, and close actions through `/queries`.
- System Management now includes Site Configuration with Study site create and current-user assignment through `/studies/{study_id}/sites` and `/studies/{study_id}/sites/{site_id}/users`.
- Existing Study-scoped patient, consent, clinical capture, sample/testing, analytics, CRF, approval, file, and member flows remain intact.

## Validation Checklist

- `npm run lint`
- `npm run build`
- `npm run export:html`
- `npm test`
- `npm run regression:browser`
- `npm run smoke:docker`
- `python3 -m compileall -q backend`

## Known Limitations

- SQLite remains the default demo runtime database; PostgreSQL activation is intentionally deferred.
- Query management is a working base panel, not yet a full production worklist with assignee pickers and advanced filters.
- Site configuration supports Study sites and current-user assignment; full site deactivation and site-level roster management remain future work.
