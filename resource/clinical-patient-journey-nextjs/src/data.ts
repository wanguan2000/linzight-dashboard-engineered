export type EventCategory = 'disease' | 'admission' | 'treatment' | 'visit' | 'sample' | 'omics';
export type EventKind = 'point' | 'range';

export interface JourneyEvent {
  id: string;
  kind: EventKind;
  category: EventCategory;
  track: string;
  title: string;
  date: string;
  endDate?: string;
  subtitle?: string;
  description: string;
  tag: string;
  color: string;
  softColor: string;
  borderColor: string;
  laneIndex: number;
  visible?: boolean;
}

export interface BiomarkerPoint {
  date: string;
  sledai: number;
  c3: number;
  esr: number;
  protein24h: number;
  igg: number;
}

export interface PatientSummary {
  patientId: string;
  name: string;
  sex: string;
  age: number;
  diagnosis: string;
  currentVisit: string;
  currentStatus: string;
  latestSledai: number;
  followup: string;
}

export const patientSummary: PatientSummary = {
  patientId: 'Nexus1111 / WG328',
  name: '王**',
  sex: '女',
  age: 34,
  diagnosis: 'NPSLE',
  currentVisit: 'V4 6月随访',
  currentStatus: '狼疮稳定，维持现有治疗',
  latestSledai: 4,
  followup: '2024-11-01'
};

export const trackLabels = ['病程主线', '住院/急性事件', '治疗方案', '随访访视', '样本与组学'];

export const categoryConfig: Record<EventCategory, { label: string; color: string; softColor: string; borderColor: string }> = {
  disease: {
    label: '病程',
    color: '#2478ff',
    softColor: '#eaf3ff',
    borderColor: '#8bb8ff'
  },
  admission: {
    label: '住院',
    color: '#fa8c16',
    softColor: '#fff4e6',
    borderColor: '#ffc078'
  },
  treatment: {
    label: '治疗',
    color: '#7c4dff',
    softColor: '#f1ecff',
    borderColor: '#b69cff'
  },
  visit: {
    label: '随访',
    color: '#12b5cb',
    softColor: '#e8fbfd',
    borderColor: '#8ae7f0'
  },
  sample: {
    label: '样本采集',
    color: '#20a162',
    softColor: '#eaf9f0',
    borderColor: '#84d9ad'
  },
  omics: {
    label: 'Omics检测',
    color: '#2f6bff',
    softColor: '#edf4ff',
    borderColor: '#99bbff'
  }
};

const c = categoryConfig;

