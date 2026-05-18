import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = mkdtempSync(join(tmpdir(), 'linzight-performance-smoke-'));
const reportDir = join(repoRoot, 'reports');
const reportPath = join(reportDir, 'performance-smoke.json');
const pythonFromVenv = join(repoRoot, 'backend', '.venv', 'bin', 'python');
const python = existsSync(pythonFromVenv) ? pythonFromVenv : 'python3';
const port = 25080 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;

let server;
let stderr = '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeReport(status, details) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ status, baseUrl, details, generatedAt: new Date().toISOString() }, null, 2));
}

function startServer() {
  server = spawn(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-performance.db')}`,
      LINZIGHT_DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-performance.db')}`,
      LINZIGHT_ALLOW_SQLITE_RUNTIME: '1',
      LINZIGHT_UPLOADS_DIR: join(tempDir, 'uploads'),
      LINZIGHT_STORAGE_BACKEND: 'object',
      LINZIGHT_OBJECT_BUCKET: 'performance-smoke',
      LINZIGHT_OBJECT_PREFIX: 'rws-edc',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Backend exited before health check passed.\n${stderr}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Retry until uvicorn is ready.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Backend did not become healthy in time.\n${stderr}`);
}

async function request(path, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, options);
  const elapsedMs = Math.round(performance.now() - started);
  const raw = await response.text();
  let data = raw;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  assert(response.ok, `${options.method || 'GET'} ${path} failed ${response.status}: ${raw}`);
  return { data, elapsedMs };
}

async function login() {
  const { data } = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@demo.linzight', password: 'Demo1234!' }),
  });
  return data.access_token;
}

async function run() {
  startServer();
  const details = {};
  try {
    await waitForHealth();
    await request('/seed', { method: 'POST' });
    const token = await login();
    const patients = await request('/global/patient-index', { headers: { Authorization: `Bearer ${token}` } });
    details.patientListMs = patients.elapsedMs;
    details.patientCount = patients.data.length;
    assert(patients.data.length === 70, `expected 70 demo patient index rows, got ${patients.data.length}`);
    assert(patients.elapsedMs < 2000, `patient list too slow: ${patients.elapsedMs}ms`);

    const exportJob = await request('/exports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ export_type: 'patients', scope: { study_id: 'LZXK-01' }, requested_by: 'USR-005' }),
    });
    details.exportCreateMs = exportJob.elapsedMs;
    assert(exportJob.elapsedMs < 5000, `export creation too slow: ${exportJob.elapsedMs}ms`);
    assert(exportJob.data.status === 'ready', 'export job should be ready');

    const download = await request(`/exports/${exportJob.data.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
    details.exportDownloadMs = download.elapsedMs;
    assert(download.elapsedMs < 3000, `export download too slow: ${download.elapsedMs}ms`);
    writeReport('passed', details);
    console.log(`Performance smoke passed: 70 patients, patient list ${details.patientListMs}ms, export ${details.exportCreateMs}ms. Report: ${reportPath}`);
  } catch (error) {
    writeReport('failed', { ...details, message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (server) server.kill('SIGTERM');
    rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
