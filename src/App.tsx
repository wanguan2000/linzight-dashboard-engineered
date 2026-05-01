import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import {
  ClinicalDataCapturePage,
  ConsentManagementPage,
  PatientJourneyPage,
  ReportsPage,
  SampleTestingPage,
  SystemManagementPage
} from './components/ModulePages';
import { PatientCohortPage } from './components/PatientCohortPage';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import type { AuthenticatedUser } from './data/auth';
import { navItems } from './data/dashboard';
import type { PatientRecord } from './data/patientCohort';
import { useI18n } from './i18n/I18nProvider';

declare global {
  interface Window {
    __LINZIGHT_INITIAL_MODULE__?: string;
  }
}

const moduleSlugMap: Record<string, string> = {
  首页工作台: 'home-workbench',
  患者队列管理: 'patient-cohort-management',
  知情同意: 'informed-consent',
  临床数据采集: 'clinical-data-capture',
  样本及检测: 'sample-testing',
  患者旅程: 'patient-journey',
  数据分析: 'data-analysis',
  系统管理: 'system-management'
};

const authStorageKey = 'linzight-demo-user';

function getNavIndexByLabel(label?: string | null) {
  if (!label) return 0;
  const normalizedLabel = decodeURIComponent(label).trim();
  const index = navItems.findIndex((item) => item.label === normalizedLabel);
  return index >= 0 ? index : 0;
}

function getNavIndexBySlug(slug?: string | null) {
  if (!slug) return 0;
  const normalizedSlug = slug.replace(/\.html$/i, '').trim();
  const label = Object.entries(moduleSlugMap).find(([, value]) => value === normalizedSlug)?.[0];
  return getNavIndexByLabel(label);
}

function getInitialNavIndex() {
  if (typeof window === 'undefined') return 0;

  const initialModule = window.__LINZIGHT_INITIAL_MODULE__;
  if (initialModule) return getNavIndexByLabel(initialModule);

  const params = new URLSearchParams(window.location.search);
  const moduleParam = params.get('module');
  if (moduleParam) return getNavIndexByLabel(moduleParam);

  const hashSlug = window.location.hash.replace(/^#\/?/, '');
  if (hashSlug) return getNavIndexBySlug(hashSlug);

  const pathSlug = window.location.pathname.split('/').pop();
  return getNavIndexBySlug(pathSlug);
}

function getInitialUser(): AuthenticatedUser | null {
  if (typeof window === 'undefined') return null;
  const rawUser = window.localStorage.getItem(authStorageKey);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as AuthenticatedUser;
  } catch {
    window.localStorage.removeItem(authStorageKey);
    return null;
  }
}

function syncModuleRoute(label: string) {
  if (typeof window === 'undefined') return;
  const slug = moduleSlugMap[label];
  if (!slug) return;

  const url = new URL(window.location.href);
  url.searchParams.set('module', label);
  url.hash = slug;
  window.history.replaceState({ module: label }, '', `${url.pathname}${url.search}${url.hash}`);
}

function getTopbarCopy(activeModule: string) {
  const copy: Record<string, { title: string; subtitle: string; aiPlaceholder?: string; showAiPrompts?: boolean }> = {
    首页工作台: {
      title: '欢迎回来，约翰·伦格博士',
      subtitle: '这里是今日临床研究运营概览。'
    },
    患者队列管理: {
      title: '患者队列管理',
      subtitle: '管理和审核 LGL-1111 研究患者队列。',
      aiPlaceholder: '搜索患者、住院号、疾病类型，或询问 LinZight AI...'
    },
    知情同意: {
      title: '知情同意管理',
      subtitle: '管理患者授权、版本签署与审计轨迹。',
      aiPlaceholder: '询问 LinZight AI... 例如：列出待签署患者、汇总撤回情况'
    },
    临床数据采集: {
      title: '临床数据采集',
      subtitle: '采集和审核 LGL-1111 研究结构化临床数据。',
      aiPlaceholder: '搜索患者、住院号、疾病类型，或询问 LinZight AI...'
    },
    样本及检测: {
      title: '样本及检测',
      subtitle: '管理样本采集、检测项目、结果文件和检测进度。',
      aiPlaceholder: '询问样本采集、检测状态、结果文件或患者样本情况...'
    },
    患者旅程: {
      title: '患者旅程',
      subtitle: '查看单患者从筛选、知情同意、临床随访到样本检测的全景数据。',
      aiPlaceholder: '询问单患者病程、样本结果、下次随访风险...'
    },
    数据分析: {
      title: '导出 / 报表',
      subtitle: '生成研究数据集、患者全景报表与审计导出。',
      aiPlaceholder: '询问报表生成、数据导出、SDTM 草稿或审计记录...'
    },
    系统管理: {
      title: '系统管理',
      subtitle: '管理账户、角色、字段配置和权限策略。',
      aiPlaceholder: '询问角色权限、字段配置或系统审计...'
    }
  };

  return copy[activeModule] ?? copy.首页工作台;
}

export default function App() {
  useI18n();
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(getInitialUser);
  const [activeNavIndex, setActiveNavIndex] = useState(getInitialNavIndex);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const activeModule = navItems[activeNavIndex]?.label ?? '首页工作台';
  const topbarCopy = getTopbarCopy(activeModule);

  function setActiveModule(label: string) {
    const index = navItems.findIndex((item) => item.label === label);
    setActiveNavIndex(index >= 0 ? index : 0);
  }

  useEffect(() => {
    syncModuleRoute(activeModule);
  }, [activeModule]);

  function openPatientJourney(patient: PatientRecord) {
    setSelectedPatient(patient);
    setActiveModule('患者旅程');
  }

  function openClinicalData(patient: PatientRecord) {
    setSelectedPatient(patient);
    setActiveModule('临床数据采集');
  }

  function createPatient() {
    setSelectedPatient(null);
    setActiveModule('临床数据采集');
  }

  function handleAuthenticated(user: AuthenticatedUser) {
    window.localStorage.setItem(authStorageKey, JSON.stringify(user));
    setCurrentUser(user);
  }

  function handleLogout() {
    window.localStorage.removeItem(authStorageKey);
    window.localStorage.removeItem('linzight-demo-token');
    setSelectedPatient(null);
    setActiveNavIndex(0);
    setCurrentUser(null);
  }

  function renderActiveModule() {
    if (activeModule === '患者队列管理') {
      return <PatientCohortPage onCreatePatient={createPatient} onEditPatient={openClinicalData} onViewPatient={openPatientJourney} />;
    }
    if (activeModule === '知情同意') return <ConsentManagementPage />;
    if (activeModule === '临床数据采集') return <ClinicalDataCapturePage selectedPatient={selectedPatient} onOpenPatientJourney={openPatientJourney} />;
    if (activeModule === '样本及检测') return <SampleTestingPage />;
    if (activeModule === '患者旅程') return <PatientJourneyPage selectedPatient={selectedPatient} />;
    if (activeModule === '数据分析') return <ReportsPage />;
    if (activeModule === '系统管理') return <SystemManagementPage />;
    return <Dashboard selectedModule={activeModule === '首页工作台' ? undefined : activeModule} selectedPatient={selectedPatient} />;
  }

  if (!currentUser) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <Sidebar activeIndex={activeNavIndex} onSelect={setActiveNavIndex} currentUser={currentUser} />
      <main className="main-panel">
        <Topbar
          aiPlaceholder={topbarCopy.aiPlaceholder}
          showAiPrompts={topbarCopy.showAiPrompts}
          title={topbarCopy.title}
          subtitle={topbarCopy.subtitle}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        {renderActiveModule()}
      </main>
    </div>
  );
}
