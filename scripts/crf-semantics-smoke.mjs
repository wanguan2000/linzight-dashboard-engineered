import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePython } from './python-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = mkdtempSync(join(tmpdir(), 'linzight-crf-semantics-'));
const python = resolvePython(repoRoot);
const port = 22080 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;

const lungStudyId = 'LZXK-01';
const forbiddenLungTokens = [
  'SLEDAI评分',
  'RSLEDAI',
  'C3 (g/L)',
  'C4 (g/L)',
  'IgG Index',
  '免疫抑制剂1',
  '免疫抑制剂2',
  '免疫相关性神经系统疾病多组学解析及机制探索',
];
const requiredLungFields = [
  '研究编号',
  '研究名称',
  '病种',
  '分期',
  'TNM分期',
  'ECOG评分',
  '治疗线数',
  '当前治疗方案',
  '驱动基因突变',
  '耐药机制',
  'RECIST评估',
  'ctDNA突变丰度',
  'PFS（月）',
  'ORR评估',
  '检测项目',
];

let server;
let stderr = '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoForbiddenTokens(value, label) {
  const serialized = JSON.stringify(value);
  const leaked = forbiddenLungTokens.filter((token) => serialized.includes(token));
  assert(!leaked.length, `${label} leaked lung-forbidden CRF/domain tokens: ${leaked.join(', ')}`);
}

function startServer() {
  server = spawn(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LINZIGHT_DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-crf-semantics.db')}`,
      LINZIGHT_UPLOADS_DIR: join(tempDir, 'uploads'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  server.stdout.on('data', () => {});
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
  const { method = 'GET', token, body, expectedStatus } = options;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (expectedStatus !== undefined) {
    assert(response.status === expectedStatus, `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${raw}`);
  } else {
    assert(response.ok, `${method} ${path} failed ${response.status}: ${raw}`);
  }
  return { status: response.status, data };
}

async function login(username) {
  const { data } = await request('/auth/login', {
    method: 'POST',
    body: { username, password: 'Demo1234!' },
  });
  assert(data.access_token, `missing token for ${username}`);
  return data.access_token;
}

async function run() {
  startServer();
  try {
    await waitForHealth();
    const seed = await fetch(`${baseUrl}/seed`, { method: 'POST' });
    assert(seed.ok, `seed failed: ${seed.status} ${await seed.text()}`);

    const crcToken = await login('lung-crc@demo.linzight');
    const dmToken = await login('lung-dm@demo.linzight');
    const configToken = await login('lung-config@demo.linzight');

    const configuration = await request(`/studies/${lungStudyId}/configuration`, { token: crcToken });
    assert(configuration.data.active_crf_version_id === 'CRFV-LZXK-01-V1.0', `${lungStudyId} should bind its published lung CRF in Study configuration`);
    assert(configuration.data.consent_template === 'lung-cancer-rwd-consent-v1.0', `${lungStudyId} should bind lung consent template`);
    assert(configuration.data.testing_profile.testing_project_id === 'TP-LUNG-RESIST-OMICS', `${lungStudyId} should bind lung testing profile`);
    assertNoForbiddenTokens(configuration.data, 'lung Study configuration');

    const patients = await request(`/patients?study_id=${lungStudyId}`, { token: crcToken });
    assert(patients.data.length === 20, `${lungStudyId} should have 20 seeded patients`);
    assert(patients.data.every((patient) => patient.study_id === lungStudyId), 'lung patients leaked another Study');
    assertNoForbiddenTokens(patients.data.map((patient) => patient.clinical_data), 'lung patient clinical_data');
    for (const field of requiredLungFields) {
      assert(field in patients.data[0].clinical_data, `lung patient clinical_data missing ${field}`);
    }

    const crfEntries = await request(`/crf?study_id=${lungStudyId}`, { token: crcToken });
    assert(crfEntries.data.length > 0, `${lungStudyId} CRF entries should exist`);
    assert(crfEntries.data.every((entry) => entry.study_id === lungStudyId), 'lung CRF entries leaked another Study');
    assert(crfEntries.data.every((entry) => String(entry.crf_version_id).startsWith('CRFV-LZXK-01')), 'lung CRF entries should bind LZXK CRF version');
    assertNoForbiddenTokens(crfEntries.data.map((entry) => entry.payload), 'lung CRF payload');

    const crfFields = await request(`/studies/${lungStudyId}/crf-fields`, { token: configToken });
    const fieldNames = crfFields.data.map((field) => field.name);
    assert(crfFields.data.length === requiredLungFields.length, `${lungStudyId} should expose ${requiredLungFields.length} CRF fields`);
    assertNoForbiddenTokens(fieldNames, 'lung CRF field dictionary');
    for (const field of requiredLungFields) {
      assert(fieldNames.includes(field), `lung CRF field dictionary missing ${field}`);
    }

    const invalidQuery = await request('/queries', {
      method: 'POST',
      token: dmToken,
      expectedStatus: 400,
      body: {
        study_id: lungStudyId,
        patient_id: patients.data[0].id,
        visit_id: null,
        form_id: 'baseline',
        field_name: 'SLEDAI评分',
        title: 'Invalid cross-domain Query',
        description: 'This should be rejected because lung CRF does not contain SLEDAI.',
        assigned_to: null,
      },
    });
    assert(String(invalidQuery.data.detail ?? '').includes('field_name'), 'invalid lung SLEDAI Query should fail on field_name validation');

    console.log(`CRF semantics smoke passed: ${lungStudyId} CRF, payload, patients and Query validation are lung-specific.`);
  } finally {
    if (server) server.kill('SIGTERM');
    rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
