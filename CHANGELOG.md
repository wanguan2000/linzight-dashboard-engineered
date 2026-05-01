# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses Semantic Versioning.

## [0.0.1-beta.0] - 2026-05-01

### Added

- GitHub beta release preparation documents: `AGENTS.md`, `AI_HANDOFF.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `SETUP.md`, `ROADMAP.md`, `API.md`, `DEPLOYMENT.md`, and `SECURITY.md`.
- Root `.env.example` and improved backend environment example.
- MIT `LICENSE`.
- Static HTML export documentation for eight dashboard modules.

### Changed

- Project version normalized to `0.0.1-beta.0`.
- README updated as the primary GitHub entry point for future developers and AI agents.
- `.gitignore` expanded to exclude generated output, caches, local env files, local database files, uploads, and IDE/system files.

### Known Issues

- No dedicated `test` script is configured yet.
- FastAPI backend is Demo-grade and uses local SQLite plus demo token authentication.
- Production API, CI/CD, Docker deployment, and automated browser tests are still planned work.
