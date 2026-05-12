import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendUrl = process.env.DOCKER_SMOKE_BACKEND_URL || 'http://127.0.0.1:8000';
const frontendUrl = process.env.DOCKER_SMOKE_FRONTEND_URL || 'http://localhost:5173';
const shouldStop = process.env.DOCKER_SMOKE_DOWN === '1';

function run(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`docker ${args.join(' ')} failed${output ? `\n${output}` : ''}`);
  }
  return result.stdout ?? '';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHealth() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) return;
    } catch {
      // Retry until the compose healthcheck and host port are ready.
    }
    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 1000);
    });
  }
  throw new Error(`Docker backend did not become healthy at ${backendUrl}/health`);
}

async function verifyBackendLogin() {
  const response = await fetch(`${backendUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'lung-crc@demo.linzight', password: 'demo123' }),
  });
  const raw = await response.text();
  assert(response.ok, `Docker backend login failed ${response.status}: ${raw}`);
  const data = JSON.parse(raw);
  assert(data.access_token, 'Docker backend login did not return an access token');
  assert(data.user?.study_scope?.studyIds?.includes('LZXK-01'), 'Docker backend login did not preserve LZXK-01 study scope');
}

async function verifyFrontend() {
  const response = await fetch(frontendUrl);
  const html = await response.text();
  assert(response.ok, `Docker frontend failed ${response.status}`);
  assert(html.includes('root') && html.includes('/assets/'), 'Docker frontend did not return the Vite app shell');
}

async function runSmoke() {
  run(['version']);
  run(['compose', 'config']);
  run(['compose', 'build']);
  run(['compose', 'up', '-d']);
  await waitForHealth();
  await verifyBackendLogin();
  await verifyFrontend();
  run(['compose', 'ps']);
  console.log(`Docker smoke passed: ${frontendUrl} and ${backendUrl} are reachable.`);
}

runSmoke()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (shouldStop) {
      run(['compose', 'down', '--remove-orphans']);
    }
  });
