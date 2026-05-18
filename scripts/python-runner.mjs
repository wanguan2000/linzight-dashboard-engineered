import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function resolvePython(repoRoot) {
  const candidates = [join(repoRoot, 'backend', '.venv', 'bin', 'python'), 'python3'];
  for (const candidate of candidates) {
    if (candidate.includes('.venv') && !existsSync(candidate)) continue;
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  return 'python3';
}