export const journeyEvents: JourneyEvent[] = [
  {
    id: 'evt-onset',
    kind: 'point',
    category: 'disease',
    track: '病程主线',
    laneIndex: 0,
    title: '发病',
    tag: '发病',
    date: '2022-01-15',
    subtitle: '2022-01-15',
    description: '患者出现面部皮疹、乏力，后续伴随关节痛。',
    ...c.disease
  },
  {
    id: 'evt-diagnose',
    kind: 'point',
    category: 'disease',
    track: '病程主线',
    laneIndex: 0,
    title: '明确NPSLE',
    tag: '诊断',
    date: '2022-04-20',
    subtitle: '2022-04-20',
    description: '符合 ACR/EULAR 标准，诊断为 NPSLE。',
    ...c.omics
  },
  {
    id: 'evt-first-admission-pin',
    kind: 'point',
    category: 'admission',
    track: '病程主线',
    laneIndex: 0,
    title: '首次住院',
    tag: '住院',
    date: '2022-06-10',
    subtitle: '2022-06-10',
    description: '首次住院评估病情活动度，完善检查并制定治疗方案。',
    ...c.admission
  },
  {
    id: 'evt-relapse',
    kind: 'point',
    category: 'disease',
    track: '病程主线',
    laneIndex: 0,
    title: '复发',
    tag: '复发',
    date: '2023-03-05',
    subtitle: '2023-03-05',
    description: '出现皮疹与肾脏受累，提示疾病活动。',
    color: '#ff4d4f',
    softColor: '#fff1f0',
    borderColor: '#ffa39e'
  },
  {
    id: 'evt-cd20-start',
    kind: 'point',
    category: 'treatment',
    track: '病程主线',
    laneIndex: 0,
    title: 'CD20启动',
    tag: '治疗',
    date: '2024-05-01',
    subtitle: '2024-05-01',
    description: '开始 CD20 治疗，联合 MMF 维持。',
    ...c.treatment
  },
  {
    id: 'evt-v4',
    kind: 'point',
    category: 'visit',
    track: '病程主线',
    laneIndex: 0,
    title: 'V4 6月随访',
    tag: '随访',
    date: '2024-11-01',
    subtitle: 'SLEDAI 4，病情稳定',
    description: 'SLEDAI 4，狼疮稳定，继续现有治疗。',
    ...c.visit
  },
  {
    id: 'evt-adm-2022',
    kind: 'range',
    category: 'admission',
    track: '住院/急性事件',
    laneIndex: 1,
    title: '初次住院',
    tag: '住院',
    date: '2022-06-10',
    endDate: '2022-06-20',
    subtitle: '2022-06-10 ~ 2022-06-20',
    description: '初次住院，完成免疫学、脑脊液及影像学评估。',
    ...c.admission
  },
  {
    id: 'evt-adm-2024-relapse',
    kind: 'range',
    category: 'admission',
    track: '住院/急性事件',
    laneIndex: 1,
    title: '狼疮活动复发住院',
    tag: '住院',
    date: '2024-04-25',
    endDate: '2024-05-10',
    subtitle: '2024-04-25 ~ 2024-05-10',
    description: '高热、关节痛、补体下降、蛋白尿增加。',
    ...c.admission
  },
  {
    id: 'evt-observe-admission',
    kind: 'range',
    category: 'admission',
    track: '住院/急性事件',
    laneIndex: 1,
    title: '观察住院',
    tag: '住院',
    date: '2024-09-18',
    endDate: '2024-09-20',
    subtitle: '2024-09-18 ~ 2024-09-20',
    description: '短期观察住院，评估 CD20 后治疗反应。',
    ...c.admission
  },
  {
    id: 'evt-ctx',
    kind: 'range',
    category: 'treatment',
    track: '治疗方案',
    laneIndex: 2,
    title: '激素冲击',
    tag: '治疗',
    date: '2022-06-10',
    endDate: '2022-06-20',
    subtitle: '2022-06-10 ~ 2022-06-20',
    description: '甲泼尼龙冲击治疗。',
    ...c.treatment
  },
  {
    id: 'evt-mmf-maintain',
    kind: 'range',
    category: 'treatment',
    track: '治疗方案',
    laneIndex: 2,
    title: 'MMF维持',
    tag: '治疗',
    date: '2022-07-01',
    endDate: '2024-04-30',
    subtitle: '2022-07-01 ~ 2024-04-30',
    description: 'MMF 维持治疗，定期监测血常规、肝肾功能及病情活动度。',
    ...c.treatment
  },
  {
    id: 'evt-cd20-mmf',
    kind: 'range',
    category: 'treatment',
    track: '治疗方案',
    laneIndex: 2,
    title: 'CD20 + MMF',
    tag: '治疗',
    date: '2024-05-01',
    endDate: '2024-10-31',
    subtitle: '2024-05-01 ~ 2024-10-31',
    description: '开始 CD20 治疗，联合 MMF 维持。',
    ...c.treatment
  },
  {
    id: 'evt-ivig',
    kind: 'range',
    category: 'treatment',
    track: '治疗方案',
    laneIndex: 2,
    title: 'IVIG',
    tag: '治疗',
    date: '2024-10-15',
    endDate: '2024-11-05',
    subtitle: '2024-10-15 ~ 至今',
    description: '静脉免疫球蛋白治疗，用于辅助控制症状。',
    ...c.treatment
  },
  {
    id: 'evt-v1',
    kind: 'point',
    category: 'visit',
    track: '随访访视',
    laneIndex: 3,
    title: 'V1 基线',
    tag: '随访',
    date: '2022-06-01',
    subtitle: '2022-06-01',
    description: '基线随访，记录 SLEDAI、用药和实验室检查。',
    ...c.visit
  },
  {
    id: 'evt-v2',
    kind: 'point',
    category: 'visit',
    track: '随访访视',
    laneIndex: 3,
    title: 'V2 1月随访',
    tag: '随访',
    date: '2024-06-01',
    subtitle: 'SLEDAI 8，症状改善',
    description: 'SLEDAI 8，症状改善，实验室指标好转。',
    ...c.visit
  },
  {
    id: 'evt-v3',
    kind: 'point',
    category: 'visit',
    track: '随访访视',
    laneIndex: 3,
    title: 'V3 3月随访',
    tag: '随访',
    date: '2024-08-01',
    subtitle: '2024-08-01',
    description: '完成 3 月随访，记录治疗反应和不良事件。',
    ...c.visit
  },
  {
    id: 'evt-blood',
    kind: 'point',
    category: 'sample',
    track: '样本与组学',
    laneIndex: 4,
    title: '血液采集',
    tag: '样本采集',
    date: '2022-06-01',
    subtitle: '2022-06-01',
    description: '采集外周血样本，用于免疫指标检测。',
    ...c.sample
  },
  {
    id: 'evt-csf',
    kind: 'point',
    category: 'sample',
    track: '样本与组学',
    laneIndex: 4,
    title: 'CSF采集',
    tag: '样本采集',
    date: '2023-03-05',
    subtitle: '2023-03-05',
    description: '采集脑脊液样本，用于神经免疫检测。',
    ...c.sample
  },
  {
    id: 'evt-rnaseq',
    kind: 'point',
    category: 'omics',
    track: '样本与组学',
    laneIndex: 4,
    title: 'RNA-seq',
    tag: 'Omics检测',
    date: '2024-04-20',
    subtitle: '2024-04-20',
    description: 'RNA-seq 转录组检测，评估炎症通路变化。',
    ...c.sample
  },
  {
    id: 'evt-proteomics',
    kind: 'point',
    category: 'omics',
    track: '样本与组学',
    laneIndex: 4,
    title: 'Proteomics送检',
    tag: 'Omics检测',
    date: '2024-08-01',
    subtitle: '血浆蛋白组学检测',
    description: '血浆蛋白组学检测，LC-MS/MS平台。',
    ...c.omics
  },
  {
    id: 'evt-metabolomics',
    kind: 'point',
    category: 'omics',
    track: '样本与组学',
    laneIndex: 4,
    title: 'Metabolomics',
    tag: 'Omics检测',
    date: '2024-10-15',
    subtitle: '2024-10-15',
    description: '代谢组学检测，用于治疗响应相关分析。',
    ...c.sample
  }
];

