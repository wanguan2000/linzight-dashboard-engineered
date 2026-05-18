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
      DATABASE_URL: databaseUrl,
      LINZIGHT_DATABASE_URL: databaseUrl,
      LINZIGHT_ALLOW_SQLITE_RUNTIME: '1',
      LINZIGHT_UPLOADS_DIR: uploadsDir,
      LINZIGHT_STORAGE_BACKEND: 'object',
      LINZIGHT_OBJECT_BUCKET: 'smoke-bucket',
      LINZIGHT_OBJECT_PREFIX: 'rws-edc-smoke',
      LINZIGHT_VIRUS_SCAN_PROVIDER: 'clamav',
      LINZIGHT_VIRUS_SCAN_ENDPOINT: 'tcp://clamav-smoke:3310',
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
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
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

function apiFieldTypeToSchemaType(type) {
  if (type === 'Number') return 'number';
  if (type === 'Dropdown') return 'select';
  if (type === 'Boolean') return 'boolean';
  return 'text';
}

function crfFieldsToSchema(fields, version = 'smoke-draft') {
  const sections = [];
  const byModule = new Map();
  for (const field of fields) {
    const module = field.module || 'CRF';
    if (!byModule.has(module)) {
      const section = {
        id: `section-${byModule.size + 1}`,
        title: module,
        fields: [],
      };
      byModule.set(module, section);
      sections.push(section);
    }
    byModule.get(module).fields.push({
      id: field.id,
      name: field.name,
      type: apiFieldTypeToSchemaType(field.type),
      status: field.status,
      options: Array.isArray(field.options) ? field.options : [],
      required: Boolean(field.required),
      validationRule: field.validation_rule || '',
      conditionalLogic: field.conditional_logic || '',
    });
  }
  sections.push({
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
  });
  return { version, sections };
}

