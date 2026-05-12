import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const tempDir = mkdtempSync(join(tmpdir(), 'linzight-api-smoke-'));
const uploadsDir = join(tempDir, 'uploads');
const databaseUrl = `sqlite:///${join(tempDir, 'linzight-smoke.db')}`;
const pythonFromVenv = join(repoRoot, 'backend', '.venv', 'bin', 'python');
const python = existsSync(pythonFromVenv) ? pythonFromVenv : 'python3';
const port = 18080 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;

let server;
let stderr = '';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function startServer() {
  server = spawn(python, ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LINZIGHT_DATABASE_URL: databaseUrl,
      LINZIGHT_UPLOADS_DIR: uploadsDir,
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
    if (server.exitCode !== null) {
      throw new Error(`Backend exited before health check passed.\n${stderr}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until uvicorn is ready.
    }
    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 250);
    });
  }
  throw new Error(`Backend did not become healthy in time.\n${stderr}`);
}

async function request(path, options = {}) {
  const { method = 'GET', token, body, expectedStatus } = options;
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  const expected = expectedStatus ?? (response.ok ? response.status : null);
  if (expectedStatus !== undefined) {
    assert(response.status === expectedStatus, `${method} ${path} expected ${expectedStatus}, got ${response.status}: ${raw}`);
  } else {
    assert(response.ok, `${method} ${path} failed ${response.status}: ${raw}`);
  }
  return { status: response.status, data, expected };
}

async function login(username) {
  const { data } = await request('/auth/login', {
    method: 'POST',
    body: { username, password: 'Demo1234!' },
  });
  assert(data.access_token, `missing token for ${username}`);
  return data;
}

async function uploadConsentFile(token, consentId, patientId) {
  const body = new globalThis.FormData();
  body.append('category', 'consent');
  body.append('patient_id', patientId);
  body.append('consent_id', consentId);
  body.append('is_deidentified', 'false');
  body.append('file', new globalThis.Blob(['smoke consent pdf'], { type: 'application/pdf' }), 'smoke-consent.pdf');

  const response = await fetch(`${baseUrl}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  assert(response.status === 201, `consent file upload expected 201, got ${response.status}: ${raw}`);
  return data;
}

async function downloadText(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await response.text();
  assert(response.ok, `download ${path} failed ${response.status}: ${raw}`);
  return raw;
}

async function downloadBlob(path, token, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await response.text();
  assert(response.status === expectedStatus, `download ${path} expected ${expectedStatus}, got ${response.status}: ${raw}`);
  return raw;
}

async function runSmoke() {
  startServer();
  await waitForHealth();
  await request('/seed', { method: 'POST' });

  const configAdmin = await login('lung-config@demo.linzight');
  const crfAdmin = await login('crf-admin@demo.linzight');
  const crc = await login('lung-crc@demo.linzight');
  const pi = await login('lung-pi@demo.linzight');
  const dataManager = await login('lung-dm@demo.linzight');
  const lzAdmin = await login('admin@demo.linzight');

  assert(configAdmin.user.role === 'STUDY_CONFIG_ADMIN', 'config admin role mismatch');
  assert(crfAdmin.user.role === 'LZ_CRF_ADMIN', 'CRF admin role mismatch');
  assert(crc.user.role === 'STUDY_CRC', 'crc role mismatch');
  assert(!crc.access_token.startsWith('demo-token-'), 'auth token should not use the legacy demo-token format');
  const currentUser = await request('/auth/me', { token: crc.access_token });
  assert(currentUser.data.id === crc.user.id, 'auth/me should return the current signed-token user');
  await request('/auth/me', { expectedStatus: 401 });
  await request('/patients?study_id=LZXK-01', { token: 'invalid-token', expectedStatus: 401 });

  const patients = await request('/patients?study_id=LZXK-01', { token: crc.access_token });
  assert(patients.data.length > 0, 'LZXK-01 patients should be visible to lung CRC');
  assert(patients.data.every((patient) => patient.study_id === 'LZXK-01'), 'patient list leaked another study');
  await request('/patients?study_id=LGL-1111', { token: crc.access_token, expectedStatus: 403 });
  const dataManagerPatients = await request('/patients?study_id=LZXK-01', { token: dataManager.access_token });
  assert(dataManagerPatients.data.length > 0, 'data manager should see scoped patients');
  assert(dataManagerPatients.data[0].name.includes('**'), 'data manager patient name should be masked');
  assert(dataManagerPatients.data[0].hospital_no.includes('****'), 'data manager hospital number should be masked in API view');

  const patient = patients.data[0];
  const consentList = await request('/consents?study_id=LZXK-01', { token: crc.access_token });
  const patientConsent = consentList.data.find((consent) => consent.patient_id === patient.id) ?? consentList.data[0];
  assert(patientConsent?.study_id === 'LZXK-01', 'consent list should stay in LZXK-01');
  const consentFile = await uploadConsentFile(crc.access_token, patientConsent.id, patientConsent.patient_id);
  assert(consentFile.category === 'consent', 'uploaded consent file should use consent category');
  assert(consentFile.consent_id === patientConsent.id, 'uploaded consent file should link consent_id');
  assert(consentFile.scan_status === 'clean', 'uploaded consent file should be scanner-clean');
  await downloadBlob(`/files/${consentFile.id}/download`, crc.access_token);
  const archivedConsentFile = await request(`/files/${consentFile.id}/archive`, {
    method: 'POST',
    token: crc.access_token,
  });
  assert(archivedConsentFile.data.archive_status === 'archived', 'file archive should persist archived status');
  await downloadBlob(`/files/${consentFile.id}/download`, crc.access_token, 409);

  const createdUser = await request('/users', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      username: `smoke-crc-${Date.now()}@demo.linzight`,
      display_name: 'Smoke CRC',
      role: 'STUDY_CRC',
      password: 'Demo1234!',
      status: 'active',
      study_id: 'LZXK-01',
      member_status: 'pending',
    },
  });
  assert(createdUser.status === 201, 'user create should return 201');
  assert(createdUser.data.study_memberships.some((member) => member.study_id === 'LZXK-01' && member.study_role === 'STUDY_CRC'), 'created user should be linked to LZXK-01');
  await request('/users', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      username: `weak-crc-${Date.now()}@demo.linzight`,
      display_name: 'Weak CRC',
      role: 'STUDY_CRC',
      password: 'weak',
      status: 'active',
      study_id: 'LZXK-01',
      member_status: 'pending',
    },
    expectedStatus: 422,
  });
  const disabledUser = await request(`/users/${createdUser.data.id}/status`, {
    method: 'PATCH',
    token: lzAdmin.access_token,
    body: { status: 'disabled' },
  });
  assert(disabledUser.data.status === 'disabled', 'LZ_ADMIN should be able to disable a user');
  await request('/auth/login', {
    method: 'POST',
    body: { username: createdUser.data.username, password: 'Demo1234!' },
    expectedStatus: 403,
  });
  await request('/users', {
    method: 'POST',
    token: crc.access_token,
    body: {
      username: `blocked-crc-${Date.now()}@demo.linzight`,
      display_name: 'Blocked CRC',
      role: 'STUDY_CRC',
      study_id: 'LZXK-01',
    },
    expectedStatus: 403,
  });

  const crfFields = await request('/studies/LZXK-01/crf-fields', { token: configAdmin.access_token });
  assert(crfFields.data.length >= 100, 'LZXK-01 CRF fields should be seeded');
  assert(crfFields.data.every((field) => field.study_id === 'LZXK-01'), 'CRF field list leaked another study');
  assert(crfFields.data.some((field) => field.id === 'LUNG-015'), 'expected lung CRF field LUNG-015');

  const updatedField = await request('/studies/LZXK-01/crf-fields/LUNG-015', {
    method: 'PUT',
    token: configAdmin.access_token,
    body: {
      name: '当前治疗线数',
      type: 'Number',
      module: '肺癌耐药研究字段',
      status: '启用',
      options: [],
      required: true,
      validation_rule: 'integer >= 1',
      conditional_logic: 'line_of_therapy >= 1',
    },
  });
  assert(updatedField.data.id === 'LUNG-015', 'CRF update returned wrong field');
  assert(updatedField.data.required === true, 'CRF required flag should persist');
  assert(updatedField.data.validation_rule === 'integer >= 1', 'CRF validation rule should persist');
  assert(updatedField.data.conditional_logic === 'line_of_therapy >= 1', 'CRF conditional logic should persist');
  const migrationPreview = await request('/studies/LZXK-01/crf-versions/migration-preview', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      schema: {
        version: 'smoke-preview',
        sections: [
          {
            id: 'smoke',
            title: 'Smoke',
            fields: [
              {
                id: 'SMOKE-001',
                name: 'Smoke Field',
                type: 'text',
                required: true,
              },
            ],
          },
        ],
      },
    },
  });
  assert(migrationPreview.data.summary.added >= 1, 'migration preview should report added fields');
  assert(migrationPreview.data.summary.removed >= 1, 'migration preview should report removed fields');
  const draftVersion = await request('/studies/LZXK-01/crf-versions', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      version: `V1.${Date.now()}`,
      status: 'draft',
      schema: {
        version: 'smoke-draft',
        sections: [
          {
            id: 'smoke',
            title: 'Smoke',
            fields: [
              {
                id: 'SMOKE-001',
                name: 'Smoke Field',
                type: 'text',
                required: true,
              },
            ],
          },
        ],
      },
      change_summary: 'Smoke draft version',
    },
  });
  assert(draftVersion.status === 201, 'CRF version draft create should return 201');
  assert(draftVersion.data.status === 'draft', 'CRF version should start as draft');
  const migrationApproval = await request('/studies/LZXK-01/crf-migrations', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      target_version_id: draftVersion.data.id,
      note: 'Smoke approval request',
    },
  });
  assert(migrationApproval.status === 201, 'CRF migration approval request should return 201');
  assert(migrationApproval.data.status === 'pending', 'CRF migration should start pending');
  assert(migrationApproval.data.preview.summary.added >= 1, 'CRF migration approval should persist preview');
  assert(migrationApproval.data.execution_logs?.some((log) => log.step === 'request'), 'CRF migration should include request execution log');
  await request(`/studies/LZXK-01/crf-migrations/${migrationApproval.data.id}/approve`, {
    method: 'POST',
    token: configAdmin.access_token,
    body: { note: 'Requester should not self-approve' },
    expectedStatus: 400,
  });
  const approvedMigration = await request(`/studies/LZXK-01/crf-migrations/${migrationApproval.data.id}/approve`, {
    method: 'POST',
    token: crfAdmin.access_token,
    body: { note: 'Smoke approved' },
  });
  assert(approvedMigration.data.status === 'approved', 'CRF migration should approve');
  assert(approvedMigration.data.execution_logs.some((log) => log.step === 'approve' && log.status === 'approved'), 'CRF migration should include approval execution log');
  const appliedMigration = await request(`/studies/LZXK-01/crf-migrations/${migrationApproval.data.id}/apply`, {
    method: 'POST',
    token: crfAdmin.access_token,
    body: { note: 'Smoke applied' },
  });
  assert(appliedMigration.data.status === 'applied', 'CRF migration should apply');
  assert(appliedMigration.data.execution_logs.some((log) => log.step === 'apply' && log.status === 'applied'), 'CRF migration should include apply execution log');
  const crfVersionsAfterApply = await request('/studies/LZXK-01/crf-versions', { token: configAdmin.access_token });
  const publishedVersion = crfVersionsAfterApply.data.find((version) => version.id === draftVersion.data.id);
  assert(publishedVersion?.status === 'published', 'approved CRF migration should publish the target version');
  assert(publishedVersion.published_at, 'published CRF version should have published_at');
  await request('/studies/LZXK-01/crf-fields/LUNG-015', {
    method: 'PUT',
    token: crc.access_token,
    body: { status: '停用' },
    expectedStatus: 403,
  });

  const sample = await request('/samples', {
    method: 'POST',
    token: crc.access_token,
    body: {
      patient_id: patient.id,
      patient_name: patient.name,
      hospital_no: patient.hospital_no,
      sample_type: '血液',
      visit: 'V1',
      collected_at: '2026-05-11',
      storage: 'A-01',
      status: '已采集',
      linked_omics: [],
    },
  });
  assert(sample.status === 201, 'sample create should return 201');
  assert(sample.data.study_id === 'LZXK-01', 'sample should inherit patient study_id');

  const omics = await request('/omics', {
    method: 'POST',
    token: crc.access_token,
    body: {
      testing_project_id: 'TP-LUNG-NGS',
      patient_id: patient.id,
      patient_name: patient.name,
      sample_id: sample.data.id,
      sample_type: sample.data.sample_type,
      assay: 'NGS panel',
      platform: 'NovaSeq',
      run_id: 'RUN-SMOKE-001',
      status: '样本接收',
      qc: '待确认',
      sent_at: '2026-05-11',
      completed_at: '-',
    },
  });
  assert(omics.status === 201, 'omics create should return 201');
  assert(omics.data.study_id === 'LZXK-01', 'omics should inherit patient study_id');

  await request('/exports', {
    method: 'POST',
    token: pi.access_token,
    body: {
      export_type: 'patients',
      scope: { study_id: 'LZXK-01' },
      requested_by: pi.user.id,
    },
    expectedStatus: 403,
  });
  const exportJob = await request('/exports', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      export_type: 'patients',
      scope: { study_id: 'LZXK-01' },
      requested_by: dataManager.user.id,
    },
  });
  assert(exportJob.status === 201, 'export create should return 201');
  assert(exportJob.data.study_id === 'LZXK-01', 'export should be scoped to LZXK-01');
  assert(exportJob.data.status === 'ready', 'export should be ready in demo backend');
  const exportedCsv = await downloadText(`/exports/${exportJob.data.id}/download`, dataManager.access_token);
  const exportedFirstDataRow = exportedCsv.trim().split('\n')[1].split(',');
  assert(exportedFirstDataRow[2] === '' && exportedFirstDataRow[3] === '', 'data manager export should remove direct identifiers');
  const fieldPermissions = await request('/field-permissions?resource=patients', { token: dataManager.access_token });
  assert(fieldPermissions.data.every((item) => item.role === 'STUDY_DATA_MANAGER'), 'non-admin field permissions response should be role-scoped');
  assert(fieldPermissions.data.some((item) => item.field_name === 'name' && item.mask_rule === 'name'), 'field permissions should expose patient name masking rule');

  const exportApproval = await request('/approvals', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: 'LZXK-01',
      approval_type: 'deidentified_export',
      entity_type: 'export_jobs',
      entity_id: exportJob.data.id,
      payload: { export_id: exportJob.data.id, export_type: 'patients' },
      comment: 'Smoke deidentified export approval',
      submit: true,
    },
  });
  assert(exportApproval.status === 201, 'export approval create should return 201');
  assert(exportApproval.data.status === 'submitted', 'approval should start submitted');
  await request(`/approvals/${exportApproval.data.id}/approve`, {
    method: 'POST',
    token: dataManager.access_token,
    body: { comment: 'self approval should fail' },
    expectedStatus: 400,
  });
  const approvedExport = await request(`/approvals/${exportApproval.data.id}/approve`, {
    method: 'POST',
    token: lzAdmin.access_token,
    body: { comment: 'approved by smoke admin' },
  });
  assert(approvedExport.data.status === 'approved', 'approval should approve');
  const completedExport = await request(`/approvals/${exportApproval.data.id}/complete`, {
    method: 'POST',
    token: dataManager.access_token,
    body: { comment: 'completed after approved export' },
  });
  assert(completedExport.data.status === 'completed', 'approval should complete');
  assert(completedExport.data.actions.some((action) => action.to_status === 'completed'), 'approval actions should record completion');

  const crfPublishApproval = await request('/approvals', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      study_id: 'LZXK-01',
      approval_type: 'crf_publish',
      entity_type: 'study_crf_versions',
      entity_id: draftVersion.data.id,
      payload: { target_version_id: draftVersion.data.id },
      comment: 'Smoke CRF publish approval',
      submit: true,
    },
  });
  const rejectedCrfPublish = await request(`/approvals/${crfPublishApproval.data.id}/reject`, {
    method: 'POST',
    token: crfAdmin.access_token,
    body: { comment: 'reject path covered' },
  });
  assert(rejectedCrfPublish.data.status === 'rejected', 'CRF publish approval should reject');

  const audits = await request('/audit-logs?study_id=LZXK-01&entity_type=study_crf_versions', { token: configAdmin.access_token });
  assert(audits.data.some((entry) => entry.action === 'update_crf_field'), 'CRF update audit log missing');
  const logout = await request('/auth/logout', { method: 'POST', token: crc.access_token });
  assert(logout.data.status === 'logged_out', 'logout should acknowledge the signed-token session');

  console.log('API smoke passed: auth, study isolation, user provisioning, CRF config, consent upload, samples, omics, export permissions, audit logs.');
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    return;
  }
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => {
      server.once('exit', resolveExit);
    }),
    new Promise((resolveTimeout) => {
      setTimeout(resolveTimeout, 3000);
    }),
  ]);
  if (server.exitCode === null) {
    server.kill('SIGKILL');
  }
}

try {
  await runSmoke();
} finally {
  await stopServer();
  rmSync(tempDir, { recursive: true, force: true });
}
