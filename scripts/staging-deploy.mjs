import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = join(repoRoot, 'reports');
const reportPath = join(reportDir, 'staging-deploy-plan.json');

const requiredFiles = [
  'Dockerfile.frontend',
  'Dockerfile.backend',
  'docker-compose.yml',
  'backend/migrations/postgres/001_schema.sql',
  'backend/migrations/postgres/002_indexes.sql',
  'backend/migrations/postgres/003_constraints.sql',
  'backend/migrations/postgres/004_seed_demo.sql',
];

const config = {
  frontendApiBaseUrl: process.env.VITE_API_BASE_URL || 'https://staging.example.com/api',
  databaseUrl: process.env.LINZIGHT_POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://linzight:***@postgres:5432/linzight',
  storageBackend: process.env.LINZIGHT_STORAGE_BACKEND || 'object',
  objectBucket: process.env.LINZIGHT_OBJECT_BUCKET || 'linzight-rws-staging',
  objectPrefix: process.env.LINZIGHT_OBJECT_PREFIX || 'rws-edc',
  virusScanProvider: process.env.LINZIGHT_VIRUS_SCAN_PROVIDER || 'clamav',
  virusScanEndpoint: process.env.LINZIGHT_VIRUS_SCAN_ENDPOINT || 'tcp://clamav:3310',
};

const missing = requiredFiles.filter((path) => !existsSync(join(repoRoot, path)));
if (missing.length) {
  console.error(`Staging deploy plan failed: missing ${missing.join(', ')}`);
  process.exit(1);
}

const plan = {
  status: 'ready_for_operator_review',
  mode: process.argv.includes('--execute') ? 'execute_requested' : 'dry_run',
  config,
  steps: [
    'Build frontend with VITE_API_BASE_URL pointing to the staging API.',
    'Apply backend/migrations/postgres SQL files to an empty staging PostgreSQL database in numeric order.',
    'Seed or import the reviewed demo dataset.',
    'Start backend with PostgreSQL, object storage, and virus scanner environment variables.',
    'Start frontend behind TLS reverse proxy.',
    'Run npm run smoke:api, npm run browser:matrix, npm run demo:e2e, and npm run smoke:performance against staging.',
    'Keep rollback ready: previous frontend artifact, previous backend image/tag, database restore point, object-store version marker.',
  ],
  generatedAt: new Date().toISOString(),
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, JSON.stringify(plan, null, 2));

console.log(`Staging deploy plan written: ${reportPath}`);
if (plan.mode === 'execute_requested') {
  console.log('This RC script is intentionally dry-run only; execute the generated plan with your deployment runner.');
}
