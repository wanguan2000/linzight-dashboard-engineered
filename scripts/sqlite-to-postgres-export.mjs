import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(repoRoot, process.argv[2] || 'exports/postgres-migration');
const databaseUrl = process.env.LINZIGHT_DATABASE_URL || `sqlite:///${resolve(repoRoot, 'backend/linzight_demo.db')}`;

mkdirSync(outputDir, { recursive: true });

const python = process.env.PYTHON || 'python3';
const script = `
import csv, json, os, sqlite3, sys
from pathlib import Path

database_url = os.environ["LINZIGHT_DATABASE_URL"]
if not database_url.startswith("sqlite:///"):
    raise SystemExit("sqlite-to-postgres-export expects LINZIGHT_DATABASE_URL=sqlite:///...")
db_path = database_url.replace("sqlite:///", "", 1)
out_dir = Path(os.environ["LINZIGHT_MIGRATION_EXPORT_DIR"])
out_dir.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
tables = [row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
manifest = []
for table in tables:
    rows = [dict(row) for row in conn.execute(f"SELECT * FROM {table}")]
    csv_path = out_dir / f"{table}.csv"
    json_path = out_dir / f"{table}.json"
    if rows:
        with csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    else:
        csv_path.write_text("", encoding="utf-8")
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest.append({"table": table, "rows": len(rows), "csv": csv_path.name, "json": json_path.name})
(out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Exported {len(tables)} tables to {out_dir}")
`;

const result = spawnSync(python, ['-c', script], {
  cwd: repoRoot,
  env: {
    ...process.env,
    LINZIGHT_DATABASE_URL: databaseUrl,
    LINZIGHT_MIGRATION_EXPORT_DIR: outputDir,
  },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

process.stdout.write(result.stdout);
