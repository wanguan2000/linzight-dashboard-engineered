import { useEffect, useMemo, useState } from 'react';
import {
  calculateClinicalCompleteness,
  cohortStats,
  diseaseDistribution,
  patientRecords,
  sampleSummary,
  type DiseaseType,
  type OmicsStatus,
  type PatientRecord
} from '../data/patientCohort';
import { Icon } from './Icon';
import { KpiProgress } from './MetricGrid';
import { fetchDemoDataset } from '../services/api';

const diseaseOptions: Array<'全部' | DiseaseType> = ['全部', 'NPSLE', 'Non-NPSLE', 'MS', 'NMOSD', 'HC'];
const patientPageSize = 10;

function sampleText(patient: PatientRecord) {
  return patient.samples.map((sample) => `${sample.type}${sample.count > 1 ? ` x${sample.count}` : ''}`).join(' / ');
}

function sampleSummaryIcon(label: string) {
  if (label === '血液') return 'blood';
  if (label === 'CSF') return 'csf';
  if (label === '肾') return 'kidney';
  return 'sampleBank';
}

function sampleSummaryClass(label: string) {
  if (label === '血液') return 'sample-summary__item--blood';
  if (label === 'CSF') return 'sample-summary__item--csf';
  if (label === '肾') return 'sample-summary__item--kidney';
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

function PatientKpiGrid() {
  return (
    <section className="patient-kpis" aria-label="患者队列关键指标">
      {cohortStats.map((metric) => (
        <article className="kpi-card patient-kpi" key={metric.label}>
          <div>
            <p className="kpi-card__label">{metric.label}</p>
            <strong className="kpi-card__value">{metric.value}</strong>
            <p className="kpi-card__delta is-up">
              <span className="delta-arrow">↑</span>
              <span>{metric.delta}</span>
              <span>{metric.helper}</span>
            </p>
          </div>
          {'progress' in metric && typeof metric.progress === 'number' ? (
            <KpiProgress progress={metric.progress} />
          ) : (
            <Icon className="kpi-card__icon" name={metric.icon} size={44} />
          )}
        </article>
      ))}
    </section>
  );
}

function CohortOverviewPanel() {
  return (
    <section className="cohort-side-card" aria-label="队列概览">
      <header className="cohort-side-card__header">
        <h2>队列概览</h2>
      </header>
      <div className="cohort-overview">
        <div className="cohort-donut">
          <strong>1,248</strong>
          <span>总计</span>
        </div>
        <div className="cohort-legend">
          {diseaseDistribution.map((item) => (
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

function CompletenessTrendPanel() {
  return (
    <section className="cohort-side-card" aria-label="数据完整性趋势">
      <header className="cohort-side-card__header">
        <h2>数据完整性趋势</h2>
        <span>本月</span>
      </header>
      <div className="cohort-mini-chart">
        <svg viewBox="0 0 220 118" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="20" x2="220" y2="20" className="chart-grid" />
          <line x1="0" y1="52" x2="220" y2="52" className="chart-grid" />
          <line x1="0" y1="84" x2="220" y2="84" className="chart-grid" />
          <path d="M 0 82 C 22 74 34 82 48 66 C 64 50 82 70 102 55 C 122 40 138 55 160 43 C 178 35 196 42 220 28 L 220 118 L 0 118 Z" fill="rgba(45,191,184,.18)" />
          <path d="M 0 82 C 22 74 34 82 48 66 C 64 50 82 70 102 55 C 122 40 138 55 160 43 C 178 35 196 42 220 28" fill="none" stroke="#48b99b" strokeWidth="3" strokeLinecap="round" />
          <text x="184" y="23" className="chart-label">88.6%</text>
        </svg>
        <div className="cohort-chart-axis"><span>5月1日</span><span>5月15日</span><span>5月29日</span></div>
      </div>
    </section>
  );
}

function SampleSummaryPanel() {
  return (
    <section className="cohort-side-card" aria-label="样本采集汇总">
      <header className="cohort-side-card__header">
        <h2>样本采集汇总</h2>
      </header>
      <div className="sample-summary">
        {sampleSummary.map((item) => (
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
  const [patients, setPatients] = useState(patientRecords);
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
        if (!ignore && dataset.patients.length >= patientPageSize * 3) {
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

      <PatientKpiGrid />

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
          <CohortOverviewPanel />
          <CompletenessTrendPanel />
          <SampleSummaryPanel />
          <p className="patient-update-time">数据更新于 2024-05-29 14:30</p>
        </aside>
      </div>
    </div>
  );
}
