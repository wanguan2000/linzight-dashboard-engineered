import { useEffect, useMemo, useState } from 'react';
import { CohortOverviewCard } from './CohortOverviewCard';
import { EnrollmentTrendCard } from './EnrollmentTrendCard';
import { MetricGrid } from './MetricGrid';
import { OmicsTatCard } from './OmicsTatCard';
import { PatientJourneyCard } from './PatientJourneyCard';
import { QuickActions } from './QuickActions';
import { SmartSummaryCard } from './SmartSummaryCard';
import { WorkflowProgressCard } from './WorkflowProgressCard';
import { fetchAnalyticsSummary } from '../services/api';
import type { ApiAnalysisSummary } from '../services/contracts';
import { authStorageKey, normalizeAuthenticatedUser, type AuthenticatedUser } from '../data/auth';
import type { PatientRecord } from '../data/patientCohort';
import { useI18n } from '../i18n/I18nProvider';
import type { CohortStat, JourneyStage, KpiMetric, WorkflowItem } from '../types';

interface DashboardProps {
  currentUser?: AuthenticatedUser | null;
  activeStudy?: { id: string; name: string };
  selectedModule?: string;
  selectedPatient?: PatientRecord | null;
  onNavigate?: (module: string) => void;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

type OmicsMetric = Array<{ label: string; value: string; delta?: string }>;

function buildDashboardData(summary?: ApiAnalysisSummary): {
  metrics: KpiMetric[];
  enrollmentValue: string;
  enrollmentDelta: string;
  journey: JourneyStage[];
  journeyRateValues: string[];
  cohort: CohortStat[];
  workflow: WorkflowItem[];
  workflowOverall: number;
  omics: OmicsMetric;
} {
  if (!summary || summary.patient_count === 0) {
    return {
      metrics: [
        { label: '已入组患者', value: '0', helper: '暂无患者数据', icon: 'patients' },
        { label: '样本统计', value: '0', helper: '暂无样本数据', icon: 'samples' },
        { label: '样本及检测', value: '0', helper: '暂无检测数据', icon: 'lab' },
        { label: '随访次数', value: '0', helper: '暂无访视数据', icon: 'calendarCheck' },
        { label: '临床数据完整性', value: '0%', helper: '暂无 CRF 数据', icon: 'check', progress: 0 }
      ],
      enrollmentValue: '0',
      enrollmentDelta: '暂无入组数据',
      journey: [
        { label: '已识别', value: '0', icon: 'patients', theme: 'teal' },
        { label: '已筛选', value: '0', icon: 'check', theme: 'teal' },
        { label: '已入组', value: '0', icon: 'studies', theme: 'teal' },
        { label: '治疗中', value: '0', icon: 'lock', theme: 'blue' },
        { label: '随访中', value: '0', icon: 'activity', theme: 'blue' },
        { label: '已完成', value: '0', icon: 'check', theme: 'blue' }
      ],
      journeyRateValues: ['0%', '0%', '0%', '0%', '0%'],
      cohort: [
        { label: '患者总数', value: '0', icon: 'patients', drillable: true },
        { label: '平均完整度', value: '0%', icon: 'visits', drillable: true }
      ],
      workflow: [
        { label: '患者筛选', icon: 'patients', count: '0 / 0', percent: 0, status: 'empty' },
        { label: '知情同意', icon: 'studies', count: '0 / 0', percent: 0, status: 'empty' },
        { label: 'CRF 录入', icon: 'crf', count: '0 / 0', percent: 0, status: 'empty' },
        { label: '样本采集', icon: 'samples', count: '0 / 0', percent: 0, status: 'empty' },
        { label: '组学归档', icon: 'activity', count: '0 / 0', percent: 0, status: 'empty' },
        { label: '导出归档', icon: 'shield', count: '0 / 0', percent: 0, status: 'empty' }
      ],
      workflowOverall: 0,
      omics: [
        { label: '已处理样本', value: '0', delta: '暂无样本' },
        { label: '检测归档率', value: '0%', delta: '0/0' },
        { label: '检测项目', value: '0' }
      ]
    };
  }

  const patientCount = summary.patient_count;
  const visitCount = summary.visit_count ?? 0;
  const crfCount = summary.crf_count ?? 0;
  const consentSignedCount = summary.consent_signed_count ?? 0;
  const samplePatientCount = summary.sample_patient_count ?? 0;
  const activePatientCount = summary.active_patient_count ?? patientCount - (summary.disease_distribution.HC ?? 0);
  const completedPatientCount = summary.completed_patient_count ?? 0;
  const completeness = Math.round(summary.data_completeness_avg);
  const consentPercent = percent(consentSignedCount, patientCount);
  const samplePercent = percent(samplePatientCount, patientCount);
  const completedOmicsPercent = percent(summary.completed_omics_count, summary.omics_count);
  const exportCount = summary.export_count ?? 0;
  const readyExportCount = summary.ready_export_count ?? 0;
  const exportPercent = percent(readyExportCount, exportCount);
  const overall = Math.round((100 + consentPercent + samplePercent + completedOmicsPercent + exportPercent) / 5);
  const diseaseStats = Object.entries(summary.disease_distribution)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([label, value]) => ({ label, value }));

