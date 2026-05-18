import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  accessibleStudyIdsForUser,
  activeStudyStorageKey,
  authStorageKey,
  isPlatformRole,
  normalizeAuthenticatedUser,
  userCanAccessStudy,
  type AuthenticatedUser
} from './data/auth';
import { navItems } from './data/dashboard';
import type { PatientRecord } from './data/patientCohort';
import { useI18n } from './i18n/I18nProvider';
import { authTokenStorageKey, fetchCurrentUser, fetchStudies, logoutFromBackend } from './services/api';

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

const lzPlatformBusinessRoles = new Set(['LZ_ADMIN', 'LZ_CRC', 'LZ_DATA_MANAGER']);
const lzPlatformGlobalModules = new Set(['首页工作台', '患者队列管理', '临床数据采集', '样本及检测', '患者旅程', '数据分析', '系统管理']);

function isLzPlatformBusinessRole(user: AuthenticatedUser | null) {
  return Boolean(user?.role && lzPlatformBusinessRoles.has(user.role));
}

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

function getInitialActiveStudyId(user: AuthenticatedUser | null): string | undefined {
  if (typeof window === 'undefined' || !user) return undefined;
  const activeStudyId = window.localStorage.getItem(activeStudyStorageKey) || undefined;
  if (activeStudyId && userCanAccessStudy(user, activeStudyId)) return activeStudyId;
  if (activeStudyId) window.localStorage.removeItem(activeStudyStorageKey);
  const studyIds = accessibleStudyIdsForUser(user);
  if (studyIds.length === 1) return studyIds[0];
  return undefined;
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
      title: '欢迎回来，任约翰博士',
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

function canAccessModule(user: AuthenticatedUser | null, label: string, activeStudyId?: string) {
  if (!user) return true;
  if (!activeStudyId) {
    if (isLzPlatformBusinessRole(user)) return lzPlatformGlobalModules.has(label);
    return isPlatformRole(user) && label === '系统管理';
  }
  if (user.role === 'LZ_ADMIN') return true;
  if (label === '系统管理') return ['LZ_CRF_ADMIN', 'STUDY_CONFIG_ADMIN', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_DATA_MANAGER'].includes(user.role);
  if (label === '数据分析') return ['LZ_CRC', 'LZ_DATA_MANAGER', 'LZ_AUDITOR', 'STUDY_PI', 'STUDY_CRC', 'STUDY_DATA_MANAGER'].includes(user.role);
  if (label === '临床数据采集') return !['LZ_AUDITOR'].includes(user.role);
  if (label === '样本及检测') return !['LZ_CRF_ADMIN', 'LZ_AUDITOR', 'STUDY_CONFIG_ADMIN'].includes(user.role);
  if (label === '知情同意') return !['LZ_CRF_ADMIN', 'LZ_AUDITOR', 'STUDY_CONFIG_ADMIN'].includes(user.role);
  return true;
}

export default function App() {
  useI18n();
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(getInitialUser);
  const [activeStudyId, setActiveStudyId] = useState<string | undefined>(() => getInitialActiveStudyId(getInitialUser()));
  const [activeNavIndex, setActiveNavIndex] = useState(getInitialNavIndex);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [runtimeStudyOptions, setRuntimeStudyOptions] = useState<Array<{ id: string; name: string }>>([]);
  const hasVerifiedSession = useRef(false);
  const visibleNavItems = useMemo(() => {
    const items = navItems.filter((item) => canAccessModule(currentUser, item.label, activeStudyId));
    if (currentUser && isPlatformRole(currentUser) && !activeStudyId) {
      return items.map((item) => {
        if (item.label === '系统管理') return { ...item, label: 'Study 系统管理', routeLabel: item.label };
        return item;
      });
    }
    return items;
  }, [activeStudyId, currentUser]);
  const activeModule = navItems[activeNavIndex]?.label ?? '首页工作台';
  const visibleActiveIndex = Math.max(0, visibleNavItems.findIndex((item) => (item.routeLabel ?? item.label) === activeModule));
  const baseTopbarCopy = getTopbarCopy(activeModule);
  const topbarCopy =
    currentUser && isPlatformRole(currentUser) && !activeStudyId && activeModule === '患者队列管理'
      ? {
          ...baseTopbarCopy,
          title: '患者队列管理',
          subtitle: 'LZ 平台视角按 Study 汇总患者队列；业务读写仍逐个使用 Study Workspace API。',
          aiPlaceholder: '搜索患者、Study ID、疾病类型或状态...',
          showAiPrompts: false
        }
      : currentUser && isPlatformRole(currentUser) && !activeStudyId && activeModule === '系统管理'
        ? {
            ...baseTopbarCopy,
            title: 'Study 系统管理',
            subtitle: '管理 Study、用户、Study 绑定和平台角色；业务数据继续按 study_id 隔离。',
            aiPlaceholder: '询问 Study、用户、角色或授权范围...',
            showAiPrompts: false
          }
        : baseTopbarCopy;
  const topbarTitle =
    activeModule === '首页工作台' && currentUser
      ? `欢迎回来，${currentUser.name}`
      : topbarCopy.title;
  const topbarStudyOptions = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.studyScope?.scopeType === 'all_studies') return runtimeStudyOptions;
    const userStudyIds = accessibleStudyIdsForUser(currentUser);
    return userStudyIds.map((id) => runtimeStudyOptions.find((study) => study.id === id) ?? { id, name: id });
  }, [currentUser, runtimeStudyOptions]);
  const activeStudyContext = activeStudyId
    ? (topbarStudyOptions.find((study) => study.id === activeStudyId) ?? { id: activeStudyId, name: activeStudyId })
    : undefined;

  function setActiveModule(label: string) {
    const index = navItems.findIndex((item) => item.label === label);
    setActiveNavIndex(index >= 0 ? index : 0);
  }

  useEffect(() => {
    syncModuleRoute(activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (!currentUser) {
      setRuntimeStudyOptions([]);
      return undefined;
    }
    let cancelled = false;
    const loadStudies = () => {
      void fetchStudies()
        .then((studies) => {
          if (!cancelled) {
            setRuntimeStudyOptions(studies.filter((study) => study.status !== 'deleted').map((study) => ({ id: study.id, name: study.name })));
          }
        })
        .catch(() => {
          if (!cancelled) setRuntimeStudyOptions([]);
        });
    };
    loadStudies();
    window.addEventListener('linzight-studies-updated', loadStudies);
    return () => {
      cancelled = true;
      window.removeEventListener('linzight-studies-updated', loadStudies);
    };
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser || hasVerifiedSession.current) return undefined;
    if (!window.localStorage.getItem(authTokenStorageKey)) return undefined;
    hasVerifiedSession.current = true;
    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return;
        window.localStorage.setItem(authStorageKey, JSON.stringify(user));
        setCurrentUser(user);
        const storedActiveStudyId = window.localStorage.getItem(activeStudyStorageKey) || undefined;
        if (storedActiveStudyId && !userCanAccessStudy(user, storedActiveStudyId)) {
          window.localStorage.removeItem(activeStudyStorageKey);
          setActiveStudyId(undefined);
        }
      })
      .catch(() => {
        if (cancelled) return;
        window.localStorage.removeItem(authStorageKey);
        window.localStorage.removeItem(authTokenStorageKey);
        window.localStorage.removeItem(activeStudyStorageKey);
        window.localStorage.removeItem('linzight-demo-token');
        setSelectedPatient(null);
        setActiveStudyId(undefined);
        setCurrentUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || canAccessModule(currentUser, activeModule, activeStudyId)) return;
    setActiveModule(visibleNavItems[0]?.label ?? '首页工作台');
  }, [activeModule, activeStudyId, currentUser, visibleNavItems]);

  useEffect(() => {
    if (!currentUser) return;
    if (activeStudyId && userCanAccessStudy(currentUser, activeStudyId)) return;
    if (activeStudyId) {
      window.localStorage.removeItem(activeStudyStorageKey);
      setActiveStudyId(undefined);
      return;
    }
    const studyIds = accessibleStudyIdsForUser(currentUser);
    if (!isPlatformRole(currentUser) && studyIds.length === 1) {
      window.localStorage.setItem(activeStudyStorageKey, studyIds[0]);
      setActiveStudyId(studyIds[0]);
    }
  }, [activeStudyId, currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedPatient) return;
    if (!selectedPatient.studyId || !userCanAccessStudy(currentUser, selectedPatient.studyId) || (activeStudyId && selectedPatient.studyId !== activeStudyId)) {
      setSelectedPatient(null);
    }
  }, [activeStudyId, currentUser, selectedPatient]);

  function enterStudyWorkspace(studyId: string) {
    if (!currentUser || !userCanAccessStudy(currentUser, studyId)) return;
    window.localStorage.setItem(activeStudyStorageKey, studyId);
    setActiveStudyId(studyId);
  }

  function enterGlobalManagement() {
    if (!currentUser || !isPlatformRole(currentUser)) return;
    window.localStorage.removeItem(activeStudyStorageKey);
    setActiveStudyId(undefined);
    setSelectedPatient(null);
    setActiveModule('系统管理');
  }

  function openPatientJourney(patient: PatientRecord) {
    if (patient.studyId && currentUser && userCanAccessStudy(currentUser, patient.studyId)) {
      enterStudyWorkspace(patient.studyId);
    }
    setSelectedPatient(patient);
    setActiveModule('患者旅程');
  }

  function openClinicalData(patient: PatientRecord) {
    if (patient.studyId && currentUser && userCanAccessStudy(currentUser, patient.studyId)) {
      enterStudyWorkspace(patient.studyId);
    }
    setSelectedPatient(patient);
    setActiveModule('临床数据采集');
  }

  function createPatient() {
    if (!activeStudyId) {
      setActiveModule('患者队列管理');
      return;
    }
    setSelectedPatient(null);
    setActiveModule('临床数据采集');
  }

  function handleAuthenticated(user: AuthenticatedUser, nextActiveStudyId?: string) {
    hasVerifiedSession.current = false;
    window.localStorage.setItem(authStorageKey, JSON.stringify(user));
    if (nextActiveStudyId && userCanAccessStudy(user, nextActiveStudyId)) {
      window.localStorage.setItem(activeStudyStorageKey, nextActiveStudyId);
      setActiveStudyId(nextActiveStudyId);
      setActiveNavIndex(0);
    } else {
      window.localStorage.removeItem(activeStudyStorageKey);
      setActiveStudyId(undefined);
      setActiveModule('系统管理');
    }
    setCurrentUser(user);
  }

  function handleLogout() {
    hasVerifiedSession.current = false;
    logoutFromBackend().catch(() => undefined);
    window.localStorage.removeItem(authStorageKey);
    window.localStorage.removeItem(authTokenStorageKey);
    window.localStorage.removeItem(activeStudyStorageKey);
    window.localStorage.removeItem('linzight-demo-token');
    setSelectedPatient(null);
    setActiveStudyId(undefined);
    setActiveNavIndex(0);
    setCurrentUser(null);
  }

  function renderActiveModule() {
    if (activeModule === '患者队列管理') {
      return <PatientCohortPage currentUser={currentUser} onCreatePatient={createPatient} onEditPatient={openClinicalData} onViewPatient={openPatientJourney} />;
    }
    if (activeModule === '知情同意') return <ConsentManagementPage currentUser={currentUser} />;
    if (activeModule === '临床数据采集') {
      return <ClinicalDataCapturePage selectedPatient={selectedPatient} onOpenPatientJourney={openPatientJourney} onPatientChange={setSelectedPatient} />;
    }
    if (activeModule === '样本及检测') return <SampleTestingPage />;
    if (activeModule === '患者旅程') return <PatientJourneyPage selectedPatient={selectedPatient} onPatientChange={setSelectedPatient} />;
    if (activeModule === '数据分析') return <ReportsPage currentUser={currentUser} />;
    if (activeModule === '系统管理') return <SystemManagementPage currentUser={currentUser} />;
    return (
      <Dashboard
        currentUser={currentUser}
        activeStudy={activeStudyContext}
        selectedModule={activeModule === '首页工作台' ? undefined : activeModule}
        selectedPatient={selectedPatient}
        onNavigate={setActiveModule}
      />
    );
  }

  if (!currentUser) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeIndex={visibleActiveIndex}
        items={visibleNavItems}
        onSelect={(index) => setActiveModule(visibleNavItems[index]?.routeLabel ?? visibleNavItems[index]?.label ?? '首页工作台')}
        currentUser={currentUser}
      />
      <main className="main-panel">
        <Topbar
          aiPlaceholder={topbarCopy.aiPlaceholder}
          showAiPrompts={topbarCopy.showAiPrompts}
          title={topbarTitle}
          subtitle={topbarCopy.subtitle}
          currentUser={currentUser}
          activeStudyId={activeStudyId}
          activeStudy={activeStudyContext}
          studyOptions={topbarStudyOptions}
          onStudyChange={enterStudyWorkspace}
          onGlobalManagement={isPlatformRole(currentUser) ? enterGlobalManagement : undefined}
          onLogout={handleLogout}
        />
        {renderActiveModule()}
      </main>
    </div>
  );
}
