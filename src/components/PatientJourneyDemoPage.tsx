import { useEffect, useMemo, useRef, useState, type CSSProperties, type ElementRef, type PointerEvent } from 'react';
import {
  journeyBiomarkerPoints,
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
import { getSelectedPatient } from '../data/operations';
import { patientRecords, type PatientRecord } from '../data/patientCohort';
import { fetchDemoDataset } from '../services/api';
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
  protein24h: 108,
  igg: 62
};

const chartLayout = {
  minWidth: 820,
  labelColumn: 118,
  top: 78,
  laneGap: 35,
  amplitude: 22
};

type TimelineZoomRange = { start: number; end: number };
type ChartFrame = {
  left: number;
  right: number;
  top: number;
  laneGap: number;
  amplitude: number;
};

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

function datePercent(date: string) {
  const start = Date.parse(journeyStart);
  const end = Date.parse(journeyEnd);
  const current = Date.parse(date);
  if (Number.isNaN(current)) return 0;
  return Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100));
}

function percentToDate(percent: number) {
  const start = Date.parse(journeyStart);
  const end = Date.parse(journeyEnd);
  return new Date(start + (end - start) * (clampPercent(percent) / 100)).toISOString().slice(0, 10);
}

function dateFromZoomPercent(localPercent: number, zoomRange: TimelineZoomRange) {
  const globalPercent = zoomRange.start + (clampPercent(localPercent) / 100) * Math.max(1, zoomRange.end - zoomRange.start);
  return percentToDate(globalPercent);
}

function datePercentInZoom(date: string, zoomRange: TimelineZoomRange) {
  const zoomWidth = Math.max(1, zoomRange.end - zoomRange.start);
  return clampPercent(((datePercent(date) - zoomRange.start) / zoomWidth) * 100);
}

function dateIsVisible(date: string, zoomRange: TimelineZoomRange) {
  const percent = datePercent(date);
  return percent >= zoomRange.start && percent <= zoomRange.end;
}

