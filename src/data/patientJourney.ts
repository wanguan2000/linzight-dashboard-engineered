export type JourneyEventCategory = 'disease' | 'admission' | 'treatment' | 'visit' | 'sample' | 'omics';
export type JourneyEventKind = 'point' | 'range';

export interface JourneyEvent {
  id: string;
  kind: JourneyEventKind;
  category: JourneyEventCategory;
  track: string;
  laneIndex: number;
  title: string;
  tag: string;
  date: string;
  endDate?: string;
  subtitle?: string;
  description: string;
  color: string;
  softColor: string;
  borderColor: string;
}

export interface JourneyBiomarkerPoint {
  date: string;
  sledai: number;
  c3: number;
  esr: number;
  protein24h: number;
  igg: number;
}

export const journeyStart = '2022-01-01';
export const journeyEnd = '2024-12-31';

export const journeyTrackLabels = ['病程主线', '住院/急性事件', '治疗方案', '随访访视', '样本与组学'];

export const journeyCategoryConfig: Record<
  JourneyEventCategory,
  { label: string; color: string; softColor: string; borderColor: string }
> = {
  disease: { label: '病程', color: '#2478ff', softColor: '#eaf3ff', borderColor: '#8bb8ff' },
  admission: { label: '住院', color: '#fa8c16', softColor: '#fff4e6', borderColor: '#ffc078' },
  treatment: { label: '治疗', color: '#7c4dff', softColor: '#f1ecff', borderColor: '#b69cff' },
  visit: { label: '随访', color: '#12b5cb', softColor: '#e8fbfd', borderColor: '#8ae7f0' },
  sample: { label: '样本采集', color: '#20a162', softColor: '#eaf9f0', borderColor: '#84d9ad' },
  omics: { label: 'Omics检测', color: '#2f6bff', softColor: '#edf4ff', borderColor: '#99bbff' }
};

export const journeyReferenceEvents: JourneyEvent[] = [];

export const journeyStreamOrder = [
  'evt-v4',
  'evt-blood-2024',
  'evt-proteomics',
  'evt-v2',
  'evt-cd20-mmf',
  'evt-adm-2024-relapse',
  'evt-diagnose',
  'evt-relapse'
];

export const journeyBiomarkerPoints: JourneyBiomarkerPoint[] = [];
