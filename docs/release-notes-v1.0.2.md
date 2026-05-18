# LinZight RWD EDC v1.0.2

Release date: 2026-05-19

This patch release locks the GA functional-testing runtime to PostgreSQL and keeps SQLite only as an explicitly enabled local test/export utility.

## Runtime

- Formal backend runtime now rejects `sqlite:///...` database URLs unless `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` is explicitly set.
- Docker Compose and the default backend configuration continue to use PostgreSQL.
- SQLite remains available only for isolated smoke tests, legacy SQLite backup/restore, and migration export rehearsal.

## Documentation

- Updated setup, deployment, architecture, API, handoff, release checklist, UAT package, and static export docs to state PostgreSQL as the formal GA database.
- Clarified that formal Docker startup creates only the configured first LZ system administrator and does not seed Studies, patients, samples, visits, omics records, or test users.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
- `npm run smoke:docker`
- `python3 -m compileall -q backend`
- Direct runtime guard check: SQLite is blocked without `LINZIGHT_ALLOW_SQLITE_RUNTIME=1` and allowed with the explicit flag.

## Release Boundary

`v1.0.2` is for GA functional testing and user-entered test data. It is not a real-patient production clinical deployment until centralized identity, managed secrets, production object storage, PostgreSQL RLS, backup/restore drills, monitoring, security review, and compliance sign-off are completed.