async function runSmoke() {
  startServer();
  await waitForHealth();
  await request('/seed', { method: 'POST' });

  const configAdmin = await login('lung-config@demo.linzight');
  const crfAdmin = await login('crf-admin@demo.linzight');
  const crc = await login('lung-crc@demo.linzight');
  const lglCrc = await login('crc@demo.linzight');
  const pi = await login('lung-pi@demo.linzight');
  const dataManager = await login('lung-dm@demo.linzight');
  const lzDataManager = await login('lz-dm@demo.linzight');
  const lzAdmin = await login('admin@demo.linzight');

  assert(configAdmin.user.role === 'STUDY_CONFIG_ADMIN', 'config admin role mismatch');
  assert(crfAdmin.user.role === 'LZ_CRF_ADMIN', 'CRF admin role mismatch');
  assert(crc.user.role === 'STUDY_CRC', 'crc role mismatch');
  assert(!crc.access_token.startsWith('demo-token-'), 'auth token should not use the legacy demo-token format');
  const currentUser = await request('/auth/me', { token: crc.access_token });
  assert(currentUser.data.id === crc.user.id, 'auth/me should return the current signed-token user');
  await request('/auth/me', { expectedStatus: 401 });
  await request('/studies/LZXK-01/patients', { token: 'invalid-token', expectedStatus: 401 });

  const lungConfiguration = await request('/studies/LZXK-01/configuration', { token: crc.access_token });
  assert(lungConfiguration.data.study_id === 'LZXK-01', 'lung Study configuration should be scoped to LZXK-01');
  assert(lungConfiguration.data.disease_area === 'lung_cancer_resistance', 'lung Study configuration disease area mismatch');
  assert(lungConfiguration.data.active_crf_version_id === 'CRFV-LZXK-01-V1.0', 'lung Study configuration should bind published lung CRF');
  assert(lungConfiguration.data.consent_template === 'lung-cancer-rwd-consent-v1.0', 'lung Study configuration should bind lung consent template');
  assert(lungConfiguration.data.testing_profile.testing_project_id === 'TP-LUNG-RESIST-OMICS', 'lung Study configuration testing profile mismatch');
  assert(lungConfiguration.data.visit_plan.active_plan_codes.includes('V2'), 'lung Study configuration should expose active visit plan codes');
  await request('/studies/LGL-1111/configuration', { token: crc.access_token, expectedStatus: 403 });
  const adminConfigurations = await request('/study-configurations', { token: lzAdmin.access_token });
  assert(adminConfigurations.data.length >= 3, 'LZ_ADMIN should see all Study configurations');
  assert(adminConfigurations.data.every((row) => row.study_id && row.active_crf_version_id && row.consent_template), 'Study configuration rows must be complete');
  const smokeStudyId = `SMOKE-STUDY-${Date.now().toString().slice(-5)}`;
  const createdStudy = await request('/studies', {
    method: 'POST',
    token: lzAdmin.access_token,
    body: {
      id: smokeStudyId,
      code: smokeStudyId,
      name: 'Smoke Lifecycle Study',
      indication: 'smoke',
      phase: 'RWD',
      status: 'draft',
      owner_org: 'LinZight',
    },
  });
  assert(createdStudy.status === 201 && createdStudy.data.status === 'draft', 'LZ_ADMIN should create a draft Study');
  await request('/studies', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      id: `${smokeStudyId}-BLOCKED`,
      code: `${smokeStudyId}-BLOCKED`,
      name: 'Blocked Study',
      indication: 'smoke',
    },
    expectedStatus: 403,
  });
  const terminatedStudy = await request(`/studies/${smokeStudyId}`, {
    method: 'PATCH',
    token: lzAdmin.access_token,
    body: { status: 'terminated' },
  });
  assert(terminatedStudy.data.status === 'terminated', 'LZ_ADMIN should terminate a Study');
  await request(`/studies/${smokeStudyId}/patients`, {
    method: 'POST',
    token: lzAdmin.access_token,
    body: {
      study_id: smokeStudyId,
      name: `Smoke Terminated Patient ${Date.now()}`,
      hospital_no: `TERM-${Date.now()}`,
      sex: '女',
      age: 45,
      disease_type: 'NSCLC',
      organs: [],
      note: 'blocked',
      clinical_data: {},
    },
    expectedStatus: 409,
  });
  const deletedStudy = await request(`/studies/${smokeStudyId}`, { method: 'DELETE', token: lzAdmin.access_token });
  assert(deletedStudy.data.status === 'deleted', 'Study delete should soft-delete lifecycle status');

  await request('/patients', { token: lzAdmin.access_token, expectedStatus: 400 });
  const patients = await request('/studies/LZXK-01/patients', { token: crc.access_token });
  assert(patients.data.length > 0, 'LZXK-01 patients should be visible to lung CRC');
  assert(patients.data.every((patient) => patient.study_id === 'LZXK-01'), 'patient list leaked another study');
  await request('/studies/LGL-1111/patients', { token: crc.access_token, expectedStatus: 403 });
  const adminStudyPatientLists = await Promise.all(
    ['LGL-1111', 'RWD-NMO-2026', 'LZXK-01'].map((studyId) => request(`/studies/${studyId}/patients`, { token: lzAdmin.access_token }))
  );
  const adminPatients = { data: adminStudyPatientLists.flatMap((result) => result.data) };
  const adminPatientStudies = new Set(adminPatients.data.map((patient) => patient.study_id));
  assert(adminPatientStudies.size >= 3, 'LZ_ADMIN should see patients from each seeded Study through Study-scoped APIs');
  assert(adminPatients.data.every((patient) => patient.study_id && patient.id && patient.updated_at), 'admin patient views must use Study-scoped patient rows');
  const lglPatient = adminPatients.data.find((row) => row.study_id === 'LGL-1111');
  assert(lglPatient?.id, 'seeded admin view should include an LGL-1111 patient');
  const dataManagerPatients = await request('/studies/LZXK-01/patients', { token: dataManager.access_token });
  assert(dataManagerPatients.data.length > 0, 'data manager should see scoped patients');
  assert(dataManagerPatients.data[0].name.includes('**'), 'data manager patient name should be masked');
  assert(dataManagerPatients.data[0].hospital_no.includes('****'), 'data manager hospital number should be masked in API view');

  const patient = patients.data[0];
  const consentList = await request('/studies/LZXK-01/consents', { token: crc.access_token });
  const patientConsent = consentList.data.find((consent) => consent.patient_id === patient.id) ?? consentList.data[0];
  assert(patientConsent?.study_id === 'LZXK-01', 'consent list should stay in LZXK-01');
  assert(consentList.data.every((consent) => consent.study_id === 'LZXK-01'), 'consent list leaked another study');
  await request('/studies/LGL-1111/consents', { token: crc.access_token, expectedStatus: 403 });
  const consentFile = await uploadConsentFile(crc.access_token, patientConsent.id, patientConsent.patient_id);
  assert(consentFile.category === 'consent', 'uploaded consent file should use consent category');
  assert(consentFile.consent_id === patientConsent.id, 'uploaded consent file should link consent_id');
  assert(consentFile.scan_status === 'clean', 'uploaded consent file should be scanner-clean');
  assert(consentFile.storage_backend === 'object', 'file upload should use configured object storage adapter');
  assert(consentFile.storage_path.startsWith('object://smoke-bucket/'), 'object storage path should use object URI');
  assert(consentFile.scan_message.includes('clamav'), 'file upload should use configured virus scanner adapter');
  const scopedFiles = await request('/studies/LZXK-01/files', { token: crc.access_token });
  assert(scopedFiles.data.some((row) => row.id === consentFile.id), 'scoped file list should include uploaded consent file');
  assert(scopedFiles.data.every((row) => row.study_id === 'LZXK-01'), 'file list leaked another study');
  await request('/studies/LGL-1111/files', { token: crc.access_token, expectedStatus: 403 });
  await downloadBlob(`/files/${consentFile.id}/download`, crc.access_token);
  await downloadBlob(`/files/${consentFile.id}/download`, lglCrc.access_token, 403);
  const lglSamplesForMismatch = await request('/studies/LGL-1111/samples', { token: lzAdmin.access_token });
  const lglSampleForMismatch = lglSamplesForMismatch.data[0];
  assert(lglSampleForMismatch?.study_id === 'LGL-1111', 'LGL sample required for file mismatch smoke');
  const mismatchedFileBody = new globalThis.FormData();
  mismatchedFileBody.append('category', 'consent');
  mismatchedFileBody.append('patient_id', patient.id);
  mismatchedFileBody.append('sample_id', lglSampleForMismatch.id);
  mismatchedFileBody.append('is_deidentified', 'false');
  mismatchedFileBody.append('file', new globalThis.Blob(['mismatched file'], { type: 'application/pdf' }), 'mismatched-file.pdf');
  const mismatchedFileResponse = await fetch(`${baseUrl}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${lzAdmin.access_token}` },
    body: mismatchedFileBody,
  });
  const mismatchedFileRaw = await mismatchedFileResponse.text();
  assert(mismatchedFileResponse.status === 400, `mismatched linked file expected 400, got ${mismatchedFileResponse.status}: ${mismatchedFileRaw}`);
  const archivedConsentFile = await request(`/files/${consentFile.id}/archive`, {
    method: 'POST',
    token: crc.access_token,
  });
  assert(archivedConsentFile.data.archive_status === 'archived', 'file archive should persist archived status');
  await downloadBlob(`/files/${consentFile.id}/download`, crc.access_token, 409);
  const consentWithdrawal = await request(`/consents/${patientConsent.id}/withdrawal-request`, {
    method: 'POST',
    token: crc.access_token,
    body: { comment: 'Smoke withdrawal request' },
  });
  assert(consentWithdrawal.status === 201, 'eConsent withdrawal approval request should return 201');
  assert(consentWithdrawal.data.approval_type === 'econsent_withdrawal', 'eConsent withdrawal approval type mismatch');
  const consentPendingWithdrawal = await request(`/studies/LZXK-01/consents`, { token: crc.access_token });
  assert(consentPendingWithdrawal.data.find((row) => row.id === patientConsent.id)?.status === '撤回审批中', 'withdrawal request should set pending consent status');
  await request(`/approvals/${consentWithdrawal.data.id}/approve`, {
    method: 'POST',
    token: crc.access_token,
    body: { comment: 'Requester should not self-approve eConsent withdrawal' },
    expectedStatus: 400,
  });
  const approvedConsentWithdrawal = await request(`/approvals/${consentWithdrawal.data.id}/approve`, {
    method: 'POST',
    token: lzAdmin.access_token,
    body: { comment: 'Approved eConsent withdrawal' },
  });
  assert(approvedConsentWithdrawal.data.status === 'approved', 'eConsent withdrawal should approve');
  const completedConsentWithdrawal = await request(`/approvals/${consentWithdrawal.data.id}/complete`, {
    method: 'POST',
    token: lzAdmin.access_token,
    body: { comment: 'Applied eConsent withdrawal' },
  });
  assert(completedConsentWithdrawal.data.status === 'completed', 'eConsent withdrawal should complete');
  const consentAfterWithdrawal = await request(`/studies/LZXK-01/consents`, { token: crc.access_token });
  const withdrawnConsent = consentAfterWithdrawal.data.find((row) => row.id === patientConsent.id);
  assert(withdrawnConsent?.status === '已撤回', 'completed eConsent withdrawal should update consent status');
  const consentResign = await request(`/consents/${patientConsent.id}/resign-request`, {
    method: 'POST',
    token: crc.access_token,
    body: { comment: 'Smoke re-sign request' },
  });
  assert(consentResign.data.approval_type === 'econsent_resign', 'eConsent re-sign approval type mismatch');
  const consentPendingResign = await request(`/studies/LZXK-01/consents`, { token: crc.access_token });
  assert(consentPendingResign.data.find((row) => row.id === patientConsent.id)?.status === '重签审批中', 're-sign request should set pending consent status');
  await request(`/approvals/${consentResign.data.id}/approve`, {
    method: 'POST',
    token: lzAdmin.access_token,
    body: { comment: 'Approved eConsent re-sign' },
  });
  await request(`/approvals/${consentResign.data.id}/complete`, {
    method: 'POST',
    token: lzAdmin.access_token,
    body: { comment: 'Applied eConsent re-sign' },
  });
  const consentAfterResign = await request(`/studies/LZXK-01/consents`, { token: crc.access_token });
  assert(consentAfterResign.data.find((row) => row.id === patientConsent.id)?.status === '已重签', 'completed eConsent re-sign should update consent status');

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
  const updatedUser = await request(`/users/${createdUser.data.id}?study_id=LZXK-01`, {
    method: 'PATCH',
    token: configAdmin.access_token,
    body: { display_name: 'Smoke CRC Updated' },
  });
  assert(updatedUser.data.display_name === 'Smoke CRC Updated', 'Study config admin should update a Study member display name');
  const promotedMember = await request('/studies/LZXK-01/members', {
    method: 'POST',
    token: lzAdmin.access_token,
    body: { user_id: createdUser.data.id, study_role: 'STUDY_CONFIG_ADMIN', status: 'active' },
  });
  assert(promotedMember.data.study_role === 'STUDY_CONFIG_ADMIN', 'LZ_ADMIN should assign Study system admin role');
  const scopedUsers = await request('/users?study_id=LZXK-01', { token: lzAdmin.access_token });
  assert(scopedUsers.data.some((user) => user.id === createdUser.data.id), 'Study user list should include newly created member');
  const scopedPlatformUser = await request(`/users/${lzDataManager.user.id}/study-scope`, {
    method: 'PATCH',
    token: lzAdmin.access_token,
    body: { study_ids: ['LZXK-01'] },
  });
  assert(scopedPlatformUser.data.study_scope.studyIds.includes('LZXK-01'), 'LZ_ADMIN should update platform role Study scope');
  await request('/studies/RWD-NMO-2026/patients', { token: lzDataManager.access_token, expectedStatus: 403 });
  await request('/studies/LZXK-01/patients', { token: lzDataManager.access_token });
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

  const site = await request('/studies/LZXK-01/sites', {
    method: 'POST',
    token: configAdmin.access_token,
    body: { code: `SMK-${Date.now().toString().slice(-4)}`, name: 'Smoke Site', status: 'active' },
  });
  assert(site.status === 201, 'site create should return 201');
  assert(site.data.study_id === 'LZXK-01', 'site should stay scoped to LZXK-01');
  const siteAssignment = await request(`/studies/LZXK-01/sites/${site.data.id}/users`, {
    method: 'POST',
    token: configAdmin.access_token,
    body: { user_id: crc.user.id, role: 'site_crc', status: 'active' },
  });
  assert(siteAssignment.data.site_id === site.data.id, 'site user assignment should link site');
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
      password: 'Demo1234!',
      study_id: 'LZXK-01',
    },
    expectedStatus: 403,
  });

  const crfFields = await request('/studies/LZXK-01/crf-fields', { token: configAdmin.access_token });
  assert(crfFields.data.length === 15, 'LZXK-01 CRF fields should be the standalone lung CRF schema');
  assert(crfFields.data.every((field) => field.study_id === 'LZXK-01'), 'CRF field list leaked another study');
  assert(crfFields.data.some((field) => field.id === 'LUNG-015'), 'expected lung CRF field LUNG-015');

  const updatedField = await request('/studies/LZXK-01/crf-fields/LUNG-007', {
    method: 'PUT',
    token: configAdmin.access_token,
    body: {
      name: '治疗线数',
      type: 'Number',
      module: '肺癌治疗与耐药评估',
      status: '启用',
      options: [],
      required: true,
      validation_rule: 'integer >= 1',
      conditional_logic: 'line_of_therapy >= 1',
    },
  });
  assert(updatedField.data.id === 'LUNG-007', 'CRF update returned wrong field');
  assert(updatedField.data.required === true, 'CRF required flag should persist');
  assert(updatedField.data.validation_rule === 'integer >= 1', 'CRF validation rule should persist');
  assert(updatedField.data.conditional_logic === 'line_of_therapy >= 1', 'CRF conditional logic should persist');
  const lungSchemaWithSmokeField = crfFieldsToSchema(
    crfFields.data.map((field) => (field.id === updatedField.data.id ? updatedField.data : field)),
  );
  const migrationPreview = await request('/studies/LZXK-01/crf-versions/migration-preview', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      schema: { ...lungSchemaWithSmokeField, version: 'smoke-preview' },
    },
  });
  assert(migrationPreview.data.summary.added >= 1, 'migration preview should report added fields');
  assert(migrationPreview.data.summary.removed === 0, 'migration preview should preserve existing lung CRF fields');
  const draftVersion = await request('/studies/LZXK-01/crf-versions', {
    method: 'POST',
    token: configAdmin.access_token,
    body: {
      version: `V1.${Date.now()}`,
      status: 'draft',
      schema: lungSchemaWithSmokeField,
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
  const scopedCrfEntries = await request('/studies/LZXK-01/crf', { token: crc.access_token });
  assert(scopedCrfEntries.data.length > 0, 'scoped CRF entries should not be empty');
  assert(scopedCrfEntries.data.every((row) => row.study_id === 'LZXK-01'), 'CRF entry list leaked another study');
  await request('/studies/LGL-1111/crf', { token: crc.access_token, expectedStatus: 403 });
  await request('/studies/LGL-1111/crf', {
    method: 'POST',
    token: crc.access_token,
    body: {
      patient_id: lglPatient.id,
      module: 'baseline',
      form_id: 'baseline',
      payload: { smoke: true },
      status: 'draft',
    },
    expectedStatus: 403,
  });
  await request('/studies/LZXK-01/crf-fields/LUNG-007', {
    method: 'PUT',
    token: crc.access_token,
    body: { status: '停用' },
    expectedStatus: 403,
  });

  const sample = await request('/studies/LZXK-01/samples', {
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
  const scopedSamples = await request('/studies/LZXK-01/samples', { token: crc.access_token });
  assert(scopedSamples.data.length > 0, 'scoped sample list should not be empty');
  assert(scopedSamples.data.every((row) => row.study_id === 'LZXK-01'), 'sample list leaked another study');
  await request('/studies/LGL-1111/samples', { token: crc.access_token, expectedStatus: 403 });
  await request('/studies/LGL-1111/samples', {
    method: 'POST',
    token: crc.access_token,
    body: {
      patient_id: lglPatient.id,
      patient_name: lglPatient.name,
      hospital_no: lglPatient.hospital_no,
      sample_type: '血液',
      visit: 'V1',
      collected_at: '2026-05-11',
      storage: 'A-01',
      status: '已采集',
      linked_omics: [],
    },
    expectedStatus: 403,
  });

  const omics = await request('/studies/LZXK-01/omics', {
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
  const scopedOmics = await request('/studies/LZXK-01/omics', { token: crc.access_token });
  assert(scopedOmics.data.length > 0, 'scoped omics list should not be empty');
  assert(scopedOmics.data.every((row) => row.study_id === 'LZXK-01'), 'omics list leaked another study');
  await request('/studies/LGL-1111/omics', { token: crc.access_token, expectedStatus: 403 });

  const query = await request('/queries', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: 'LZXK-01',
      patient_id: patient.id,
      form_id: 'baseline',
      field_name: '治疗线数',
      title: 'Smoke query',
      description: 'Please verify treatment line value.',
      assigned_to: crc.user.id,
    },
  });
  assert(query.status === 201, 'query create should return 201');
  const scopedQueries = await request('/studies/LZXK-01/queries', { token: dataManager.access_token });
  assert(scopedQueries.data.some((row) => row.id === query.data.id), 'scoped query list should include created query');
  assert(scopedQueries.data.every((row) => row.study_id === 'LZXK-01'), 'query list leaked another study');
  await request('/studies/LGL-1111/queries', { token: dataManager.access_token, expectedStatus: 403 });
  await request(`/queries?patient_id=${encodeURIComponent(lglPatient.id)}`, { token: dataManager.access_token, expectedStatus: 400 });
  await request('/queries', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: 'LGL-1111',
      patient_id: lglPatient.id,
      form_id: 'baseline',
      field_name: 'data_completeness',
      title: 'Blocked cross-study query',
    },
    expectedStatus: 403,
  });
  await request('/queries', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: 'LZXK-01',
      patient_id: patient.id,
      form_id: 'baseline',
      field_name: 'SLEDAI评分',
      title: 'Invalid lung CRF field query',
    },
    expectedStatus: 400,
  });
  const answeredQuery = await request(`/queries/${query.data.id}`, {
    method: 'PUT',
    token: dataManager.access_token,
    body: { status: 'answered', response: 'Verified in source record.' },
  });
  assert(answeredQuery.data.status === 'answered', 'query should be answerable');
  const closedQuery = await request(`/queries/${query.data.id}`, {
    method: 'PUT',
    token: dataManager.access_token,
    body: { status: 'closed' },
  });
  assert(closedQuery.data.closed_at, 'closed query should set closed_at');
  const reopenedQuery = await request(`/queries/${query.data.id}`, {
    method: 'PUT',
    token: dataManager.access_token,
    body: { status: 'open', response: 'Reopened for source verification.' },
  });
  assert(reopenedQuery.data.status === 'open' && !reopenedQuery.data.closed_at, 'reopened query should clear closed_at');
  const filteredQueries = await request(`/studies/LZXK-01/queries?status=open&field_name=${encodeURIComponent('治疗线数')}&assigned_to=${encodeURIComponent(crc.user.id)}`, { token: dataManager.access_token });
  assert(filteredQueries.data.some((row) => row.id === query.data.id), 'query filters should find reopened query by status, field, and assignee');
  const visits = await request(`/studies/LZXK-01/visits?patient_id=${encodeURIComponent(patient.id)}`, { token: dataManager.access_token });
  const plannedFollowUpVisit = visits.data.find((visit) => visit.visit_plan_code === 'V2') ?? visits.data.find((visit) => visit.visit_plan_id);
  assert(plannedFollowUpVisit, 'planned visit required for visit-window smoke');
  const shiftedVisit = await request(`/visits/${plannedFollowUpVisit.id}`, {
    method: 'PUT',
    token: configAdmin.access_token,
    body: { visit_date: '2027-12-31' },
  });
  assert(shiftedVisit.data.visit_date === '2027-12-31', 'visit update should persist date for window smoke');
  const qualityResult = await request('/studies/LZXK-01/quality/run', { method: 'POST', token: dataManager.access_token });
  assert(qualityResult.data.status === 'completed', 'quality run should complete for scoped data manager');
  const qualityIssues = await request('/studies/LZXK-01/quality/issues', { token: dataManager.access_token });
  assert(qualityIssues.data.every((row) => row.study_id === 'LZXK-01'), 'quality issue list leaked another study');
  assert(qualityIssues.data.some((row) => row.source_table === 'visits' && row.field_name === 'visit_date'), 'visit-window quality issue should be generated');
  const visitWindowIssue = qualityIssues.data.find((row) => row.source_table === 'visits' && row.field_name === 'visit_date');
  const visitDateQuery = await request('/queries', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: visitWindowIssue.study_id,
      patient_id: visitWindowIssue.patient_id,
      visit_id: visitWindowIssue.source_id,
      form_id: 'visits',
      field_name: 'visit_date',
      title: 'Visit window query',
      description: visitWindowIssue.message,
      assigned_to: crc.user.id,
    },
  });
  assert(visitDateQuery.status === 201, 'visit_date quality issue should be convertible to a Query');
  await request('/studies/LGL-1111/quality/run', { method: 'POST', token: dataManager.access_token, expectedStatus: 403 });
  await request('/studies/LGL-1111/quality/issues', { token: dataManager.access_token, expectedStatus: 403 });

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
  const scopedExports = await request('/studies/LZXK-01/exports', { token: dataManager.access_token });
  assert(scopedExports.data.some((row) => row.id === exportJob.data.id), 'scoped export list should include created export');
  assert(scopedExports.data.every((row) => row.study_id === 'LZXK-01'), 'export list leaked another study');
  await request('/studies/LGL-1111/exports', { token: dataManager.access_token, expectedStatus: 403 });
  await request('/exports', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      export_type: 'patients',
      scope: { study_id: 'LGL-1111' },
      requested_by: dataManager.user.id,
    },
    expectedStatus: 403,
  });
  const exportedCsv = await downloadText(`/exports/${exportJob.data.id}/download`, dataManager.access_token);
  const exportedFirstDataRow = exportedCsv.trim().split('\n')[1].split(',');
  assert(exportedFirstDataRow[2] === '' && exportedFirstDataRow[3] === '', 'data manager export should remove direct identifiers');
  const fieldPermissions = await request('/field-permissions?resource=patients', { token: dataManager.access_token });
  assert(fieldPermissions.data.every((item) => item.role === 'STUDY_DATA_MANAGER'), 'non-admin field permissions response should be role-scoped');
  assert(fieldPermissions.data.some((item) => item.field_name === 'name' && item.mask_rule === 'name'), 'field permissions should expose patient name masking rule');
  const permissionMatrix = await request('/permissions/matrix', { token: lzAdmin.access_token });
  const matrixByOperation = new Map(permissionMatrix.data.map((row) => [row.operation, row]));
  assert(matrixByOperation.get('Create or update patient records')?.allowed_roles.includes('STUDY_CRC'), 'permission matrix should allow STUDY_CRC patient writes');
  assert(!matrixByOperation.get('Create or update patient records')?.allowed_roles.includes('STUDY_PI'), 'permission matrix should block STUDY_PI patient writes');
  assert(matrixByOperation.get('Configure CRF versions, fields, visit plans, and sites')?.allowed_roles.includes('STUDY_CONFIG_ADMIN'), 'permission matrix should allow Study config admin CRF config writes');
  assert(matrixByOperation.get('Export and download data')?.allowed_roles.includes('STUDY_DATA_MANAGER'), 'permission matrix should allow Study data manager exports');
  assert(matrixByOperation.get('Read audit logs')?.allowed_roles.includes('LZ_AUDITOR'), 'permission matrix should allow auditors to read audit logs');

  const exportApproval = await request('/approvals', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: 'LZXK-01',
      approval_type: 'export',
      entity_type: 'export_jobs',
      entity_id: exportJob.data.id,
      payload: { export_id: exportJob.data.id, export_type: 'patients' },
      comment: 'Smoke export approval',
      submit: true,
    },
  });
  assert(exportApproval.status === 201, 'export approval create should return 201');
  assert(exportApproval.data.status === 'submitted', 'approval should start submitted');
  const scopedApprovals = await request('/studies/LZXK-01/approvals', { token: dataManager.access_token });
  assert(scopedApprovals.data.some((row) => row.id === exportApproval.data.id), 'scoped approvals should include export approval');
  assert(scopedApprovals.data.every((row) => row.study_id === 'LZXK-01'), 'approval list leaked another study');
  await request('/studies/LGL-1111/approvals', { token: dataManager.access_token, expectedStatus: 403 });
  await request('/approvals', {
    method: 'POST',
    token: dataManager.access_token,
    body: {
      study_id: 'LGL-1111',
      approval_type: 'export',
      entity_type: 'export_jobs',
      entity_id: exportJob.data.id,
      payload: { export_id: exportJob.data.id, export_type: 'patients' },
      comment: 'Blocked cross-study export approval',
      submit: true,
    },
    expectedStatus: 403,
  });
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

  const audits = await request('/studies/LZXK-01/audit-logs?entity_type=study_crf_versions', { token: configAdmin.access_token });
  assert(audits.data.some((entry) => entry.action === 'update_crf_field'), 'CRF update audit log missing');
  const crfFieldAudit = audits.data.find((entry) => entry.action === 'update_crf_field');
  assert(Array.isArray(crfFieldAudit?.diff) && crfFieldAudit.diff.some((change) => change.field === 'required'), 'audit log should include structured before/after diff');
  assert(audits.data.every((entry) => entry.study_id === 'LZXK-01'), 'audit log list leaked another study');
  const dataManagerAudits = await request('/studies/LZXK-01/audit-logs', { token: dataManager.access_token });
  assert(dataManagerAudits.data.every((entry) => entry.study_id === 'LZXK-01'), 'data manager audit list leaked another study');
  await request('/studies/LGL-1111/audit-logs', { token: dataManager.access_token, expectedStatus: 403 });
  await request('/audit-logs', { token: lzAdmin.access_token, expectedStatus: 400 });
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
} catch (error) {
  if (stderr) {
    process.stderr.write(`${stderr}\n`);
  }
  throw error;
} finally {
  await stopServer();
  rmSync(tempDir, { recursive: true, force: true });
}
