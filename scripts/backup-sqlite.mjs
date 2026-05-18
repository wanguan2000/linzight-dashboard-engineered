import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function resolveProjectPath(path) {
  return isAbsolute(path) ? path : join(projectRoot, path);
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith('sqlite:///')) {
    throw new Error(`Only sqlite:/// URLs are supported by this legacy SQLite backup script: ${databaseUrl}`);
  }
  return resolveProjectPath(databaseUrl.slice('sqlite:///'.length));
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

const databaseUrl = process.env.LINZIGHT_DATABASE_URL || 'sqlite:///./backend/linzight_demo.db';
const uploadsDir = resolveProjectPath(process.env.LINZIGHT_UPLOADS_DIR || './uploads');
const databasePath = resolveSqlitePath(databaseUrl);
const backupRoot = resolveProjectPath(process.env.LINZIGHT_BACKUP_DIR || './backups');
const backupDir = join(backupRoot, `linzight-${timestamp()}`);

mkdirSync(backupDir, { recursive: true });

if (existsSync(databasePath)) {
  copyFileSync(databasePath, join(backupDir, 'linzight_demo.db'));
} else {
  console.warn(`SQLite database not found, skipped database copy: ${databasePath}`);
}

if (existsSync(uploadsDir)) {
  cpSync(uploadsDir, join(backupDir, 'uploads'), { recursive: true });
}

writeFileSync(
  join(backupDir, 'manifest.json'),
  `${JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      databaseUrl,
      databasePath,
      uploadsDir,
      note: 'Legacy SQLite/upload backup for local validation. Not a production backup solution.',
    },
    null,
    2,
  )}\n`,
);

console.log(`Backup created: ${backupDir}`);