export const eventStreamOrder = [
  'evt-v4',
  'evt-blood-2024',
  'evt-proteomics',
  'evt-v2',
  'evt-cd20-mmf',
  'evt-adm-2024-relapse',
  'evt-diagnose',
  'evt-relapse'
];

export const extraStreamEvents: JourneyEvent[] = [
  {
    id: 'evt-blood-2024',
    kind: 'point',
    category: 'sample',
    track: '样本与组学',
    laneIndex: 4,
    title: '血液、CSF采集',
    tag: '样本采集',
    date: '2024-08-01',
    subtitle: '采集血液与CSF样本',
    description: '采集血液与 CSF 样本，用于组学检测。',
    ...c.sample
  }
];

export const allStreamEvents = [...journeyEvents, ...extraStreamEvents];

export const biomarkerPoints: BiomarkerPoint[] = [
  { date: '2022-01-01', sledai: 20, c3: 0.34, esr: 4, protein24h: 0.2, igg: 14.5 },
  { date: '2022-03-01', sledai: 16, c3: 0.52, esr: 32, protein24h: 0.4, igg: 11.3 },
  { date: '2022-05-01', sledai: 13, c3: 0.46, esr: 30, protein24h: 0.7, igg: 12.1 },
  { date: '2022-07-01', sledai: 17, c3: 0.62, esr: 82, protein24h: 0.8, igg: 10.8 },
  { date: '2022-09-01', sledai: 12, c3: 0.58, esr: 55, protein24h: 0.5, igg: 9.5 },
  { date: '2022-11-01', sledai: 10, c3: 0.66, esr: 45, protein24h: 0.4, igg: 10.1 },
  { date: '2023-01-01', sledai: 8, c3: 0.72, esr: 42, protein24h: 0.3, igg: 12.5 },
  { date: '2023-03-01', sledai: 10, c3: 0.55, esr: 48, protein24h: 0.5, igg: 14.2 },
  { date: '2023-05-01', sledai: 12, c3: 0.50, esr: 77, protein24h: 0.6, igg: 15.6 },
  { date: '2023-07-01', sledai: 10, c3: 0.63, esr: 66, protein24h: 0.4, igg: 13.2 },
  { date: '2023-09-01', sledai: 7, c3: 0.69, esr: 60, protein24h: 0.3, igg: 11.0 },
  { date: '2023-11-01', sledai: 14, c3: 0.53, esr: 71, protein24h: 0.6, igg: 12.7 },
  { date: '2024-01-01', sledai: 20, c3: 0.42, esr: 92, protein24h: 0.9, igg: 16.8 },
  { date: '2024-03-01', sledai: 21, c3: 0.38, esr: 86, protein24h: 0.9, igg: 16.2 },
  { date: '2024-05-01', sledai: 18, c3: 0.47, esr: 78, protein24h: 0.8, igg: 15.9 },
  { date: '2024-06-01', sledai: 8, c3: 0.59, esr: 50, protein24h: 0.8, igg: 15.6 },
  { date: '2024-08-01', sledai: 5, c3: 0.68, esr: 30, protein24h: 0.6, igg: 14.2 },
  { date: '2024-10-01', sledai: 4, c3: 0.70, esr: 42, protein24h: 0.5, igg: 13.8 },
  { date: '2024-12-01', sledai: 4, c3: 0.71, esr: 50, protein24h: 0.8, igg: 15.6 }
];

export const journeyStart = '2022-01-01';
export const journeyEnd = '2024-12-31';

export function findEventById(id?: string | null) {
  if (!id) return undefined;
  return allStreamEvents.find((event) => event.id === id);
}
