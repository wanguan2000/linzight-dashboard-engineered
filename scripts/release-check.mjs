import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function fail(message) {
  console.error(`Release check failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8'));
}

function gitLsFiles() {
  return execFileSync('git', ['ls-files'], { cwd: projectRoot, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const packageJson = readJson('package.json');
for (const script of ['lint', 'build', 'export:html', 'export:openapi', 'smoke:api', 'smoke:crf-semantics', 'smoke:ui', 'smoke:static-runtime', 'smoke:performance', 'smoke:docker', 'browser:matrix', 'demo:e2e', 'deploy:staging', 'release:check', 'backup:postgres', 'backup:sqlite', 'restore:sqlite', 'test']) {
  assert(packageJson.scripts?.[script], `package.json missing script "${script}"`);
}

for (const path of [
  'README.md',
  'RELEASE_NOTES.md',
  'AI_HANDOFF.md',
  'ARCHITECTURE.md',
  'CHANGELOG.md',
  'ROADMAP.md',
  'docs/02-api-contract.md',
  'docs/03-frontend-backend-protocol.md',
  'docs/05-beta-release-readiness.md',
  'docs/07-production-release-candidate-workflows.md',
  'docs/08-permission-matrix.md',
  'docs/09-uat-release-package.md',
  'docs/release-notes-v1.0.1.md',
  'docs/deployment-ops.md',
  'docs/frontend-function-gap-audit.md',
  'docs/frontend-html-export.md',
  'docs/openapi.json',
  '.github/workflows/ci.yml',
  '.dockerignore',
  'Dockerfile.backend',
  'Dockerfile.frontend',
  'docker-compose.yml',
  'scripts/backup-sqlite.mjs',
  'scripts/postgres-backup-drill.mjs',
  'scripts/browser-matrix.mjs',
  'scripts/crf-semantics-smoke.mjs',
  'scripts/demo-e2e.mjs',
  'scripts/docker-smoke.mjs',
  'scripts/export-openapi.mjs',
  'scripts/performance-smoke.mjs',
  'scripts/restore-sqlite.mjs',
  'scripts/staging-deploy.mjs',
  'scripts/static-export-runtime-smoke.mjs',
  'backend/migrations/postgres/001_schema.sql',
  'backend/migrations/postgres/002_indexes.sql',
  'backend/migrations/postgres/003_constraints.sql',
  'backend/migrations/postgres/004_seed_demo.sql',
  'backend/migrations/postgres/README.md',
  'backend/export_openapi.py',
  'exports/html/EXPORT_MANIFEST.json',
]) {
  assert(existsSync(join(projectRoot, path)), `${path} is missing`);
}

const workflow = readFileSync(join(projectRoot, '.github/workflows/ci.yml'), 'utf8');
for (const marker of ['npm run lint', 'npm run build', 'npm run smoke:api', 'npm run smoke:crf-semantics', 'npm run export:openapi', 'npm run export:html', 'npm run smoke:ui', 'npm run smoke:static-runtime', 'npm run browser:matrix', 'npm run demo:e2e', 'npm run smoke:performance', 'npm run release:check', 'npm run smoke:docker', 'actions/upload-artifact']) {
  assert(workflow.includes(marker), `.github/workflows/ci.yml missing "${marker}"`);
}

const manifest = readJson('exports/html/EXPORT_MANIFEST.json');
assert(Array.isArray(manifest.pages) && manifest.pages.length === 8, 'exports/html manifest must contain 8 pages');
for (const page of manifest.pages) {
  assert(existsSync(join(projectRoot, 'exports/html', page.file)), `exported page missing: ${page.file}`);
}

const trackedFiles = gitLsFiles();
const forbiddenTrackedPatterns = [
  /^\.env(?:$|\.(?!example$))/,
  /^backend\/\.env(?:$|\.(?!example$))/,
  /^backend\/linzight_demo\.db$/,
  /^uploads\/(?!\.gitkeep$)/,
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /^dist\//,
  /(^|\/)__pycache__\//,
  /\.pyc$/,
  /\.(pem|key|sqlite|sqlite3|db)$/i,
];

const forbiddenTracked = trackedFiles.filter((path) => forbiddenTrackedPatterns.some((pattern) => pattern.test(path)));
assert(!forbiddenTracked.length, `forbidden tracked files: ${forbiddenTracked.join(', ')}`);

const largeTrackedFiles = trackedFiles
  .filter((path) => existsSync(join(projectRoot, path)))
  .map((path) => ({ path, size: statSync(join(projectRoot, path)).size }))
  .filter((file) => file.size > 5 * 1024 * 1024 && !file.path.startsWith('resource/'));

assert(!largeTrackedFiles.length, `large tracked files outside resource/: ${largeTrackedFiles.map((file) => file.path).join(', ')}`);

console.log('Release check passed: scripts, docs, CI, OpenAPI, exports, tracked-file hygiene, and size guard verified.');
