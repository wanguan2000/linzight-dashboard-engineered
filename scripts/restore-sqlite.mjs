import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function fail(message) {
  console.error(`Restore failed: ${message}`);
  process.exit(1);
}

function resolveProjectPath(path) {
  return isAbsolute(path) ? path : join(projectRoot, path);
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith('sqlite:///')) {
    fail(`Only sqlite:/// URLs are supported by this legacy SQLite restore script: ${databaseUrl}`);
  }
  return resolveProjectPath(databaseUrl.slice('sqlite:///'.length));
}

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

const backupArg = process.argv[2];
if (!backupArg) {
  fail('pass a backup directory, for example: npm run restore:sqlite -- backups/linzight-2026-05-12T00-00-00-000Z');
}

const backupDir = resolveProjectPath(backupArg);
const backupDatabase = join(backupDir, 'linzight_demo.db');
const backupUploads = join(backupDir, 'uploads');
const manifestPath = join(backupDir, 'manifest.json');

if (!existsSync(backupDir)) fail(`backup directory not found: ${backupDir}`);
if (!existsSync(backupDatabase)) fail(`backup database not found: ${backupDatabase}`);

const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const databaseUrl = process.env.LINZIGHT_DATABASE_URL || manifest.databaseUrl || 'sqlite:///./backend/linzight_demo.db';
const databasePath = resolveSqlitePath(databaseUrl);
const uploadsDir = resolveProjectPath(process.env.LINZIGHT_UPLOADS_DIR || manifest.uploadsDir || './uploads');
const preRestoreDir = join(resolveProjectPath(process.env.LINZIGHT_BACKUP_DIR || './backups'), `pre-restore-${timestamp()}`);

mkdirSync(preRestoreDir, { recursive: true });
mkdirSync(dirname(databasePath), { recursive: true });

if (existsSync(databasePath)) {
  copyFileSync(databasePath, join(preRestoreDir, 'linzight_demo.db'));
}

copyFileSync(backupDatabase, databasePath);

if (existsSync(uploadsDir)) {
  cpSync(uploadsDir, join(preRestoreDir, 'uploads'), { recursive: true });
  rmSync(uploadsDir, { recursive: true, force: true });
}

if (existsSync(backupUploads)) {
  cpSync(backupUploads, uploadsDir, { recursive: true });
} else {
  mkdirSync(uploadsDir, { recursive: true });
}

console.log(`Restored database to: ${databasePath}`);
console.log(`Restored uploads to: ${uploadsDir}`);
console.log(`Pre-restore copy kept at: ${preRestoreDir}`);
