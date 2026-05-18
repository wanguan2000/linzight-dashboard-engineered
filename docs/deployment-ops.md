# Deployment Operations Notes

This project is a GA functional-testing build. These notes document local and small-team deployment operations; they are not a production clinical deployment plan.

## Environment Variables

Frontend:

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://edc-api.example.com` | Build-time API base URL for the Vite frontend. For local Docker Compose, use `http://localhost:8000` so it resolves to the Compose-published backend port. |

Backend:

| Variable | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg2:///linzight_dashboard_engineered` | Preferred backend database URL. Formal runtime must use PostgreSQL. The default macOS local setup uses the current OS user over the local PostgreSQL socket; do not commit real passwords for other environments. |
| `LINZIGHT_DATABASE_URL` | `postgresql+psycopg2:///linzight_dashboard_engineered` | Fallback backend database URL when `DATABASE_URL` is unset. |
| `LINZIGHT_POSTGRES_URL` | `postgresql+psycopg2:///linzight_dashboard_engineered` | PostgreSQL default reference URL for local development. |
| `LINZIGHT_ALLOW_SQLITE_RUNTIME` | unset | Set to `1` only for isolated smoke tests, legacy SQLite backups, or migration export tooling. Do not set for formal runtime. |
| `LINZIGHT_UPLOADS_DIR` | `/uploads` | Local upload directory for demo files. Production should use controlled object storage. |
| `LINZIGHT_BACKUP_DIR` | `./backups` | Optional backup output path for legacy SQLite backup scripts. |

Do not commit `.env`, real tokens, real patient data, local database files, upload payloads, private keys, or deployment secrets.

## Docker Compose PostgreSQL Runtime

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173/`
- Backend: `http://127.0.0.1:8000/`
- Health: `http://127.0.0.1:8000/health`

The backend container uses PostgreSQL and runs `python -m backend.bootstrap` on startup. It initializes schema every time and creates only the configured first LZ system administrator when the `users` table is empty. It does not seed Studies, patients, samples, omics records, visits, or test users.

The SQLite export command remains available only for legacy test database migration packages:

```bash
npm run export:postgres-migration -- exports/postgres-migration
```

The export command writes one CSV and JSON file per SQLite table plus `manifest.json`. Load these files into PostgreSQL with a controlled migration tool and compare table counts against the manifest before switching traffic.

Validation commands:

```bash
npm run smoke:docker
npm run smoke:performance
npm run deploy:staging
docker compose build
docker compose up -d
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<configured-admin-email>","password":"<configured-admin-password>"}'
docker compose ps
docker compose logs --tail=80 backend frontend
```

The frontend image copies `resource/sle-crf-v0.1.schema.json` because `src/data/crfTemplate.ts` imports the CRF schema at build time.

`npm run smoke:docker` verifies the frontend at `http://localhost:5173/` so it reaches the Docker port mapping even if a local Vite dev server is bound to `127.0.0.1:5173`. It leaves local containers running by default. Set `DOCKER_SMOKE_DOWN=1` to stop them after validation, which is how CI runs it.

## Nginx Reverse Proxy Example

```nginx
server {
    listen 80;
    server_name edc-demo.example.com;

    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5173/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

If the frontend is built with `VITE_API_BASE_URL=https://edc-demo.example.com/api`, the browser will call the reverse-proxied backend path.

## Demo Backup And Restore

Create a backup of a configured legacy SQLite test database and upload directory:

```bash
npm run backup:sqlite
```

Restore from a backup directory:

```bash
npm run restore:sqlite -- backups/linzight-<timestamp>
```

Restore keeps a pre-restore copy under `backups/pre-restore-<timestamp>`. These scripts are for local legacy SQLite validation only. Formal runtime and production need PostgreSQL backups, object storage versioning, access controls, audit retention, and tested restore drills.
