# Production Adapter Notes

Last updated: 2026-05-16

Formal runtime runs on FastAPI + PostgreSQL. SQLite remains available only for isolated smoke runs, legacy backup scripts, and migration export rehearsal with `LINZIGHT_ALLOW_SQLITE_RUNTIME=1`.

## PostgreSQL Migration

Use the formal RC migration split for an empty staging database:

```bash
psql "$LINZIGHT_POSTGRES_URL" -f backend/migrations/postgres/001_schema.sql
psql "$LINZIGHT_POSTGRES_URL" -f backend/migrations/postgres/002_indexes.sql
psql "$LINZIGHT_POSTGRES_URL" -f backend/migrations/postgres/003_constraints.sql
psql "$LINZIGHT_POSTGRES_URL" -f backend/migrations/postgres/004_seed_demo.sql
```

Use the export package for full legacy test-data import rehearsal:

```bash
npm run export:postgres-migration
```

The command writes `exports/postgres-migration/manifest.json`, one CSV and one JSON file per SQLite table, plus:

- `schema-postgres.sql`: an operator-reviewed schema sketch generated from SQLite metadata.
- `load-postgres.sql`: `psql` `\copy` commands for staging imports.
- `README.md`: migration run notes.

Staging cutover rehearsal should be:

1. Seed or migrate into a staging PostgreSQL database.
2. Verify JSON payload/schema/scope/audit columns are native PostgreSQL `jsonb` after migration.
3. Run API smoke and browser matrix against the staging API.
4. Freeze writes, take backups, perform final import, then run smoke checks again.

## Object Storage

The file API keeps local storage as the default:

```bash
LINZIGHT_STORAGE_BACKEND=local
```

For production-style testing:

```bash
LINZIGHT_STORAGE_BACKEND=object
LINZIGHT_OBJECT_BUCKET=linzight-rws
LINZIGHT_OBJECT_PREFIX=prod
```

The local object adapter stores bytes under `uploads/object-store/...` but returns `object://bucket/prefix/category/file` URIs, so API behavior matches object-storage semantics without adding a vendor SDK.

## Virus Scanning

Default scanner:

```bash
LINZIGHT_VIRUS_SCAN_PROVIDER=mock
```

Production-style scanner config:

```bash
LINZIGHT_VIRUS_SCAN_PROVIDER=clamav
LINZIGHT_VIRUS_SCAN_ENDPOINT=tcp://clamav:3310
```

The external scanner adapter is deterministic in local testing and still blocks EICAR test files. A real deployment should replace the adapter body with ClamAV, OSS/S3 malware scanning, or a vendor gateway, and keep the `scan_status` / `scan_message` contract unchanged.

Failure strategy for RC:

- `infected`: block upload, return 400, do not create downloadable file metadata.
- `scanner unavailable`: treat as blocked in staging, retry only after scanner health is restored.
- `pending`: never allow download until scan status is `clean`.
- `archive/download`: always re-check Study permission, archive status, and scan status.

## Staging Deployment Plan

Generate the operator-reviewed staging plan:

```bash
npm run deploy:staging
```

The script writes `reports/staging-deploy-plan.json` with frontend, backend, PostgreSQL, object storage, scanner, validation, and rollback steps.

## Performance Smoke

Run:

```bash
npm run smoke:performance
```

The smoke starts a temporary seeded backend, verifies the 70-patient list response, creates an export task, and downloads the generated file within RC thresholds.

## Browser Permission Matrix

Run:

```bash
npm run browser:matrix
```

The matrix covers desktop and 390px mobile viewports across admin, Study CRC, LGL CRC, and Study data manager roles. It verifies role-scoped navigation, Study counts, core pages, and mobile table/card rendering. If Playwright is not installed, the command writes a skipped report under `reports/browser-matrix.json`.
