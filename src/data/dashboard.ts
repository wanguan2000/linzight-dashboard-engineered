import type {
  CohortStat,
  JourneyStage,
  KpiMetric,
  NavItem,
  QuickAction,
  QuickPrompt,
  SummaryItem,
  UserProfile,
  WorkflowItem
} from '../types';

export const userProfile: UserProfile = {
  name: '任约翰',
  role: '主要研究者',
  initials: 'RJ'
};

export const navItems: NavItem[] = [
  { label: '首页工作台', icon: 'home', active: true },
  { label: '患者队列管理', icon: 'patients' },
  { label: '知情同意', icon: 'studies' },
  { label: '临床数据采集', icon: 'crf', hasChildren: true },
  { label: '样本及检测', icon: 'sampleTube', hasChildren: true },
  { label: '患者旅程', icon: 'activity' },
  { label: '数据分析', icon: 'analytics', hasChildren: true },
  { label: '系统管理', icon: 'settings' }
];

export const quickPrompts: QuickPrompt[] = [
  { label: '查看数据完整性', icon: 'wave' },
  { label: '样本及检测', icon: 'samples' },
  { label: '患者旅程', icon: 'activity' },
  { label: '数据分析', icon: 'analytics' }
];

export const kpiMetrics: KpiMetric[] = [
  { label: '已入组患者', value: '2,842', delta: '18.6%', helper: '较近 30 天', icon: 'patients' },
  { label: '样本统计', value: '12', helper: '较近 30 天', icon: 'samples' },
  { label: '样本及检测', value: '48', delta: '2', helper: '较近 30 天', icon: 'lab' },
  { label: '随访次数', value: '8,732', delta: '22.4%', helper: '较近 30 天', icon: 'calendarCheck' },
  { label: '临床数据完整性', value: '96.7%', delta: '3.4%', helper: '较近 30 天', icon: 'check', progress: 96.7 }
];

export const journeyStages: JourneyStage[] = [
  { label: '已识别', value: '12,842', icon: 'patients', theme: 'teal' },
  { label: '已筛选', value: '9,317', icon: 'check', theme: 'teal' },
  { label: '已入组', value: '2,842', icon: 'studies', theme: 'teal' },
  { label: '治疗中', value: '2,104', icon: 'lock', theme: 'blue' },
  { label: '随访中', value: '1,307', icon: 'activity', theme: 'blue' },
  { label: '已完成', value: '842', icon: 'check', theme: 'blue' }
];

export const journeyRates = ['72.5%', '30.5%', '73.9%', '62.0%', '64.5%'];

export const cohortStats: CohortStat[] = [
  { label: '患者总数', value: '12,842', icon: 'patients', drillable: true },
  { label: '唯一患者', value: '9,317', icon: 'patients', drillable: true },
  { label: '中位年龄', value: '52.4 岁', icon: 'clock', drillable: true },
  { label: '女性占比', value: '56.3%', icon: 'female', drillable: true },
  { label: '平均合并症', value: '2.7', icon: 'activity' },
  { label: '中位随访', value: '18.6 月', icon: 'visits', drillable: true }
];

export const workflowItems: WorkflowItem[] = [
  { label: '患者筛选', icon: 'patients', count: '9,317 / 12,842', percent: 72 },
  { label: '知情同意', icon: 'studies', count: '2,901 / 2,842', percent: 102, status: 'over' },
  { label: '基线访视', icon: 'visits', count: '2,842 / 2,842', percent: 100, status: 'over' },
  { label: '样本采集', icon: 'samples', count: '2,104 / 2,842', percent: 74 },
  { label: '随访访视', icon: 'activity', count: '1,307 / 2,842', percent: 46, status: 'low' },
  { label: '数据锁库', icon: 'shield', count: '—', percent: 0, status: 'empty' }
];

export const omicsStats = [
  { label: '已处理样本', value: '1,248', delta: '↑ 12.4%' },
  { label: 'SLA 达标率', value: '92.7%', delta: '↑ 5.3%' },
  { label: 'SLA 目标', value: '≤ 5 天' }
];

export const summaryItems: SummaryItem[] = [
  { marker: '↑', theme: 'green', text: '入组趋势较上一季度提升 18.6%。', emphasis: ['18.6%'] },
  { marker: '中', theme: 'blue', text: '7 号中心和 12 号中心入组增长领先。', emphasis: ['7 号中心', '12 号中心'] },
  { marker: '数', theme: 'orange', text: '受 ePRO 推动，数据完整性提升 3.4%。', emphasis: ['3.4%'] },
  { marker: '!', theme: 'red', text: '12 名患者存在错过下次访视风险。', emphasis: ['12 名患者'] }
];

export const quickActions: QuickAction[] = [
  { label: '新增患者', icon: 'userPlus' },
  { label: '数据录入', icon: 'calendar' },
  { label: '样本录入', icon: 'filePlus' },
  { label: '随访录入', icon: 'visits' },
  { label: '知情同意', icon: 'studies' },
  { label: '患者旅程', icon: 'activity' },
  { label: '数据分析', icon: 'analytics' },
  { label: '系统管理', icon: 'settings' }
];
