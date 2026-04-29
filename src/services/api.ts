import type { ConsentRecord, OmicsRecord, SampleRecord } from '../data/operations';
import { roleLabels, type AuthenticatedUser } from '../data/auth';
import type { OmicsStatus, PatientRecord, SampleCollection } from '../data/patientCohort';
import type { ApiAnalysisSummary, ApiConsent, ApiExportJob, ApiFileMetadata, ApiLoginResponse, ApiOmics, ApiPanorama, ApiPatient, ApiSample } from './contracts';

export type DemoDataset = {
  patients: PatientRecord[];
  samples: SampleRecord[];
  omics: OmicsRecord[];
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
      const response = await window.fetch(`${base}${path}`, { ...init, signal: controller.signal });
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
  return {
    id: response.user.id,
    username: response.user.username,
    name: response.user.display_name,
    role: response.user.role,
    roleLabel: roleLabels[response.user.role],
    initials: response.user.display_name
      .split('')
      .filter((char) => /[A-Za-z\u4e00-\u9fa5]/.test(char))
      .slice(0, 2)
      .join('')
      .toUpperCase()
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
  return (await getJson<ApiConsent[]>('/consents')).map(toConsentRecord);
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
    .filter(([type]) => ['血液', 'CSF', '肾'].includes(type))
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
    studyId: patient.study_id as 'LGL-1111',
    name: patient.name,
    hospitalNo: patient.hospital_no,
    sex: patient.sex,
    age: patient.age,
    diseaseType: patient.disease_type,
    organs: patient.organs,
    samples: toSamplesByType(patientSamples),
    omicsStatus: toPatientOmicsStatus(patientSamples, patientOmics),
    note: patient.note,
    clinicalData: patient.clinical_data
  };
}

function toSampleRecord(sample: ApiSample): SampleRecord {
  return {
    id: sample.id,
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

export async function fetchDemoDataset(): Promise<DemoDataset> {
  const [patients, samples, omics] = await Promise.all([
    getJson<ApiPatient[]>('/patients'),
    getJson<ApiSample[]>('/samples'),
    getJson<ApiOmics[]>('/omics')
  ]);

  return {
    patients: patients.map((patient) => toPatientRecord(patient, samples, omics)),
    samples: samples.map(toSampleRecord),
    omics: omics.map(toOmicsRecord)
  };
}

export async function fetchSamples(): Promise<SampleRecord[]> {
  return (await getJson<ApiSample[]>('/samples')).map(toSampleRecord);
}

export async function fetchOmicsRecords(): Promise<OmicsRecord[]> {
  return (await getJson<ApiOmics[]>('/omics')).map(toOmicsRecord);
}

export async function fetchPatientPanorama(patientId: string): Promise<DemoDataset> {
  const panorama = await getJson<ApiPanorama>(`/patients/${patientId}/panorama`);
  return {
    patients: [toPatientRecord(panorama.patient, panorama.samples, panorama.omics_records)],
    samples: panorama.samples.map(toSampleRecord),
    omics: panorama.omics_records.map(toOmicsRecord)
  };
}
