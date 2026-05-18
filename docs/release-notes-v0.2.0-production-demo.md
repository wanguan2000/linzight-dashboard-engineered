# v0.2.0-production-demo

Formal Demo release promoted from `v0.2.0-production-demo-rc2`.

## Scope

- Three Study demo model: `LGL-1111`, `RWD-NMO-2026`, and `LZXK-01`.
- Study-scoped patients, consents, visits, follow-up records, CRF entries, samples, omics records, Query, quality, export and audit data.
- `LZXK-01` uses an independent 15-field lung cancer resistance CRF, lung consent template, lung visit plan and `TP-LUNG-RESIST-OMICS` testing profile.
- Static HTML export includes the eight dashboard modules and is refreshed for this release.

## Validation

- Release gates cover lint, build, backend compile, API smoke, CRF semantics smoke, OpenAPI export, static export, UI/static-runtime smoke, performance smoke, release hygiene and git diff checks.

## Limitations

- This is a customer-demo/internal-pilot package, not a production clinical deployment.
- SQLite and local signed Bearer tokens remain Demo runtime defaults.
- Real patient production use still requires managed PostgreSQL runtime, centralized identity, managed object storage, virus scanning, security review, backup/restore drill and UAT sign-off.
