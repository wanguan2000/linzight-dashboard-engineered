# PostgreSQL Migration Baseline

This directory is the formal RC migration split:

1. `001_schema.sql` creates baseline tables.
2. `002_indexes.sql` creates query indexes.
3. `003_constraints.sql` adds status/role constraints and the one-published-CRF invariant.
4. `004_seed_demo.sql` inserts minimal staging connectivity seed rows.

For the full 70-patient demo dataset, run:

```bash
npm run export:postgres-migration -- exports/postgres-migration
```

Then load the generated CSV/JSON package into a staging PostgreSQL database after reviewing JSONB columns and row counts. Formal runtime uses PostgreSQL; SQLite is limited to explicitly allowed legacy export/smoke tooling and is not a production runtime.
