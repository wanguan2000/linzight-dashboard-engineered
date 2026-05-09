import { useEffect, useMemo, useState } from 'react';
import {
  calculateClinicalCompleteness,
  diseases,
  lungResistanceDiseases,
  type DiseaseType,
  type OmicsStatus,
  type PatientRecord
} from '../data/patientCohort';
import { Icon } from './Icon';
import { KpiProgress } from './MetricGrid';
import { fetchDemoDataset } from '../services/api';
import type { IconName } from '../types';

const diseaseOptions: Array<'全部' | DiseaseType> = ['全部', ...diseases, ...lungResistanceDiseases];
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
  return diseaseOptions
    .filter((option): option is DiseaseType => option !== '全部')
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
  const npsleCount = countByDisease.NPSLE ?? 0;
  const neuroInflammatoryCount = (countByDisease.NMOSD ?? 0) + (countByDisease.MS ?? 0);
  const lungResistanceCount = lungResistanceDiseases.reduce((sum, disease) => sum + (countByDisease[disease] ?? 0), 0);
  const completeness = Number(average(getCompletenessValues(patients)).toFixed(1));

  return [
    { label: '总患者数', value: formatCount(patientCount), helper: '数据库实时', icon: 'patients' },
    { label: 'NPSLE', value: formatCount(npsleCount), delta: formatPercent(npsleCount, patientCount), helper: '占总数', icon: 'check' },
    { label: 'NMOSD / MS', value: formatCount(neuroInflammatoryCount), delta: formatPercent(neuroInflammatoryCount, patientCount), helper: '占总数', icon: 'dna' },
    { label: '肺癌耐药', value: formatCount(lungResistanceCount), delta: formatPercent(lungResistanceCount, patientCount), helper: 'LZXK-01', icon: 'dna' },
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
  const metrics = buildKpiMetrics(patients);

  return (
    <section className="patient-kpis" aria-label="患者队列关键指标">
      {metrics.map((metric) => (
        <article className="kpi-card patient-kpi" key={metric.label}>
          <div>
            <p className="kpi-card__label">{metric.label}</p>
            <strong className="kpi-card__value">{metric.value}</strong>
            <p className={`kpi-card__delta${metric.delta ? ' is-up' : ''}`}>
              {metric.delta ? <span className="delta-arrow">↑</span> : null}
              {metric.delta ? <span>{metric.delta}</span> : null}
              <span>{metric.helper}</span>
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
  const distribution = buildDiseaseDistribution(patients);

  return (
    <section className="cohort-side-card" aria-label="队列概览">
      <header className="cohort-side-card__header">
        <h2>队列概览</h2>
      </header>
      <div className="cohort-overview">
        <div className="cohort-donut" style={{ background: buildDonutGradient(distribution) }}>
          <strong>{formatCount(patients.length)}</strong>
          <span>总计</span>
        </div>
        <div className="cohort-legend">
          {distribution.map((item) => (
            <div className="cohort-legend__row" key={item.label}>
              <span className={`cohort-legend__dot cohort-legend__dot--${item.label.toLowerCase().replace('/', '-')}`} />
              <span>{item.label}</span>
              <strong>{item.value} ({item.percent})</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompletenessTrendPanel({ patients }: { patients: PatientRecord[] }) {
  const trend = buildCompletenessTrend(patients);

  return (
    <section className="cohort-side-card" aria-label="数据完整性趋势">
      <header className="cohort-side-card__header">
        <h2>数据完整性趋势</h2>
        <span>当前</span>
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
        <div className="cohort-chart-axis">{trend.axis.map((label) => <span key={label}>{label}</span>)}</div>
      </div>
    </section>
  );
}

function SampleSummaryPanel({ patients }: { patients: PatientRecord[] }) {
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
            <span>{item.label}</span>
            <small>{item.helper}</small>
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
}

function PatientTable({ patients, onEditPatient, onViewPatient, activePatientName }: PatientTableProps) {
  return (
    <div className="patient-table-wrap">
      <table className="patient-table">
        <thead>
          <tr>
            <th>患者编号</th>
            <th>住院号</th>
            <th>性别</th>
            <th>年龄</th>
            <th>疾病类型</th>
            <th>受累脏器</th>
            <th>样本采集</th>
            <th>多组学检测</th>
            <th>完整性</th>
            <th>注释</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const completeness = calculateClinicalCompleteness(patient.clinicalData);
            return (
              <tr className={patient.name === activePatientName ? 'is-active' : undefined} key={`${patient.studyId}-${patient.name}`}>
                <td>{patient.name}</td>
                <td>{patient.hospitalNo}</td>
                <td>{patient.sex}</td>
                <td>{patient.age}</td>
                <td><span className={`disease-pill disease-pill--${patient.diseaseType.toLowerCase().replace('-', '')}`}>{patient.diseaseType}</span></td>
                <td>{patient.organs.join(' / ')}</td>
                <td>{sampleText(patient)}</td>
                <td><span className={`omics-pill ${statusClass(patient.omicsStatus)}`}>{patient.omicsStatus}</span></td>
                <td><span className={`complete-pill ${completenessClass(completeness)}`}>{completeness}%</span></td>
                <td className="patient-note">{patient.note}</td>
                <td>
                  <div className="patient-actions">
                    <button type="button" onClick={() => onViewPatient(patient)}>查看</button>
                    <button type="button" onClick={() => onEditPatient(patient)}>编辑</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!patients.length && (
            <tr>
              <td colSpan={11}>暂无匹配患者</td>
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
  const [search, setSearch] = useState('');
  const [sex, setSex] = useState('全部');
  const [ageRange, setAgeRange] = useState('全部');
  const [disease, setDisease] = useState<'全部' | DiseaseType>('全部');
  const [sort, setSort] = useState('最近更新');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPatients = useMemo(() => {
    return patients
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
  }, [ageRange, disease, patients, search, sex, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / patientPageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageStart = (visiblePage - 1) * patientPageSize;
  const paginatedPatients = filteredPatients.slice(pageStart, pageStart + patientPageSize);
  const displayStart = filteredPatients.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + patientPageSize, filteredPatients.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [ageRange, disease, search, sex, sort]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <section className={`patient-list-card${className ? ` ${className}` : ''}`}>
      <header className="patient-list-card__header">
        <div>
          <h2>患者列表</h2>
          <p>按患者、样本和组学进度筛选队列</p>
        </div>
        <button className="module-primary-button" type="button" onClick={onCreatePatient}>
          <Icon name="filePlus" />
          新建患者
        </button>
      </header>

      <div className="patient-controls">
        <label className="patient-search">
          <span>患者搜索</span>
          <div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="输入患者编号、住院号或疾病类型"
            />
            <Icon name="search" />
          </div>
        </label>

        <label>
          <span>性别</span>
          <select value={sex} onChange={(event) => setSex(event.target.value)}>
            <option>全部</option>
            <option>男</option>
            <option>女</option>
          </select>
        </label>

        <label>
          <span>年龄范围</span>
          <select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
            <option>全部</option>
            <option>18-35</option>
            <option>36-55</option>
            <option>55+</option>
          </select>
        </label>

        <label>
          <span>疾病类型</span>
          <select value={disease} onChange={(event) => setDisease(event.target.value as '全部' | DiseaseType)}>
            {diseaseOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>

        <label>
          <span>排序</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option>最近更新</option>
            <option>完整性优先</option>
            <option>年龄升序</option>
          </select>
        </label>
      </div>

      <PatientTable
        patients={paginatedPatients}
        activePatientName={activePatientName}
        onEditPatient={onEditPatient}
        onViewPatient={onViewPatient}
      />

      <footer className="patient-list-card__footer">
        <span>显示 {displayStart} 至 {displayEnd} 条，共 {filteredPatients.length} 条记录</span>
        <div className="patient-pagination">
          <button
            type="button"
            aria-label="上一页"
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
            下一页
          </button>
        </div>
      </footer>
    </section>
  );
}

interface PatientCohortPageProps {
  onCreatePatient?: () => void;
  onEditPatient?: (patient: PatientRecord) => void;
  onViewPatient?: (patient: PatientRecord) => void;
}

export function PatientCohortPage({
  onCreatePatient = () => undefined,
  onEditPatient = () => undefined,
  onViewPatient = () => undefined
}: PatientCohortPageProps) {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [search, setSearch] = useState('');
  const [sex, setSex] = useState('全部');
  const [ageRange, setAgeRange] = useState('全部');
  const [disease, setDisease] = useState<'全部' | DiseaseType>('全部');
  const [sort, setSort] = useState('最近更新');
  const [currentPage, setCurrentPage] = useState(1);

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
    return patients
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
  }, [ageRange, disease, patients, search, sex, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / patientPageSize));
  const pageStart = (currentPage - 1) * patientPageSize;
  const paginatedPatients = filteredPatients.slice(pageStart, pageStart + patientPageSize);
  const displayStart = filteredPatients.length ? pageStart + 1 : 0;
  const displayEnd = Math.min(pageStart + patientPageSize, filteredPatients.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [ageRange, disease, search, sex, sort]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
            <span>{option}</span>
          </button>
        ))}
        <button className="chip patient-chip" type="button" onClick={() => setSex('女')}>
          <Icon name="female" />
          <span>女性</span>
        </button>
        <button className="chip patient-chip" type="button">
          <Icon name="sampleTube" />
          <span>样本已采集</span>
        </button>
        <button className="chip patient-chip" type="button" onClick={() => setSort('完整性优先')}>
          <Icon name="check" />
          <span>完整性 &gt;80%</span>
        </button>
      </section>

      <PatientKpiGrid patients={patients} />

      <div className="patient-main-grid">
        <section className="patient-list-card">
          <header className="patient-list-card__header">
            <div>
              <h2>患者列表</h2>
              <p>按患者、样本和组学进度筛选队列</p>
            </div>
            <button className="module-primary-button" type="button" onClick={onCreatePatient}>
              <Icon name="filePlus" />
              新建患者
            </button>
          </header>

          <div className="patient-controls">
            <label className="patient-search">
              <span>患者搜索</span>
              <div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="输入患者编号、住院号或疾病类型"
                />
                <Icon name="search" />
              </div>
            </label>

            <label>
              <span>性别</span>
              <select value={sex} onChange={(event) => setSex(event.target.value)}>
                <option>全部</option>
                <option>男</option>
                <option>女</option>
              </select>
            </label>

            <label>
              <span>年龄范围</span>
              <select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
                <option>全部</option>
                <option>18-35</option>
                <option>36-55</option>
                <option>55+</option>
              </select>
            </label>

            <label>
              <span>疾病类型</span>
              <select value={disease} onChange={(event) => setDisease(event.target.value as '全部' | DiseaseType)}>
                {diseaseOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <label>
              <span>排序</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option>最近更新</option>
                <option>完整性优先</option>
                <option>年龄升序</option>
              </select>
            </label>
          </div>

          <PatientTable patients={paginatedPatients} onEditPatient={onEditPatient} onViewPatient={onViewPatient} />

          <footer className="patient-list-card__footer">
            <span>显示 {displayStart} 至 {displayEnd} 条，共 {filteredPatients.length} 条记录</span>
            <div className="patient-pagination">
              <button
                type="button"
                aria-label="上一页"
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
                下一页
              </button>
            </div>
          </footer>
        </section>

        <aside className="patient-side-stack">
          <CohortOverviewPanel patients={patients} />
          <CompletenessTrendPanel patients={patients} />
          <SampleSummaryPanel patients={patients} />
          <p className="patient-update-time">数据源：数据库实时同步</p>
        </aside>
      </div>
    </div>
  );
}