  return {
    metrics: [
      { label: '已入组患者', value: formatCount(patientCount), helper: '已连接 patients 表', icon: 'patients' },
      { label: '样本统计', value: formatCount(summary.sample_count), helper: '已连接 samples 表', icon: 'samples' },
      { label: '样本及检测', value: formatCount(summary.omics_count), helper: `${summary.completed_omics_count} 项已归档`, icon: 'lab' },
      { label: '随访次数', value: formatCount(visitCount), helper: '已连接 visits 表', icon: 'calendarCheck' },
      { label: '临床数据完整性', value: `${summary.data_completeness_avg}%`, helper: 'clinical_data 平均值', icon: 'check', progress: completeness }
    ],
    enrollmentValue: formatCount(patientCount),
    enrollmentDelta: '来自后端业务数据',
    journey: [
      { label: '已识别', value: formatCount(patientCount), icon: 'patients', theme: 'teal' },
      { label: '已筛选', value: formatCount(patientCount), icon: 'check', theme: 'teal' },
      { label: '已入组', value: formatCount(patientCount), icon: 'studies', theme: 'teal' },
      { label: '治疗中', value: formatCount(activePatientCount), icon: 'lock', theme: 'blue' },
      { label: '随访中', value: formatCount(visitCount), icon: 'activity', theme: 'blue' },
      { label: '已完成', value: formatCount(completedPatientCount), icon: 'check', theme: 'blue' }
    ],
    journeyRateValues: [
      '100%',
      '100%',
      `${percent(activePatientCount, patientCount)}%`,
      `${percent(visitCount, Math.max(patientCount * 3, 1))}%`,
      `${percent(completedPatientCount, patientCount)}%`
    ],
    cohort: [
      { label: '患者总数', value: formatCount(patientCount), icon: 'patients', drillable: true },
      ...diseaseStats.map(({ label, value }) => ({ label, value: formatCount(value), icon: 'dna' as const, drillable: true })),
      { label: '平均完整度', value: `${summary.data_completeness_avg}%`, icon: 'visits', drillable: true }
    ],
    workflow: [
      { label: '患者筛选', icon: 'patients', count: `${formatCount(patientCount)} / ${formatCount(patientCount)}`, percent: 100, status: 'over' },
      { label: '知情同意', icon: 'studies', count: `${formatCount(consentSignedCount)} / ${formatCount(patientCount)}`, percent: consentPercent, status: consentPercent < 80 ? 'low' : 'normal' },
      { label: 'CRF 录入', icon: 'crf', count: `${formatCount(crfCount)} / ${formatCount(visitCount)}`, percent: percent(crfCount, visitCount), status: 'normal' },
      { label: '样本采集', icon: 'samples', count: `${formatCount(samplePatientCount)} / ${formatCount(patientCount)}`, percent: samplePercent, status: samplePercent < 80 ? 'low' : 'normal' },
      { label: '组学归档', icon: 'activity', count: `${formatCount(summary.completed_omics_count)} / ${formatCount(summary.omics_count)}`, percent: completedOmicsPercent, status: completedOmicsPercent < 80 ? 'low' : 'normal' },
      { label: '导出归档', icon: 'shield', count: `${formatCount(readyExportCount)} / ${formatCount(exportCount)}`, percent: exportPercent, status: exportCount === 0 ? 'empty' : exportPercent < 80 ? 'low' : 'normal' }
    ],
    workflowOverall: overall,
    omics: [
      { label: '已处理样本', value: formatCount(summary.sample_count), delta: '后端' },
      { label: '检测归档率', value: `${completedOmicsPercent}%`, delta: `${summary.completed_omics_count}/${summary.omics_count}` },
      { label: '检测项目', value: formatCount(summary.omics_count) }
    ]
  };
}

