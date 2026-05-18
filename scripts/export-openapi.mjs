import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePython } from './python-runner.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const python = resolvePython(repoRoot);
const outputPath = process.argv[2] ?? 'docs/openapi.json';

const result = spawnSync(python, ['-m', 'backend.export_openapi', outputPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
