import type { ConsentRecord, FollowUpRecord, OmicsRecord, SampleRecord, StudyVisitPlanRecord, VisitRecord } from '../data/operations';
import { activeStudyStorageKey, authStorageKey, normalizeAuthenticatedUser, roleLabels, userCanAccessStudy, type AuthenticatedUser } from '../data/auth';
import type { OmicsStatus, PatientRecord, SampleCollection } from '../data/patientCohort';
import type {
  ApiAnalysisSummary,
  ApiApprovalRequest,
  ApiAuditLog,
  ApiConsent,
  ApiCrfEntry,
  ApiCrfMigrationApproval,
  ApiDataQuery,
  ApiExportJob,
  ApiFileMetadata,
  ApiFollowUpRecord,
  ApiLoginResponse,
  ApiOmics,
  ApiPanorama,
  ApiPasswordResetConfirm,
  ApiPasswordResetRequest,
  ApiPatient,
  ApiPermissionMatrixRow,
  ApiQualityIssue,
  ApiSample,
  ApiCrfMigrationPreview,
  ApiSiteUser,
  ApiStudyConfiguration,
  ApiStudyCrfField,
  ApiStudyCrfVersion,
  ApiStudy,
  ApiStudyCreate,
  ApiStudyMember,
  ApiStudySite,
  ApiStudyUpdate,
  ApiStudyVisitPlan,
  ApiUser,
  ApiUserCreate,
  ApiUserStatusUpdate,
  ApiUserUpdate,
  ApiVisit
} from './contracts';

export type DemoDataset = {
  patients: PatientRecord[];
  samples: SampleRecord[];
  omics: OmicsRecord[];
  visits: VisitRecord[];
  followUps: FollowUpRecord[];
};

export type StudyCrfFieldRecord = {
  studyId: string;
  crfVersionId?: string;
  crfVersion?: string;
  id: string;
  name: string;
  type: ApiStudyCrfField['type'];
  module: string;
  updatedAt: string;
  status: ApiStudyCrfField['status'];
  options: string[];
  required: boolean;
  validationRule: string;
  conditionalLogic: string;
};

export type StudyCrfVersionRecord = {
  id: string;
  studyId: string;
  version: string;
  status: ApiStudyCrfVersion['status'];
  changeSummary: string;
  publishedAt?: string | null;
  updatedAt: string;
  schema: Record<string, unknown>;
};

export type CrfMigrationPreview = ApiCrfMigrationPreview;

