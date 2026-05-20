import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateClinicalCompleteness,
  type DiseaseType,
  type OmicsStatus,
  type PatientRecord
} from '../data/patientCohort';
import type { OmicsRecord, SampleRecord } from '../data/operations';
import { getGlobalDetectionTypes, getGlobalDiseaseTypes, getGlobalSampleTypes, globalConfigChangedEvent } from '../data/globalConfig';
import { Icon } from './Icon';
import { studyOptions as defaultStudyOptions, type AuthenticatedUser } from '../data/auth';
import { createPatientRecord, deletePatientRecord, fetchGlobalConfiguration, fetchStudies, fetchWorkspaceDataset, getCurrentScopedStudyId, isPermissionError, updatePatientRecord } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import type { IconName } from '../types';
import { SampleTestingPage } from './ModulePages';

const patientPageSize = 5;
const diseasePalette: Record<DiseaseType, string> = {
  NPSLE: 'var(--blue)',
  'Non-NPSLE': '#7d71db',
  NMOSD: '#35a7c8',
  MS: '#329bd3',
  HC: 'var(--green)',
  NSCLC: '#2f855a',
  LUAD: '#c05621',
  LUSC: '#9f7aea',
  'EGFR-TKI耐药': '#d69e2e',
  ALK耐药: '#dd6b20'
};

type DiseaseDistributionItem = {
  label: DiseaseType;
  value: number;
  percent: string;
  color: string;
};

type SampleSummaryItem = {
  label: string;
  value: string;
};

type PatientEditorMode = 'create' | 'edit';
type StudyNameLookup = Record<string, string>;

const sampleSummaryFallbackTypes = ['肿瘤FFPE', '肿瘤组织', 'CSF', '血液', '胸水'];
const detectionSummaryFallbackTypes = ['RNA-seq', 'WES', 'scRNA-seq', '类器官构建', 'Olink'];
const sampleSummaryAliases: Record<string, string[]> = {
  肿瘤FFPE: ['肿瘤FFPE', 'FFPE', 'FFPE组织', '肿瘤FFPE组织'],
  肿瘤组织: ['肿瘤组织', '组织', '肺癌组织'],
  CSF: ['CSF', '脑脊液'],
  血液: ['血液'],
  胸水: ['胸水']
};
const detectionSummaryAliases: Record<string, string[]> = {
  'RNA-seq': ['RNA-seq', 'RNAseq'],
  WES: ['WES', '全外显子测序'],
  'scRNA-seq': ['scRNA-seq', 'scRNAseq', '单细胞RNA-seq'],
  类器官构建: ['类器官构建', '类器官', 'Organoid', 'Organoid culture'],
  Olink: ['Olink', 'Olink/Simoa', 'Simoa']
};