const quickActionModuleMap: Record<string, string> = {
  新增患者: '患者队列管理',
  数据录入: '临床数据采集',
  样本录入: '样本及检测',
  随访录入: '临床数据采集',
  知情同意: '知情同意',
  患者旅程: '患者旅程',
  数据分析: '数据分析',
  系统管理: '系统管理'
};

const quickWriteActions = new Set(['新增患者', '数据录入', '样本录入', '随访录入']);
const quickWriteRoles = new Set(['LZ_ADMIN', 'LZ_CRC', 'STUDY_CRC', 'STUDY_CONFIG_ADMIN']);
const systemManagementRoles = new Set(['LZ_ADMIN', 'LZ_CRF_ADMIN', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_CONFIG_ADMIN', 'STUDY_DATA_MANAGER']);

function getDisabledQuickActions(user?: AuthenticatedUser | null) {
  const disabled = new Set<string>();
  if (!user) return disabled;

  if (!quickWriteRoles.has(user.role)) {
    quickWriteActions.forEach((label) => disabled.add(label));
  }

  if (!systemManagementRoles.has(user.role)) {
    disabled.add('系统管理');
  }

  return disabled;
}

function getStoredDashboardUser() {
  if (typeof window === 'undefined') return null;
  const rawUser = window.localStorage.getItem(authStorageKey);
  if (!rawUser) return null;

  try {
    return normalizeAuthenticatedUser(JSON.parse(rawUser));
  } catch {
    return null;
  }
}

export function Dashboard({ currentUser, activeStudy, selectedModule, selectedPatient, onNavigate = () => undefined }: DashboardProps = {}) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<ApiAnalysisSummary | null>(null);
  const dashboardUser = currentUser ?? getStoredDashboardUser();

  useEffect(() => {
    let ignore = false;

    void fetchAnalyticsSummary()
      .then((nextSummary) => {
        if (!ignore) setSummary(nextSummary);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const dashboardData = useMemo(() => buildDashboardData(summary ?? undefined), [summary]);
  const disabledQuickActions = useMemo(() => getDisabledQuickActions(dashboardUser), [dashboardUser]);
  const systemQuickActionDisabled = disabledQuickActions.has('系统管理');

  return (
    <div className="content">
      {activeStudy ? (
        <section className="study-project-context" aria-label="Study 项目">
          <div className="study-project-context__label">
            <span>{t('Study 项目')}</span>
            <strong>{activeStudy.name}</strong>
          </div>
          <div className="study-project-context__meta">
            <span>{t('Study ID')}</span>
            <strong>{activeStudy.id}</strong>
          </div>
        </section>
      ) : null}

      {selectedModule && (
        <section className="module-context">
          <div>
            <span>当前模块</span>
            <strong>{selectedModule}</strong>
          </div>
          {selectedPatient && <p>已定位患者：{selectedPatient.name} / 住院号 {selectedPatient.hospitalNo}</p>}
        </section>
      )}

      <MetricGrid metrics={dashboardData.metrics} />

      <section className="charts-grid" aria-label="看板可视化">
        <EnrollmentTrendCard enrolled={dashboardData.enrollmentValue} delta={dashboardData.enrollmentDelta} />
        <PatientJourneyCard stages={dashboardData.journey} rates={dashboardData.journeyRateValues} onOpenPatients={() => onNavigate('患者队列管理')} />
        <OmicsTatCard stats={dashboardData.omics} tatValue={summary ? String(summary.completed_omics_count) : '0'} tatUnit="" tatLabel={summary ? '已归档检测' : '暂无检测'} onOpenLab={() => onNavigate('样本及检测')} />
      </section>

      <section className="bottom-grid" aria-label="运营概览">
        <CohortOverviewCard stats={dashboardData.cohort} onOpenCohort={() => onNavigate('患者队列管理')} />
        <WorkflowProgressCard items={dashboardData.workflow} overall={dashboardData.workflowOverall} />
        <SmartSummaryCard summary={summary} onViewInsights={() => onNavigate('数据分析')} />
      </section>

      <QuickActions
        disabledActions={disabledQuickActions}
        disabledReasons={{ 系统管理: '当前角色不能进入系统管理' }}
        moreDisabled={systemQuickActionDisabled}
        onMore={() => onNavigate('系统管理')}
        onSelectAction={(label) => onNavigate(quickActionModuleMap[label] ?? '首页工作台')}
      />
    </div>
  );
}
