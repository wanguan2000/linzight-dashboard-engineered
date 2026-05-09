import {
  followUpRecords,
  omicsRecords,
  samples,
  visits,
  type ConsentRecord,
  type FollowUpRecord,
  type OmicsRecord,
  type SampleRecord,
  type VisitRecord
} from '../data/operations';
import { authStorageKey, normalizeAuthenticatedUser, roleLabels, userCanAccessStudy, type AuthenticatedUser } from '../data/auth';
import { patientRecords, type OmicsStatus, type PatientRecord, type SampleCollection } from '../data/patientCohort';
import type {
  ApiAnalysisSummary,
  ApiConsent,
  ApiExportJob,
  ApiFileMetadata,
  ApiFollowUpRecord,
  ApiLoginResponse,
  ApiOmics,
  ApiPanorama,
  ApiPatient,
  ApiSample,
  ApiVisit
} from './contracts';

export type DemoDataset = {
  patients: PatientRecord[];
  samples: SampleRecord[];
  omics: OmicsRecord[];
  visits: VisitRecord[];
  followUps: FollowUpRecord[];
};

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBases = Array.from(new Set([configuredBase, 'http://127.0.0.1:8000', 'http://127.0.0.1:8001'].filter(Boolean))) as string[];
type FetchInit = Parameters<typeof window.fetch>[1];

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

async function requestJson<T>(path: string, init?: FetchInit): Promise<T> {
  let lastError: unknown;

  for (const base of apiBases) {
    const controller = new window.AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 900);

    try {
      const headers = new window.Headers(init?.headers);
      const token = window.localStorage.getItem('linzight-demo-token');
      if (token && !headers.has('Authorization') && path !== '/auth/login') {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const response = await window.fetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed');
}

export async function loginWithBackend(username: string, password: string): Promise<AuthenticatedUser> {
  const response = await postJson<ApiLoginResponse>('/auth/login', { username, password });
  window.localStorage.setItem('linzight-demo-token', response.access_token);
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

  const token = window.localStorage.getItem('linzight-demo-token');
  return requestJson<ApiFileMetadata>('/files', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });
}

export async function createExportJob(exportType = 'cohort_csv'): Promise<ApiExportJob> {
  const token = window.localStorage.getItem('linzight-demo-token');
  return postJson<ApiExportJob>(
    '/exports',
    {
      export_type: exportType,
      scope: { study_id: 'LGL-1111' },
      requested_by: null
    },
    token ? { Authorization: `Bearer ${token}` } : undefined
  );
}

export async function runQualityChecks(): Promise<{ status: string; created: number }> {
  const token = window.localStorage.getItem('linzight-demo-token');
  return postJson<{ status: string; created: number }>('/quality/run', {}, token ? { Authorization: `Bearer ${token}` } : undefined);
}

export async function fetchAnalyticsSummary(): Promise<ApiAnalysisSummary> {
  return getJson<ApiAnalysisSummary>('/analytics/summary');
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
  return filterRecordsByCurrentStudyScope((await getJson<ApiConsent[]>('/consents')).map(toConsentRecord));
}

export async function updateConsentRecord(id: string, payload: Partial<Pick<ConsentRecord, 'status' | 'signedAt' | 'version' | 'method'>>): Promise<ConsentRecord> {
  const token = window.localStorage.getItem('linzight-demo-token');
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
    sleDai: record.sle_dai,
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

export function filterRecordsByCurrentStudyScope<T extends { studyId?: string }>(records: T[]): T[] {
  const user = getStoredUser();
  if (!user || !user.studyScope?.scopeType || user.studyScope.scopeType === 'all_studies') return records;
  return records.filter((record) => !record.studyId || userCanAccessStudy(user, record.studyId));
}

function filterDatasetByStudyScope(dataset: DemoDataset): DemoDataset {
  const user = getStoredUser();
  if (!user || !user.studyScope?.scopeType || user.studyScope.scopeType === 'all_studies') return dataset;
  const patients = dataset.patients.filter((patient) => userCanAccessStudy(user, patient.studyId));
  const patientIds = new Set(patients.map((patient) => patient.id).filter(Boolean));
  const patientNames = new Set(patients.map((patient) => patient.name));

  return {
    patients,
    samples: dataset.samples.filter((sample) => (sample.patientId ? patientIds.has(sample.patientId) : patientNames.has(sample.patientName))),
    omics: dataset.omics.filter((record) => (record.patientId ? patientIds.has(record.patientId) : patientNames.has(record.patientName))),
    visits: dataset.visits.filter((visit) => (visit.patientId ? patientIds.has(visit.patientId) : patientNames.has(visit.patientName))),
    followUps: dataset.followUps.filter((followUp) => (followUp.patientId ? patientIds.has(followUp.patientId) : patientNames.has(followUp.patientName)))
  };
}

export async function fetchDemoDataset(): Promise<DemoDataset> {
  try {
    const [apiPatients, apiSamples, apiOmics, apiVisits, apiFollowUps] = await Promise.all([
      getJson<ApiPatient[]>('/patients'),
      getJson<ApiSample[]>('/samples'),
      getJson<ApiOmics[]>('/omics'),
      getJson<ApiVisit[]>('/visits'),
      getJson<ApiFollowUpRecord[]>('/follow-up-records')
    ]);

    return filterDatasetByStudyScope({
      patients: apiPatients.map((patient) => toPatientRecord(patient, apiSamples, apiOmics)),
      samples: apiSamples.map(toSampleRecord),
      omics: apiOmics.map(toOmicsRecord),
      visits: apiVisits.map(toVisitRecord),
      followUps: apiFollowUps.map(toFollowUpRecord)
    });
  } catch {
    return filterDatasetByStudyScope({
      patients: patientRecords,
      samples,
      omics: omicsRecords,
      visits,
      followUps: followUpRecords
    });
  }
}

export async function fetchSamples(): Promise<SampleRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await getJson<ApiSample[]>('/samples')).map(toSampleRecord));
  } catch {
    return filterRecordsByCurrentStudyScope(samples);
  }
}

export async function fetchOmicsRecords(): Promise<OmicsRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await getJson<ApiOmics[]>('/omics')).map(toOmicsRecord));
  } catch {
    return filterRecordsByCurrentStudyScope(omicsRecords);
  }
}

export async function fetchVisits(): Promise<VisitRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await getJson<ApiVisit[]>('/visits')).map(toVisitRecord));
  } catch {
    return filterRecordsByCurrentStudyScope(visits);
  }
}

export async function fetchFollowUpRecords(): Promise<FollowUpRecord[]> {
  try {
    return filterRecordsByCurrentStudyScope((await getJson<ApiFollowUpRecord[]>('/follow-up-records')).map(toFollowUpRecord));
  } catch {
    return filterRecordsByCurrentStudyScope(followUpRecords);
  }
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
