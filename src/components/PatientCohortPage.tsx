import { useEffect, useMemo, useState } from 'react';
import {
  calculateClinicalCompleteness,
  type DiseaseType,
  type OmicsStatus,
  type PatientRecord
} from '../data/patientCohort';
import { Icon } from './Icon';
import { KpiProgress } from './MetricGrid';
import type { AuthenticatedUser } from '../data/auth';
import { createPatientRecord, fetchDemoDataset, getCurrentScopedStudyId, isPermissionError, updatePatientRecord } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import type { IconName } from '../types';

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

type CohortKpiMetric = {
  label: string;
  value: string;
  helper: string;
  delta?: string;
  icon: IconName;
  progress?: number;
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
  helper: string;
};

type CompletenessTrend = {
  areaPath: string;
  linePath: string;
  label: string;
  axis: [string, string, string];
};

type PatientEditorMode = 'create' | 'edit';

const patientWriteRoles = new Set(['LZ_ADMIN', 'LZ_CRC', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN']);

function canWritePatients(user?: AuthenticatedUser | null) {
  return Boolean(user && patientWriteRoles.has(user.role));
}

function currentStudyDefaultDisease(studyId?: string): DiseaseType {
  if (studyId === 'LZXK-01') return 'NSCLC';
  return 'NPSLE';
}

function makeDraftPatient(studyId?: string): PatientRecord {
  const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return {
    studyId: studyId ?? '',
    name: `NEW-${today}`,
    hospitalNo: '',
    sex: '女',
    age: 45,
    diseaseType: currentStudyDefaultDisease(studyId),
    organs: [],
    samples: [],
    omicsStatus: '样本采集',
    note: '',
    clinicalData: {}
  };
}

function sampleText(patient: PatientRecord) {
  return patient.samples.map((sample) => `${sample.type}${sample.count > 1 ? ` x${sample.count}` : ''}`).join(' / ');
}

function sampleSummaryIcon(label: string) {
  if (label === '血液') return 'blood';
  if (label === 'CSF') return 'csf';
  if (label === '肾') return 'kidney';
  if (label === '组织') return 'sampleTube';
  if (label === '胸水') return 'sampleBank';
  return 'sampleBank';
}

function sampleSummaryClass(label: string) {
  if (label === '血液') return 'sample-summary__item--blood';
  if (label === 'CSF') return 'sample-summary__item--csf';
  if (label === '肾') return 'sample-summary__item--kidney';
  if (label === '组织' || label === '胸水') return 'sample-summary__item--sample';
  return 'sample-summary__item--total';
}

function statusClass(status: OmicsStatus) {
  if (status === '完成') return 'is-complete';
  if (status === '进行中') return 'is-running';
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

function formatPercent(value: number, total: number) {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getCompletenessValues(patients: PatientRecord[]) {
  return patients.map((patient) => calculateClinicalCompleteness(patient.clinicalData));
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
  let cursor = 0;
  const segments = distribution.map((item) => {
    const start = cursor;
    cursor += Number.parseFloat(item.percent) || 0;
    return `${item.color} ${start}% ${cursor}%`;
  });

  return `radial-gradient(circle, rgba(255, 255, 255, 0.96) 0 48%, transparent 49%), conic-gradient(${segments.join(', ')})`;
}

function buildSampleSummary(patients: PatientRecord[]): SampleSummaryItem[] {
  const counts = patients.reduce<Record<string, number>>((acc, patient) => {
    patient.samples.forEach((sample) => {
      acc[sample.type] = (acc[sample.type] ?? 0) + sample.count;
    });
    return acc;
  }, {});
  const totalSamples = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const patientCount = patients.length;

  return [
    ...['血液', 'CSF', '肾', '组织', '胸水']
      .filter((label) => counts[label])
      .map((label) => ({ label, value: formatCount(counts[label] ?? 0), helper: formatPercent(counts[label] ?? 0, patientCount) })),
    { label: '总样本数', value: formatCount(totalSamples), helper: '数据库实时' }
  ];
}

function buildKpiMetrics(patients: PatientRecord[]): CohortKpiMetric[] {
  const patientCount = patients.length;
  const countByDisease = patients.reduce<Record<string, number>>((acc, patient) => {
    acc[patient.diseaseType] = (acc[patient.diseaseType] ?? 0) + 1;
    return acc;
  }, {});
  const completeness = Number(average(getCompletenessValues(patients)).toFixed(1));
  const topDiseases = Object.entries(countByDisease)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return [
    { label: '总患者数', value: formatCount(patientCount), helper: '数据库实时', icon: 'patients' },
    ...topDiseases.map(([label, value]) => ({ label, value: formatCount(value), delta: formatPercent(value, patientCount), helper: '占总数', icon: 'dna' as IconName })),
    { label: '数据完整性', value: `${completeness}%`, delta: `${patientCount}例`, helper: '平均完整度', icon: 'check', progress: completeness }
  ];
}

function buildCompletenessTrend(patients: PatientRecord[]): CompletenessTrend {
  const values = getCompletenessValues(patients);
  const bucketSize = Math.max(1, Math.ceil(values.length / 3));
  const buckets = [0, 1, 2].map((bucket) => {
    const slice = values.slice(bucket * bucketSize, bucket * bucketSize + bucketSize);
    return slice.length ? average(slice) : average(values);
  });
  const points = buckets.map((value, index) => {
    const x = index * 110;
    const y = 108 - Math.max(0, Math.min(100, value));
    return { x, y };
  });
  const fallback = points[0] ?? { x: 0, y: 108 };
  const [first = fallback, middle = fallback, last = fallback] = points;
  const linePath = `M ${first.x} ${first.y} C 44 ${first.y} 66 ${middle.y} ${middle.x} ${middle.y} C 154 ${middle.y} 176 ${last.y} ${last.x} ${last.y}`;
  const areaPath = `${linePath} L 220 118 L 0 118 Z`;
  const current = Number(average(values).toFixed(1));

  return {
    areaPath,
    linePath,
    label: `${current}%`,
    axis: ['前段', '中段', '当前']
  };
}

function PatientKpiGrid({ patients }: { patients: PatientRecord[] }) {
  const { t } = useI18n();
  const metrics = buildKpiMetrics(patients);

  return (
    <section className="patient-kpis" aria-label="患者队列关键指标">
      {metrics.map((metric) => (
        <article className="kpi-card patient-kpi" key={metric.label}>
          <div>
            <p className="kpi-card__label">{t(metric.label)}</p>
            <strong className="kpi-card__value">{metric.value}</strong>
            <p className={`kpi-card__delta${metric.delta ? ' is-up' : ''}`}>
              {metric.delta ? <span className="delta-arrow">↑</span> : null}
              {metric.delta ? <span>{metric.delta}</span> : null}
              <span>{t(metric.helper)}</span>
            </p>
          </div>
          {typeof metric.progress === 'number' ? (
            <KpiProgress progress={metric.progress} />
          ) : (
            <Icon className="kpi-card__icon" name={metric.icon} size={44} />
          )}
        </article>
      ))}
    </section>
  );
}

function CohortOverviewPanel({ patients }: { patients: PatientRecord[] }) {
  const { t } = useI18n();
  const distribution = buildDiseaseDistribution(patients);

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
        <div className="cohort-legend">
          {distribution.map((item) => (
            <div className="cohort-legend__row" key={item.label}>
              <span className={`cohort-legend__dot cohort-legend__dot--${item.label.toLowerCase().replace('/', '-')}`} />
              <span>{t(item.label)}</span>
              <strong>{item.value} ({item.percent})</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompletenessTrendPanel({ patients }: { patients: PatientRecord[] }) {
  const { t } = useI18n();
  const trend = buildCompletenessTrend(patients);

  return (
    <section className="cohort-side-card" aria-label="数据完整性趋势">
      <header className="cohort-side-card__header">
        <h2>数据完整性趋势</h2>
        <span>{t('当前')}</span>
      </header>
      <div className="cohort-mini-chart">
        <svg viewBox="0 0 220 118" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="20" x2="220" y2="20" className="chart-grid" />
          <line x1="0" y1="52" x2="220" y2="52" className="chart-grid" />
          <line x1="0" y1="84" x2="220" y2="84" className="chart-grid" />
          <path d={trend.areaPath} fill="rgba(45,191,184,.18)" />
          <path d={trend.linePath} fill="none" stroke="#48b99b" strokeWidth="3" strokeLinecap="round" />
          <text x="178" y="23" className="chart-label">{trend.label}</text>
        </svg>
        <div className="cohort-chart-axis">{trend.axis.map((label) => <span key={label}>{t(label)}</span>)}</div>
      </div>
    </section>
  );
}

function SampleSummaryPanel({ patients }: { patients: PatientRecord[] }) {
  const { t } = useI18n();
  const summary = buildSampleSummary(patients);

  return (
    <section className="cohort-side-card" aria-label="样本采集汇总">
      <header className="cohort-side-card__header">
        <h2>样本采集汇总</h2>
      </header>
      <div className="sample-summary">
        {summary.map((item) => (
          <div className={`sample-summary__item ${sampleSummaryClass(item.label)}`} key={item.label}>
            <Icon name={sampleSummaryIcon(item.label)} />
            <strong>{item.value}</strong>
            <span>{t(item.label)}</span>
            <small>{t(item.helper)}</small>
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
  activePatientName?: string;
  canEdit?: boolean;
  showStudyId?: boolean;
}

function PatientTable({ patients, onEditPatient, onViewPatient, activePatientName, canEdit = true, showStudyId = false }: PatientTableProps) {
  const { t } = useI18n();

  return (
    <div className="patient-table-wrap">
      <table className="patient-table">
        <thead>
          <tr>
            <th>{t('患者编号')}</th>
            {showStudyId ? <th>{t('Study ID')}</th> : null}
            <th>{t('住院号')}</th>
            <th>{t('性别')}</th>
            <th>{t('年龄')}</th>
            <th>{t('疾病类型')}</th>
            <th>{t('受累脏器')}</th>
            <th>{t('样本采集')}</th>
            <th>{t('多组学检测')}</th>
            <th>{t('完整性')}</th>
            <th>{t('注释')}</th>
            <th>{t('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const completeness = calculateClinicalCompleteness(patient.clinicalData);
              return (
              <tr className={patient.name === activePatientName ? 'is-active' : undefined} key={`${patient.studyId}-${patient.name}`}>
                <td data-label={t('患者编号')}>{patient.name}</td>
                {showStudyId ? <td data-label={t('Study ID')}><span className="status-pill status-pill--info">{patient.studyId}</span></td> : null}
                <td data-label={t('住院号')}>{patient.hospitalNo}</td>
                <td data-label={t('性别')}>{t(patient.sex)}</td>
                <td data-label={t('年龄')}>{patient.age}</td>
                <td data-label={t('疾病类型')}><span className={`disease-pill disease-pill--${patient.diseaseType.toLowerCase().replace('-', '')}`}>{t(patient.diseaseType)}</span></td>
                <td data-label={t('受累脏器')}>{t(patient.organs.join(' / '))}</td>
                <td data-label={t('样本采集')}>{t(sampleText(patient))}</td>
                <td data-label={t('多组学检测')}><span className={`omics-pill ${statusClass(patient.omicsStatus)}`}>{t(patient.omicsStatus)}</span></td>
                <td data-label={t('完整性')}><span className={`complete-pill ${completenessClass(completeness)}`}>{completeness}%</span></td>
                <td data-label={t('注释')} className="patient-note">{t(patient.note)}</td>
                <td data-label={t('操作')}>
	                  <div className="patient-actions">
	                    <button type="button" onClick={() => onViewPatient(patient)}>{t('查看')}</button>
	                    <button
	                      type="button"
	                      disabled={!canEdit}
	                      title={canEdit ? undefined : t('当前角色没有患者写入权限')}
	                      onClick={() => onEditPatient(patient)}
	                    >
	                      {t('编辑')}
	                    </button>
	                  </div>
                </td>
              </tr>
            );
          })}
          {!patients.length && (
            <tr>
              <td colSpan={showStudyId ? 12 : 11}>{t('暂无匹配患者')}</td>
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
          patient.hospitalNo,
          patient.diseaseType,
          patient.organs.join(' '),
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
  }, [ageRange, disease, patients, search, sex, sort, studyFilter]);

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
              placeholder={t('输入患者编号、住院号或疾病类型')}
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
            <option value="完整性优先">{t('完整性优先')}</option>
            <option value="年龄升序">{t('年龄升序')}</option>
          </select>
        </label>
      </div>

      <PatientTable
        patients={paginatedPatients}
        activePatientName={activePatientName}
        onEditPatient={onEditPatient}
        onViewPatient={onViewPatient}
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
  onViewPatient?: (patient: PatientRecord) => void;
}

export function PatientCohortPage({
  currentUser,
  onViewPatient = () => undefined
}: PatientCohortPageProps) {
  const { t } = useI18n();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
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
  const [sampleCollectedOnly, setSampleCollectedOnly] = useState(false);
  const currentStudyId = getCurrentScopedStudyId();
  const availableStudyOptions = useMemo(
    () => currentStudyId ? [currentStudyId] : studyOptionsForUser(currentUser, patients),
    [currentStudyId, currentUser, patients]
  );
  const selectedPatientWriteStudyId = currentStudyId ?? (studyFilter !== '全部 Study' ? studyFilter : availableStudyOptions[0]);
  const canEditPatientRecords = canWritePatients(currentUser) && Boolean(selectedPatientWriteStudyId);
  const showStudyId = true;
  const studyScopedPatients = useMemo(
    () => patients.filter((patient) => studyFilter === '全部 Study' || patient.studyId === studyFilter),
    [patients, studyFilter]
  );
  const diseaseOptions = useMemo<Array<'全部' | DiseaseType>>(
    () => ['全部', ...Array.from(new Set(studyScopedPatients.map((patient) => patient.diseaseType)))],
    [studyScopedPatients]
  );
  const editorDiseaseOptions = useMemo<DiseaseType[]>(() => {
    const options = Array.from(new Set([
      ...studyScopedPatients.map((patient) => patient.diseaseType),
      currentStudyDefaultDisease(currentStudyId)
    ]));
    return options.length ? options : [currentStudyDefaultDisease(currentStudyId)];
  }, [currentStudyId, studyScopedPatients]);

  useEffect(() => {
    let ignore = false;

    void fetchDemoDataset()
      .then((dataset) => {
        if (!ignore && dataset.patients.length) {
          setPatients(dataset.patients);
        }
      })
      .catch(() => undefined);

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
          patient.hospitalNo,
          patient.diseaseType,
          patient.organs.join(' '),
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
	  }, [ageRange, disease, sampleCollectedOnly, search, sex, sort, studyScopedPatients]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / patientPageSize));
  const pageStart = (currentPage - 1) * patientPageSize;
  const paginatedPatients = filteredPatients.slice(pageStart, pageStart + patientPageSize);
  const displayStart = filteredPatients.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + patientPageSize, filteredPatients.length);

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
    if (!draftPatient.name.trim() || !draftPatient.hospitalNo.trim()) {
      setSaveStatus('患者编号和住院号为必填项');
      return;
    }

    const nextPatient = {
      ...draftPatient,
      studyId: targetStudyId,
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
      setSearch(saved.name);
      setEditorMode(null);
      setDraftPatient(null);
      setSaveStatus(editorMode === 'create' ? `患者已创建：${saved.name}` : `患者已保存：${saved.name}`);
    } catch (error) {
      setPatients((rows) => {
        const exists = rows.some((patient) => patient.id === nextPatient.id || patient.name === nextPatient.name);
        if (exists) return rows.map((patient) => (patient.id === nextPatient.id || patient.name === nextPatient.name ? nextPatient : patient));
        return [nextPatient, ...rows];
      });
      setSaveStatus(isPermissionError(error) ? '当前角色没有患者写入权限，变更仅保存在本页' : '后端不可用，患者变更已保存在本页');
    }
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
          <span>{t('完整性')} &gt;80%</span>
        </button>
      </section>

      <PatientKpiGrid patients={studyScopedPatients} />

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
                  placeholder={t('输入患者编号、住院号或疾病类型')}
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
                <option value="完整性优先">{t('完整性优先')}</option>
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
                        diseaseType: currentStudyDefaultDisease(event.target.value)
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
                <label>
                  <span>{t('受累脏器')}</span>
                  <input value={draftPatient.organs.join(' / ')} onChange={(event) => patchDraftPatient({ organs: event.target.value.split(/[、/]/).map((item) => item.trim()).filter(Boolean) })} />
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
            onEditPatient={openEditPatientEditor}
            onViewPatient={onViewPatient}
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

        <aside className="patient-side-stack">
          <CohortOverviewPanel patients={studyScopedPatients} />
          <CompletenessTrendPanel patients={studyScopedPatients} />
          <SampleSummaryPanel patients={studyScopedPatients} />
          <p className="patient-update-time">{t('数据源：数据库实时同步')}</p>
        </aside>
      </div>
    </div>
  );
}
