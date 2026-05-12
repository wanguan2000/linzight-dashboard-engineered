import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementRef, type PointerEvent } from 'react';
import {
  journeyCategoryConfig,
  journeyDemoEvents,
  journeyEnd,
  journeyStart,
  journeyStreamOrder,
  journeyTrackLabels,
  type JourneyBiomarkerPoint,
  type JourneyDemoEvent,
  type JourneyEventCategory
} from '../data/patientJourneyDemo';
import {
  followUpRecords,
  getSelectedPatient,
  omicsRecords,
  samples,
  visits,
  type FollowUpRecord,
  type OmicsRecord,
  type SampleRecord,
  type VisitRecord
} from '../data/operations';
import { patientRecords, type PatientRecord } from '../data/patientCohort';
import { useI18n } from '../i18n/I18nProvider';
import { fetchDemoDataset, filterRecordsByCurrentStudyScope, recordBelongsToCurrentStudyScope } from '../services/api';
import type { IconName } from '../types';
import { Icon } from './Icon';

const categoryOrder = Object.keys(journeyCategoryConfig) as JourneyEventCategory[];

const categoryIcons: Record<JourneyEventCategory, IconName> = {
  disease: 'activity',
  admission: 'building',
  treatment: 'shield',
  visit: 'calendarCheck',
  sample: 'sampleTube',
  omics: 'dna'
};

const streamPageSize = 10;

const metricLines = [
  { key: 'sledai', label: 'SLEDAI', color: '#2f6bff', dash: '', max: 24, suffix: '' },
  { key: 'c3', label: 'C3', color: '#20a162', dash: '8 5', max: 1, suffix: '' },
  { key: 'esr', label: 'ESR', color: '#fa8c16', dash: '3 5', max: 100, suffix: '' },
  { key: 'protein24h', label: '24h尿蛋白', color: '#12b5cb', dash: '10 4 2 4', max: 1.2, suffix: 'g' },
  { key: 'igg', label: 'IgG', color: '#7c4dff', dash: '14 5', max: 18, suffix: 'g/L' }
] as const;

type MetricKey = (typeof metricLines)[number]['key'];

const chartLegendWidths: Record<MetricKey, number> = {
  sledai: 86,
  c3: 58,
  esr: 62,
  protein24h: 136,
  igg: 70
};

const chartLayout = {
  minWidth: 820,
  labelColumn: 118,
  top: 78,
  laneGap: 35,
  amplitude: 22
};

type TimelineZoomRange = { start: number; end: number };
type PatientJourneySource = {
  visits: VisitRecord[];
  followUps: FollowUpRecord[];
  samples: SampleRecord[];
  omics: OmicsRecord[];
};
type TimelineDomain = {
  start: string;
  end: string;
  startMs: number;
  endMs: number;
};
type ChartFrame = {
  left: number;
  right: number;
  top: number;
  laneGap: number;
  amplitude: number;
};

const fallbackJourneySource: PatientJourneySource = {
  visits,
  followUps: followUpRecords,
  samples,
  omics: omicsRecords
};

const dayMs = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateMs(date: string | undefined) {
  const timestamp = Date.parse(date ?? '');
  return Number.isNaN(timestamp) ? null : timestamp;
}

function shiftDate(date: string, days: number) {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return date;
  return toIsoDate(new Date(timestamp + days * dayMs));
}

function sortByDate<T extends { date?: string; visitDate?: string; followUpDate?: string; collectedAt?: string; sentAt?: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      Date.parse(a.date ?? a.visitDate ?? a.followUpDate ?? a.collectedAt ?? a.sentAt ?? '') -
      Date.parse(b.date ?? b.visitDate ?? b.followUpDate ?? b.collectedAt ?? b.sentAt ?? '')
  );
}

