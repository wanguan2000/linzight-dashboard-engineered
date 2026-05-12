# Deployment Operations Notes

This project is a private beta Demo. These notes document local and small-team deployment operations; they are not a production clinical deployment plan.

## Environment Variables

Frontend:

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://edc-api.example.com` | Build-time API base URL for the Vite frontend. For local Docker Compose, use `http://127.0.0.1:8000`. |

Backend:

| Variable | Example | Notes |
| --- | --- | --- |
| `LINZIGHT_DATABASE_URL` | `sqlite:////data/linzight_demo.db` | SQLite URL for the Demo backend. Do not use SQLite as a production clinical database. |
| `LINZIGHT_POSTGRES_URL` | `postgresql://user:pass@host:5432/linzight` | Reserved for future production database adaptation. |
| `LINZIGHT_UPLOADS_DIR` | `/uploads` | Local upload directory for demo files. Production should use controlled object storage. |
| `LINZIGHT_BACKUP_DIR` | `./backups` | Optional backup output path for demo SQLite backup scripts. |

Do not commit `.env`, real tokens, real patient data, local database files, upload payloads, private keys, or deployment secrets.

## Docker Compose Demo

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173/`
- Backend: `http://127.0.0.1:8000/`
- Health: `http://127.0.0.1:8000/health`

The backend container seeds the SQLite volume on first start only. Remove the `linzight_backend_data` volume if you need a clean seeded database.

Validation commands:

```bash
npm run smoke:docker
docker compose build
docker compose up -d
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"lung-crc@demo.linzight","password":"demo123"}'
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

Create a backup of the configured SQLite database and upload directory:

```bash
npm run backup:sqlite
```

Restore from a backup directory:

```bash
npm run restore:sqlite -- backups/linzight-<timestamp>
```

Restore keeps a pre-restore copy under `backups/pre-restore-<timestamp>`. These scripts are for local beta validation only. Production needs managed database backups, object storage versioning, access controls, audit retention, and tested restore drills.
