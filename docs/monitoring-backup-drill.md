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

## Backup Command

```bash
npm run backup:sqlite
```

The backup script captures the configured SQLite database and upload directory into `backups/`.

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
- `audit_logs` contains login, write, export, approval, file download, and archive actions.
- Uploaded files include `sha256`, `scan_status`, `archive_status`, and `storage_backend`.
- Backup and restore commands have been rehearsed before release.