function numericClinicalValue(patient: PatientRecord, field: string, fallback: number) {
  const value = Number(patient.clinicalData[field]);
  return Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPatientMedication(patient: PatientRecord, fallback: string) {
  const medicationFields = ['免疫抑制剂1', '免疫制剂2', '免疫制剂2（第2项）'];
  const medications = medicationFields
    .map((field) => String(patient.clinicalData[field] ?? '').trim())
    .filter((value) => value && value !== '-' && value !== '无');
  return medications.length ? medications.slice(0, 2).join(' + ') : fallback;
}

function styleFor(category: JourneyEventCategory) {
  return journeyCategoryConfig[category];
}

function patientRowMatches(patient: PatientRecord, row: { patientId?: string; patientName: string }) {
  return row.patientId === patient.id || row.patientName === patient.name;
}

function getPatientScopedRows(patient: PatientRecord, source: PatientJourneySource) {
  return {
    visits: sortByDate(source.visits.filter((visit) => patientRowMatches(patient, visit))),
    followUps: sortByDate(source.followUps.filter((followUp) => patientRowMatches(patient, followUp))),
    samples: sortByDate(source.samples.filter((sample) => patientRowMatches(patient, sample))),
    omics: sortByDate(source.omics.filter((record) => patientRowMatches(patient, record)))
  };
}

function buildPatientJourneyEvents(
  patient: PatientRecord,
  patientVisits: VisitRecord[],
  patientFollowUps: FollowUpRecord[],
  patientSamples: SampleRecord[],
  patientOmics: OmicsRecord[]
): JourneyDemoEvent[] {
  const firstVisitDate = patientVisits[0]?.visitDate ?? '2024-05-01';
  const lastVisitDate = patientVisits[patientVisits.length - 1]?.visitDate ?? firstVisitDate;
  const baselineSledai = Number(patientVisits[0]?.sleDai ?? patient.clinicalData['SLEDAI评分'] ?? 0);
  const diseaseTitle = patient.diseaseType === 'HC' ? '健康对照入组' : `明确${patient.diseaseType}`;
  const events: JourneyDemoEvent[] = [
    {
      id: `${patient.id}-screening`,
      kind: 'point',
      category: 'disease',
      track: '病程主线',
      laneIndex: 0,
      title: patient.diseaseType === 'HC' ? '筛选入组' : '症状记录',
      tag: patient.diseaseType === 'HC' ? '入组' : '病程',
      date: shiftDate(firstVisitDate, -30),
      subtitle: `${patient.name} · ${patient.diseaseType}`,
      description: `${patient.name} 建立患者旅程，受累脏器：${patient.organs.join('、') || '未记录'}。`,
      ...styleFor('disease')
    },
    {
      id: `${patient.id}-diagnosis`,
      kind: 'point',
      category: 'disease',
      track: '病程主线',
      laneIndex: 0,
      title: diseaseTitle,
      tag: '诊断',
      date: shiftDate(firstVisitDate, -14),
      subtitle: baselineSledai ? `基线 SLEDAI ${baselineSledai}` : patient.diseaseType,
      description: `${patient.name} 诊断/分组为 ${patient.diseaseType}，住院号 ${patient.hospitalNo}。`,
      ...styleFor('disease')
    }
  ];

  if (patient.diseaseType !== 'HC') {
    const treatmentTitle = formatPatientMedication(patient, patientVisits[0]?.medication ?? '维持治疗');
    events.push(
      {
        id: `${patient.id}-admission`,
        kind: 'range',
        category: 'admission',
        track: '住院/急性事件',
        laneIndex: 1,
        title: baselineSledai >= 10 ? '活动评估住院' : '基线评估住院',
        tag: '住院',
        date: shiftDate(firstVisitDate, -5),
        endDate: shiftDate(firstVisitDate, 2),
        subtitle: `${patient.diseaseType} · ${patient.organs.join('、')}`,
        description: `${patient.name} 完成 ${patient.diseaseType} 基线评估，记录 SLEDAI、用药和样本采集计划。`,
        ...styleFor('admission')
      },
      {
        id: `${patient.id}-treatment`,
        kind: 'range',
        category: 'treatment',
        track: '治疗方案',
        laneIndex: 2,
        title: treatmentTitle,
        tag: '治疗',
        date: firstVisitDate,
        endDate: shiftDate(lastVisitDate, 30),
        subtitle: patientVisits[0]?.medication ?? '随访期间维持治疗',
        description: `${patient.name} 当前治疗方案：${treatmentTitle}。`,
        ...styleFor('treatment')
      }
    );
  }

  patientVisits.forEach((visit) => {
    events.push({
      id: `${patient.id}-${visit.id}`,
      kind: 'point',
      category: 'visit',
      track: visit.visit === patientVisits[patientVisits.length - 1]?.visit ? '病程主线' : '随访访视',
      laneIndex: visit.visit === patientVisits[patientVisits.length - 1]?.visit ? 0 : 3,
      title: visit.visit,
      tag: '随访',
      date: visit.visitDate,
      subtitle: `SLEDAI ${visit.sleDai} · 完整度 ${visit.completeness}%`,
      description: `${patient.name} ${visit.visitType}，用药 ${visit.medication}，样本采集 ${visit.sampleCollection}。`,
      ...styleFor('visit')
    });
  });

  patientFollowUps.forEach((followUp) => {
    const lostReason =
      followUp.lostToFollowUpReason && followUp.lostToFollowUpReason !== '-'
        ? `；失访原因：${followUp.lostToFollowUpReason}`
        : '';
    events.push({
      id: `${patient.id}-${followUp.id}`,
      kind: 'point',
      category: 'visit',
      track: '随访访视',
      laneIndex: 3,
      title: `随访记录 · ${followUp.followUpMethod}`,
      tag: '随访记录',
      date: followUp.followUpDate,
      subtitle: `${followUp.survivalStatus} · ${followUp.diseaseStatus} · ${followUp.efficacyAssessment || '未评估'}`,
      description: `${followUp.followedBy}记录：${followUp.symptomsSigns}；影像/检验：${followUp.imagingLabSummary}；转移：${followUp.metastasisStatus || '-'}；AE/QoL：${followUp.adverseEvents || '无'} / ${followUp.qualityOfLife || '-'}${lostReason}`,
      ...styleFor('visit')
    });
  });

  patientSamples.forEach((sample) => {
    events.push({
      id: `${patient.id}-${sample.id}`,
      kind: 'point',
      category: 'sample',
      track: '样本与组学',
      laneIndex: 4,
      title: `${sample.sampleType}采集`,
      tag: '样本采集',
      date: sample.collectedAt,
      subtitle: `${sample.visit} · ${sample.status}`,
      description: `${sample.id}：${sample.sampleType} 样本采集，存储位置 ${sample.storage}，关联检测 ${sample.linkedOmics.join(' / ')}。`,
      ...styleFor('sample')
    });
  });

  patientOmics.forEach((record) => {
    const eventDate = record.completedAt !== '-' ? record.completedAt : record.sentAt;
    events.push({
      id: `${patient.id}-${record.id}`,
      kind: 'point',
      category: 'omics',
      track: '样本与组学',
      laneIndex: 4,
      title: `${record.assay}${record.status === '结果归档' ? '结果' : '送检'}`,
      tag: 'Omics检测',
      date: eventDate,
      subtitle: `${record.sampleType} · ${record.status}`,
      description: `${record.assay} / ${record.platform}，样本 ${record.sampleId}，QC ${record.qc}。`,
      ...styleFor('omics')
    });
  });

  return events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function buildPatientBiomarkerPoints(patient: PatientRecord, patientVisits: VisitRecord[]): JourneyBiomarkerPoint[] {
  const orderedVisits = patientVisits.length
    ? patientVisits
    : [
        {
          id: `${patient.id}-baseline`,
          patientName: patient.name,
          visit: 'V1 基线访视',
          visitDate: '2024-05-01',
          visitType: '基线访视',
          sleDai: String(patient.clinicalData['SLEDAI评分'] ?? 0),
          medication: '-',
          sampleCollection: '-',
          completeness: 0,
          status: '已完成' as const
        }
      ];
  const c3Base = numericClinicalValue(patient, 'C3(g/l)', patient.diseaseType === 'HC' ? 0.9 : 0.58);
  const esrBase = numericClinicalValue(patient, 'ESR(mm)', patient.diseaseType === 'HC' ? 12 : 50);
  const proteinBase = numericClinicalValue(patient, '24小时尿蛋白 g/24h', patient.organs.includes('肾') ? 0.8 : 0.18);
  const iggBase = numericClinicalValue(patient, 'IgG(g/l)', patient.diseaseType === 'HC' ? 9 : 12);

  return orderedVisits.map((visit, index) => {
    const sledai = Number(visit.sleDai);
    return {
      date: visit.visitDate,
      sledai: Number.isFinite(sledai) ? sledai : 0,
      c3: Number(clampNumber(c3Base + index * 0.05, 0.1, 1.2).toFixed(2)),
      esr: Math.round(clampNumber(esrBase - index * 6, 2, 100)),
      protein24h: Number(clampNumber(proteinBase - index * 0.08, 0.02, 1.2).toFixed(2)),
      igg: Number(clampNumber(iggBase - index * 0.35, 3, 18).toFixed(1))
    };
  });
}

function getDefaultSelectedEvent(events: JourneyDemoEvent[]) {
  const descending = [...events].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return descending.find((event) => event.category === 'visit') ?? descending[0] ?? journeyDemoEvents[0];
}

function getChartFrame(width: number): ChartFrame {
  const chartWidth = Math.max(chartLayout.minWidth, width);
  return {
    left: chartLayout.labelColumn,
    right: chartWidth,
    top: chartLayout.top,
    laneGap: chartLayout.laneGap,
    amplitude: chartLayout.amplitude
  };
}

function useElementWidth(fallback: number) {
  const ref = useRef<ElementRef<'div'> | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setWidth(Math.max(fallback, Math.round(element.clientWidth)));
    };

    updateWidth();
    const observer = new globalThis.ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);

  return [ref, width] as const;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function buildTimelineDomain(events: JourneyDemoEvent[], points: JourneyBiomarkerPoint[]): TimelineDomain {
  const timestamps = [
    ...events.flatMap((event) => [parseDateMs(event.date), parseDateMs(event.endDate)]),
    ...points.map((point) => parseDateMs(point.date))
  ].filter((value): value is number => value !== null);

  const rawStart = timestamps.length ? Math.min(...timestamps) : Date.parse(journeyStart);
  const rawEnd = timestamps.length ? Math.max(...timestamps) : Date.parse(journeyEnd);
  const rawSpanDays = Math.max(1, Math.ceil((rawEnd - rawStart) / dayMs));
  const paddingDays = rawSpanDays <= 1 ? 30 : Math.min(90, Math.max(14, Math.ceil(rawSpanDays * 0.16)));
  const startMs = rawStart - paddingDays * dayMs;
  const endMs = rawEnd + paddingDays * dayMs;

  return {
    start: toIsoDate(new Date(startMs)),
    end: toIsoDate(new Date(endMs)),
    startMs,
    endMs
  };
}

function getDomainSpanDays(domain: TimelineDomain) {
  return Math.max(1, Math.ceil((domain.endMs - domain.startMs) / dayMs));
}

function datePercent(date: string, domain: TimelineDomain) {
  const start = domain.startMs;
  const end = domain.endMs;
  const current = Date.parse(date);
  if (Number.isNaN(current)) return 0;
  return Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100));
}

