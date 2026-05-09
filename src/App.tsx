import { useEffect, useMemo, useState } from 'react';
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
import { authStorageKey, normalizeAuthenticatedUser, type AuthenticatedUser } from './data/auth';
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
    const user = normalizeAuthenticatedUser(JSON.parse(rawUser));
    if (user) {
      window.localStorage.setItem(authStorageKey, JSON.stringify(user));
      return user;
    }
    window.localStorage.removeItem(authStorageKey);
    return null;
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
      subtitle: '按 Study 权限管理和审核研究患者队列。',
      aiPlaceholder: '搜索患者、住院号、疾病类型，或询问 LinZight AI...'
    },
    知情同意: {
      title: '知情同意管理',
      subtitle: '管理患者授权、版本签署与审计轨迹。',
      aiPlaceholder: '询问 LinZight AI... 例如：列出待签署患者、汇总撤回情况'
    },
    临床数据采集: {
      title: '临床数据采集',
      subtitle: '采集和审核当前授权 Study 的结构化临床数据。',
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

function canAccessModule(user: AuthenticatedUser | null, label: string) {
  if (!user || user.role === 'LZ_ADMIN') return true;
  if (label === '系统管理') return ['LZ_CRF_ADMIN', 'STUDY_CONFIG_ADMIN', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_DATA_MANAGER'].includes(user.role);
  if (label === '数据分析') return ['LZ_CRC', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_PI', 'STUDY_DATA_MANAGER'].includes(user.role);
  if (label === '临床数据采集') return !['LZ_AUDITOR'].includes(user.role);
  if (label === '样本及检测') return !['LZ_CRF_ADMIN', 'LZ_AUDITOR', 'STUDY_CONFIG_ADMIN'].includes(user.role);
  if (label === '知情同意') return !['LZ_CRF_ADMIN', 'LZ_AUDITOR', 'STUDY_CONFIG_ADMIN'].includes(user.role);
  return true;
}

export default function App() {
  useI18n();
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(getInitialUser);
  const [activeNavIndex, setActiveNavIndex] = useState(getInitialNavIndex);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const visibleNavItems = useMemo(() => navItems.filter((item) => canAccessModule(currentUser, item.label)), [currentUser]);
  const activeModule = navItems[activeNavIndex]?.label ?? '首页工作台';
  const visibleActiveIndex = Math.max(0, visibleNavItems.findIndex((item) => item.label === activeModule));
  const topbarCopy = getTopbarCopy(activeModule);
  const topbarTitle =
    activeModule === '首页工作台' && currentUser
      ? `欢迎回来，${currentUser.name}`
      : topbarCopy.title;

  function setActiveModule(label: string) {
    const index = navItems.findIndex((item) => item.label === label);
    setActiveNavIndex(index >= 0 ? index : 0);
  }

  useEffect(() => {
    syncModuleRoute(activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (!currentUser || canAccessModule(currentUser, activeModule)) return;
    setActiveModule(visibleNavItems[0]?.label ?? '首页工作台');
  }, [activeModule, currentUser, visibleNavItems]);

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
    if (activeModule === '临床数据采集') {
      return <ClinicalDataCapturePage selectedPatient={selectedPatient} onOpenPatientJourney={openPatientJourney} onPatientChange={setSelectedPatient} />;
    }
    if (activeModule === '样本及检测') return <SampleTestingPage />;
    if (activeModule === '患者旅程') return <PatientJourneyPage selectedPatient={selectedPatient} onPatientChange={setSelectedPatient} />;
    if (activeModule === '数据分析') return <ReportsPage />;
    if (activeModule === '系统管理') return <SystemManagementPage />;
    return <Dashboard selectedModule={activeModule === '首页工作台' ? undefined : activeModule} selectedPatient={selectedPatient} />;
  }

  if (!currentUser) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeIndex={visibleActiveIndex}
        items={visibleNavItems}
        onSelect={(index) => setActiveModule(visibleNavItems[index]?.label ?? '首页工作台')}
        currentUser={currentUser}
      />
      <main className="main-panel">
        <Topbar
          aiPlaceholder={topbarCopy.aiPlaceholder}
          showAiPrompts={topbarCopy.showAiPrompts}
          title={topbarTitle}
          subtitle={topbarCopy.subtitle}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        {renderActiveModule()}
      </main>
    </div>
  );
}
