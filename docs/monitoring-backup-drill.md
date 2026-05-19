# Monitoring And Backup Drill

## Health Check

```bash
curl http://localhost:8000/health
curl http://localhost:5173/
docker compose ps
```

Expected backend response:

```json
{"status":"ok","service":"linzight-demo-api"}
```

## PostgreSQL Backup Drill

```bash
npm run backup:postgres
```

The PostgreSQL drill runs `pg_dump --format=custom`, verifies the dump with `pg_restore --list`, records table row counts, and writes:

- `backups/postgres-<timestamp>/linzight.dump`
- `backups/postgres-<timestamp>/manifest.json`
- `reports/postgres-backup-drill.json`

The script inventories upload filenames and sizes only. It does not copy upload payloads by default; production object storage must use its own versioning and restore process.

Restore must be rehearsed into a separate staging database before any destructive production restore:

```bash
createdb linzight_restore_drill
pg_restore --dbname postgresql:///linzight_restore_drill backups/postgres-<timestamp>/linzight.dump
DATABASE_URL=postgresql:///linzight_restore_drill npm run smoke:api
```

## Legacy SQLite Backup Command

```bash
npm run backup:sqlite
```

The legacy backup script captures the configured SQLite database and upload directory into `backups/`. It is not the formal GA runtime backup path.

## Restore Drill

```bash
npm run restore:sqlite -- backups/linzight-<timestamp>
npm run smoke:api
```

For PostgreSQL rehearsal exports:

```bash
npm run export:postgres-migration -- exports/postgres-migration
```

Compare `exports/postgres-migration/manifest.json` row counts after loading into PostgreSQL.

## Observability Checklist

- Backend health endpoint is reachable.
- Docker healthcheck is healthy.
- API smoke passes against a temporary database.
- Docker smoke passes against Compose services.
- GA runtime does not create `audit_logs`; approval status history is kept in `approval_actions`, while file download/archive access remains permission-checked at request time.
- Uploaded files include `sha256`, `scan_status`, `archive_status`, and `storage_backend`.
- PostgreSQL backup drill has generated a verified custom-format dump before release.
