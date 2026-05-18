export type IconName =
  | 'home'
  | 'patients'
  | 'cohorts'
  | 'studies'
  | 'lock'
  | 'visits'
  | 'samples'
  | 'data'
  | 'analytics'
  | 'reports'
  | 'insights'
  | 'alerts'
  | 'settings'
  | 'create'
  | 'chevronRight'
  | 'chevronDown'
  | 'sparkles'
  | 'wave'
  | 'building'
  | 'database'
  | 'microphone'
  | 'send'
  | 'bell'
  | 'location'
  | 'calendarCheck'
  | 'check'
  | 'shield'
  | 'activity'
  | 'userPlus'
  | 'calendar'
  | 'filePlus'
  | 'file'
  | 'homeOutline'
  | 'clock'
  | 'female'
  | 'lab'
  | 'dna'
  | 'sampleTube'
  | 'sampleBank'
  | 'crf'
  | 'search'
  | 'blood'
  | 'csf'
  | 'kidney';

export interface UserProfile {
  name: string;
  role: string;
  initials: string;
}

export interface NavItem {
  label: string;
  icon: IconName;
  active?: boolean;
  hasChildren?: boolean;
  routeLabel?: string;
}

export interface QuickPrompt {
  label: string;
  icon: IconName;
}

export interface KpiMetric {
  label: string;
  value: string;
  delta?: string;
  helper: string;
  icon: IconName;
  progress?: number;
}

export interface JourneyStage {
  label: string;
  value: string;
  icon: IconName;
  theme: 'teal' | 'blue';
}

export interface CohortStat {
  label: string;
  value: string;
  icon: IconName;
  drillable?: boolean;
}

export interface WorkflowItem {
  label: string;
  icon: IconName;
  count: string;
  percent: number;
  status?: 'normal' | 'over' | 'low' | 'empty';
}

export interface SummaryItem {
  marker: string;
  theme: 'green' | 'blue' | 'orange' | 'red';
  text: string;
  emphasis?: string[];
}

export interface QuickAction {
  label: string;
  icon: IconName;
}
