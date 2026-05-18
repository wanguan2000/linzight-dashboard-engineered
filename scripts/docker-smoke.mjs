import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backendUrl = process.env.DOCKER_SMOKE_BACKEND_URL || 'http://localhost:8000';
const frontendUrl = process.env.DOCKER_SMOKE_FRONTEND_URL || 'http://localhost:5173';
const shouldStop = process.env.DOCKER_SMOKE_DOWN === '1';
const buildTimeoutMs = Number(process.env.DOCKER_SMOKE_BUILD_TIMEOUT_MS || 180000);
const cachedImageNames = ['linzight-dashboard-engineered-backend:latest', 'linzight-dashboard-engineered-frontend:latest'];

function localEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = resolve(repoRoot, '.env');
  if (!existsSync(envPath)) return undefined;
  const match = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && line.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

function run(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    timeout: options.timeoutMs,
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    const reason = result.error instanceof Error ? `\n${result.error.message}` : '';
    throw new Error(`docker ${args.join(' ')} failed${reason}${output ? `\n${output}` : ''}`);
  }
  return result.stdout ?? '';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasCachedComposeImages() {
  return cachedImageNames.every((image) => {
    const result = spawnSync('docker', ['image', 'inspect', image], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'ignore',
    });
    return result.status === 0;
  });
}

function buildOrUseCachedImages() {
  try {
    run(['compose', 'build'], { timeoutMs: buildTimeoutMs });
    return false;
  } catch (error) {
    if (!hasCachedComposeImages()) throw error;
    console.warn(`Docker compose build did not complete; using cached images after verifying ${cachedImageNames.join(', ')} are present.`);
    return true;
  }
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
  const username = localEnvValue('LINZIGHT_INITIAL_ADMIN_EMAIL') || 'guan.wang@linzight.com';
  const password = localEnvValue('LINZIGHT_INITIAL_ADMIN_PASSWORD') || 'ChangeMe1234!';
  const response = await fetch(`${backendUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const raw = await response.text();
  assert(response.ok, `Docker backend login failed ${response.status}: ${raw}`);
  const data = JSON.parse(raw);
  assert(data.access_token, 'Docker backend login did not return an access token');
  assert(data.user?.role === 'LZ_ADMIN', 'Docker backend login did not return the LZ system administrator');
  const patients = await fetch(`${backendUrl}/global/patient-index`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const patientRows = JSON.parse(await patients.text());
  assert(Array.isArray(patientRows) && patientRows.length === 0, 'Docker GA bootstrap should not seed patient data');
}

async function verifyFrontend() {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(frontendUrl);
      const html = await response.text();
      if (response.ok && html.includes('root') && html.includes('/assets/')) return;
      lastError = new Error(`Docker frontend returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 1000);
    });
  }
  throw lastError instanceof Error ? lastError : new Error(`Docker frontend did not become ready at ${frontendUrl}`);
}

async function runSmoke() {
  run(['version']);
  run(['compose', 'config'], { capture: true });
  const usingCachedImages = buildOrUseCachedImages();
  run(usingCachedImages ? ['compose', 'up', '-d', '--no-build'] : ['compose', 'up', '-d']);
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