export type CrfMigrationApprovalRecord = {
  id: string;
  studyId: string;
  sourceVersionId: string;
  targetVersionId: string;
  status: ApiCrfMigrationApproval['status'];
  preview: ApiCrfMigrationApproval['preview'];
  note: string;
  requestedBy?: string | null;
  approvedBy?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
  appliedAt?: string | null;
  updatedAt: string;
  executionLogs: NonNullable<ApiCrfMigrationApproval['execution_logs']>;
};

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBases = Array.from(new Set([configuredBase, 'http://127.0.0.1:8000', 'http://127.0.0.1:8001'].filter(Boolean))) as string[];
export const authTokenStorageKey = 'linzight-auth-token';
type FetchInit = Parameters<typeof window.fetch>[1];

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export function isPermissionError(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

async function postJson<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

async function putJson<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

async function requestJson<T>(path: string, init?: FetchInit, timeoutMs = 900): Promise<T> {
  let lastError: unknown;

  for (const base of apiBases) {
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = new window.Headers(init?.headers);
      const token = window.localStorage.getItem(authTokenStorageKey);
      if (token && !headers.has('Authorization') && path !== '/auth/login') {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const response = await window.fetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const error = new ApiRequestError(response.status, `${response.status} ${response.statusText}${detail ? ` ${detail}` : ''}`);
        if (response.status === 401 || response.status === 403) throw error;
        throw error;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (isPermissionError(error)) throw error;
      lastError = error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed');
}

export async function loginWithBackend(username: string, password: string): Promise<AuthenticatedUser> {
  const response = await postJson<ApiLoginResponse>('/auth/login', { username, password });
  window.localStorage.removeItem('linzight-demo-token');
  window.localStorage.setItem(authTokenStorageKey, response.access_token);
  const initials = response.user.display_name
    .split('')
    .filter((char) => /[A-Za-z\u4e00-\u9fa5]/.test(char))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const normalizedUser = normalizeAuthenticatedUser({
    id: response.user.id,
    username: response.user.username,
    name: response.user.display_name,
    role: response.user.role,
    roleLabel: roleLabels[response.user.role] ?? String(response.user.role),
    studyScope: response.user.study_scope ?? { scopeType: 'own_studies', studyIds: ['LGL-1111'] },
    studyMemberships: response.user.study_memberships ?? [],
    initials
  });
  if (normalizedUser) return normalizedUser;
  return {
    id: response.user.id,
    username: response.user.username,
    name: response.user.display_name,
    role: 'STUDY_PI',
    roleLabel: roleLabels.STUDY_PI,
    studyScope: response.user.study_scope ?? { scopeType: 'own_studies', studyIds: ['LGL-1111'] },
    studyMemberships: response.user.study_memberships ?? [],
    initials
  };
}

export async function requestPasswordReset(payload: ApiPasswordResetRequest): Promise<{ status: string; email: string }> {
  return requestJson<{ status: string; email: string }>(
    '/auth/password-reset/request',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    15000
  );
}

export async function confirmPasswordReset(payload: ApiPasswordResetConfirm): Promise<{ status: string }> {
  return postJson<{ status: string }>('/auth/password-reset/confirm', payload);
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser> {
  const response = await getJson<ApiUser>('/auth/me');
  const initials = response.display_name
    .split('')
    .filter((char) => /[A-Za-z\u4e00-\u9fa5]/.test(char))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const normalizedUser = normalizeAuthenticatedUser({
    id: response.id,
    username: response.username,
    name: response.display_name,
    role: response.role,
    roleLabel: roleLabels[response.role] ?? String(response.role),
    studyScope: response.study_scope ?? { scopeType: 'own_studies', studyIds: ['LGL-1111'] },
    studyMemberships: response.study_memberships ?? [],
    initials
  });
  if (!normalizedUser) throw new Error('invalid current user response');
  return normalizedUser;
}

export async function logoutFromBackend(): Promise<void> {
  await postJson<{ status: string }>('/auth/logout', {});
}

export async function uploadFileToBackend(
  file: globalThis.File,
  metadata: {
    category: ApiFileMetadata['category'];
    patientId?: string;
    sampleId?: string;
    omicsId?: string;
    consentId?: string;
    isDeidentified?: boolean;
  }
): Promise<ApiFileMetadata> {
  const formData = new window.FormData();
  formData.append('file', file);
  formData.append('category', metadata.category);
  formData.append('is_deidentified', metadata.isDeidentified ? 'true' : 'false');
  if (metadata.patientId) formData.append('patient_id', metadata.patientId);
  if (metadata.sampleId) formData.append('sample_id', metadata.sampleId);
  if (metadata.omicsId) formData.append('omics_id', metadata.omicsId);
  if (metadata.consentId) formData.append('consent_id', metadata.consentId);

  const token = window.localStorage.getItem(authTokenStorageKey);
  return requestJson<ApiFileMetadata>('/files', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });
}

export async function createExportJob(exportType = 'cohort_csv', studyId = getCurrentScopedStudyId()): Promise<ApiExportJob> {
  const scopedStudyId = studyId ?? getCurrentScopedStudyId();
  if (!scopedStudyId) throw new ApiRequestError(400, 'Study Workspace is required for exports');
  const token = window.localStorage.getItem(authTokenStorageKey);
  return postJson<ApiExportJob>(
    '/exports',
    {
      export_type: exportType,
      scope: { study_id: scopedStudyId },
      requested_by: null
    },
    token ? { Authorization: `Bearer ${token}` } : undefined
  );
}

export async function fetchApprovalRequests(studyId = getCurrentScopedStudyId()): Promise<ApiApprovalRequest[]> {
  return getJson<ApiApprovalRequest[]>(studyBusinessPath(studyId, 'approvals'));
}

export async function createApprovalRequest(payload: {
  study_id: string;
  approval_type: ApiApprovalRequest['approval_type'];
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  comment?: string;
  submit?: boolean;
}): Promise<ApiApprovalRequest> {
  return postJson<ApiApprovalRequest>('/approvals', payload);
}

export async function approveApprovalRequest(approvalId: string, comment = ''): Promise<ApiApprovalRequest> {
  return postJson<ApiApprovalRequest>(`/approvals/${encodeURIComponent(approvalId)}/approve`, { comment });
}

export async function rejectApprovalRequest(approvalId: string, comment = ''): Promise<ApiApprovalRequest> {
  return postJson<ApiApprovalRequest>(`/approvals/${encodeURIComponent(approvalId)}/reject`, { comment });
}

export async function completeApprovalRequest(approvalId: string, comment = ''): Promise<ApiApprovalRequest> {
  return postJson<ApiApprovalRequest>(`/approvals/${encodeURIComponent(approvalId)}/complete`, { comment });
}

export async function requestConsentWithdrawal(consentId: string, comment = ''): Promise<ApiApprovalRequest> {
  return postJson<ApiApprovalRequest>(`/consents/${encodeURIComponent(consentId)}/withdrawal-request`, { comment });
}

export async function requestConsentResign(consentId: string, comment = ''): Promise<ApiApprovalRequest> {
  return postJson<ApiApprovalRequest>(`/consents/${encodeURIComponent(consentId)}/resign-request`, { comment });
}

export async function downloadExportJob(job: ApiExportJob): Promise<void> {
  const token = window.localStorage.getItem(authTokenStorageKey);
  const response = await window.fetch(`${apiBases[0]}/exports/${encodeURIComponent(job.id)}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `${job.study_id}-${job.export_type}-${job.id}.csv`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function toStudyVisitPlanRecord(plan: ApiStudyVisitPlan): StudyVisitPlanRecord {
  return {
    id: plan.id,
    studyId: plan.study_id,
    code: plan.code,
    name: plan.name,
    visitType: plan.visit_type,
    dayOffset: plan.day_offset,
    windowBeforeDays: plan.window_before_days,
    windowAfterDays: plan.window_after_days,
    requiredForms: plan.required_forms,
    requiredSamples: plan.required_samples,
    status: plan.status,
    sortOrder: plan.sort_order
  };
}

function toStudyCrfFieldRecord(field: ApiStudyCrfField): StudyCrfFieldRecord {
  return {
    studyId: field.study_id,
    crfVersionId: field.crf_version_id,
    crfVersion: field.crf_version,
    id: field.id,
    name: field.name,
    type: field.type,
    module: field.module,
    updatedAt: field.updated_at.slice(0, 10),
    status: field.status,
    options: field.options ?? [],
    required: Boolean(field.required),
    validationRule: field.validation_rule ?? '',
    conditionalLogic: field.conditional_logic ?? ''
  };
}

function toStudyCrfVersionRecord(version: ApiStudyCrfVersion): StudyCrfVersionRecord {
  return {
    id: version.id,
    studyId: version.study_id,
    version: version.version,
    status: version.status,
    changeSummary: version.change_summary,
    publishedAt: version.published_at,
    updatedAt: version.updated_at.slice(0, 10),
    schema: version.schema
  };
}

function toCrfMigrationApprovalRecord(record: ApiCrfMigrationApproval): CrfMigrationApprovalRecord {
  return {
    id: record.id,
    studyId: record.study_id,
    sourceVersionId: record.source_version_id,
    targetVersionId: record.target_version_id,
    status: record.status,
    preview: record.preview,
    note: record.note,
    requestedBy: record.requested_by,
    approvedBy: record.approved_by,
    requestedAt: record.requested_at,
    reviewedAt: record.reviewed_at,
    appliedAt: record.applied_at,
    updatedAt: record.updated_at.slice(0, 10),
    executionLogs: record.execution_logs ?? []
  };
}

export async function fetchStudyVisitPlans(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<StudyVisitPlanRecord[]> {
  return (await getJson<ApiStudyVisitPlan[]>(`/studies/${encodeURIComponent(studyId)}/visit-plans`)).map(toStudyVisitPlanRecord);
}

export async function fetchStudyConfiguration(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<ApiStudyConfiguration> {
  return getJson<ApiStudyConfiguration>(`/studies/${encodeURIComponent(studyId)}/configuration`);
}

export async function fetchStudies(): Promise<ApiStudy[]> {
  return getJson<ApiStudy[]>('/studies');
}

export async function createStudy(payload: ApiStudyCreate): Promise<ApiStudy> {
  return postJson<ApiStudy>('/studies', payload);
}

export async function updateStudy(studyId: string, payload: ApiStudyUpdate): Promise<ApiStudy> {
  return requestJson<ApiStudy>(`/studies/${encodeURIComponent(studyId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteStudy(studyId: string): Promise<ApiStudy> {
  return requestJson<ApiStudy>(`/studies/${encodeURIComponent(studyId)}`, {
    method: 'DELETE'
  });
}

export async function fetchStudyConfigurations(studyId?: string): Promise<ApiStudyConfiguration[]> {
  const query = studyId ? `?study_id=${encodeURIComponent(studyId)}` : '';
  return getJson<ApiStudyConfiguration[]>(`/study-configurations${query}`);
}

export async function createStudyVisitPlan(plan: StudyVisitPlanRecord): Promise<StudyVisitPlanRecord> {
  const response = await postJson<ApiStudyVisitPlan>(`/studies/${encodeURIComponent(plan.studyId)}/visit-plans`, {
    id: plan.id.startsWith('LOCAL-VP-') ? undefined : plan.id,
    code: plan.code,
    name: plan.name,
    visit_type: plan.visitType,
    day_offset: plan.dayOffset,
    window_before_days: plan.windowBeforeDays,
    window_after_days: plan.windowAfterDays,
    required_forms: plan.requiredForms,
    required_samples: plan.requiredSamples,
    status: plan.status,
    sort_order: plan.sortOrder
  });
  return toStudyVisitPlanRecord(response);
}

export async function fetchStudyMembers(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<ApiStudyMember[]> {
  return getJson<ApiStudyMember[]>(`/studies/${encodeURIComponent(studyId)}/members`);
}

export async function fetchStudySites(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<ApiStudySite[]> {
  return getJson<ApiStudySite[]>(`/studies/${encodeURIComponent(studyId)}/sites`);
}

export async function createStudySite(
  studyId: string,
  payload: { code: string; name: string; status?: ApiStudySite['status'] }
): Promise<ApiStudySite> {
  return postJson<ApiStudySite>(`/studies/${encodeURIComponent(studyId)}/sites`, {
    code: payload.code,
    name: payload.name,
    status: payload.status ?? 'active'
  });
}

export async function assignStudySiteUser(
  studyId: string,
  siteId: string,
  payload: { userId: string; role: string; status?: ApiSiteUser['status'] }
): Promise<ApiSiteUser> {
  return postJson<ApiSiteUser>(`/studies/${encodeURIComponent(studyId)}/sites/${encodeURIComponent(siteId)}/users`, {
    user_id: payload.userId,
    role: payload.role,
    status: payload.status ?? 'active'
  });
}

export async function fetchDataQueries(studyId = getCurrentScopedStudyId()): Promise<ApiDataQuery[]> {
  return getJson<ApiDataQuery[]>(studyBusinessPath(studyId, 'queries'));
}

export async function fetchQualityIssues(studyId = getCurrentScopedStudyId()): Promise<ApiQualityIssue[]> {
  return getJson<ApiQualityIssue[]>(studyBusinessPath(studyId, 'quality/issues'));
}

export async function fetchAuditLogs(studyId = getCurrentScopedStudyId()): Promise<ApiAuditLog[]> {
  return getJson<ApiAuditLog[]>(studyBusinessPath(studyId, 'audit-logs'));
}

export async function createDataQuery(payload: {
  study_id: string;
  patient_id: string;
  visit_id?: string | null;
  form_id?: string;
  field_name?: string;
  title: string;
  description?: string;
  assigned_to?: string | null;
}): Promise<ApiDataQuery> {
  return postJson<ApiDataQuery>('/queries', payload);
}

export async function updateDataQuery(
  queryId: string,
  payload: Partial<Pick<ApiDataQuery, 'status' | 'assigned_to' | 'response'>>
): Promise<ApiDataQuery> {
  return putJson<ApiDataQuery>(`/queries/${encodeURIComponent(queryId)}`, payload);
}

export async function createUserAccount(payload: ApiUserCreate): Promise<ApiUser> {
  return postJson<ApiUser>('/users', payload);
}

export async function fetchUsers(studyId?: string): Promise<ApiUser[]> {
  const query = studyId ? `?study_id=${encodeURIComponent(studyId)}` : '';
  return getJson<ApiUser[]>(`/users${query}`);
}

export async function fetchPermissionMatrix(): Promise<ApiPermissionMatrixRow[]> {
  return getJson<ApiPermissionMatrixRow[]>('/permissions/matrix');
}

export async function updateUserAccount(userId: string, payload: ApiUserUpdate, studyId?: string): Promise<ApiUser> {
  const query = studyId ? `?study_id=${encodeURIComponent(studyId)}` : '';
  return requestJson<ApiUser>(`/users/${encodeURIComponent(userId)}${query}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateUserAccountStatus(userId: string, payload: ApiUserStatusUpdate): Promise<ApiUser> {
  return requestJson<ApiUser>(`/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateGlobalRoleStudyScope(userId: string, studyIds: string[]): Promise<ApiUser> {
  return requestJson<ApiUser>(`/users/${encodeURIComponent(userId)}/study-scope`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ study_ids: studyIds })
  });
}

export async function upsertStudyMember(
  studyId: string,
  payload: { userId: string; studyRole: ApiStudyMember['study_role']; status: string }
): Promise<ApiStudyMember> {
  return postJson<ApiStudyMember>(`/studies/${encodeURIComponent(studyId)}/members`, {
    user_id: payload.userId,
    study_role: payload.studyRole,
    status: payload.status
  });
}

export async function fetchStudyCrfFields(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<StudyCrfFieldRecord[]> {
  return (await getJson<ApiStudyCrfField[]>(`/studies/${encodeURIComponent(studyId)}/crf-fields`)).map(toStudyCrfFieldRecord);
}

export async function fetchStudyCrfVersions(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<StudyCrfVersionRecord[]> {
  return (await getJson<ApiStudyCrfVersion[]>(`/studies/${encodeURIComponent(studyId)}/crf-versions`)).map(toStudyCrfVersionRecord);
}

export async function createStudyCrfVersion(
  studyId: string,
  payload: { version: string; status: ApiStudyCrfVersion['status']; schema: Record<string, unknown>; changeSummary: string }
): Promise<StudyCrfVersionRecord> {
  return toStudyCrfVersionRecord(
    await postJson<ApiStudyCrfVersion>(`/studies/${encodeURIComponent(studyId)}/crf-versions`, {
      version: payload.version,
      status: payload.status,
      schema: payload.schema,
      change_summary: payload.changeSummary
    })
  );
}

export async function updateStudyCrfVersion(
  studyId: string,
  versionId: string,
  payload: { status?: ApiStudyCrfVersion['status']; schema?: Record<string, unknown>; changeSummary?: string }
): Promise<StudyCrfVersionRecord> {
  return toStudyCrfVersionRecord(
    await putJson<ApiStudyCrfVersion>(`/studies/${encodeURIComponent(studyId)}/crf-versions/${encodeURIComponent(versionId)}`, {
      status: payload.status,
      schema: payload.schema,
      change_summary: payload.changeSummary
    })
  );
}

export async function previewStudyCrfMigration(
  studyId: string,
  payload: { sourceVersionId?: string; schema: Record<string, unknown> }
): Promise<CrfMigrationPreview> {
  return postJson<CrfMigrationPreview>(`/studies/${encodeURIComponent(studyId)}/crf-versions/migration-preview`, {
    source_version_id: payload.sourceVersionId,
    schema: payload.schema
  });
}

export async function fetchStudyCrfMigrations(studyId = getCurrentScopedStudyId() ?? 'LGL-1111'): Promise<CrfMigrationApprovalRecord[]> {
  return (await getJson<ApiCrfMigrationApproval[]>(`/studies/${encodeURIComponent(studyId)}/crf-migrations`)).map(toCrfMigrationApprovalRecord);
}

export async function requestStudyCrfMigrationApproval(
  studyId: string,
  payload: { sourceVersionId?: string; targetVersionId: string; note?: string }
): Promise<CrfMigrationApprovalRecord> {
  return toCrfMigrationApprovalRecord(
    await postJson<ApiCrfMigrationApproval>(`/studies/${encodeURIComponent(studyId)}/crf-migrations`, {
      source_version_id: payload.sourceVersionId,
      target_version_id: payload.targetVersionId,
      note: payload.note ?? ''
    })
  );
}

export async function approveStudyCrfMigration(studyId: string, migrationId: string, note = ''): Promise<CrfMigrationApprovalRecord> {
  return toCrfMigrationApprovalRecord(
    await postJson<ApiCrfMigrationApproval>(`/studies/${encodeURIComponent(studyId)}/crf-migrations/${encodeURIComponent(migrationId)}/approve`, {
      note
    })
  );
}

export async function applyStudyCrfMigration(studyId: string, migrationId: string, note = ''): Promise<CrfMigrationApprovalRecord> {
  return toCrfMigrationApprovalRecord(
    await postJson<ApiCrfMigrationApproval>(`/studies/${encodeURIComponent(studyId)}/crf-migrations/${encodeURIComponent(migrationId)}/apply`, {
      note
    })
  );
}

export async function createStudyCrfField(field: StudyCrfFieldRecord): Promise<StudyCrfFieldRecord> {
  const response = await postJson<ApiStudyCrfField>(`/studies/${encodeURIComponent(field.studyId)}/crf-fields`, {
    id: field.id.startsWith('LOCAL-FIELD-') ? undefined : field.id,
    name: field.name,
    type: field.type,
    module: field.module,
    status: field.status,
    options: field.options,
    required: field.required,
    validation_rule: field.validationRule,
    conditional_logic: field.conditionalLogic
  });
  return toStudyCrfFieldRecord(response);
}

export async function updateStudyCrfField(field: StudyCrfFieldRecord): Promise<StudyCrfFieldRecord> {
  const response = await putJson<ApiStudyCrfField>(`/studies/${encodeURIComponent(field.studyId)}/crf-fields/${encodeURIComponent(field.id)}`, {
    name: field.name,
    type: field.type,
    module: field.module,
    status: field.status,
    options: field.options,
    required: field.required,
    validation_rule: field.validationRule,
    conditional_logic: field.conditionalLogic
  });
  return toStudyCrfFieldRecord(response);
}

export async function runQualityChecks(studyId = getCurrentScopedStudyId()): Promise<{ status: string; created: number }> {
  const token = window.localStorage.getItem(authTokenStorageKey);
  return postJson<{ status: string; created: number }>(studyBusinessPath(studyId, 'quality/run'), {}, token ? { Authorization: `Bearer ${token}` } : undefined);
}

export async function fetchAnalyticsSummary(): Promise<ApiAnalysisSummary> {
  return getJson<ApiAnalysisSummary>(currentStudyBusinessPath('analytics/summary'));
}

function toConsentRecord(record: ApiConsent): ConsentRecord {
  return {
    id: record.id,
    studyId: record.study_id,
    patientId: record.patient_id,
    patientName: record.patient_name,
    hospitalNo: record.hospital_no,
    diseaseType: record.disease_type,
    status: record.status,
    signedAt: record.signed_at,
    version: record.version,
    method: record.method
  };
}

export async function fetchConsentRecords(): Promise<ConsentRecord[]> {
  return filterRecordsByCurrentStudyScope((await getJson<ApiConsent[]>(currentStudyBusinessPath('consents'))).map(toConsentRecord));
}

export async function updateConsentRecord(id: string, payload: Partial<Pick<ConsentRecord, 'status' | 'signedAt' | 'version' | 'method'>>): Promise<ConsentRecord> {
  const token = window.localStorage.getItem(authTokenStorageKey);
  const response = await requestJson<ApiConsent>(`/consents/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      status: payload.status,
      signed_at: payload.signedAt,
      version: payload.version,
      method: payload.method
    })
  });
  return toConsentRecord(response);
}

export async function updatePatientClinicalData(patient: PatientRecord, clinicalData: PatientRecord['clinicalData']): Promise<PatientRecord> {
  if (!patient.id) throw new Error('patient id is required');
  const response = await putJson<ApiPatient>(`/patients/${patient.id}`, { clinical_data: clinicalData });
  return toPatientRecord(response, [], []);
}

export async function createPatientRecord(patient: PatientRecord): Promise<PatientRecord> {
  const studyId = patient.studyId || getCurrentScopedStudyId();
  const response = await postJson<ApiPatient>(studyBusinessPath(studyId, 'patients'), {
    study_id: studyId,
    name: patient.name,
    hospital_no: patient.hospitalNo,
    sex: patient.sex,
    age: patient.age,
    disease_type: patient.diseaseType,
    organs: patient.organs,
    note: patient.note,
    clinical_data: patient.clinicalData
  });
  return toPatientRecord(response, [], []);
}

export async function updatePatientRecord(patient: PatientRecord): Promise<PatientRecord> {
  if (!patient.id) throw new Error('patient id is required');
  const response = await putJson<ApiPatient>(`/patients/${patient.id}`, {
    name: patient.name,
    hospital_no: patient.hospitalNo,
    sex: patient.sex,
    age: patient.age,
    disease_type: patient.diseaseType,
    organs: patient.organs,
    note: patient.note,
    clinical_data: patient.clinicalData
  });
  return toPatientRecord(response, [], []);
}

export async function fetchCrfEntries(patientId: string): Promise<ApiCrfEntry[]> {
  return getJson<ApiCrfEntry[]>(`${currentStudyBusinessPath('crf')}?patient_id=${encodeURIComponent(patientId)}`);
}

export async function saveClinicalCrfEntry(patient: PatientRecord, payload: PatientRecord['clinicalData'], status: ApiCrfEntry['status']): Promise<ApiCrfEntry> {
  if (!patient.id) throw new Error('patient id is required');
  const existingEntries = await fetchCrfEntries(patient.id).catch(() => []);
  const existingEntry = existingEntries.find((entry) => entry.form_id === 'clinical_capture' || entry.module === 'clinical_capture') ?? existingEntries[0];
  const body = {
    study_id: patient.studyId,
    patient_id: patient.id,
    visit_id: null,
    form_id: 'clinical_capture',
    module: 'clinical_capture',
    payload,
    status
  };

  if (existingEntry) {
    return putJson<ApiCrfEntry>(`/crf/${existingEntry.id}`, body);
  }
  return postJson<ApiCrfEntry>(studyBusinessPath(patient.studyId, 'crf'), body);
}

export async function createSampleRecord(record: SampleRecord): Promise<SampleRecord> {
  if (!record.patientId) throw new Error('patient id is required');
  const response = await postJson<ApiSample>(studyBusinessPath(record.studyId, 'samples'), {
    id: record.id.startsWith('SPL-NEW-') ? undefined : record.id,
    patient_id: record.patientId,
    patient_name: record.patientName,
    hospital_no: record.hospitalNo,
    sample_type: record.sampleType,
    visit: record.visit,
    collected_at: record.collectedAt,
    storage: record.storage,
    status: record.status,
    linked_omics: record.linkedOmics
  });
  return toSampleRecord(response);
}

export async function updateSampleRecord(record: SampleRecord): Promise<SampleRecord> {
  const response = await putJson<ApiSample>(`/samples/${record.id}`, {
    patient_id: record.patientId,
    patient_name: record.patientName,
    hospital_no: record.hospitalNo,
    sample_type: record.sampleType,
    visit: record.visit,
    collected_at: record.collectedAt,
    storage: record.storage,
    status: record.status,
    linked_omics: record.linkedOmics
  });
  return toSampleRecord(response);
}

export async function createOmicsRecord(record: OmicsRecord): Promise<OmicsRecord> {
  if (!record.patientId) throw new Error('patient id is required');
  const response = await postJson<ApiOmics>(studyBusinessPath(record.studyId, 'omics'), {
    id: record.id.startsWith('OMX-NEW-') ? undefined : record.id,
    testing_project_id: record.testingProjectId ?? testingProjectIdForStudy(record.studyId),
    patient_id: record.patientId,
    patient_name: record.patientName,
    sample_id: record.sampleId,
    sample_type: record.sampleType,
    assay: record.assay,
    platform: record.platform,
    run_id: record.runId,
    status: record.status,
    qc: record.qc,
    sent_at: record.sentAt,
    completed_at: record.completedAt
  });
  return toOmicsRecord(response);
}

export async function updateOmicsRecord(record: OmicsRecord): Promise<OmicsRecord> {
  const response = await putJson<ApiOmics>(`/omics/${record.id}`, {
    testing_project_id: record.testingProjectId,
    patient_id: record.patientId,
    patient_name: record.patientName,
    sample_id: record.sampleId,
    sample_type: record.sampleType,
    assay: record.assay,
    platform: record.platform,
    run_id: record.runId,
    status: record.status,
    qc: record.qc,
    sent_at: record.sentAt,
    completed_at: record.completedAt
  });
  return toOmicsRecord(response);
}

function toSamplesByType(records: ApiSample[]): SampleCollection[] {
  const counts = records.reduce<Record<string, number>>((acc, sample) => {
    acc[sample.sample_type] = (acc[sample.sample_type] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .filter(([type]) => ['血液', 'CSF', '肾', '组织', '胸水'].includes(type))
    .map(([type, count]) => ({ type: type as SampleCollection['type'], count }));
}

function toPatientOmicsStatus(patientSamples: ApiSample[], patientOmics: ApiOmics[]): OmicsStatus {
  if (!patientSamples.length) return '样本采集';
  if (!patientOmics.length) return '样本采集';
  return patientOmics.every((record) => record.status === '结果归档') ? '完成' : '进行中';
}

function toPatientRecord(patient: ApiPatient, allSamples: ApiSample[], allOmics: ApiOmics[]): PatientRecord {
  const patientSamples = allSamples.filter((sample) => sample.patient_id === patient.id);
  const patientOmics = allOmics.filter((record) => record.patient_id === patient.id);

  return {
    id: patient.id,
    studyId: patient.study_id,
    name: patient.name,
    hospitalNo: patient.hospital_no,
    sex: patient.sex,
    age: patient.age,
    diseaseType: patient.disease_type,
    organs: patient.organs,
    samples: toSamplesByType(patientSamples),
    omicsStatus: toPatientOmicsStatus(patientSamples, patientOmics),
    note: patient.note,
    clinicalDataVersion: patient.clinical_data_version,
    clinicalDataFormat: patient.clinical_data_format,
    clinicalData: patient.clinical_data
  };
}

function toSampleRecord(sample: ApiSample): SampleRecord {
  return {
    id: sample.id,
    studyId: sample.study_id,
    patientId: sample.patient_id,
    patientName: sample.patient_name,
    hospitalNo: sample.hospital_no,
    sampleType: sample.sample_type,
    visit: sample.visit,
    collectedAt: sample.collected_at,
    storage: sample.storage,
    status: sample.status,
    linkedOmics: sample.linked_omics
  };
}

function toOmicsRecord(record: ApiOmics): OmicsRecord {
  return {
    id: record.id,
    studyId: record.study_id,
    testingProjectId: record.testing_project_id,
    patientId: record.patient_id,
    patientName: record.patient_name,
    sampleId: record.sample_id,
    sampleType: record.sample_type,
    assay: record.assay,
    platform: record.platform,
    runId: record.run_id,
    status: record.status,
    qc: record.qc,
    sentAt: record.sent_at,
    completedAt: record.completed_at
  };
}

function toVisitRecord(record: ApiVisit): VisitRecord {
  const lungMetric =
    record.study_id === 'LZXK-01'
      ? record.visit_plan_code === 'V1'
        ? 'ECOG 1 / 基线'
        : record.visit_plan_code === 'V2'
          ? 'ECOG 1 / ctDNA复核'
          : 'ECOG 1 / RECIST SD'
      : record.sle_dai;

  return {
    id: record.id,
    studyId: record.study_id,
    patientId: record.patient_id,
    visitPlanId: record.visit_plan_id ?? undefined,
    visitPlanCode: record.visit_plan_code ?? undefined,
    planDayOffset: record.plan_day_offset ?? undefined,
    windowBeforeDays: record.window_before_days ?? undefined,
    windowAfterDays: record.window_after_days ?? undefined,
    patientName: record.patient_name,
    visit: record.visit,
    visitDate: record.visit_date,
    visitType: record.visit_type,
    sleDai: lungMetric,
    medication: record.medication,
    sampleCollection: record.sample_collection,
    completeness: record.completeness,
    status: record.status
  };
}

function toFollowUpRecord(record: ApiFollowUpRecord): FollowUpRecord {
  return {
    id: record.id,
    studyId: record.study_id,
    patientId: record.patient_id,
    visitId: record.visit_id ?? undefined,
    patientName: record.patient_name,
    followUpDate: record.follow_up_date,
    followUpMethod: record.follow_up_method,
    followedBy: record.followed_by,
    survivalStatus: record.survival_status,
    diseaseStatus: record.disease_status,
    symptomsSigns: record.symptoms_signs,
    imagingLabSummary: record.imaging_lab_summary,
    efficacyAssessment: record.efficacy_assessment,
    metastasisStatus: record.metastasis_status,
    adverseEvents: record.adverse_events,
    qualityOfLife: record.quality_of_life,
    lostToFollowUpReason: record.lost_to_follow_up_reason,
    recordedAt: record.recorded_at
  };
}

function getStoredUser(): AuthenticatedUser | null {
  const raw = window.localStorage.getItem(authStorageKey);
  if (!raw) return null;
  try {
    const user = normalizeAuthenticatedUser(JSON.parse(raw));
    if (user) window.localStorage.setItem(authStorageKey, JSON.stringify(user));
    else window.localStorage.removeItem(authStorageKey);
    return user;
  } catch {
    window.localStorage.removeItem(authStorageKey);
    return null;
  }
}

function testingProjectIdForStudy(studyId?: string): string {
  if (studyId === 'LZXK-01') return 'TP-LUNG-RESIST-OMICS';
  if (studyId === 'RWD-NMO-2026') return 'TP-NMO-OMICS';
  return 'TP-SLE-OMICS';
}

export function getCurrentScopedStudyId(): string | undefined {
  const user = getStoredUser();
  if (!user || !user.studyScope?.scopeType) return undefined;
  const activeStudyId = window.localStorage.getItem(activeStudyStorageKey) || undefined;
  if (activeStudyId && userCanAccessStudy(user, activeStudyId)) return activeStudyId;
  if (activeStudyId) window.localStorage.removeItem(activeStudyStorageKey);
  if (user.studyScope.scopeType === 'all_studies') return undefined;
  const studyIds = user.studyScope.studyIds ?? [];
  return studyIds.length === 1 ? studyIds[0] : undefined;
}

function currentStudyBusinessPath(resource: string): string {
  const studyId = getCurrentScopedStudyId();
  if (!studyId) throw new ApiRequestError(400, 'Study Workspace is required for business APIs');
  return `/studies/${encodeURIComponent(studyId)}/${resource.replace(/^\/+/, '')}`;
}

function studyBusinessPath(studyId: string | undefined, resource: string): string {
  if (!studyId) throw new ApiRequestError(400, 'Study Workspace is required for business APIs');
  return `/studies/${encodeURIComponent(studyId)}/${resource.replace(/^\/+/, '')}`;
}

export function recordBelongsToCurrentStudyScope(record: { studyId?: string }): boolean {
  const activeStudyId = getCurrentScopedStudyId();
  if (activeStudyId) return record.studyId === activeStudyId;
  const user = getStoredUser();
  if (!user || !user.studyScope?.scopeType || user.studyScope.scopeType === 'all_studies') return true;
  return Boolean(record.studyId && userCanAccessStudy(user, record.studyId));
}

export function filterRecordsByCurrentStudyScope<T extends { studyId?: string }>(records: T[]): T[] {
  const activeStudyId = getCurrentScopedStudyId();
  if (activeStudyId) return records.filter((record) => record.studyId === activeStudyId);
  const user = getStoredUser();
  if (!user || !user.studyScope?.scopeType || user.studyScope.scopeType === 'all_studies') return records;
  return records.filter((record) => Boolean(record.studyId && userCanAccessStudy(user, record.studyId)));
}

function fallbackDemoDataset(): DemoDataset {
  return {
    patients: [],
    samples: [],
    omics: [],
    visits: [],
    followUps: []
  };
}

function filterDatasetByStudyScope(dataset: DemoDataset): DemoDataset {
  const activeStudyId = getCurrentScopedStudyId();
  if (activeStudyId) {
    const patients = dataset.patients.filter((patient) => patient.studyId === activeStudyId);
    const patientIds = new Set(patients.map((patient) => patient.id).filter(Boolean));
    const patientNames = new Set(patients.map((patient) => patient.name));
    return {
      patients,
      samples: dataset.samples.filter((sample) => sample.studyId === activeStudyId || (!sample.studyId && (sample.patientId ? patientIds.has(sample.patientId) : patientNames.has(sample.patientName)))),
      omics: dataset.omics.filter((record) => record.studyId === activeStudyId || (!record.studyId && (record.patientId ? patientIds.has(record.patientId) : patientNames.has(record.patientName)))),
      visits: dataset.visits.filter((visit) => visit.studyId === activeStudyId || (!visit.studyId && (visit.patientId ? patientIds.has(visit.patientId) : patientNames.has(visit.patientName)))),
      followUps: dataset.followUps.filter((followUp) => followUp.studyId === activeStudyId || (!followUp.studyId && (followUp.patientId ? patientIds.has(followUp.patientId) : patientNames.has(followUp.patientName))))
    };
  }

  const user = getStoredUser();
  if (!user || !user.studyScope?.scopeType || user.studyScope.scopeType === 'all_studies') return dataset;
  const patients = dataset.patients.filter((patient) => userCanAccessStudy(user, patient.studyId));
  const patientIds = new Set(patients.map((patient) => patient.id).filter(Boolean));
  const patientNames = new Set(patients.map((patient) => patient.name));

  return {
    patients,
    samples: dataset.samples.filter((sample) => {
      if (sample.studyId) return userCanAccessStudy(user, sample.studyId);
      return sample.patientId ? patientIds.has(sample.patientId) : patientNames.has(sample.patientName);
    }),
    omics: dataset.omics.filter((record) => {
      if (record.studyId) return userCanAccessStudy(user, record.studyId);
      return record.patientId ? patientIds.has(record.patientId) : patientNames.has(record.patientName);
    }),
    visits: dataset.visits.filter((visit) => {
      if (visit.studyId) return userCanAccessStudy(user, visit.studyId);
      return visit.patientId ? patientIds.has(visit.patientId) : patientNames.has(visit.patientName);
    }),
    followUps: dataset.followUps.filter((followUp) => {
      if (followUp.studyId) return userCanAccessStudy(user, followUp.studyId);
      return followUp.patientId ? patientIds.has(followUp.patientId) : patientNames.has(followUp.patientName);
    })
  };
}

async function businessStudyIdsForCurrentUser(): Promise<string[]> {
  const activeStudyId = getCurrentScopedStudyId();
  if (activeStudyId) return [activeStudyId];

  const user = getStoredUser();
  if (!user?.studyScope?.scopeType) return [];
  if (user.studyScope.scopeType !== 'all_studies') return user.studyScope.studyIds ?? [];

  const studies = await fetchStudies();
  return studies.filter((study) => study.status !== 'deleted').map((study) => study.id);
}

async function fetchStudyBusinessRows<T>(resource: string): Promise<T[]> {
  const studyIds = Array.from(new Set(await businessStudyIdsForCurrentUser()));
  if (!studyIds.length) return [];

  const results = await Promise.allSettled(studyIds.map((studyId) => getJson<T[]>(studyBusinessPath(studyId, resource))));
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

export async function fetchDemoDataset(): Promise<DemoDataset> {
  try {
    const [apiPatients, apiSamples, apiOmics, apiVisits, apiFollowUps, apiCrfEntries] = await Promise.all([
      fetchStudyBusinessRows<ApiPatient>('patients'),
      fetchStudyBusinessRows<ApiSample>('samples'),
      fetchStudyBusinessRows<ApiOmics>('omics'),
      fetchStudyBusinessRows<ApiVisit>('visits'),
      fetchStudyBusinessRows<ApiFollowUpRecord>('follow-up-records'),
      fetchStudyBusinessRows<ApiCrfEntry>('crf')
    ]);
    const crfPayloadByPatient = apiCrfEntries.reduce<Record<string, PatientRecord['clinicalData']>>((payloads, entry) => {
      const normalizedPayload = Object.fromEntries(
        Object.entries(entry.payload ?? {})
          .filter(([, value]) => value !== null)
          .map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : value])
      ) as PatientRecord['clinicalData'];
      payloads[entry.patient_id] = {
        ...(payloads[entry.patient_id] ?? {}),
        ...normalizedPayload
      };
      return payloads;
    }, {});

    return filterDatasetByStudyScope({
      patients: apiPatients.map((patient) => {
        const record = toPatientRecord(patient, apiSamples, apiOmics);
        return {
          ...record,
          clinicalData: {
            ...record.clinicalData,
            ...(crfPayloadByPatient[patient.id] ?? {})
          }
        };
      }),
      samples: apiSamples.map(toSampleRecord),
      omics: apiOmics.map(toOmicsRecord),
      visits: apiVisits.map(toVisitRecord),
      followUps: apiFollowUps.map(toFollowUpRecord)
    });
  } catch {
    return fallbackDemoDataset();
  }
}

export async function fetchSamples(): Promise<SampleRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await fetchStudyBusinessRows<ApiSample>('samples')).map(toSampleRecord));
  } catch {
    return [];
  }
}

export async function fetchOmicsRecords(): Promise<OmicsRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await fetchStudyBusinessRows<ApiOmics>('omics')).map(toOmicsRecord));
  } catch {
    return [];
  }
}

export async function fetchVisits(): Promise<VisitRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await fetchStudyBusinessRows<ApiVisit>('visits')).map(toVisitRecord));
  } catch {
    return [];
  }
}

export async function fetchFollowUpRecords(): Promise<FollowUpRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await fetchStudyBusinessRows<ApiFollowUpRecord>('follow-up-records')).map(toFollowUpRecord));
  } catch {
    return [];
  }
}

function followUpMethodFromVisitType(visitType: string): FollowUpRecord['followUpMethod'] {
  if (visitType.includes('电话')) return '电话';
  if (visitType.includes('线上')) return '线上';
  if (visitType.includes('家访')) return '家访';
  if (visitType.includes('门诊') || visitType.includes('访视') || visitType.includes('基线')) return '门诊';
  return '其他';
}

function visitRecordToFollowUpPayload(record: VisitRecord, patient: PatientRecord) {
  const method = followUpMethodFromVisitType(record.visitType);
  const studyId = record.studyId ?? patient.studyId ?? getCurrentScopedStudyId() ?? 'LGL-1111';
  const isLungStudy = studyId === 'LZXK-01';
  return {
    study_id: studyId,
    patient_id: record.patientId ?? patient.id,
    visit_id: record.id.startsWith('V-NEW-') || record.id.startsWith('FUP-') ? null : record.id,
    follow_up_date: record.visitDate,
    follow_up_method: method,
    followed_by: 'LinZight Demo',
    survival_status: '存活',
    disease_status: record.status,
    symptoms_signs: isLungStudy ? `ECOG/疗效 ${record.sleDai}` : `SLEDAI ${record.sleDai}`,
    imaging_lab_summary: record.sampleCollection,
    efficacy_assessment: record.completeness ? `完整度 ${record.completeness}%` : '未评估',
    metastasis_status: '-',
    adverse_events: record.medication,
    quality_of_life: '-',
    lost_to_follow_up_reason: '',
    recorded_at: new Date().toISOString()
  };
}

function followUpRecordToVisitRecord(record: FollowUpRecord, base: VisitRecord): VisitRecord {
  return {
    ...base,
    id: record.id,
    studyId: record.studyId ?? base.studyId,
    patientId: record.patientId ?? base.patientId,
    patientName: record.patientName || base.patientName,
    visitDate: record.followUpDate,
    visitType: record.followUpMethod,
    medication: base.medication || record.adverseEvents,
    sampleCollection: base.sampleCollection || record.imagingLabSummary,
    status: base.status
  };
}

export async function saveVisitFollowUpRecord(record: VisitRecord, patient: PatientRecord): Promise<VisitRecord> {
  if (!patient.id && !record.patientId) throw new Error('patient id is required');
  const patientId = record.patientId ?? patient.id;
  const payload = visitRecordToFollowUpPayload(record, patient);

  if (record.id.startsWith('FUP-')) {
    const response = await putJson<ApiFollowUpRecord>(`/follow-up-records/${encodeURIComponent(record.id)}`, payload);
    return followUpRecordToVisitRecord(toFollowUpRecord(response), record);
  }

  const existingRecords = await getJson<ApiFollowUpRecord[]>(`${studyBusinessPath(payload.study_id, 'follow-up-records')}?patient_id=${encodeURIComponent(patientId ?? '')}`)
    .then((rows) => rows.map(toFollowUpRecord))
    .catch(() => [] as FollowUpRecord[]);
  const existing = existingRecords.find((item) => item.visitId === record.id)
    ?? existingRecords.find((item) => item.followUpDate === record.visitDate && item.followUpMethod === payload.follow_up_method);

  if (existing) {
    const response = await putJson<ApiFollowUpRecord>(`/follow-up-records/${encodeURIComponent(existing.id)}`, payload);
    return followUpRecordToVisitRecord(toFollowUpRecord(response), record);
  }

  const response = await postJson<ApiFollowUpRecord>(studyBusinessPath(payload.study_id, 'follow-up-records'), {
    id: record.id.startsWith('V-NEW-') ? undefined : `FUP-${record.id}`,
    ...payload
  });
  return followUpRecordToVisitRecord(toFollowUpRecord(response), record);
}

export async function fetchPatientPanorama(patientId: string): Promise<DemoDataset> {
  const panorama = await getJson<ApiPanorama>(`/patients/${patientId}/panorama`);
  return {
    patients: [toPatientRecord(panorama.patient, panorama.samples, panorama.omics_records)],
    samples: panorama.samples.map(toSampleRecord),
    omics: panorama.omics_records.map(toOmicsRecord),
    visits: (panorama.visits ?? []).map(toVisitRecord),
    followUps: (panorama.follow_up_records ?? []).map(toFollowUpRecord)
  };
}
