import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const pythonFromVenv = join(repoRoot, 'backend', '.venv', 'bin', 'python');
const python = existsSync(pythonFromVenv) ? pythonFromVenv : 'python3';
const outputPath = process.argv[2] ?? 'docs/openapi.json';

const result = spawnSync(python, ['-m', 'backend.export_openapi', outputPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
