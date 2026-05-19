import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function resolveProjectPath(path) {
  return isAbsolute(path) ? path : join(projectRoot, path);
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function normalizePostgresUrl(url) {
  return url.replace(/^postgresql\+psycopg2:\/\//, 'postgresql://');
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed${output ? `\n${output}` : ''}`);
  }
  return result.stdout ?? '';
}

function uploadInventory(root) {
  if (!existsSync(root)) return [];
  const rows = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        const stat = statSync(fullPath);
        rows.push({
          path: fullPath.slice(root.length + 1),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

const databaseUrl = normalizePostgresUrl(
  process.env.DATABASE_URL ||
    process.env.LINZIGHT_DATABASE_URL ||
    process.env.LINZIGHT_POSTGRES_URL ||
    'postgresql:///linzight_dashboard_engineered',
);

if (!databaseUrl.startsWith('postgresql://')) {
  throw new Error(`PostgreSQL backup drill requires a postgresql:// URL, got: ${databaseUrl}`);
}

const backupRoot = resolveProjectPath(process.env.LINZIGHT_BACKUP_DIR || './backups');
const backupDir = join(backupRoot, `postgres-${timestamp()}`);
const dumpPath = join(backupDir, 'linzight.dump');
const manifestPath = join(backupDir, 'manifest.json');
const uploadsDir = resolveProjectPath(process.env.LINZIGHT_UPLOADS_DIR || './uploads');
const reportDir = join(projectRoot, 'reports');

mkdirSync(backupDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', dumpPath, databaseUrl]);

const tableListRaw = run(
  'psql',
  [
    databaseUrl,
    '-Atc',
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;",
  ],
  { capture: true },
);
const tableNames = tableListRaw.trim().split(/\r?\n/).filter(Boolean);
const tableCounts = Object.fromEntries(
  tableNames.map((tableName) => {
    const count = run('psql', [databaseUrl, '-Atc', `SELECT COUNT(*) FROM public.${quoteIdentifier(tableName)};`], { capture: true }).trim();
    return [tableName, Number(count)];
  }),
);

const restoreList = run('pg_restore', ['--list', dumpPath], { capture: true });

const manifest = {
  createdAt: new Date().toISOString(),
  databaseUrl: databaseUrl.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@'),
  dumpPath,
  dumpSizeBytes: statSync(dumpPath).size,
  tableCounts,
  restoreListEntries: restoreList.trim().split(/\r?\n/).filter(Boolean).length,
  uploadInventory: uploadInventory(uploadsDir),
  note: 'PostgreSQL functional-testing backup drill. Restore into a separate staging database before any destructive production restore.',
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  join(reportDir, 'postgres-backup-drill.json'),
  `${JSON.stringify({ status: 'passed', backupDir, manifest }, null, 2)}\n`,
);

console.log(`PostgreSQL backup drill passed: ${backupDir}`);