function percentToDate(percent: number, domain: TimelineDomain) {
  const start = domain.startMs;
  const end = domain.endMs;
  return new Date(start + (end - start) * (clampPercent(percent) / 100)).toISOString().slice(0, 10);
}

function dateFromZoomPercent(localPercent: number, zoomRange: TimelineZoomRange, domain: TimelineDomain) {
  const globalPercent = zoomRange.start + (clampPercent(localPercent) / 100) * Math.max(1, zoomRange.end - zoomRange.start);
  return percentToDate(globalPercent, domain);
}

function datePercentInZoom(date: string, zoomRange: TimelineZoomRange, domain: TimelineDomain) {
  const zoomWidth = Math.max(1, zoomRange.end - zoomRange.start);
  return clampPercent(((datePercent(date, domain) - zoomRange.start) / zoomWidth) * 100);
}

function dateIsVisible(date: string, zoomRange: TimelineZoomRange, domain: TimelineDomain) {
  const percent = datePercent(date, domain);
  return percent >= zoomRange.start && percent <= zoomRange.end;
}

function eventIntersectsZoom(event: JourneyDemoEvent, zoomRange: TimelineZoomRange, domain: TimelineDomain) {
  const start = datePercent(event.date, domain);
  const end = datePercent(event.endDate ?? event.date, domain);
  return Math.max(start, end) >= zoomRange.start && Math.min(start, end) <= zoomRange.end;
}

function formatDate(date: string) {
  return date.replace(/-/g, '.');
}

function matchesEventQuery(event: JourneyDemoEvent, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  return [event.title, event.tag, event.subtitle, event.description, event.date, event.endDate]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword));
}

function getOrderedStreamEvents(events: JourneyDemoEvent[]) {
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const ordered = journeyStreamOrder.map((id) => eventMap.get(id)).filter(Boolean) as JourneyDemoEvent[];
  const orderedIds = new Set(ordered.map((event) => event.id));
  const rest = events
    .filter((event) => !orderedIds.has(event.id))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return [...ordered, ...rest];
}

function nearestBiomarker(date: string, points: JourneyBiomarkerPoint[]) {
  const target = Date.parse(date);
  const fallback = points[0] ?? { date, sledai: 0, c3: 0, esr: 0, protein24h: 0, igg: 0 };
  return points.reduce((nearest, point) => {
    const currentGap = Math.abs(Date.parse(point.date) - target);
    const nearestGap = Math.abs(Date.parse(nearest.date) - target);
    return currentGap < nearestGap ? point : nearest;
  }, fallback);
}

function getNearestEvent(events: JourneyDemoEvent[], date: string) {
  const target = Date.parse(date);
  if (!events.length || Number.isNaN(target)) return events[0] ?? journeyDemoEvents[0];
  return events.reduce((nearest, event) => {
    const eventStart = Date.parse(event.date);
    const eventEnd = Date.parse(event.endDate ?? event.date);
    const nearestStart = Date.parse(nearest.date);
    const nearestEnd = Date.parse(nearest.endDate ?? nearest.date);
    const eventGap = target >= eventStart && target <= eventEnd ? 0 : Math.min(Math.abs(target - eventStart), Math.abs(target - eventEnd));
    const nearestGap =
      target >= nearestStart && target <= nearestEnd ? 0 : Math.min(Math.abs(target - nearestStart), Math.abs(target - nearestEnd));
    return eventGap < nearestGap ? event : nearest;
  }, events[0]);
}

function getVisibleBiomarkerPoints(zoomRange: TimelineZoomRange, points: JourneyBiomarkerPoint[], domain: TimelineDomain) {
  return points.filter((point) => dateIsVisible(point.date, zoomRange, domain));
}

function getMetricLaneY(index: number, frame: ChartFrame) {
  return frame.top + index * frame.laneGap;
}

function getChartPlotTop(frame: ChartFrame) {
  return frame.top - 16;
}

function getChartPlotBottom(frame: ChartFrame) {
  return getMetricLaneY(metricLines.length - 1, frame) + 14;
}

function getTrendPoint(
  metric: (typeof metricLines)[number],
  metricIndex: number,
  point: JourneyBiomarkerPoint,
  zoomRange: TimelineZoomRange,
  domain: TimelineDomain,
  frame: ChartFrame
) {
  const width = frame.right - frame.left;
  const value = Math.min(1, Math.max(0, Number(point[metric.key]) / metric.max));
  return {
    x: frame.left + (datePercentInZoom(point.date, zoomRange, domain) / 100) * width,
    y: getMetricLaneY(metricIndex, frame) + frame.amplitude / 2 - value * frame.amplitude,
    value: point[metric.key]
  };
}

function getChartValueLabel(pointX: number, pointY: number, chartFrame: ChartFrame) {
  if (pointX <= chartFrame.left + 28) {
    return { textAnchor: 'start' as const, x: pointX + 7, y: pointY - 7 };
  }
  if (pointX >= chartFrame.right - 34) {
    return { textAnchor: 'end' as const, x: chartFrame.right - 8, y: pointY - 7 };
  }
  return { textAnchor: 'middle' as const, x: pointX, y: pointY - 8 };
}