function eventIntersectsZoom(event: JourneyDemoEvent, zoomRange: TimelineZoomRange) {
  const start = datePercent(event.date);
  const end = datePercent(event.endDate ?? event.date);
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

function nearestBiomarker(date: string) {
  const target = Date.parse(date);
  return journeyBiomarkerPoints.reduce((nearest, point) => {
    const currentGap = Math.abs(Date.parse(point.date) - target);
    const nearestGap = Math.abs(Date.parse(nearest.date) - target);
    return currentGap < nearestGap ? point : nearest;
  }, journeyBiomarkerPoints[0]);
}

function getNearestEvent(events: JourneyDemoEvent[], date: string) {
  const target = Date.parse(date);
  if (!events.length || Number.isNaN(target)) return journeyDemoEvents[0];
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

function getVisibleBiomarkerPoints(zoomRange: TimelineZoomRange) {
  return journeyBiomarkerPoints.filter((point) => dateIsVisible(point.date, zoomRange));
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
  frame: ChartFrame
) {
  const width = frame.right - frame.left;
  const value = Math.min(1, Math.max(0, Number(point[metric.key]) / metric.max));
  return {
    x: frame.left + (datePercentInZoom(point.date, zoomRange) / 100) * width,
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
  frame: ChartFrame
) {
  return points
    .map((point) => {
      const { x, y } = getTrendPoint(metric, metricIndex, point, zoomRange, frame);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getTimelineTicks(zoomRange: TimelineZoomRange) {
  const ticks: Array<{ label: string; percent: number }> = [];
  for (let year = 2022; year <= 2024; year += 1) {
    [1, 4, 7, 10].forEach((month, index) => {
      const date = `${year}-${String(month).padStart(2, '0')}-01`;
      if (dateIsVisible(date, zoomRange)) {
        ticks.push({ label: `${year} Q${index + 1}`, percent: datePercentInZoom(date, zoomRange) });
      }
    });
  }
  return ticks;
}

function getBrushYearTicks() {
  return [2022, 2023, 2024].map((year) => ({
    label: String(year),
    percent: datePercent(`${year}-01-01`)
  }));
}

function getBrushMonthTicks() {
  const ticks: Array<{ id: string; percent: number; major: boolean }> = [];
  for (let year = 2022; year <= 2024; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const id = `${year}-${String(month).padStart(2, '0')}`;
      ticks.push({ id, percent: datePercent(`${id}-01`), major: month === 1 || month === 4 || month === 7 || month === 10 });
    }
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

export function PatientJourneyDemoPage({ selectedPatient }: { selectedPatient?: PatientRecord | null }) {
  const initialPatient = getSelectedPatient(selectedPatient);
  const [patients, setPatients] = useState<PatientRecord[]>(patientRecords);
  const [activePatient, setActivePatient] = useState<PatientRecord>(initialPatient);
  const [patientQuery, setPatientQuery] = useState('');
  const [enabledCategories, setEnabledCategories] = useState<JourneyEventCategory[]>(categoryOrder);
  const [query, setQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>('evt-v2');
  const [selectedDate, setSelectedDate] = useState('2024-06-01');
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
        setActivePatient((current) => {
          if (selectedPatient) return selectedPatient;
          return dataset.patients.find((item) => item.name === current.name) ?? dataset.patients[0];
        });
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedPatient) {
      setActivePatient(selectedPatient);
      setPatientQuery('');
    }
  }, [selectedPatient]);

  const patientMatches = useMemo(() => {
    const normalized = patientQuery.trim().toLowerCase();
    if (!normalized) return patients.slice(0, 5);

    return patients
      .filter((item) =>
        [item.name, item.hospitalNo, item.diseaseType, item.sex, item.organs.join(' ')]
          .some((value) => value.toLowerCase().includes(normalized))
      )
      .slice(0, 6);
  }, [patientQuery, patients]);

  const filteredEvents = useMemo(
    () => journeyDemoEvents.filter((event) => enabledCategories.includes(event.category) && matchesEventQuery(event, query)),
    [enabledCategories, query]
  );
  const streamEvents = useMemo(() => getOrderedStreamEvents(filteredEvents), [filteredEvents]);
  const streamPageCount = Math.max(1, Math.ceil(streamEvents.length / streamPageSize));
  const safeStreamPage = Math.min(streamPage, streamPageCount);
  const selectedEvent =
    (selectedEventId ? journeyDemoEvents.find((event) => event.id === selectedEventId) : null) ??
    getNearestEvent(filteredEvents, selectedDate) ??
    journeyDemoEvents[0];
  const currentPoint = nearestBiomarker(selectedDate);

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
    setEnabledCategories(categoryOrder);
    setQuery('');
    setSelectedEventId('evt-v2');
    setSelectedDate('2024-06-01');
    setStreamPage(1);
    setZoomRange({ start: 0, end: 100 });
    setHoveredEventId(null);
  };

  return (
    <div className="content workspace-page patient-journey-demo">
      <section className="journey-demo-toolbar">
        <div className="journey-demo-patient">
          <div className="journey-demo-avatar">PJ</div>
          <div>
            <h2>临床 Patient Journey</h2>
            <p>
              LGL-1111 / {patient.name} · {patient.sex} · {patient.age}岁 · {patient.diseaseType}
            </p>
          </div>
        </div>
        <div className="journey-demo-patient-picker">
          <label className="journey-demo-search journey-demo-patient-search">
            <Icon name="search" />
            <input
              onChange={(event) => setPatientQuery(event.target.value)}
              placeholder="查找患者编号、住院号或疾病类型"
              value={patientQuery}
            />
          </label>
          <div className="journey-demo-patient-results" aria-label="患者查找结果">
            {patientMatches.map((item) => (
              <button
                className={item.name === patient.name ? 'is-active' : undefined}
                key={`${item.studyId}-${item.name}`}
                onClick={() => {
                  setActivePatient(item);
                  setPatientQuery('');
                }}
                type="button"
              >
                <strong>{item.name}</strong>
                <span>{item.hospitalNo} · {item.diseaseType}</span>
              </button>
            ))}
            {!patientMatches.length ? <span className="journey-demo-patient-empty">无匹配患者</span> : null}
          </div>
        </div>
        <div className="journey-demo-categories" aria-label="旅程事件分类筛选">
          {categoryOrder.map((category) => {
            const config = journeyCategoryConfig[category];
            const active = enabledCategories.includes(category);
            return (
              <button
                className={active ? 'journey-demo-category is-active' : 'journey-demo-category'}
                key={category}
                onClick={() => toggleCategory(category)}
                style={{
                  color: active ? config.color : undefined,
                  backgroundColor: active ? config.softColor : undefined,
                  borderColor: active ? config.borderColor : undefined
                }}
                type="button"
              >
                <Icon name={categoryIcons[category]} />
                {config.label}
              </button>
            );
          })}
        </div>
        <div className="journey-demo-actions">
          <label className="journey-demo-search">
            <Icon name="search" />
            <input
              onChange={(event) => {
                setQuery(event.target.value);
                setStreamPage(1);
              }}
              placeholder="搜索事件、治疗或样本"
              value={query}
            />
          </label>
          <button className="module-link-button" onClick={resetView} type="button">
            <Icon name="clock" />
            重置视图
          </button>
        </div>
      </section>

      <section className="journey-demo-grid">
        <div className="journey-demo-main">
          <JourneyTimeline
            events={filteredEvents}
            hoveredEventId={hoveredEventId}
            onHover={setHoveredEventId}
            onSelect={selectEvent}
            onZoomChange={setZoomRange}
            selectedDate={selectedDate}
            selectedEventId={selectedEvent.id}
            zoomRange={zoomRange}
          />
          <JourneyBiomarkers
            currentPoint={currentPoint}
            onSelectDate={selectDate}
            onZoomChange={setZoomRange}
            selectedDate={selectedDate}
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
  events,
  hoveredEventId,
  onHover,
  onSelect,
  onZoomChange,
  selectedDate,
  selectedEventId,
  zoomRange
}: {
  events: JourneyDemoEvent[];
  hoveredEventId: string | null;
  onHover: (eventId: string | null) => void;
  onSelect: (event: JourneyDemoEvent) => void;
  onZoomChange: (range: TimelineZoomRange) => void;
  selectedDate: string;
  selectedEventId: string;
  zoomRange: TimelineZoomRange;
}) {
  const visibleEvents = events.filter((event) => eventIntersectsZoom(event, zoomRange));
  const selectedDateVisible = dateIsVisible(selectedDate, zoomRange);
  const selectedDatePosition = datePercentInZoom(selectedDate, zoomRange);
  const ticks = getTimelineTicks(zoomRange);

  return (
    <section className="journey-demo-card journey-demo-timeline-card">
      <header className="journey-demo-card__header">
        <div>
          <span>Multi-track Event Timeline</span>
          <h2>多轨临床事件轴</h2>
        </div>
        <strong>{visibleEvents.length}</strong>
      </header>
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
              <div className="journey-demo-track-label">{track}</div>
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
                        left: `${Math.min(datePercentInZoom(event.date, zoomRange), datePercentInZoom(event.endDate ?? event.date, zoomRange))}%`,
                        width: `${Math.max(
                          Math.abs(datePercentInZoom(event.endDate ?? event.date, zoomRange) - datePercentInZoom(event.date, zoomRange)),
                          3
                        )}%`,
                        backgroundColor: event.softColor,
                        borderColor: event.borderColor,
                        color: event.color
                      }}
                      title={`${event.title} ${event.subtitle ?? ''}`}
                      type="button"
                    >
                      {event.title}
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
                        left: `${datePercentInZoom(event.date, zoomRange)}%`,
                        backgroundColor: event.softColor,
                        borderColor: event.borderColor,
                        color: event.color
                      }}
                      title={`${event.title} ${event.date}`}
                      type="button"
                    >
                      <span>{event.title}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      <RangeBrush className="journey-demo-brush--timeline" label="患者旅程时间范围" onChange={onZoomChange} range={zoomRange} />
    </section>
  );
}

