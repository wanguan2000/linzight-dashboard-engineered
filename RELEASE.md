# LinZight Release Notes Template

## Version

- Version:
- Candidate tag:
- Release date:
- Commit:

## Scope

- Frontend:
- Backend:
- Database:
- Docker:
- Static export:
- OpenAPI:

## Validation

- `npm run lint`:
- `python3 -m compileall -q backend`:
- `npm test`:
- `npm run regression:browser`:
- `npm run smoke:docker`:
- Manual browser verification:

## Rollback Artifacts

- Source tag or commit:
- `dist/` or `exports/html/` artifact:
- SQLite backup path:
- Upload backup path:
- Docker image tags:

## Known Limitations

- Playwright regression requires installing Playwright and Chromium to run full browser automation.
- SQLite remains the default demo runtime database until PostgreSQL SQL adapter activation.
- Do not use demo seed data or local secrets for real patient deployments.

## GitHub Release Checklist

- Confirm branch is clean except intentional generated artifacts.
- Confirm OpenAPI snapshot is regenerated.
- Confirm static HTML export manifest includes all eight module pages.
- Confirm Docker smoke uses the intended backend/frontend URLs.
- Confirm no `.env`, database file, upload payload, private key, or real patient data is tracked.
- Create release notes from this template.
- Create the tag locally and push only after approval.