function buildTrendLine(
  metric: (typeof metricLines)[number],
  metricIndex: number,
  points: JourneyBiomarkerPoint[],
  zoomRange: TimelineZoomRange,
  domain: TimelineDomain,
  frame: ChartFrame
) {
  return points
    .map((point) => {
      const { x, y } = getTrendPoint(metric, metricIndex, point, zoomRange, domain, frame);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getTimelineTicks(zoomRange: TimelineZoomRange, domain: TimelineDomain) {
  const ticks: Array<{ label: string; percent: number }> = [];
  const visibleStart = Date.parse(percentToDate(zoomRange.start, domain));
  const visibleEnd = Date.parse(percentToDate(zoomRange.end, domain));
  const spanDays = Math.max(1, Math.ceil((visibleEnd - visibleStart) / dayMs));
  const cursor = new Date(visibleStart);

  if (spanDays > 540) {
    cursor.setUTCMonth(Math.floor(cursor.getUTCMonth() / 3) * 3, 1);
    while (cursor.getTime() <= visibleEnd) {
      const date = toIsoDate(cursor);
      if (dateIsVisible(date, zoomRange, domain)) {
        ticks.push({ label: `${cursor.getUTCFullYear()} Q${Math.floor(cursor.getUTCMonth() / 3) + 1}`, percent: datePercentInZoom(date, zoomRange, domain) });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 3, 1);
    }
    return ticks;
  }

  if (spanDays > 75) {
    cursor.setUTCDate(1);
    while (cursor.getTime() <= visibleEnd) {
      const date = toIsoDate(cursor);
      if (dateIsVisible(date, zoomRange, domain)) {
        ticks.push({ label: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`, percent: datePercentInZoom(date, zoomRange, domain) });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    return ticks;
  }

  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
  while (cursor.getTime() <= visibleEnd) {
    const date = toIsoDate(cursor);
    if (dateIsVisible(date, zoomRange, domain)) {
      ticks.push({ label: `${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`, percent: datePercentInZoom(date, zoomRange, domain) });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return ticks;
}

function getBrushLabelTicks(domain: TimelineDomain) {
  const ticks: Array<{ label: string; percent: number }> = [];
  const spanDays = getDomainSpanDays(domain);
  const cursor = new Date(domain.startMs);

  if (spanDays > 540) {
    cursor.setUTCMonth(0, 1);
    while (cursor.getTime() <= domain.endMs) {
      const date = toIsoDate(cursor);
      ticks.push({ label: String(cursor.getUTCFullYear()), percent: datePercent(date, domain) });
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1, 0, 1);
    }
    return ticks;
  }

  cursor.setUTCDate(1);
  const stepMonths = spanDays > 180 ? 2 : 1;
  while (cursor.getTime() <= domain.endMs) {
    const date = toIsoDate(cursor);
    ticks.push({ label: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`, percent: datePercent(date, domain) });
    cursor.setUTCMonth(cursor.getUTCMonth() + stepMonths, 1);
  }
  return ticks;
}

function getBrushTicks(domain: TimelineDomain) {
  const ticks: Array<{ id: string; percent: number; major: boolean }> = [];
  const spanDays = getDomainSpanDays(domain);
  const cursor = new Date(domain.startMs);

  if (spanDays > 90) {
    cursor.setUTCDate(1);
    while (cursor.getTime() <= domain.endMs) {
      const id = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      ticks.push({ id, percent: datePercent(`${id}-01`, domain), major: cursor.getUTCMonth() % 3 === 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    return ticks;
  }

  while (cursor.getTime() <= domain.endMs) {
    const id = toIsoDate(cursor);
    ticks.push({ id, percent: datePercent(id, domain), major: cursor.getUTCDate() <= 7 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return ticks;
}

function getMetricValue(point: JourneyBiomarkerPoint, key: (typeof metricLines)[number]['key']) {
  const value = point[key];
  return key === 'c3' || key === 'protein24h' ? value.toFixed(2) : String(value);
}

function getChartLegendItems() {
  let x = 0;
  return metricLines.map((metric) => {
    const item = { metric, x };
    x += chartLegendWidths[metric.key];
    return item;
  });
}

export function PatientJourneyDemoPage({
  selectedPatient,
  onPatientChange
}: {
  selectedPatient?: PatientRecord | null;
  onPatientChange?: (patient: PatientRecord) => void;
}) {
  const { t } = useI18n();
  const scopedFallbackPatients = filterRecordsByCurrentStudyScope(patientRecords);
  const scopedSelectedPatient = selectedPatient && recordBelongsToCurrentStudyScope(selectedPatient) ? selectedPatient : null;
  const initialPatient = scopedSelectedPatient ?? scopedFallbackPatients[0] ?? getSelectedPatient(null);
  const [patients, setPatients] = useState<PatientRecord[]>(scopedFallbackPatients);
  const [journeySource, setJourneySource] = useState<PatientJourneySource>({
    visits: filterRecordsByCurrentStudyScope(fallbackJourneySource.visits),
    followUps: filterRecordsByCurrentStudyScope(fallbackJourneySource.followUps),
    samples: filterRecordsByCurrentStudyScope(fallbackJourneySource.samples),
    omics: filterRecordsByCurrentStudyScope(fallbackJourneySource.omics)
  });
  const [activePatient, setActivePatient] = useState<PatientRecord>(initialPatient);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [enabledCategories, setEnabledCategories] = useState<JourneyEventCategory[]>(categoryOrder);
  const [query, setQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('2024-05-01');
  const [streamPage, setStreamPage] = useState(1);
  const [zoomRange, setZoomRange] = useState<TimelineZoomRange>({ start: 0, end: 100 });
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const patient = activePatient;

  useEffect(() => {
    let ignore = false;

    void fetchDemoDataset()
      .then((dataset) => {
        if (ignore || !dataset.patients.length) return;
        setPatients(dataset.patients);
        setJourneySource({
          visits: dataset.visits,
          followUps: dataset.followUps,
          samples: dataset.samples,
          omics: dataset.omics
        });
        setActivePatient((current) => {
          if (scopedSelectedPatient) return scopedSelectedPatient;
          return dataset.patients.find((item) => item.id === current.id || item.name === current.name) ?? dataset.patients[0];
        });
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [scopedSelectedPatient]);

  useEffect(() => {
    if (selectedPatient) {
      setActivePatient(selectedPatient);
      setPatientQuery('');
      setPatientPickerOpen(false);
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (activePatient.id) onPatientChange?.(activePatient);
  }, [activePatient, onPatientChange]);

  const scopedJourneyRows = useMemo(() => getPatientScopedRows(patient, journeySource), [journeySource, patient]);
  const journeyEvents = useMemo(
    () => buildPatientJourneyEvents(patient, scopedJourneyRows.visits, scopedJourneyRows.followUps, scopedJourneyRows.samples, scopedJourneyRows.omics),
    [patient, scopedJourneyRows]
  );
  const biomarkerPoints = useMemo(() => buildPatientBiomarkerPoints(patient, scopedJourneyRows.visits), [patient, scopedJourneyRows.visits]);
  const timelineDomain = useMemo(() => buildTimelineDomain(journeyEvents, biomarkerPoints), [biomarkerPoints, journeyEvents]);

  useEffect(() => {
    const defaultEvent = getDefaultSelectedEvent(journeyEvents);
    setSelectedEventId(defaultEvent.id);
    setSelectedDate(defaultEvent.date);
    setStreamPage(1);
    setZoomRange({ start: 0, end: 100 });
    setHoveredEventId(null);
  }, [journeyEvents, patient.id]);

  const normalizedPatientQuery = patientQuery.trim().toLowerCase();
  const patientSearchMatches = useMemo(() => {
    if (!normalizedPatientQuery) return patients;

    return patients.filter((item) =>
      [item.name, item.hospitalNo, item.diseaseType, item.sex, item.organs.join(' ')]
        .some((value) => value.toLowerCase().includes(normalizedPatientQuery))
    );
  }, [normalizedPatientQuery, patients]);
  const patientMatches = normalizedPatientQuery ? patientSearchMatches : [];
  const showPatientMatches = patientPickerOpen && Boolean(normalizedPatientQuery);
  const patientResultSummary = normalizedPatientQuery
    ? `匹配 ${patientSearchMatches.length} / ${patients.length} 名患者`
    : `${patients.length} 名患者 · 输入编号、住院号或疾病类型切换`;

  const filteredEvents = useMemo(
    () => journeyEvents.filter((event) => enabledCategories.includes(event.category) && matchesEventQuery(event, query)),
    [enabledCategories, journeyEvents, query]
  );
  const streamEvents = useMemo(() => getOrderedStreamEvents(filteredEvents), [filteredEvents]);
  const streamPageCount = Math.max(1, Math.ceil(streamEvents.length / streamPageSize));
  const safeStreamPage = Math.min(streamPage, streamPageCount);
  const selectedEvent =
    (selectedEventId ? journeyEvents.find((event) => event.id === selectedEventId) : null) ??
    getNearestEvent(filteredEvents, selectedDate) ??
    journeyEvents[0] ??
    journeyDemoEvents[0];
  const currentPoint = nearestBiomarker(selectedDate, biomarkerPoints);

  const getStreamPageForEvent = (eventId: string) => {
    const eventIndex = streamEvents.findIndex((event) => event.id === eventId);
    return eventIndex < 0 ? 1 : Math.floor(eventIndex / streamPageSize) + 1;
  };

  const toggleCategory = (category: JourneyEventCategory) => {
    setStreamPage(1);
    setEnabledCategories((current) => {
      if (current.includes(category)) {
        return current.length === 1 ? current : current.filter((item) => item !== category);
      }
      return [...current, category];
    });
  };

  const selectEvent = (event: JourneyDemoEvent) => {
    setSelectedEventId(event.id);
    setSelectedDate(event.date);
    setStreamPage(getStreamPageForEvent(event.id));
  };

  const selectDate = (date: string) => {
    const nearestEvent = getNearestEvent(filteredEvents, date);
    setSelectedDate(date);
    setSelectedEventId(nearestEvent.id);
    setStreamPage(getStreamPageForEvent(nearestEvent.id));
  };

  const resetView = () => {
    const defaultEvent = getDefaultSelectedEvent(journeyEvents);
    setEnabledCategories(categoryOrder);
    setQuery('');
    setSelectedEventId(defaultEvent.id);
    setSelectedDate(defaultEvent.date);
    setStreamPage(1);
    setZoomRange({ start: 0, end: 100 });
    setHoveredEventId(null);
  };

  const updateEventQuery = (value: string) => {
    setQuery(value);
    setStreamPage(1);
  };

  return (
    <div className="content workspace-page patient-journey-demo">
      <section className="journey-demo-toolbar">
        <div className="journey-demo-patient">
          <div className="journey-demo-avatar">PJ</div>
          <div>
            <h2>{t('临床 Patient Journey')}</h2>
            <p>
              {t(`${patient.studyId} / ${patient.name} · ${patient.sex} · ${patient.age}岁 · ${patient.diseaseType}`)}
            </p>
          </div>
        </div>
        <div className="journey-demo-patient-picker">
          <div className="journey-demo-patient-picker__header">
            <div>
              <strong>{t('查找患者')}</strong>
              <span>{t(patientResultSummary)}</span>
            </div>
            {patientQuery ? (
              <button
                className="journey-demo-patient-clear"
                onClick={() => {
                  setPatientQuery('');
                  setPatientPickerOpen(false);
                }}
                type="button"
              >
                {t('清空')}
              </button>
            ) : null}
          </div>
          <label className="journey-demo-search journey-demo-patient-search">
            <Icon name="search" />
            <input
              onChange={(event) => {
                setPatientQuery(event.target.value);
                setPatientPickerOpen(true);
              }}
              onFocus={() => {
                if (patientQuery.trim()) setPatientPickerOpen(true);
              }}
              placeholder={t('搜索患者编号、住院号、疾病类型、性别或受累脏器')}
              value={patientQuery}
            />
          </label>
          {showPatientMatches ? (
            <div className="journey-demo-patient-results" aria-label={t('患者查找结果')}>
              {patientMatches.map((item) => (
                <button
                  className={item.name === patient.name ? 'is-active' : undefined}
                  key={`${item.studyId}-${item.name}`}
                  onClick={() => {
                    setActivePatient(item);
                    setPatientQuery('');
                    setPatientPickerOpen(false);
                  }}
                  type="button"
                >
                  <strong>{item.name}</strong>
                  <span>{t(`${item.hospitalNo} · ${item.sex} · ${item.age}岁 · ${item.diseaseType}`)}</span>
                </button>
              ))}
              {!patientMatches.length ? <span className="journey-demo-patient-empty">{t('无匹配患者')}</span> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="journey-demo-grid">
        <div className="journey-demo-main">
          <JourneyTimeline
            enabledCategories={enabledCategories}
            events={filteredEvents}
            hoveredEventId={hoveredEventId}
            onHover={setHoveredEventId}
            onQueryChange={updateEventQuery}
            onResetView={resetView}
            onSelect={selectEvent}
            onToggleCategory={toggleCategory}
            onZoomChange={setZoomRange}
            query={query}
            selectedDate={selectedDate}
            selectedEventId={selectedEvent.id}
            timelineDomain={timelineDomain}
            zoomRange={zoomRange}
          />
          <JourneyBiomarkers
            currentPoint={currentPoint}
            onSelectDate={selectDate}
            onZoomChange={setZoomRange}
            points={biomarkerPoints}
            selectedDate={selectedDate}
            timelineDomain={timelineDomain}
            zoomRange={zoomRange}
          />
        </div>
        <JourneyEventStream
          events={streamEvents}
          currentPage={safeStreamPage}
          hoveredEventId={hoveredEventId}
          onHover={setHoveredEventId}
          onPageChange={setStreamPage}
          pageSize={streamPageSize}
          onSelect={selectEvent}
          selectedEvent={selectedEvent}
        />
      </section>
    </div>
  );
}

function JourneyTimeline({
  enabledCategories,
  events,
  hoveredEventId,
  onHover,
  onQueryChange,
  onResetView,
  onSelect,
  onToggleCategory,
  onZoomChange,
  query,
  selectedDate,
  selectedEventId,
  timelineDomain,
  zoomRange
}: {
  enabledCategories: JourneyEventCategory[];
  events: JourneyDemoEvent[];
  hoveredEventId: string | null;
  onHover: (eventId: string | null) => void;
  onQueryChange: (value: string) => void;
  onResetView: () => void;
  onSelect: (event: JourneyDemoEvent) => void;
  onToggleCategory: (category: JourneyEventCategory) => void;
  onZoomChange: (range: TimelineZoomRange) => void;
  query: string;
  selectedDate: string;
  selectedEventId: string;
  timelineDomain: TimelineDomain;
  zoomRange: TimelineZoomRange;
}) {
  const { t } = useI18n();
  const visibleEvents = events.filter((event) => eventIntersectsZoom(event, zoomRange, timelineDomain));
  const selectedDateVisible = dateIsVisible(selectedDate, zoomRange, timelineDomain);
  const selectedDatePosition = datePercentInZoom(selectedDate, zoomRange, timelineDomain);
  const ticks = getTimelineTicks(zoomRange, timelineDomain);

  return (
    <section className="journey-demo-card journey-demo-timeline-card">
      <header className="journey-demo-card__header">
        <div>
          <span>Multi-track Event Timeline</span>
          <h2>{t('多轨临床事件轴')}</h2>
        </div>
      </header>
      <div className="journey-demo-timeline-controls">
        <div className="journey-demo-categories journey-demo-timeline-categories" aria-label={t('旅程事件分类筛选')}>
          {categoryOrder.map((category) => {
            const config = journeyCategoryConfig[category];
            const active = enabledCategories.includes(category);
            return (
              <button
                className={active ? 'journey-demo-category is-active' : 'journey-demo-category'}
                key={category}
                onClick={() => onToggleCategory(category)}
                style={{
                  color: active ? config.color : undefined,
                  backgroundColor: active ? config.softColor : undefined,
                  borderColor: active ? config.borderColor : undefined
                }}
                type="button"
              >
                <Icon name={categoryIcons[category]} />
                {t(config.label)}
              </button>
            );
          })}
        </div>
        <div className="journey-demo-actions journey-demo-timeline-actions">
          <label className="journey-demo-search journey-demo-timeline-search">
            <Icon name="search" />
            <input onChange={(event) => onQueryChange(event.target.value)} placeholder={t('搜索事件、治疗或样本')} value={query} />
          </label>
          <button className="module-link-button" onClick={onResetView} type="button">
            <Icon name="clock" />
            {t('重置视图')}
          </button>
        </div>
      </div>
      <div className="journey-demo-timeline-scale">
        <div className="journey-demo-track-label" />
        <div className="journey-demo-scale-axis">
          {ticks.map((tick) => (
            <span key={tick.label} style={{ left: `${tick.percent}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <div className="journey-demo-timeline">
        {journeyTrackLabels.map((track) => {
          const trackEvents = visibleEvents.filter((event) => event.track === track);
          return (
            <div className="journey-demo-track-row" key={track}>
              <div className="journey-demo-track-label">{t(track)}</div>
              <div className="journey-demo-track-axis">
                {selectedDateVisible ? <span className="journey-demo-selected-date-line" style={{ left: `${selectedDatePosition}%` }} /> : null}
                {trackEvents.map((event) =>
                  event.kind === 'range' ? (
                    <button
                      className={[
                        'journey-demo-event-range',
                        event.id === selectedEventId ? 'is-active' : '',
                        event.id === hoveredEventId ? 'is-hovered' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={event.id}
                      onMouseEnter={() => onHover(event.id)}
                      onMouseLeave={() => onHover(null)}
                      onClick={() => onSelect(event)}
                      style={{
                        left: `${Math.min(
                          datePercentInZoom(event.date, zoomRange, timelineDomain),
                          datePercentInZoom(event.endDate ?? event.date, zoomRange, timelineDomain)
                        )}%`,
                        width: `${Math.max(
                          Math.abs(
                            datePercentInZoom(event.endDate ?? event.date, zoomRange, timelineDomain) -
                              datePercentInZoom(event.date, zoomRange, timelineDomain)
                          ),
                          3
                        )}%`,
                        backgroundColor: event.softColor,
                        borderColor: event.borderColor,
                        color: event.color
                      }}
                      title={`${t(event.title)} ${event.subtitle ? t(event.subtitle) : ''}`}
                      type="button"
                    >
                      {t(event.title)}
                    </button>
                  ) : (
                    <button
                      className={[
                        'journey-demo-event-point',
                        event.id === selectedEventId ? 'is-active' : '',
                        event.id === hoveredEventId ? 'is-hovered' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={event.id}
                      onMouseEnter={() => onHover(event.id)}
                      onMouseLeave={() => onHover(null)}
                      onClick={() => onSelect(event)}
                      style={{
                        left: `${datePercentInZoom(event.date, zoomRange, timelineDomain)}%`,
                        backgroundColor: event.softColor,
                        borderColor: event.borderColor,
                        color: event.color
                      }}
                      title={`${t(event.title)} ${event.date}`}
                      type="button"
                    >
                      <span>{t(event.title)}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      <RangeBrush
        className="journey-demo-brush--timeline"
        label={t('患者旅程时间范围')}
        onChange={onZoomChange}
        range={zoomRange}
        timelineDomain={timelineDomain}
      />
    </section>
  );
}

function JourneyBiomarkers({
  currentPoint,
  onSelectDate,
  onZoomChange,
  points,
  selectedDate,
  timelineDomain,
  zoomRange
}: {
  currentPoint: JourneyBiomarkerPoint;
  onSelectDate: (date: string) => void;
  onZoomChange: (range: TimelineZoomRange) => void;
  points: JourneyBiomarkerPoint[];
  selectedDate: string;
  timelineDomain: TimelineDomain;
  zoomRange: TimelineZoomRange;
}) {
  const { t } = useI18n();
  const [chartRef, chartWidth] = useElementWidth(chartLayout.minWidth);
  const chartFrame = getChartFrame(chartWidth);
  const visiblePoints = getVisibleBiomarkerPoints(zoomRange, points, timelineDomain);
  const selectedDateVisible = dateIsVisible(selectedDate, zoomRange, timelineDomain);
  const selectedX = chartFrame.left + (datePercentInZoom(selectedDate, zoomRange, timelineDomain) / 100) * (chartFrame.right - chartFrame.left);
  const selectedLabelX = Math.min(chartFrame.right - 43, Math.max(chartFrame.left + 43, selectedX));
  const selectedLabelY = getChartPlotTop(chartFrame) - 26;
  const plotTop = getChartPlotTop(chartFrame);
  const plotBottom = getChartPlotBottom(chartFrame);
  const legendItems = getChartLegendItems();
  const selectedLegendX = legendItems.reduce((right, item) => right + chartLegendWidths[item.metric.key], 0);
  const [hoveredMetricKey, setHoveredMetricKey] = useState<MetricKey | null>(null);

  const handleChartPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * chartWidth;
    onSelectDate(dateFromZoomPercent(((viewX - chartFrame.left) / (chartFrame.right - chartFrame.left)) * 100, zoomRange, timelineDomain));
  };

  const handleChartPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const viewY = ((event.clientY - rect.top) / rect.height) * 246;

    if (viewX < chartFrame.left || viewX > chartFrame.right || viewY < plotTop - 8 || viewY > plotBottom + 8) return;

    const nearest = metricLines.reduce<{ key: MetricKey; distance: number }>(
      (current, metric, index) => {
        const distance = Math.abs(viewY - getMetricLaneY(index, chartFrame));
        return distance < current.distance ? { key: metric.key, distance } : current;
      },
      { key: metricLines[0].key, distance: Number.POSITIVE_INFINITY }
    );
    setHoveredMetricKey(nearest.key);
  };

  return (
    <section className="journey-demo-card">
      <header className="journey-demo-card__header journey-demo-trend-header">
        <div className="journey-demo-trend-title">
          <span>Clinical Trend</span>
          <div className="journey-demo-trend-title-row">
            <h2>{t('关键指标趋势')}</h2>
            <div className="journey-demo-metrics">
              {metricLines.map((metric) => (
                <div
                  className="journey-demo-metric"
                  key={metric.key}
                  style={{ '--metric-color': metric.color } as CSSProperties}
                >
                  <span>{t(metric.label)}</span>
                  <strong>
                    {getMetricValue(currentPoint, metric.key)}
                    {metric.suffix ? <small>{metric.suffix}</small> : null}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <label className="journey-demo-date-picker">
          {t('指标日期')}
          <input
            max={timelineDomain.end}
            min={timelineDomain.start}
            onChange={(event) => onSelectDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </label>
      </header>
      <div className="journey-demo-chart" ref={chartRef}>
        <svg
          aria-label={t('患者关键指标趋势')}
          onPointerDown={handleChartPointer}
          onPointerLeave={() => setHoveredMetricKey(null)}
          onPointerMove={handleChartPointerMove}
          role="img"
          viewBox={`0 0 ${chartWidth} 246`}
        >
          <g className="journey-demo-chart-legend" transform={`translate(${chartFrame.left + 8}, 22)`}>
            {legendItems.map(({ metric, x }) => (
              <g
                className={[
                  'journey-demo-chart-legend-item',
                  hoveredMetricKey && hoveredMetricKey !== metric.key ? 'is-muted' : '',
                  hoveredMetricKey === metric.key ? 'is-active' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={metric.key}
                onMouseEnter={() => setHoveredMetricKey(metric.key)}
                onMouseLeave={() => setHoveredMetricKey(null)}
                transform={`translate(${x}, 0)`}
              >
                <line stroke={metric.color} strokeDasharray={metric.dash} strokeWidth="2.4" x1="0" x2="30" y1="0" y2="0" />
                <circle cx="15" cy="0" fill="#ffffff" r="3.5" stroke={metric.color} strokeWidth="2" />
                <text x="38" y="4">
                  {t(metric.label)}
                </text>
              </g>
            ))}
            <g transform={`translate(${selectedLegendX}, 0)`}>
              <circle cx="4" cy="0" fill="rgba(47, 120, 255, 0.78)" r="4" />
              <text x="14" y="4">
                {t('选中时间点')}
              </text>
            </g>
          </g>
          <g className="journey-demo-chart-grid">
            {metricLines.map((metric, index) => (
              <g key={metric.key}>
                <text className="journey-demo-chart-y-label" textAnchor="end" x="98" y={getMetricLaneY(index, chartFrame) + 4}>
                  {getMetricValue(currentPoint, metric.key)}
                </text>
                <line x1={chartFrame.left} x2={chartFrame.right} y1={getMetricLaneY(index, chartFrame)} y2={getMetricLaneY(index, chartFrame)} />
              </g>
            ))}
            <line className="journey-demo-chart-axis" x1={chartFrame.left} x2={chartFrame.left} y1={plotTop} y2={plotBottom} />
          </g>
          {metricLines.map((metric, metricIndex) => {
            const lastPoint = visiblePoints[visiblePoints.length - 1];
            const labelPoint = lastPoint ? getTrendPoint(metric, metricIndex, lastPoint, zoomRange, timelineDomain, chartFrame) : null;
            const linePoints = buildTrendLine(metric, metricIndex, visiblePoints, zoomRange, timelineDomain, chartFrame);
            return (
              <g
                className={[
                  'journey-demo-trend-line',
                  hoveredMetricKey && hoveredMetricKey !== metric.key ? 'is-muted' : '',
                  hoveredMetricKey === metric.key ? 'is-active' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={metric.key}
                onMouseEnter={() => setHoveredMetricKey(metric.key)}
                onMouseLeave={() => setHoveredMetricKey(null)}
              >
                <polyline className="journey-demo-trend-hit" fill="none" points={linePoints} stroke="transparent" strokeWidth="14" />
                <polyline
                  fill="none"
                  points={linePoints}
                  stroke={metric.color}
                  strokeDasharray={metric.dash}
                  strokeWidth="3"
                />
                {visiblePoints.map((point) => {
                  const trendPoint = getTrendPoint(metric, metricIndex, point, zoomRange, timelineDomain, chartFrame);
                  const isSelected = point.date === currentPoint.date;
                  const valueLabel = getChartValueLabel(trendPoint.x, trendPoint.y, chartFrame);
                  return (
                    <g key={`${metric.key}-${point.date}`}>
                      <circle
                        cx={trendPoint.x}
                        cy={trendPoint.y}
                        fill={isSelected ? metric.color : '#ffffff'}
                        r={isSelected ? 4.5 : 3}
                        stroke={metric.color}
                        strokeWidth="2"
                      />
                      <text
                        className={['journey-demo-chart-point-value', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                        style={{ fill: metric.color }}
                        textAnchor={valueLabel.textAnchor}
                        x={valueLabel.x}
                        y={valueLabel.y}
                      >
                        {getMetricValue(point, metric.key)}
                      </text>
                    </g>
                  );
                })}
                {labelPoint ? (
                  <text
                    className="journey-demo-chart-inline-label"
                    fill={metric.color}
                    textAnchor={labelPoint.x > chartFrame.right - 92 ? 'end' : 'start'}
                    x={labelPoint.x > chartFrame.right - 92 ? chartFrame.right - 8 : labelPoint.x + 10}
                    y={labelPoint.y + 4}
                  >
                    {t(metric.label)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {selectedDateVisible ? (
            <g className="journey-demo-chart-selected-date">
              <line x1={selectedX} x2={selectedX} y1={plotTop} y2={plotBottom} />
              <rect height="24" rx="6" width="86" x={selectedLabelX - 43} y={selectedLabelY} />
              <text textAnchor="middle" x={selectedLabelX} y={selectedLabelY + 17}>
                {selectedDate}
              </text>
            </g>
          ) : null}
          {visiblePoints.map((point) => (
            <g
              className="journey-demo-chart-hit"
              key={point.date}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDate(point.date);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectDate(point.date);
              }}
              role="button"
              tabIndex={0}
            >
              <rect
                fill="transparent"
                height={plotBottom - plotTop + 12}
                width="14"
                x={chartFrame.left + (datePercentInZoom(point.date, zoomRange, timelineDomain) / 100) * (chartFrame.right - chartFrame.left) - 7}
                y={plotTop - 6}
              />
            </g>
          ))}
        </svg>
        <RangeBrush
          className="journey-demo-brush--chart"
          label={t('指标趋势时间范围')}
          onChange={onZoomChange}
          range={zoomRange}
          timelineDomain={timelineDomain}
        />
      </div>
    </section>
  );
}

function JourneyEventStream({
  currentPage,
  events,
  hoveredEventId,
  onHover,
  onPageChange,
  pageSize,
  onSelect,
  selectedEvent
}: {
  currentPage: number;
  events: JourneyDemoEvent[];
  hoveredEventId: string | null;
  onHover: (eventId: string | null) => void;
  onPageChange: (page: number) => void;
  pageSize: number;
  onSelect: (event: JourneyDemoEvent) => void;
  selectedEvent: JourneyDemoEvent;
}) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, currentPage));
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(events.length, pageStart + pageSize);
  const visibleEvents = events.slice(pageStart, pageEnd);
  const selectedConfig = journeyCategoryConfig[selectedEvent.category];

  return (
    <aside className="journey-demo-card journey-demo-stream">
      <header className="journey-demo-card__header">
        <div>
          <span>Event Detail Stream</span>
          <h2>{t('事件明细流')}</h2>
        </div>
        <strong>{events.length}</strong>
      </header>
      <div className="journey-demo-selected-event" style={{ borderColor: selectedConfig.borderColor, backgroundColor: selectedConfig.softColor }}>
        <span style={{ color: selectedConfig.color }}>{t(selectedConfig.label)}</span>
        <h3>{t(selectedEvent.title)}</h3>
        <p>{t(selectedEvent.description)}</p>
        <small>
          {formatDate(selectedEvent.date)}
          {selectedEvent.endDate ? ` - ${formatDate(selectedEvent.endDate)}` : ''}
        </small>
      </div>
      <div className="journey-demo-stream-list">
        {visibleEvents.map((event) => {
          const config = journeyCategoryConfig[event.category];
          return (
            <button
              className={[
                'journey-demo-stream-item',
                event.id === selectedEvent.id ? 'is-active' : '',
                event.id === hoveredEventId ? 'is-hovered' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              key={event.id}
              onMouseEnter={() => onHover(event.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(event)}
              type="button"
            >
              <span className="journey-demo-stream-icon" style={{ color: config.color, backgroundColor: config.softColor }}>
                <Icon name={categoryIcons[event.category]} />
              </span>
              <span>
                <strong>{t(event.title)}</strong>
                <small>
                  {formatDate(event.date)}
                  {event.subtitle ? ` · ${t(event.subtitle)}` : ''}
                </small>
              </span>
              <Icon name="chevronRight" />
            </button>
          );
        })}
      </div>
      {events.length > pageSize ? (
        <div className="journey-demo-pagination" aria-label={t('事件分页')}>
          <button disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} type="button">
            {t('上一页')}
          </button>
          <div>
            <strong>
              {safePage} / {totalPages}
            </strong>
            <span>
              {pageStart + 1}-{pageEnd} / {events.length}
            </span>
          </div>
          <button disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} type="button">
            {t('下一页')}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function RangeBrush({
  className,
  label,
  onChange,
  range,
  timelineDomain
}: {
  className?: string;
  label: string;
  onChange: (range: TimelineZoomRange) => void;
  range: TimelineZoomRange;
  timelineDomain: TimelineDomain;
}) {
  const { t } = useI18n();
  const labelTicks = getBrushLabelTicks(timelineDomain);
  const ticks = getBrushTicks(timelineDomain);

  const updateStart = (value: number) => {
    onChange({ start: Math.min(clampPercent(value), range.end - 4), end: range.end });
  };
  const updateEnd = (value: number) => {
    onChange({ start: range.start, end: Math.max(clampPercent(value), range.start + 4) });
  };

  return (
    <div className={['journey-demo-brush', className].filter(Boolean).join(' ')}>
      <div className="journey-demo-brush__date-pills">
        <span style={{ left: `${range.start}%` }}>{percentToDate(range.start, timelineDomain)}</span>
        <span style={{ left: `${range.end}%` }}>{percentToDate(range.end, timelineDomain)}</span>
      </div>
      <div className="journey-demo-brush__rail">
        <div className="journey-demo-brush__ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <i className={tick.major ? 'is-major' : ''} key={tick.id} style={{ left: `${tick.percent}%` }} />
          ))}
        </div>
        <span className="journey-demo-brush__selection" style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }} />
        <input
          aria-label={`${t(label)} ${t('开始')}`}
          max="100"
          min="0"
          onChange={(event) => updateStart(Number(event.target.value))}
          type="range"
          value={range.start}
        />
        <input
          aria-label={`${t(label)} ${t('结束')}`}
          max="100"
          min="0"
          onChange={(event) => updateEnd(Number(event.target.value))}
          type="range"
          value={range.end}
        />
      </div>
      <div className="journey-demo-brush__labels">
        {labelTicks.map((tick) => (
          <span key={tick.label} style={{ left: `${tick.percent}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