function JourneyBiomarkers({
  currentPoint,
  onSelectDate,
  onZoomChange,
  selectedDate,
  zoomRange
}: {
  currentPoint: JourneyBiomarkerPoint;
  onSelectDate: (date: string) => void;
  onZoomChange: (range: TimelineZoomRange) => void;
  selectedDate: string;
  zoomRange: TimelineZoomRange;
}) {
  const [chartRef, chartWidth] = useElementWidth(chartLayout.minWidth);
  const chartFrame = getChartFrame(chartWidth);
  const visiblePoints = getVisibleBiomarkerPoints(zoomRange);
  const selectedDateVisible = dateIsVisible(selectedDate, zoomRange);
  const selectedX = chartFrame.left + (datePercentInZoom(selectedDate, zoomRange) / 100) * (chartFrame.right - chartFrame.left);
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
    onSelectDate(dateFromZoomPercent(((viewX - chartFrame.left) / (chartFrame.right - chartFrame.left)) * 100, zoomRange));
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
            <h2>关键指标趋势</h2>
            <div className="journey-demo-metrics">
              {metricLines.map((metric) => (
                <div
                  className="journey-demo-metric"
                  key={metric.key}
                  style={{ '--metric-color': metric.color } as CSSProperties}
                >
                  <span>{metric.label}</span>
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
          指标日期
          <input max={journeyEnd} min={journeyStart} onChange={(event) => onSelectDate(event.target.value)} type="date" value={selectedDate} />
        </label>
      </header>
      <div className="journey-demo-chart" ref={chartRef}>
        <svg
          aria-label="患者关键指标趋势"
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
                  {metric.label}
                </text>
              </g>
            ))}
            <g transform={`translate(${selectedLegendX}, 0)`}>
              <circle cx="4" cy="0" fill="rgba(47, 120, 255, 0.78)" r="4" />
              <text x="14" y="4">
                选中时间点
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
            const labelPoint = lastPoint ? getTrendPoint(metric, metricIndex, lastPoint, zoomRange, chartFrame) : null;
            const linePoints = buildTrendLine(metric, metricIndex, visiblePoints, zoomRange, chartFrame);
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
                  const trendPoint = getTrendPoint(metric, metricIndex, point, zoomRange, chartFrame);
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
                    {metric.label}
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
                x={chartFrame.left + (datePercentInZoom(point.date, zoomRange) / 100) * (chartFrame.right - chartFrame.left) - 7}
                y={plotTop - 6}
              />
            </g>
          ))}
        </svg>
        <RangeBrush className="journey-demo-brush--chart" label="指标趋势时间范围" onChange={onZoomChange} range={zoomRange} />
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
          <h2>事件明细流</h2>
        </div>
        <strong>{events.length}</strong>
      </header>
      <div className="journey-demo-selected-event" style={{ borderColor: selectedConfig.borderColor, backgroundColor: selectedConfig.softColor }}>
        <span style={{ color: selectedConfig.color }}>{selectedConfig.label}</span>
        <h3>{selectedEvent.title}</h3>
        <p>{selectedEvent.description}</p>
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
                <strong>{event.title}</strong>
                <small>
                  {formatDate(event.date)}
                  {event.subtitle ? ` · ${event.subtitle}` : ''}
                </small>
              </span>
              <Icon name="chevronRight" />
            </button>
          );
        })}
      </div>
      {events.length > pageSize ? (
        <div className="journey-demo-pagination" aria-label="事件分页">
          <button disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} type="button">
            上一页
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
            下一页
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
  range
}: {
  className?: string;
  label: string;
  onChange: (range: TimelineZoomRange) => void;
  range: TimelineZoomRange;
}) {
  const years = getBrushYearTicks();
  const months = getBrushMonthTicks();

  const updateStart = (value: number) => {
    onChange({ start: Math.min(clampPercent(value), range.end - 4), end: range.end });
  };
  const updateEnd = (value: number) => {
    onChange({ start: range.start, end: Math.max(clampPercent(value), range.start + 4) });
  };

  return (
    <div className={['journey-demo-brush', className].filter(Boolean).join(' ')}>
      <div className="journey-demo-brush__date-pills">
        <span style={{ left: `${range.start}%` }}>{percentToDate(range.start)}</span>
        <span style={{ left: `${range.end}%` }}>{percentToDate(range.end)}</span>
      </div>
      <div className="journey-demo-brush__rail">
        <div className="journey-demo-brush__ticks" aria-hidden="true">
          {months.map((tick) => (
            <i className={tick.major ? 'is-major' : ''} key={tick.id} style={{ left: `${tick.percent}%` }} />
          ))}
        </div>
        <span className="journey-demo-brush__selection" style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }} />
        <input
          aria-label={`${label}开始`}
          max="100"
          min="0"
          onChange={(event) => updateStart(Number(event.target.value))}
          type="range"
          value={range.start}
        />
        <input
          aria-label={`${label}结束`}
          max="100"
          min="0"
          onChange={(event) => updateEnd(Number(event.target.value))}
          type="range"
          value={range.end}
        />
      </div>
      <div className="journey-demo-brush__labels">
        {years.map((tick) => (
          <span key={tick.label} style={{ left: `${tick.percent}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