const patientWriteRoles = new Set(['LZ_ADMIN', 'LZ_CRC', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN']);

function canWritePatients(user?: AuthenticatedUser | null) {
  return Boolean(user && patientWriteRoles.has(user.role));
}

function currentStudyDefaultDisease(studyId?: string): DiseaseType {
  const configuredDiseases = getGlobalDiseaseTypes();
  if (studyId === 'LZXK-01' && configuredDiseases.includes('NSCLC')) return 'NSCLC';
  return configuredDiseases[0] ?? 'NPSLE';
}

function makeDraftPatient(studyId?: string): PatientRecord {
  const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return {
	    studyId: studyId ?? '',
	    patientNumber: `NEW-${today}`,
	    patientName: '',
	    name: `NEW-${today}`,
    hospitalNo: '',
    sex: '女',
    age: 45,
    diseaseType: currentStudyDefaultDisease(studyId),
    organs: [],
    samples: [],
    omicsStatus: '未采集',
    note: '',
    clinicalData: {}
  };
}

function sampleText(patient: PatientRecord) {
  if (!patient.samples.length) return '未采集';
  return patient.samples.map((sample) => `${sample.type}${sample.count > 1 ? ` x${sample.count}` : ''}`).join(' / ');
}

function sampleSummaryIcon(label: string): IconName {
  if (label === '血液') return 'blood';
  if (label === 'CSF') return 'csf';
  if (label === '肾') return 'kidney';
  if (label === '肿瘤FFPE') return 'ffpeBlock';
  if (label === '组织' || label === '肿瘤组织') return 'tissueSlice';
  if (label === '胸水') return 'pleuralFluid';
  if (label === 'RNA-seq') return 'dna';
  if (label === 'WES') return 'wesPanel';
  if (label === 'scRNA-seq') return 'singleCell';
  if (label === '类器官构建') return 'organoid';
  if (label === 'Olink') return 'proteomics';
  if (label === '总检测数') return 'testSummary';
  if (label === '做过检测样本') return 'check';
  if (label === '剩余样本数') return 'check';
  return 'sampleBank';
}

function sampleSummaryClass(label: string) {
  if (label === '血液') return 'sample-summary__item--blood';
  if (label === 'CSF') return 'sample-summary__item--csf';
  if (label === '肾') return 'sample-summary__item--kidney';
  if (label === '肿瘤FFPE') return 'sample-summary__item--ffpe';
  if (label === '组织' || label === '肿瘤组织') return 'sample-summary__item--tissue';
  if (label === '胸水') return 'sample-summary__item--pleural';
  if (label === 'RNA-seq') return 'sample-summary__item--rna';
  if (label === 'WES') return 'sample-summary__item--wes';
  if (label === 'scRNA-seq') return 'sample-summary__item--single-cell';
  if (label === '类器官构建') return 'sample-summary__item--organoid';
  if (label === 'Olink') return 'sample-summary__item--protein';
  return 'sample-summary__item--total';
}

function statusClass(status: OmicsStatus) {
  if (status === '完成') return 'is-complete';
  if (status === '进行中') return 'is-running';
  if (status === '未采集') return 'is-low';
  return 'is-collecting';
}

function completenessClass(value: number) {
  if (value >= 90) return 'is-high';
  if (value >= 80) return 'is-medium';
  return 'is-low';
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function uniqueStudyIds(records: PatientRecord[]) {
  return Array.from(new Set(records.map((record) => record.studyId).filter(Boolean) as string[])).sort();
}

function studyOptionsForUser(user?: AuthenticatedUser | null, records: PatientRecord[] = []) {
  const scopedStudies = user?.studyScope?.scopeType === 'all_studies'
    ? []
    : user?.studyScope?.studyIds ?? [];
  return Array.from(new Set([...scopedStudies, ...uniqueStudyIds(records)])).sort();
}

function defaultStudyNameLookup(): StudyNameLookup {
  return Object.fromEntries(defaultStudyOptions.map((study) => [study.id, study.name]));
}

function studyNameForPatient(patient: PatientRecord, studyNameById: StudyNameLookup) {
  return patient.studyName || studyNameById[patient.studyId] || patient.studyId || '-';
}

function formatPercent(value: number, total: number) {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function preferredConfiguredTypes(configuredTypes: string[], fallbackTypes: string[]) {
  const configuredMatches = configuredTypes.filter((item) => fallbackTypes.includes(item));
  const hasCurrentSummarySet = fallbackTypes.every((item) => configuredMatches.includes(item));
  return hasCurrentSummarySet ? configuredMatches.slice(0, 5) : fallbackTypes;
}

function countMatchingLabels<T>(records: T[], label: string, aliases: Record<string, string[]>, getValue: (record: T) => string) {
  const acceptedValues = new Set([label, ...(aliases[label] ?? [])]);
  return records.filter((record) => acceptedValues.has(getValue(record))).length;
}

function buildDiseaseDistribution(patients: PatientRecord[]): DiseaseDistributionItem[] {
  const total = patients.length;
  const diseaseOptions = Array.from(new Set(patients.map((patient) => patient.diseaseType)));
  return diseaseOptions
    .map((label) => {
      const value = patients.filter((patient) => patient.diseaseType === label).length;
      return {
        label,
        value,
        percent: formatPercent(value, total),
        color: diseasePalette[label]
      };
    });
}

function buildDonutGradient(distribution: DiseaseDistributionItem[]) {
  if (!distribution.length) {
    return 'radial-gradient(circle, rgba(255, 255, 255, 0.96) 0 48%, transparent 49%), conic-gradient(rgba(226, 234, 242, 0.9) 0 100%)';
  }
  let cursor = 0;
  const segments = distribution.map((item) => {
    const start = cursor;
    cursor += Number.parseFloat(item.percent) || 0;
    return `${item.color} ${start}% ${cursor}%`;
  });

  return `radial-gradient(circle, rgba(255, 255, 255, 0.96) 0 48%, transparent 49%), conic-gradient(${segments.join(', ')})`;
}

function buildSampleSummary(samples: SampleRecord[], configuredTypes: string[]): SampleSummaryItem[] {
  const totalSamples = samples.length;
  const labels = preferredConfiguredTypes(configuredTypes, sampleSummaryFallbackTypes);

  return [
    ...labels.map((label) => {
      const value = countMatchingLabels(samples, label, sampleSummaryAliases, (sample) => sample.sampleType);
      return { label, value: formatCount(value) };
    }),
    { label: '总样本数', value: formatCount(totalSamples) }
  ];
}

function buildDetectionSummary(omicsRows: OmicsRecord[], configuredTypes: string[]): SampleSummaryItem[] {
  const total = omicsRows.length;
  const labels = preferredConfiguredTypes(configuredTypes, detectionSummaryFallbackTypes);

  return [
    ...labels.map((label) => {
      const value = countMatchingLabels(omicsRows, label, detectionSummaryAliases, (record) => record.assay);
      return { label, value: formatCount(value) };
    }),
    { label: '总检测数', value: formatCount(total) }
  ];
}

function hasRemainingQuantity(sample: SampleRecord) {
  const value = Number.parseFloat(sample.remainingQuantity ?? '');
  return Number.isFinite(value) && value > 0;
}

function buildRemainingSampleSummary(samples: SampleRecord[], omicsRows: OmicsRecord[], configuredTypes: string[]): SampleSummaryItem[] {
  const detectedSampleIds = new Set<string>();
  omicsRows.forEach((record) => (record.sampleIds?.length ? record.sampleIds : [record.sampleId]).forEach((sampleId) => detectedSampleIds.add(sampleId)));
  const remainingDetectedSamples = samples.filter((sample) =>
    hasRemainingQuantity(sample) && (detectedSampleIds.has(sample.id) || sample.linkedOmics.some((item) => item && item !== '待选择' && item !== '待指定'))
  );
  const totalRemainingDetectedSamples = remainingDetectedSamples.length;
  const labels = preferredConfiguredTypes(configuredTypes, sampleSummaryFallbackTypes);

  return [
    ...labels.map((label) => {
      const value = countMatchingLabels(remainingDetectedSamples, label, sampleSummaryAliases, (sample) => sample.sampleType);
      return { label, value: formatCount(value) };
    }),
    { label: '剩余样本数', value: formatCount(totalRemainingDetectedSamples) }
  ];
}

function CohortOverviewPanel({ patients, samples, omicsRows }: { patients: PatientRecord[]; samples: SampleRecord[]; omicsRows: OmicsRecord[] }) {
  const { t } = useI18n();
  const distribution = buildDiseaseDistribution(patients);
  const studyCount = new Set(patients.map((patient) => patient.studyId).filter(Boolean)).size;
  const sampledPatientCount = new Set(samples.map((sample) => sample.patientId || sample.patientName).filter(Boolean)).size;
  const completedOmicsCount = omicsRows.filter((record) => ['测序完成', '结果归档', '检测完成', '已归档'].includes(String(record.status))).length;

  return (
    <section className="cohort-side-card" aria-label="队列概览">
      <header className="cohort-side-card__header">
        <h2>队列概览</h2>
      </header>
      <div className="cohort-overview">
        <div className="cohort-donut" style={{ background: buildDonutGradient(distribution) }}>
          <strong>{formatCount(patients.length)}</strong>
          <span>{t('总计')}</span>
        </div>
        <div className="cohort-overview__content">
          <div className="cohort-overview__stats">
            <span><strong>{formatCount(studyCount)}</strong>{t('Study')}</span>
            <span><strong>{formatCount(distribution.length)}</strong>{t('疾病类型')}</span>
            <span><strong>{formatCount(sampledPatientCount)}</strong>{t('已采样')}</span>
            <span><strong>{formatCount(completedOmicsCount)}</strong>{t('检测完成')}</span>
          </div>
          <div className="cohort-legend">
            {distribution.map((item) => (
              <div className="cohort-legend__row" key={item.label}>
                <span className={`cohort-legend__dot cohort-legend__dot--${item.label.toLowerCase().replace('/', '-')}`} />
                <span>{t(item.label)}</span>
                <strong>{formatCount(item.value)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SampleSummaryPanel({ samples, configuredTypes }: { samples: SampleRecord[]; configuredTypes: string[] }) {
  const { t } = useI18n();
  const summary = buildSampleSummary(samples, configuredTypes);

  return (
    <section className="cohort-side-card" aria-label="样本采集汇总">
      <header className="cohort-side-card__header">
        <h2>样本采集汇总</h2>
      </header>
      <div className="sample-summary sample-summary--six">
        {summary.map((item) => (
          <div className={`sample-summary__item ${sampleSummaryClass(item.label)}`} key={item.label}>
            <Icon name={sampleSummaryIcon(item.label)} />
            <strong>{item.value}</strong>
            <span>{t(item.label)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetectionSummaryPanel({ omicsRows, configuredTypes }: { omicsRows: OmicsRecord[]; configuredTypes: string[] }) {
  const { t } = useI18n();
  const summary = buildDetectionSummary(omicsRows, configuredTypes);

  return (
    <section className="cohort-side-card" aria-label="检测项目汇总">
      <header className="cohort-side-card__header">
        <h2>检测项目汇总</h2>
      </header>
      <div className="sample-summary sample-summary--six">
        {summary.map((item) => (
          <div className={`sample-summary__item ${sampleSummaryClass(item.label)}`} key={item.label}>
            <Icon name={sampleSummaryIcon(item.label)} />
            <strong>{item.value}</strong>
            <span>{t(item.label)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RemainingSampleSummaryPanel({ samples, omicsRows, configuredTypes }: { samples: SampleRecord[]; omicsRows: OmicsRecord[]; configuredTypes: string[] }) {
  const { t } = useI18n();
  const summary = buildRemainingSampleSummary(samples, omicsRows, configuredTypes);

  return (
    <section className="cohort-side-card" aria-label="剩余样本统计">
      <header className="cohort-side-card__header">
        <h2>剩余样本统计</h2>
      </header>
      <div className="sample-summary sample-summary--six">
        {summary.map((item) => (
          <div className={`sample-summary__item ${sampleSummaryClass(item.label)}`} key={item.label}>
            <Icon name={sampleSummaryIcon(item.label)} />
            <strong>{item.value}</strong>
            <span>{t(item.label)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface PatientTableProps {
  patients: PatientRecord[];
  onEditPatient: (patient: PatientRecord) => void;
  onViewPatient: (patient: PatientRecord) => void;
  onViewSamples?: (patient: PatientRecord) => void;
  onAddSample?: (patient: PatientRecord) => void;
  onAddOmics?: (patient: PatientRecord) => void;
  onDeletePatient?: (patient: PatientRecord) => void;
  activePatientName?: string;
  canEdit?: boolean;
  emptyMessage?: string;
  showStudyId?: boolean;
  studyNameById?: StudyNameLookup;
}

function PatientTable({
  patients,
  onEditPatient,
  onViewPatient,
  onViewSamples = () => undefined,
  onAddSample = () => undefined,
  onAddOmics = () => undefined,
  onDeletePatient = () => undefined,
  activePatientName,
  canEdit = true,
  emptyMessage = '暂无匹配患者',
  showStudyId = false,
  studyNameById = defaultStudyNameLookup()
}: PatientTableProps) {
  const { t } = useI18n();
  const [revealedPatientIds, setRevealedPatientIds] = useState<Set<string>>(new Set());

  return (
    <div className="patient-table-wrap">
      <table className="patient-table">
        <thead>
          <tr>
            <th>{t('患者编号')}</th>
            <th>{t('患者姓名')}</th>
            {showStudyId ? <th>{t('Study ID')}</th> : null}
            {showStudyId ? <th>{t('Study 名称')}</th> : null}
            <th>{t('住院号')}</th>
            <th>{t('性别')}</th>
            <th>{t('年龄')}</th>
            <th>{t('疾病类型')}</th>
            <th>{t('样本采集')}</th>
            <th>{t('多组学检测')}</th>
            <th>{t('CRF完整性')}</th>
            <th>{t('注释')}</th>
            <th>{t('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const completeness = calculateClinicalCompleteness(patient.clinicalData);
            const revealKey = patient.id ?? `${patient.studyId}-${patient.name}`;
            const hasPatientName = Boolean(patient.patientName?.trim());
            const patientNameInitials = patient.patientNameInitials || patient.patientName || t('未录入姓名');
            const canRevealPatientName = hasPatientName && patient.patientName !== patientNameInitials;
            const showFullPatientName = revealedPatientIds.has(revealKey) && canRevealPatientName;
            const studyName = studyNameForPatient(patient, studyNameById);
              return (
              <tr className={patient.name === activePatientName ? 'is-active' : undefined} key={`${patient.studyId}-${patient.name}`}>
                <td data-label={t('患者编号')}>{patient.name}</td>
                <td data-label={t('患者姓名')}>
                  <div className="patient-actions">
                    <span>{showFullPatientName ? patient.patientName : patientNameInitials}</span>
                    {canRevealPatientName ? (
                      <button
                        type="button"
                        onClick={() => setRevealedPatientIds((current) => {
                          const next = new Set(current);
                          if (next.has(revealKey)) next.delete(revealKey);
                          else next.add(revealKey);
                          return next;
                        })}
                      >
                        {t(showFullPatientName ? '隐藏姓名' : '授权查看')}
                      </button>
                    ) : !hasPatientName ? (
                      <button type="button" disabled title={t('未录入患者姓名，无法授权查看')}>
                        {t('未录入姓名')}
                      </button>
                    ) : null}
                  </div>
                </td>
                {showStudyId ? <td data-label={t('Study ID')}><span className="status-pill status-pill--info">{patient.studyId}</span></td> : null}
                {showStudyId ? <td data-label={t('Study 名称')}>{t(studyName)}</td> : null}
                <td data-label={t('住院号')}>{patient.hospitalNo}</td>
                <td data-label={t('性别')}>{t(patient.sex)}</td>
                <td data-label={t('年龄')}>{patient.age}</td>
                <td data-label={t('疾病类型')}><span className={`disease-pill disease-pill--${patient.diseaseType.toLowerCase().replace('-', '')}`}>{t(patient.diseaseType)}</span></td>
                <td data-label={t('样本采集')}>{t(sampleText(patient))}</td>
                <td data-label={t('多组学检测')}><span className={`omics-pill ${statusClass(patient.omicsStatus)}`}>{t(patient.omicsStatus)}</span></td>
                <td data-label={t('CRF完整性')}><span className={`complete-pill ${completenessClass(completeness)}`}>{completeness}%</span></td>
                <td data-label={t('注释')} className="patient-note">{t(patient.note)}</td>
                <td data-label={t('操作')}>
	                  <div className="patient-actions">
	                    <button type="button" onClick={() => onViewPatient(patient)}>{t('病程查看')}</button>
	                    <button type="button" onClick={() => onViewSamples(patient)}>{t('样本查看')}</button>
	                    <button
	                      type="button"
	                      disabled={!canEdit || !patient.id}
	                      title={canEdit ? undefined : t('当前角色没有样本写入权限')}
	                      onClick={() => onAddSample(patient)}
	                    >
	                      {t('新增样本')}
	                    </button>
	                    <button
	                      type="button"
	                      disabled={!canEdit || !patient.id}
	                      title={canEdit ? undefined : t('当前角色没有检测写入权限')}
	                      onClick={() => onAddOmics(patient)}
	                    >
	                      {t('新增检测')}
	                    </button>
	                    <button
	                      type="button"
	                      disabled={!canEdit}
	                      title={canEdit ? undefined : t('当前角色没有患者写入权限')}
	                      onClick={() => onEditPatient(patient)}
	                    >
	                      {t('编辑')}
	                    </button>
	                    <button
	                      type="button"
	                      disabled={!canEdit || !patient.id}
	                      title={canEdit ? undefined : t('当前角色没有患者写入权限')}
	                      onClick={() => onDeletePatient(patient)}
	                    >
	                      {t('删除')}
	                    </button>
	                  </div>
                </td>
              </tr>
            );
          })}
          {!patients.length && (
            <tr>
	              <td colSpan={showStudyId ? 13 : 11}>{t(emptyMessage)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PatientListModuleProps {
  patients: PatientRecord[];
  activePatientName?: string;
  className?: string;
  onCreatePatient?: () => void;
  onEditPatient?: (patient: PatientRecord) => void;
  onViewPatient?: (patient: PatientRecord) => void;
}

export function PatientListModule({
  patients,
  activePatientName,
  className,
  onCreatePatient = () => undefined,
  onEditPatient = () => undefined,
  onViewPatient = () => undefined
}: PatientListModuleProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [sex, setSex] = useState('全部');
  const [ageRange, setAgeRange] = useState('全部');
  const [disease, setDisease] = useState<'全部' | DiseaseType>('全部');
  const [studyFilter, setStudyFilter] = useState('全部 Study');
  const [sort, setSort] = useState('最近更新');
  const [currentPage, setCurrentPage] = useState(1);
  const studyOptions = useMemo(() => uniqueStudyIds(patients), [patients]);
  const showStudyId = studyOptions.length > 1;
  const studyNameById = useMemo(() => ({
    ...defaultStudyNameLookup(),
    ...Object.fromEntries(patients.filter((patient) => patient.studyName).map((patient) => [patient.studyId, patient.studyName as string]))
  }), [patients]);
  const diseaseOptions = useMemo<Array<'全部' | DiseaseType>>(
    () => ['全部', ...Array.from(new Set(patients.filter((patient) => studyFilter === '全部 Study' || patient.studyId === studyFilter).map((patient) => patient.diseaseType)))],
    [patients, studyFilter]
  );

  const filteredPatients = useMemo(() => {
    return patients
      .filter((patient) => studyFilter === '全部 Study' || patient.studyId === studyFilter)
      .filter((patient) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return [
	          patient.name,
	          patient.patientName ?? '',
	          patient.patientNameInitials ?? '',
          studyNameForPatient(patient, studyNameById),
	          patient.hospitalNo,
          patient.diseaseType,
          sampleText(patient),
          patient.note
        ].some((value) => value.toLowerCase().includes(query));
      })
      .filter((patient) => sex === '全部' || patient.sex === sex)
      .filter((patient) => disease === '全部' || patient.diseaseType === disease)
      .filter((patient) => {
        if (ageRange === '全部') return true;
        if (ageRange === '18-35') return patient.age >= 18 && patient.age <= 35;
        if (ageRange === '36-55') return patient.age >= 36 && patient.age <= 55;
        return patient.age > 55;
      })
      .sort((a, b) => {
        if (sort === '完整性优先') return calculateClinicalCompleteness(b.clinicalData) - calculateClinicalCompleteness(a.clinicalData);
        if (sort === '年龄升序') return a.age - b.age;
        return a.name.localeCompare(b.name);
      });
  }, [ageRange, disease, patients, search, sex, sort, studyFilter, studyNameById]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / patientPageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageStart = (visiblePage - 1) * patientPageSize;
  const paginatedPatients = filteredPatients.slice(pageStart, pageStart + patientPageSize);
  const displayStart = filteredPatients.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + patientPageSize, filteredPatients.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [ageRange, disease, search, sex, sort, studyFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <section className={`patient-list-card${className ? ` ${className}` : ''}`}>
      <header className="patient-list-card__header">
        <div>
          <h2>{t('患者列表')}</h2>
          <p>{t('按患者、样本和组学进度筛选队列')}</p>
        </div>
        <button className="module-primary-button" type="button" onClick={onCreatePatient}>
          <Icon name="filePlus" />
          {t('新建患者')}
        </button>
      </header>

      <div className="patient-controls">
        <label className="patient-search">
          <span>{t('患者搜索')}</span>
          <div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('输入患者编号、患者姓名、住院号或疾病类型')}
            />
            <Icon name="search" />
          </div>
        </label>

        {showStudyId ? (
          <label>
            <span>{t('Study ID')}</span>
            <select value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
              <option value="全部 Study">{t('全部 Study')}</option>
              {studyOptions.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
        ) : null}

        <label>
          <span>{t('性别')}</span>
          <select value={sex} onChange={(event) => setSex(event.target.value)}>
            <option value="全部">{t('全部')}</option>
            <option value="男">{t('男')}</option>
            <option value="女">{t('女')}</option>
          </select>
        </label>

        <label>
          <span>{t('年龄范围')}</span>
          <select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
            <option value="全部">{t('全部')}</option>
            <option value="18-35">18-35</option>
            <option value="36-55">36-55</option>
            <option value="55+">55+</option>
          </select>
        </label>

        <label>
          <span>{t('疾病类型')}</span>
          <select value={disease} onChange={(event) => setDisease(event.target.value as '全部' | DiseaseType)}>
            {diseaseOptions.map((option) => <option value={option} key={option}>{t(option)}</option>)}
          </select>
        </label>

        <label>
          <span>{t('排序')}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="最近更新">{t('最近更新')}</option>
            <option value="完整性优先">{t('CRF完整性优先')}</option>
            <option value="年龄升序">{t('年龄升序')}</option>
          </select>
        </label>
      </div>

      <PatientTable
        patients={paginatedPatients}
        activePatientName={activePatientName}
        onEditPatient={onEditPatient}
        onViewPatient={onViewPatient}
        studyNameById={studyNameById}
        showStudyId={showStudyId}
      />

      <footer className="patient-list-card__footer">
        <span>{t(`显示 ${displayStart} 至 ${displayEnd} 条，共 ${filteredPatients.length} 条记录`)}</span>
        <div className="patient-pagination">
          <button
            type="button"
            aria-label={t('上一页')}
            disabled={visiblePage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return (
              <button
                className={visiblePage === page ? 'is-active' : undefined}
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            );
          })}
          <button
            type="button"
            disabled={visiblePage === totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          >
            {t('下一页')}
          </button>
        </div>
      </footer>
    </section>
  );
}

interface PatientCohortPageProps {
  currentUser?: AuthenticatedUser | null;
  onCreatePatient?: () => void;
  onEditPatient?: (patient: PatientRecord) => void;
  onPatientChange?: (patient: PatientRecord) => void;
  onViewPatient?: (patient: PatientRecord) => void;
  onViewSamples?: (patient: PatientRecord) => void;
}

export function PatientCohortPage({
  currentUser,
  onPatientChange = () => undefined,
  onViewPatient = () => undefined
}: PatientCohortPageProps) {
  const { t } = useI18n();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [sampleRows, setSampleRows] = useState<SampleRecord[]>([]);
  const [omicsRows, setOmicsRows] = useState<OmicsRecord[]>([]);
  const [search, setSearch] = useState('');
  const [sex, setSex] = useState('全部');
  const [ageRange, setAgeRange] = useState('全部');
  const [disease, setDisease] = useState<'全部' | DiseaseType>('全部');
  const [studyFilter, setStudyFilter] = useState('全部 Study');
  const [sort, setSort] = useState('最近更新');
  const [currentPage, setCurrentPage] = useState(1);
  const [editorMode, setEditorMode] = useState<PatientEditorMode | null>(null);
  const [draftPatient, setDraftPatient] = useState<PatientRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState('等待患者操作');
  const [patientLoadStatus, setPatientLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sampleCollectedOnly, setSampleCollectedOnly] = useState(false);
  const [configuredDiseaseTypes, setConfiguredDiseaseTypes] = useState(getGlobalDiseaseTypes);
  const [configuredSampleTypes, setConfiguredSampleTypes] = useState(getGlobalSampleTypes);
  const [configuredDetectionTypes, setConfiguredDetectionTypes] = useState(getGlobalDetectionTypes);
  const [runtimeStudyOptions, setRuntimeStudyOptions] = useState<string[]>([]);
  const [runtimeStudyNames, setRuntimeStudyNames] = useState<StudyNameLookup>(defaultStudyNameLookup);
  const [sampleFocusPatient, setSampleFocusPatient] = useState<PatientRecord | null>(null);
  const [sampleCreateRequest, setSampleCreateRequest] = useState(0);
  const [omicsCreateRequest, setOmicsCreateRequest] = useState(0);
  const sampleSectionRef = useRef<HTMLDivElement>(null);
  const currentStudyId = getCurrentScopedStudyId();
  const availableStudyOptions = useMemo(
    () => currentStudyId
      ? [currentStudyId]
      : Array.from(new Set([
          ...runtimeStudyOptions,
          ...studyOptionsForUser(currentUser, patients)
        ])).sort(),
    [currentStudyId, currentUser, patients, runtimeStudyOptions]
  );
  const selectedPatientWriteStudyId = currentStudyId ?? (studyFilter !== '全部 Study' ? studyFilter : availableStudyOptions[0]);
  const canEditPatientRecords = canWritePatients(currentUser) && Boolean(selectedPatientWriteStudyId);
  const showStudyId = true;
  const studyNameById = useMemo(() => ({
    ...defaultStudyNameLookup(),
    ...runtimeStudyNames,
    ...Object.fromEntries(patients.filter((patient) => patient.studyName).map((patient) => [patient.studyId, patient.studyName as string]))
  }), [patients, runtimeStudyNames]);
  const studyScopedPatients = useMemo(
    () => patients.filter((patient) => studyFilter === '全部 Study' || patient.studyId === studyFilter),
    [patients, studyFilter]
  );
  const studyScopedSamples = useMemo(
    () => sampleRows.filter((sample) => studyFilter === '全部 Study' || sample.studyId === studyFilter),
    [sampleRows, studyFilter]
  );
  const studyScopedOmics = useMemo(
    () => omicsRows.filter((record) => studyFilter === '全部 Study' || record.studyId === studyFilter),
    [omicsRows, studyFilter]
  );
  const diseaseOptions = useMemo<Array<'全部' | DiseaseType>>(
    () => ['全部', ...Array.from(new Set([...configuredDiseaseTypes, ...studyScopedPatients.map((patient) => patient.diseaseType)]))],
    [configuredDiseaseTypes, studyScopedPatients]
  );
  const editorDiseaseOptions = useMemo<DiseaseType[]>(() => {
    const options = Array.from(new Set([
      ...configuredDiseaseTypes,
      ...studyScopedPatients.map((patient) => patient.diseaseType),
      currentStudyDefaultDisease(currentStudyId)
    ]));
    return options.length ? options : [currentStudyDefaultDisease(currentStudyId)];
  }, [configuredDiseaseTypes, currentStudyId, studyScopedPatients]);

  useEffect(() => {
    const refresh = () => {
      setConfiguredDiseaseTypes(getGlobalDiseaseTypes());
      setConfiguredSampleTypes(getGlobalSampleTypes());
      setConfiguredDetectionTypes(getGlobalDetectionTypes());
    };
    window.addEventListener(globalConfigChangedEvent, refresh);
    return () => window.removeEventListener(globalConfigChangedEvent, refresh);
  }, []);

  useEffect(() => {
    let ignore = false;
    void fetchGlobalConfiguration()
      .then((config) => {
        if (ignore) return;
        setConfiguredDiseaseTypes(config.diseaseTypes);
        setConfiguredSampleTypes(config.sampleTypes);
        setConfiguredDetectionTypes(config.detectionTypes);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setRuntimeStudyOptions([]);
      return undefined;
    }
    let ignore = false;
    void fetchStudies()
      .then((studies) => {
        if (ignore) return;
        const activeStudies = studies.filter((study) => study.status !== 'deleted');
        setRuntimeStudyOptions(activeStudies.map((study) => study.id));
        setRuntimeStudyNames({
          ...defaultStudyNameLookup(),
          ...Object.fromEntries(activeStudies.map((study) => [study.id, study.name]))
        });
      })
      .catch(() => {
        if (!ignore) setRuntimeStudyOptions([]);
      });
    return () => {
      ignore = true;
    };
  }, [currentUser]);

  useEffect(() => {
    let ignore = false;

    setPatientLoadStatus('loading');
    void fetchWorkspaceDataset()
      .then((dataset) => {
        if (!ignore) {
          setPatients(dataset.patients);
          setSampleRows(dataset.samples);
          setOmicsRows(dataset.omics);
          setPatientLoadStatus('ready');
          setSaveStatus(dataset.patients.length ? `已读取 ${dataset.patients.length} 名患者` : '当前授权范围暂无患者');
        }
      })
      .catch((error) => {
        if (!ignore) {
          setPatients([]);
          setSampleRows([]);
          setOmicsRows([]);
          setPatientLoadStatus('error');
          setSaveStatus(isPermissionError(error) ? '后端登录已失效，请重新登录后查看患者' : '患者数据读取失败：请检查后端 API');
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    return studyScopedPatients
      .filter((patient) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return [
	          patient.name,
	          patient.patientName ?? '',
	          patient.patientNameInitials ?? '',
          studyNameForPatient(patient, studyNameById),
	          patient.hospitalNo,
          patient.diseaseType,
          sampleText(patient),
          patient.note
        ].some((value) => value.toLowerCase().includes(query));
      })
      .filter((patient) => sex === '全部' || patient.sex === sex)
      .filter((patient) => disease === '全部' || patient.diseaseType === disease)
	      .filter((patient) => {
	        if (ageRange === '全部') return true;
	        if (ageRange === '18-35') return patient.age >= 18 && patient.age <= 35;
	        if (ageRange === '36-55') return patient.age >= 36 && patient.age <= 55;
	        return patient.age > 55;
	      })
	      .filter((patient) => !sampleCollectedOnly || patient.samples.length > 0)
	      .sort((a, b) => {
	        if (sort === '完整性优先') return calculateClinicalCompleteness(b.clinicalData) - calculateClinicalCompleteness(a.clinicalData);
	        if (sort === '年龄升序') return a.age - b.age;
	        return a.name.localeCompare(b.name);
	      });
	  }, [ageRange, disease, sampleCollectedOnly, search, sex, sort, studyNameById, studyScopedPatients]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / patientPageSize));
  const pageStart = (currentPage - 1) * patientPageSize;
  const paginatedPatients = filteredPatients.slice(pageStart, pageStart + patientPageSize);
  const displayStart = filteredPatients.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + patientPageSize, filteredPatients.length);
  const emptyPatientMessage =
    patientLoadStatus === 'loading'
      ? '正在读取患者数据...'
      : patientLoadStatus === 'error'
        ? '患者数据读取失败，请重新登录或检查后端 API'
        : patients.length
          ? '暂无匹配患者'
          : '当前授权范围暂无患者';

  useEffect(() => {
    setCurrentPage(1);
  }, [ageRange, disease, sampleCollectedOnly, search, sex, sort, studyFilter]);

  useEffect(() => {
    if (studyFilter !== '全部 Study' && !availableStudyOptions.includes(studyFilter)) {
      setStudyFilter('全部 Study');
    }
  }, [availableStudyOptions, studyFilter]);

  useEffect(() => {
    if (currentStudyId) setStudyFilter(currentStudyId);
  }, [currentStudyId]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!canEditPatientRecords) {
      setSaveStatus('当前角色只读：患者新增/编辑已禁用');
      setDraftPatient(null);
      setEditorMode(null);
    }
  }, [canEditPatientRecords]);

  function openCreatePatientEditor() {
    if (!canEditPatientRecords) {
      setSaveStatus(currentStudyId ? '当前角色没有患者写入权限，请切换到 Study CRC 或 LZ CRC' : '请先选择一个 Study，再新建患者');
      return;
    }
    setEditorMode('create');
    setDraftPatient(makeDraftPatient(selectedPatientWriteStudyId));
    setSaveStatus(`正在新建 ${selectedPatientWriteStudyId} 患者`);
  }

  function openEditPatientEditor(patient: PatientRecord) {
    if (!canEditPatientRecords) {
      setSaveStatus(currentStudyId ? '当前角色没有患者写入权限，请切换到 Study CRC 或 LZ CRC' : '请先选择一个 Study，再编辑患者');
      return;
    }
    setEditorMode('edit');
    setDraftPatient({ ...patient, organs: [...patient.organs], clinicalData: { ...patient.clinicalData } });
    setSaveStatus(`正在编辑患者 ${patient.name}`);
  }

  function cancelPatientEditor() {
    setEditorMode(null);
    setDraftPatient(null);
    setSaveStatus('等待患者操作');
  }

  function patchDraftPatient(patch: Partial<PatientRecord>) {
    setDraftPatient((current) => (current ? { ...current, ...patch } : current));
  }

  async function savePatientEditor() {
    if (!draftPatient || !editorMode) return;
    const targetStudyId = draftPatient.studyId || selectedPatientWriteStudyId;
    if (!targetStudyId) {
      setSaveStatus('请先选择一个 Study，再保存患者');
      return;
    }
	    if (!draftPatient.name.trim() || !draftPatient.patientName?.trim() || !draftPatient.hospitalNo.trim()) {
	      setSaveStatus('患者编号、患者姓名和住院号为必填项');
      return;
    }

    const nextPatient = {
      ...draftPatient,
	      studyId: targetStudyId,
	      patientNumber: draftPatient.patientNumber?.trim() || draftPatient.name.trim(),
	      patientName: draftPatient.patientName?.trim() ?? '',
	      name: draftPatient.name.trim(),
      hospitalNo: draftPatient.hospitalNo.trim(),
      note: draftPatient.note.trim()
    };

    setSaveStatus(editorMode === 'create' ? '患者正在写入后端...' : `患者 ${nextPatient.name} 正在同步后端...`);
    try {
      const saved = editorMode === 'create' ? await createPatientRecord(nextPatient) : await updatePatientRecord(nextPatient);
      setPatients((rows) => {
        const exists = rows.some((patient) => patient.id === saved.id || patient.name === saved.name);
        if (exists) return rows.map((patient) => (patient.id === saved.id || patient.name === saved.name ? { ...patient, ...saved } : patient));
        return [saved, ...rows];
      });
      setSearch('');
      setRuntimeStudyOptions((options) => saved.studyId && !options.includes(saved.studyId) ? [...options, saved.studyId].sort() : options);
      onPatientChange(saved);
      setEditorMode(null);
      setDraftPatient(null);
      setSaveStatus(editorMode === 'create' ? `患者已创建：${saved.name}` : `患者已保存：${saved.name}`);
    } catch (error) {
      setSaveStatus(isPermissionError(error) ? '保存失败：当前角色没有患者写入权限' : '保存失败：后端未接受患者变更');
    }
  }

  async function removePatient(patient: PatientRecord) {
    if (!patient.id) {
      setSaveStatus('删除失败：缺少患者后端 ID');
      return;
    }
    setSaveStatus(`患者 ${patient.name} 正在从后端删除...`);
    try {
      await deletePatientRecord(patient.id);
      setPatients((rows) => rows.filter((row) => row.id !== patient.id));
      setSaveStatus(`患者已删除：${patient.name}`);
    } catch (error) {
      setSaveStatus(isPermissionError(error) ? '删除失败：当前角色没有患者写入权限' : '删除失败：后端未接受删除请求');
    }
  }

  function viewPatientSamples(patient: PatientRecord) {
    setSampleFocusPatient(patient);
    onPatientChange(patient);
    window.requestAnimationFrame(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function addPatientSample(patient: PatientRecord) {
    setSampleFocusPatient(patient);
    setSampleCreateRequest(Date.now());
    onPatientChange(patient);
    window.requestAnimationFrame(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function addPatientOmics(patient: PatientRecord) {
    setSampleFocusPatient(patient);
    setOmicsCreateRequest(Date.now());
    onPatientChange(patient);
    window.requestAnimationFrame(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="content patient-page">
      <section className="patient-filter-chips" aria-label="患者队列筛选">
        {diseaseOptions.map((option) => (
          <button
            className={`chip patient-chip${disease === option ? ' is-selected' : ''}`}
            key={option}
            type="button"
            onClick={() => setDisease(option)}
          >
            <Icon name={option === '全部' ? 'patients' : option === 'HC' ? 'userPlus' : 'dna'} />
            <span>{t(option)}</span>
          </button>
        ))}
        <button className="chip patient-chip" type="button" onClick={() => setSex('女')}>
          <Icon name="female" />
          <span>{t('女性')}</span>
        </button>
        <button className={`chip patient-chip${sampleCollectedOnly ? ' is-selected' : ''}`} type="button" onClick={() => setSampleCollectedOnly((value) => !value)}>
          <Icon name="sampleTube" />
          <span>{t('样本已采集')}</span>
        </button>
        <button className="chip patient-chip" type="button" onClick={() => setSort('完整性优先')}>
          <Icon name="check" />
          <span>{t('CRF完整性')} &gt;80%</span>
        </button>
      </section>

      <section className="patient-overview-grid" aria-label="患者队列运营概览">
        <CohortOverviewPanel patients={studyScopedPatients} samples={studyScopedSamples} omicsRows={studyScopedOmics} />
        <SampleSummaryPanel samples={studyScopedSamples} configuredTypes={configuredSampleTypes} />
        <DetectionSummaryPanel omicsRows={studyScopedOmics} configuredTypes={configuredDetectionTypes} />
        <RemainingSampleSummaryPanel samples={studyScopedSamples} omicsRows={studyScopedOmics} configuredTypes={configuredSampleTypes} />
      </section>

      <div className="patient-main-grid">
        <section className="patient-list-card">
          <header className="patient-list-card__header">
            <div>
              <h2>{t('患者列表')}</h2>
              <p>{t('按患者、样本和组学进度筛选队列')}</p>
            </div>
            <button
              className="module-primary-button"
              type="button"
              disabled={!canEditPatientRecords}
              title={canEditPatientRecords ? undefined : t(currentStudyId ? '当前角色没有患者写入权限' : '请先选择一个 Study，再新建患者')}
              onClick={openCreatePatientEditor}
            >
              <Icon name="filePlus" />
              {t('新建患者')}
            </button>
          </header>

          <div className="patient-controls">
            <label className="patient-search">
              <span>{t('患者搜索')}</span>
              <div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
	                  placeholder={t('输入患者编号、患者姓名、住院号或疾病类型')}
                />
                <Icon name="search" />
              </div>
            </label>

            {showStudyId ? (
              <label>
                <span>{t('Study ID')}</span>
                <select value={studyFilter} onChange={(event) => setStudyFilter(event.target.value)}>
                  <option value="全部 Study">{t('全部 Study')}</option>
                  {availableStudyOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
              </label>
            ) : null}

            <label>
              <span>{t('性别')}</span>
              <select value={sex} onChange={(event) => setSex(event.target.value)}>
                <option value="全部">{t('全部')}</option>
                <option value="男">{t('男')}</option>
                <option value="女">{t('女')}</option>
              </select>
            </label>

            <label>
              <span>{t('年龄范围')}</span>
              <select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
                <option value="全部">{t('全部')}</option>
                <option value="18-35">18-35</option>
                <option value="36-55">36-55</option>
                <option value="55+">55+</option>
              </select>
            </label>

            <label>
              <span>{t('疾病类型')}</span>
              <select value={disease} onChange={(event) => setDisease(event.target.value as '全部' | DiseaseType)}>
                {diseaseOptions.map((option) => <option value={option} key={option}>{t(option)}</option>)}
              </select>
            </label>

            <label>
              <span>{t('排序')}</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="最近更新">{t('最近更新')}</option>
                <option value="完整性优先">{t('CRF完整性优先')}</option>
                <option value="年龄升序">{t('年龄升序')}</option>
              </select>
            </label>
          </div>

          {draftPatient ? (
            <section className="patient-editor-card" aria-label="患者编辑表单">
              <header>
                <div>
                  <strong>{editorMode === 'create' ? t('新建患者') : t(`编辑患者 ${draftPatient.name}`)}</strong>
                  <span>{draftPatient.studyId || selectedPatientWriteStudyId || '-'}</span>
                </div>
                <div className="module-table-actions">
                  <button className="module-link-button module-link-button--primary" type="button" disabled={!canEditPatientRecords} onClick={() => void savePatientEditor()}>{t('保存')}</button>
                  <button className="module-link-button" type="button" onClick={cancelPatientEditor}>{t('取消')}</button>
                </div>
              </header>
              <div className="patient-editor-grid">
                <label>
                  <span>{t('Study ID')}</span>
                  {showStudyId ? (
                    <select
                      value={draftPatient.studyId || selectedPatientWriteStudyId || ''}
                      onChange={(event) => patchDraftPatient({
                        studyId: event.target.value,
                        diseaseType: currentStudyDefaultDisease(event.target.value),
                        organs: []
                      })}
                    >
                      {availableStudyOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input value={draftPatient.studyId || selectedPatientWriteStudyId || ''} readOnly />
                  )}
                </label>
	                <label>
	                  <span>{t('患者编号')}</span>
	                  <input value={draftPatient.name} onChange={(event) => patchDraftPatient({ name: event.target.value })} />
	                </label>
	                <label>
	                  <span>{t('患者姓名')}</span>
	                  <input value={draftPatient.patientName ?? ''} onChange={(event) => patchDraftPatient({ patientName: event.target.value })} />
	                </label>
	                <label>
                  <span>{t('住院号')}</span>
                  <input value={draftPatient.hospitalNo} onChange={(event) => patchDraftPatient({ hospitalNo: event.target.value })} />
                </label>
                <label>
                  <span>{t('性别')}</span>
                  <select value={draftPatient.sex} onChange={(event) => patchDraftPatient({ sex: event.target.value as PatientRecord['sex'] })}>
                    <option value="男">{t('男')}</option>
                    <option value="女">{t('女')}</option>
                  </select>
                </label>
                <label>
                  <span>{t('年龄')}</span>
                  <input type="number" min={0} max={120} value={draftPatient.age} onChange={(event) => patchDraftPatient({ age: Number(event.target.value) })} />
                </label>
                <label>
                  <span>{t('疾病类型')}</span>
                  <select value={draftPatient.diseaseType} onChange={(event) => patchDraftPatient({ diseaseType: event.target.value as DiseaseType })}>
                    {editorDiseaseOptions.map((option) => <option value={option} key={option}>{t(option)}</option>)}
                  </select>
                </label>
                <label className="patient-editor-note">
                  <span>{t('注释')}</span>
                  <input value={draftPatient.note} onChange={(event) => patchDraftPatient({ note: event.target.value })} />
                </label>
              </div>
            </section>
          ) : null}

          <div className="module-upload-status">
            <Icon name="shield" />
            <span>{t(saveStatus)}</span>
          </div>

          <PatientTable
            patients={paginatedPatients}
            canEdit={canEditPatientRecords}
            emptyMessage={emptyPatientMessage}
            onEditPatient={openEditPatientEditor}
            onViewPatient={onViewPatient}
            onViewSamples={viewPatientSamples}
            onAddSample={addPatientSample}
            onAddOmics={addPatientOmics}
            onDeletePatient={(patient) => void removePatient(patient)}
            studyNameById={studyNameById}
            showStudyId={showStudyId}
          />

          <footer className="patient-list-card__footer">
            <span>{t(`显示 ${displayStart} 至 ${displayEnd} 条，共 ${filteredPatients.length} 条记录`)}</span>
            <div className="patient-pagination">
              <button
                type="button"
                aria-label={t('上一页')}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;
                return (
                  <button
                    className={currentPage === page ? 'is-active' : undefined}
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                {t('下一页')}
              </button>
            </div>
          </footer>
        </section>

      </div>

      <div className="patient-sample-section" ref={sampleSectionRef}>
        <SampleTestingPage
          selectedPatient={sampleFocusPatient}
          embedded
          createSampleRequest={sampleCreateRequest}
          createOmicsRequest={omicsCreateRequest}
        />
      </div>
    </div>
  );
}
